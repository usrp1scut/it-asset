import io
import uuid
from datetime import UTC, datetime

import segno
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.core.storage import get_object, put_object, remove_object
from app.deps import get_db, require_roles
from app.modules.assets import importer, labels, service
from app.modules.assets.models import Asset, AssetClass, AssetType
from app.modules.assets.schemas import (
    AccessoryOut,
    AssetCreate,
    AssetDetailOut,
    AssetListResponse,
    AssetOut,
    AssetUpdate,
    AssignIn,
    AttachmentOut,
    BindAccessoriesIn,
    ChangeLogOut,
    NoteIn,
    ReasonIn,
    TransferIn,
)
from app.modules.assets.state_machine import (
    IllegalTransition,
    InfrastructureNotAssignable,
)
from app.modules.users.models import Role, User

router = APIRouter(prefix="/api/assets", tags=["assets"])

# Read = any staff role; write = IT admin (sys_admin always passes via require_roles).
staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)
it_admin = require_roles(Role.it_admin)


def _detail(db: Session, code: str) -> AssetDetailOut:
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    return AssetDetailOut(
        asset=AssetOut.model_validate(asset),
        lifecycle=[ChangeLogOut.model_validate(x) for x in service.lifecycle(db, asset.id)],
        accessories=[AccessoryOut.model_validate(x) for x in service.accessories(db, asset.id)],
    )


@router.get("", response_model=AssetListResponse)
def list_assets(
    db: Session = Depends(get_db),
    _: User = Depends(staff),
    status_: str | None = Query(None, alias="status"),
    asset_class: str | None = None,
    type_id: int | None = None,
    department_id: int | None = None,
    q: str | None = None,
    needs_review: bool | None = None,
    scrap_candidate: bool | None = None,
    page: int = 1,
    size: int = 20,
):
    total, rows = service.list_assets(
        db, status=status_, asset_class=asset_class, type_id=type_id,
        department_id=department_id, q=q, needs_review=needs_review,
        scrap_candidate=scrap_candidate, page=page, size=size,
    )
    return AssetListResponse(total=total, items=[AssetOut.model_validate(r) for r in rows])


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(body: AssetCreate, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    data = body.model_dump(exclude={"prefix"})
    prefix = body.prefix
    # The asset_type drives both the code prefix and the personal /
    # infrastructure split; when provided it overrides any body values.
    # The legacy (asset_class + prefix) pair stays accepted so the
    # Phase-0 importer keeps working.
    if body.asset_type_id is not None:
        t = db.get(AssetType, body.asset_type_id)
        if t is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "资产类型不存在")
        prefix = t.code_prefix
        data["asset_class"] = t.asset_class
    if not prefix or data.get("asset_class") is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "请选择资产类型,或同时提供 asset_class 与 prefix",
        )
    asset = service.create_asset(db, data, prefix, user.id)
    write_audit(db, actor_user_id=user.id, action="asset.create",
                resource_type="asset", resource_id=asset.asset_code)
    return AssetOut.model_validate(asset)


@router.post("/import")
async def import_assets(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    """Phase 0 — 导入云文档/Excel(容脏,脏数据进 needs_review,不卡门)。"""
    content = await file.read()
    rows = importer.parse_workbook(content)
    summary = importer.import_rows(db, rows, user.id)
    write_audit(db, actor_user_id=user.id, action="asset.import",
                resource_type="asset", payload=summary)
    return summary


@router.get("/export")
def export_assets(db: Session = Depends(get_db), _: User = Depends(it_admin)):
    """导出带编号清单(供 IT 打印贴标 / 回写云文档)。"""
    data = importer.export_workbook(db)
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=assets.xlsx"},
    )


class LabelsIn(BaseModel):
    codes: list[str]
    # Layout key from labels.LAYOUTS — `compact` (4×8), `standard` (3×6),
    # `large` (2×4). Defaults to compact.
    layout: str = labels.DEFAULT_LAYOUT


@router.get("/labels/layouts")
def label_layouts(_: User = Depends(it_admin)):
    """List the label-layout presets the frontend offers in its picker."""
    return labels.list_layouts()


@router.post("/labels")
def print_labels(
    body: LabelsIn, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    """A4 PDF: QR + asset_code + brand_model + spec + owner.

    `body.layout` selects density — see labels.LAYOUTS.
    """
    codes = [c.strip() for c in body.codes if c and c.strip()]
    if not codes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "请至少选择一个资产")
    if len(codes) > 500:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "单次最多 500 个")
    if body.layout not in labels.LAYOUTS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"未知布局 {body.layout!r}(可选: {', '.join(labels.LAYOUTS)})",
        )
    # Fetch the full asset records (one query) so the label text uses the
    # latest owner / brand / spec snapshot.
    assets = db.scalars(
        select(Asset).where(Asset.asset_code.in_(codes), Asset.deleted_at.is_(None))
    ).all()
    found = {a.asset_code: a for a in assets}
    missing = [c for c in codes if c not in found]
    if missing:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"以下资产编号不存在: {', '.join(missing[:5])}"
        )
    # Preserve the caller's order, not the DB's.
    rows = [
        labels.LabelRow(
            asset_code=found[c].asset_code,
            brand_model=found[c].brand_model,
            spec=found[c].spec,
            owner_name=found[c].owner_name,
            department_name=found[c].department_name,
        )
        for c in codes
    ]
    pdf = labels.render_labels_pdf(rows, layout_id=body.layout)
    write_audit(db, actor_user_id=user.id, action="asset.labels.print",
                resource_type="asset",
                payload={"count": len(codes), "layout": body.layout})
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="asset-labels.pdf"'},
    )


@router.get("/migration-stats")
def migration_stats(db: Session = Depends(get_db), _: User = Depends(staff)):
    return importer.stats(db)


@router.post("/rematch")
def rematch(db: Session = Depends(get_db), user: User = Depends(it_admin)):
    """Re-resolve owner/department on needs_review assets (post contact-sync)."""
    summary = importer.rematch_dirty(db)
    write_audit(db, actor_user_id=user.id, action="asset.rematch",
                resource_type="asset", payload=summary)
    return summary


@router.get("/{code}", response_model=AssetDetailOut)
def get_detail(code: str, db: Session = Depends(get_db), _: User = Depends(staff)):
    return _detail(db, code)


@router.get("/{code}/qrcode")
def asset_qrcode(code: str, db: Session = Depends(get_db), _: User = Depends(staff)):
    """SVG QR. Payload is a deep-link URL when PUBLIC_BASE_URL is configured,
    else plain asset_code (scanner shows text but can't tap)."""
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    buf = io.BytesIO()
    # micro=False forces a standard QR (3 finder patterns) — without this,
    # segno picks a Micro QR (1 finder pattern) when the payload is short
    # enough to fit (e.g., bare "PC-0002" when PUBLIC_BASE_URL is unset).
    # Lark scanCode + most generic scanners don't decode Micro QR, so the
    # user sees just the top-left finder block and can't scan.
    segno.make(service.qr_payload(asset.asset_code), error="m", micro=False).save(
        buf, kind="svg", scale=4, border=2
    )
    return Response(content=buf.getvalue(), media_type="image/svg+xml")


_ATTACH_TYPES = {
    "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    "application/pdf",
}
_ATTACH_MAX = 10 * 1024 * 1024  # 10 MB


def _safe_name(name: str | None) -> str:
    base = (name or "file").replace("\\", "/").split("/")[-1]
    cleaned = "".join(c for c in base if c.isalnum() or c in "._- ").strip()
    return cleaned[:120] or "file"


def _attachments(asset) -> list[dict]:
    return [a for a in (asset.photo_urls or []) if isinstance(a, dict)]


@router.get("/{code}/attachments", response_model=list[AttachmentOut])
def list_attachments(code: str, db: Session = Depends(get_db), _: User = Depends(staff)):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    return [AttachmentOut(**a) for a in _attachments(asset)]


@router.post("/{code}/attachments", response_model=list[AttachmentOut],
             status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    code: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    ctype = (file.content_type or "").lower()
    if ctype not in _ATTACH_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"不支持的文件类型: {ctype}")
    data = await file.read()
    if len(data) > _ATTACH_MAX:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "文件超过 10MB 上限")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "空文件")
    name = _safe_name(file.filename)
    key = f"assets/{asset.asset_code}/{uuid.uuid4().hex}-{name}"
    put_object(key, data, ctype)
    desc = {
        "key": key,
        "name": name,
        "content_type": ctype,
        "size": len(data),
        "uploaded_at": datetime.now(UTC).isoformat(),
    }
    asset.photo_urls = [*_attachments(asset), desc]
    db.commit()
    db.refresh(asset)
    write_audit(db, actor_user_id=user.id, action="asset.attachment.add",
                resource_type="asset", resource_id=code)
    return [AttachmentOut(**a) for a in _attachments(asset)]


@router.get("/{code}/attachments/raw")
def get_attachment(
    code: str, key: str = Query(...), db: Session = Depends(get_db),
    _: User = Depends(staff),
):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    match = next((a for a in _attachments(asset) if a["key"] == key), None)
    if match is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "attachment not found")
    data = get_object(key)
    return Response(
        content=data,
        media_type=match["content_type"],
        headers={"Content-Disposition": f'inline; filename="{match["name"]}"'},
    )


@router.delete("/{code}/attachments")
def delete_attachment(
    code: str, key: str = Query(...), db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    rest = [a for a in _attachments(asset) if a["key"] != key]
    if len(rest) == len(_attachments(asset)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "attachment not found")
    remove_object(key)
    asset.photo_urls = rest
    db.commit()
    write_audit(db, actor_user_id=user.id, action="asset.attachment.remove",
                resource_type="asset", resource_id=code)
    return {"ok": True}


@router.put("/{code}", response_model=AssetOut)
def update_asset(
    code: str, body: AssetUpdate, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    fields = body.model_dump(exclude_unset=True)
    # On a personal asset, owner_name / department_name are derived from the
    # assigned directory user (set via assign / transfer) — a free-text edit
    # must not desync them. Infrastructure can't be assigned, so its text
    # owner / department stay editable here.
    if asset.asset_class != AssetClass.infrastructure:
        fields.pop("owner_name", None)
        fields.pop("department_name", None)
    for k, v in fields.items():
        setattr(asset, k, v)
    db.commit()
    db.refresh(asset)
    write_audit(db, actor_user_id=user.id, action="asset.update",
                resource_type="asset", resource_id=code)
    return AssetOut.model_validate(asset)


def _load(db: Session, code: str):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "asset not found")
    return asset


@router.delete("/{code}")
def delete_asset(code: str, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    """Soft-delete an asset — drops it from the ledger (recoverable in DB)."""
    asset = _load(db, code)
    service.delete_asset(db, asset, user.id)
    write_audit(db, actor_user_id=user.id, action="asset.delete",
                resource_type="asset", resource_id=code)
    return {"ok": True}


@router.post("/{code}/assign", response_model=AssetOut)
def assign(
    code: str, body: AssignIn, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    asset = _load(db, code)
    try:
        asset = service.assign(db, asset, body.user_id, user.id, body.note)
    except (IllegalTransition, InfrastructureNotAssignable) as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return AssetOut.model_validate(asset)


@router.post("/{code}/return", response_model=AssetOut)
def return_asset(
    code: str, body: NoteIn, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    asset = _load(db, code)
    try:
        asset = service.return_asset(db, asset, user.id, body.note)
    except (IllegalTransition, InfrastructureNotAssignable) as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return AssetOut.model_validate(asset)


@router.post("/{code}/transfer", response_model=AssetOut)
def transfer(
    code: str, body: TransferIn, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    asset = _load(db, code)
    try:
        asset = service.transfer(db, asset, body.to_user_id, user.id, body.reason)
    except (IllegalTransition, InfrastructureNotAssignable) as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return AssetOut.model_validate(asset)


@router.post("/{code}/repair", response_model=AssetOut)
def repair(
    code: str, body: ReasonIn, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    asset = _load(db, code)
    try:
        asset = service.repair(db, asset, user.id, body.reason)
    except IllegalTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return AssetOut.model_validate(asset)


@router.post("/{code}/scrap", response_model=AssetOut)
def scrap(code: str, body: ReasonIn, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    asset = _load(db, code)
    try:
        asset = service.scrap(db, asset, user.id, body.reason)
    except IllegalTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="asset.scrap",
                resource_type="asset", resource_id=code)
    return AssetOut.model_validate(asset)


@router.post("/{code}/accessories", response_model=AssetDetailOut)
def bind_accessories(
    code: str, body: BindAccessoriesIn, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    main = _load(db, code)
    service.bind_accessories(db, main, body.child_ids)
    return _detail(db, code)

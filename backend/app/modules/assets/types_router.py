"""Asset-type CRUD — drives the prefix and asset_class for new assets.

Kept in its own router so the `/api/asset-types` URL stays clean (the main
assets router has a `/api/assets` prefix). Mirrors the inventory module's
ItemCategory CRUD: it_admin writes, any staff role reads, delete refused
while live assets still reference the type.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.assets.models import Asset, AssetType
from app.modules.assets.schemas import AssetTypeCreate, AssetTypeOut, AssetTypeUpdate
from app.modules.users.models import Role, User

router = APIRouter(prefix="/api/asset-types", tags=["asset-types"])
staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)
it_admin = require_roles(Role.it_admin)


def _with_count(db: Session, t: AssetType) -> AssetTypeOut:
    o = AssetTypeOut.model_validate(t)
    o.asset_count = db.scalar(
        select(func.count()).select_from(Asset).where(
            Asset.asset_type_id == t.id, Asset.deleted_at.is_(None)
        )
    ) or 0
    return o


@router.get("", response_model=list[AssetTypeOut])
def list_asset_types(db: Session = Depends(get_db), _: User = Depends(staff)):
    types = db.scalars(select(AssetType).order_by(AssetType.code_prefix)).all()
    return [_with_count(db, t) for t in types]


@router.post("", response_model=AssetTypeOut, status_code=status.HTTP_201_CREATED)
def create_asset_type(
    body: AssetTypeCreate, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    code = body.code_prefix.strip().upper()
    if not code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "编号前缀不能为空")
    t = AssetType(
        name=body.name,
        code_prefix=code,
        asset_class=body.asset_class,
        depreciation_years=body.depreciation_years,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    write_audit(db, actor_user_id=user.id, action="asset_type.create",
                resource_type="asset_type", resource_id=str(t.id))
    return _with_count(db, t)


@router.put("/{type_id}", response_model=AssetTypeOut)
def update_asset_type(
    type_id: int,
    body: AssetTypeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    t = db.get(AssetType, type_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "类型不存在")
    if body.name is not None:
        t.name = body.name
    if body.code_prefix is not None:
        code = body.code_prefix.strip().upper()
        if not code:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "编号前缀不能为空")
        t.code_prefix = code
    if body.asset_class is not None:
        t.asset_class = body.asset_class
    if body.depreciation_years is not None:
        t.depreciation_years = body.depreciation_years
    db.commit()
    db.refresh(t)
    write_audit(db, actor_user_id=user.id, action="asset_type.update",
                resource_type="asset_type", resource_id=str(t.id))
    return _with_count(db, t)


@router.delete("/{type_id}")
def delete_asset_type(
    type_id: int, db: Session = Depends(get_db), user: User = Depends(it_admin)
):
    t = db.get(AssetType, type_id)
    if t is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "类型不存在")
    n = db.scalar(
        select(func.count()).select_from(Asset).where(
            Asset.asset_type_id == type_id, Asset.deleted_at.is_(None)
        )
    ) or 0
    if n:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"该类型下还有 {n} 个资产,请先转走再删除"
        )
    db.delete(t)
    db.commit()
    write_audit(db, actor_user_id=user.id, action="asset_type.delete",
                resource_type="asset_type", resource_id=str(type_id))
    return {"ok": True}

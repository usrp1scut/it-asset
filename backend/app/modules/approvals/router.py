from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_roles
from app.lark.security import WebhookAuthError, process_webhook
from app.modules.approvals import service
from app.modules.approvals.schemas import (
    ApprovalItemOut,
    ApprovalOut,
    AutoRuleIn,
    AutoRuleOut,
    BatchDecisionIn,
    CreateRequestIn,
    DecisionIn,
)
from app.modules.approvals.models import ApprovalRequest
from app.modules.assets.models import Asset, AssetType
from app.modules.inventory.models import EmployeeItemIssue, Sku
from app.modules.inventory.service import InsufficientStock
from app.modules.users.models import Role, User

router = APIRouter(tags=["approvals"])
approver = require_roles(Role.manager, Role.it_admin)
it_admin = require_roles(Role.it_admin, Role.procurement)


def _item_out(it: dict, skus: dict) -> ApprovalItemOut:
    s = skus.get(it.get("sku_id"))
    return ApprovalItemOut(
        sku_id=it.get("sku_id"),
        qty=it.get("qty", 0),
        sku_code=s.sku_code if s else None,
        name=s.name if s else None,
        spec=s.spec if s else None,
        unit=s.unit if s else None,
    )


def _outs(db: Session, reqs: list[ApprovalRequest]) -> list[ApprovalOut]:
    """Enrich requests with requester/approver names + SKU names in one pass."""
    user_ids = {r.requester_id for r in reqs} | {r.decided_by for r in reqs if r.decided_by}
    sku_ids = {
        it["sku_id"]
        for r in reqs
        for it in (r.payload_json or {}).get("items", [])
        if it.get("sku_id")
    }
    names = (
        {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(user_ids)))}
        if user_ids else {}
    )
    skus = (
        {s.id: s for s in db.scalars(select(Sku).where(Sku.id.in_(sku_ids)))}
        if sku_ids else {}
    )
    out: list[ApprovalOut] = []
    for r in reqs:
        o = ApprovalOut.model_validate(r)
        o.requester_name = names.get(r.requester_id)
        o.approver_name = names.get(r.decided_by) if r.decided_by else None
        o.items = [_item_out(it, skus) for it in (r.payload_json or {}).get("items", [])]
        out.append(o)
    return out


def _out(db: Session, req: ApprovalRequest) -> ApprovalOut:
    return _outs(db, [req])[0]


# ── Employee mobile (H5) ─────────────────────────────────────────────────────


@router.get("/api/m/me")
def my_overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assets = db.scalars(
        select(Asset).where(Asset.owner_user_id == user.id, Asset.deleted_at.is_(None))
    ).all()
    type_ids = {a.asset_type_id for a in assets if a.asset_type_id is not None}
    types: dict[int, AssetType] = {}
    if type_ids:
        types = {
            t.id: t
            for t in db.scalars(select(AssetType).where(AssetType.id.in_(type_ids)))
        }
    issues = db.scalars(
        select(EmployeeItemIssue)
        .where(EmployeeItemIssue.user_id == user.id)
        .order_by(EmployeeItemIssue.created_at.desc())
        .limit(10)
    ).all()
    my_reqs = service.list_mine(db, user)
    return {
        "user": {"id": user.id, "name": user.name, "role": user.role.value},
        "assets": [
            {
                "asset_code": a.asset_code,
                "brand_model": a.brand_model,
                "status": a.status.value,
                "asset_type_name": (t.name if (t := types.get(a.asset_type_id)) else None),
                "asset_type_icon": (t.icon if t else None),
                "asset_type_color": (t.color if t else None),
            }
            for a in assets
        ],
        "issues": [
            {"sku_id": i.sku_id, "quantity": i.quantity, "status": i.status.value,
             "created_at": i.created_at.isoformat()}
            for i in issues
        ],
        "pending_todos": sum(1 for r in my_reqs if r.status.value in ("pending", "approved")),
    }


@router.get("/api/m/skus")
def issuable_skus(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.modules.inventory.service import total_available

    out = []
    for s in db.scalars(select(Sku).where(Sku.status == "active")):
        avail = total_available(db, s.id)
        if avail > 0:
            out.append({"sku_id": s.id, "sku_code": s.sku_code, "name": s.name,
                        "spec": s.spec, "available": avail})
    return out


@router.post("/api/m/requests", response_model=ApprovalOut, status_code=status.HTTP_201_CREATED)
def submit_request(
    body: CreateRequestIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    payload = {
        "items": [i.model_dump() for i in body.items],
        "reason": body.reason,
        "urgency": body.urgency,
        "deliver_to": body.deliver_to,
    }
    req = service.create_request(
        db, requester=user, request_type=body.request_type, payload=payload
    )
    return _out(db, req)


# ── Approval centre (admin) ──────────────────────────────────────────────────


@router.get("/api/approvals", response_model=list[ApprovalOut])
def list_approvals(
    scope: str = "for_me",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if scope == "mine":
        rows = service.list_mine(db, user)
    elif scope == "all":
        rows = service.list_all(db)  # approval centre — every status
    else:
        rows = service.list_for_approver(db, user)
    return _outs(db, rows)


@router.post("/api/approvals/{req_id}/approve", response_model=ApprovalOut)
def approve(
    req_id: int, body: DecisionIn | None = None,
    db: Session = Depends(get_db), user: User = Depends(approver),
):
    try:
        req = service.approve(db, req_id, user, note=body.note if body else None)
    except service.ApprovalError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return _out(db, req)


@router.post("/api/approvals/{req_id}/reject", response_model=ApprovalOut)
def reject(
    req_id: int, body: DecisionIn | None = None,
    db: Session = Depends(get_db), user: User = Depends(approver),
):
    try:
        req = service.reject(db, req_id, user, note=body.note if body else None)
    except service.ApprovalError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return _out(db, req)


@router.post("/api/approvals/batch")
def batch(body: BatchDecisionIn, db: Session = Depends(get_db), user: User = Depends(approver)):
    return service.batch_decide(db, body.ids, body.action, user, body.note)


@router.get("/api/approvals/auto-rule", response_model=AutoRuleOut)
def get_auto_rule(db: Session = Depends(get_db), _: User = Depends(approver)):
    return AutoRuleOut.model_validate(service.get_auto_rule(db))


@router.put("/api/approvals/auto-rule", response_model=AutoRuleOut)
def set_auto_rule(body: AutoRuleIn, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    rule = service.get_auto_rule(db)
    rule.enabled = body.enabled
    rule.consumable_only = body.consumable_only
    rule.respect_sku_flag = body.respect_sku_flag
    rule.max_total_qty = body.max_total_qty
    rule.max_total_amount = body.max_total_amount
    rule.updated_by = user.id
    db.commit()
    db.refresh(rule)
    return AutoRuleOut.model_validate(rule)


@router.post("/api/approvals/{req_id}/fulfill", response_model=ApprovalOut)
def fulfill(req_id: int, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    try:
        req = service.fulfill(db, req_id, user)
    except InsufficientStock as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    except service.ApprovalError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    return _out(db, req)


# ── Lark webhook (event verify + interactive card callback) ──────────────────


@router.post("/api/lark/webhook")
async def lark_webhook(request: Request, db: Session = Depends(get_db)):
    """Handles Lark URL verification and interactive-card approve/reject.

    Signature / encrypt / verification-token are checked by process_webhook
    when configured. Idempotent: re-delivered callbacks for an already-decided
    request are no-ops.
    """
    raw = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    try:
        body = process_webhook(headers, raw)
    except WebhookAuthError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e)) from e

    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    action = (body.get("action") or {}).get("value") or {}
    service.apply_card_decision(db, action.get("approval_id"), action.get("decision"))
    return {"ok": True}

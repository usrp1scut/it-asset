from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_roles
from app.lark.security import WebhookAuthError, process_webhook
from app.modules.approvals import service
from app.modules.approvals.schemas import ApprovalOut, CreateRequestIn
from app.modules.assets.models import Asset
from app.modules.inventory.models import EmployeeItemIssue, Sku
from app.modules.inventory.service import InsufficientStock
from app.modules.users.models import Role, User

router = APIRouter(tags=["approvals"])
approver = require_roles(Role.manager, Role.it_admin)
it_admin = require_roles(Role.it_admin, Role.procurement)


# ── Employee mobile (H5) ─────────────────────────────────────────────────────


@router.get("/api/m/me")
def my_overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    assets = db.scalars(
        select(Asset).where(Asset.owner_user_id == user.id, Asset.deleted_at.is_(None))
    ).all()
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
            {"asset_code": a.asset_code, "brand_model": a.brand_model, "status": a.status.value}
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
    return ApprovalOut.model_validate(req)


# ── Approval centre (admin) ──────────────────────────────────────────────────


@router.get("/api/approvals", response_model=list[ApprovalOut])
def list_approvals(
    scope: str = "for_me",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        service.list_mine(db, user)
        if scope == "mine"
        else service.list_for_approver(db, user)
    )
    return [ApprovalOut.model_validate(r) for r in rows]


@router.post("/api/approvals/{req_id}/approve", response_model=ApprovalOut)
def approve(req_id: int, db: Session = Depends(get_db), user: User = Depends(approver)):
    try:
        return ApprovalOut.model_validate(service.approve(db, req_id, user))
    except service.ApprovalError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e


@router.post("/api/approvals/{req_id}/reject", response_model=ApprovalOut)
def reject(req_id: int, db: Session = Depends(get_db), user: User = Depends(approver)):
    try:
        return ApprovalOut.model_validate(service.reject(db, req_id, user))
    except service.ApprovalError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e


@router.post("/api/approvals/{req_id}/fulfill", response_model=ApprovalOut)
def fulfill(req_id: int, db: Session = Depends(get_db), user: User = Depends(it_admin)):
    try:
        return ApprovalOut.model_validate(service.fulfill(db, req_id, user))
    except InsufficientStock as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    except service.ApprovalError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e


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

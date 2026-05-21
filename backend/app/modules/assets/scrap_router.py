"""Scrap workflow endpoints (Phase 2).

POST /api/assets/{code}/scrap-request           — submit
GET  /api/scrap-requests?status=&asset_code=    — list
GET  /api/scrap-requests/{id}                   — detail
POST /api/scrap-requests/{id}/approve           — approver != proposer
POST /api/scrap-requests/{id}/reject            — approver != proposer
POST /api/scrap-requests/{id}/dispose           — final, asset → scrapped
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.assets import scrap_workflow as wf
from app.modules.assets import service
from app.modules.assets.models import Asset, ScrapRequest
from app.modules.assets.schemas import (
    ScrapRequestApproveIn,
    ScrapRequestDisposeIn,
    ScrapRequestOut,
    ScrapRequestRejectIn,
    ScrapRequestSubmitIn,
)
from app.modules.users.models import Role, User

router = APIRouter(tags=["scrap"])

# Same approver pool as user role mgmt — sys_admin passes implicitly.
approver = require_roles(Role.it_admin, Role.finance)
# Submitter pool is wider (procurement may want to retire fixtures too).
proposer = require_roles(Role.it_admin, Role.finance, Role.procurement)


def _enrich(db: Session, req: ScrapRequest) -> ScrapRequestOut:
    asset = db.get(Asset, req.asset_id)
    proposer_u = db.get(User, req.proposer_id) if req.proposer_id else None
    approver_u = db.get(User, req.approver_id) if req.approver_id else None
    return ScrapRequestOut(
        id=req.id,
        asset_id=req.asset_id,
        asset_code=asset.asset_code if asset else "",
        brand_model=asset.brand_model if asset else None,
        proposer_id=req.proposer_id,
        proposer_name=proposer_u.name if proposer_u else None,
        reason=req.reason,
        status=req.status,
        approver_id=req.approver_id,
        approver_name=approver_u.name if approver_u else None,
        approved_at=req.approved_at,
        approve_remark=req.approve_remark,
        disposition_method=req.disposition_method,
        residual_value=req.residual_value,
        disposed_by=req.disposed_by,
        disposed_at=req.disposed_at,
        disposal_remark=req.disposal_remark,
        created_at=req.created_at,
    )


@router.post("/api/assets/{code}/scrap-request", response_model=ScrapRequestOut,
             status_code=status.HTTP_201_CREATED)
def submit_scrap(
    code: str,
    body: ScrapRequestSubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(proposer),
):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "资产不存在")
    if not (body.reason or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "申请理由必填")
    try:
        req = wf.submit_request(db, asset, user.id, body.reason)
    except wf.IllegalScrapTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="scrap.submit",
                resource_type="asset", resource_id=code,
                payload={"request_id": req.id})
    return _enrich(db, req)


@router.get("/api/scrap-requests", response_model=list[ScrapRequestOut])
def list_requests(
    db: Session = Depends(get_db),
    _: User = Depends(approver),
    status_: str | None = None,
    asset_code: str | None = None,
):
    stmt = select(ScrapRequest).order_by(ScrapRequest.created_at.desc())
    if status_:
        stmt = stmt.where(ScrapRequest.status == status_)
    if asset_code:
        asset = service.get_asset(db, asset_code)
        if asset is None:
            return []
        stmt = stmt.where(ScrapRequest.asset_id == asset.id)
    return [_enrich(db, r) for r in db.scalars(stmt).all()]


@router.get("/api/scrap-requests/{req_id}", response_model=ScrapRequestOut)
def get_request(
    req_id: int, db: Session = Depends(get_db), _: User = Depends(approver)
):
    req = db.get(ScrapRequest, req_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "申请不存在")
    return _enrich(db, req)


def _load_or_404(db: Session, req_id: int) -> ScrapRequest:
    req = db.get(ScrapRequest, req_id)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "申请不存在")
    return req


@router.post("/api/scrap-requests/{req_id}/approve", response_model=ScrapRequestOut)
def approve_request(
    req_id: int, body: ScrapRequestApproveIn, db: Session = Depends(get_db),
    user: User = Depends(approver),
):
    req = _load_or_404(db, req_id)
    try:
        req = wf.approve(db, req, user.id, body.remark)
    except wf.IllegalScrapTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="scrap.approve",
                resource_type="scrap_request", resource_id=str(req_id))
    return _enrich(db, req)


@router.post("/api/scrap-requests/{req_id}/reject", response_model=ScrapRequestOut)
def reject_request(
    req_id: int, body: ScrapRequestRejectIn, db: Session = Depends(get_db),
    user: User = Depends(approver),
):
    req = _load_or_404(db, req_id)
    try:
        req = wf.reject(db, req, user.id, body.remark)
    except wf.IllegalScrapTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="scrap.reject",
                resource_type="scrap_request", resource_id=str(req_id))
    return _enrich(db, req)


@router.post("/api/scrap-requests/{req_id}/dispose", response_model=ScrapRequestOut)
def dispose_request(
    req_id: int, body: ScrapRequestDisposeIn, db: Session = Depends(get_db),
    user: User = Depends(approver),
):
    req = _load_or_404(db, req_id)
    try:
        req = wf.dispose(
            db, req, user.id, body.disposition_method, body.residual_value, body.remark
        )
    except wf.IllegalScrapTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="scrap.dispose",
                resource_type="scrap_request", resource_id=str(req_id),
                payload={"method": body.disposition_method.value,
                         "residual": str(body.residual_value or "")})
    return _enrich(db, req)

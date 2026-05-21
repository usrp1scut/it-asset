"""Repair-order endpoints (Phase 2)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.assets import repair_workflow as wf
from app.modules.assets import service
from app.modules.assets.models import Asset, RepairOrder
from app.modules.assets.schemas import (
    RepairCancelIn,
    RepairCompleteIn,
    RepairOpenIn,
    RepairOrderOut,
    RepairUpdateIn,
)
from app.modules.users.models import Role, User

router = APIRouter(tags=["repair"])
it_admin = require_roles(Role.it_admin)
staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)


def _enrich(db: Session, order: RepairOrder) -> RepairOrderOut:
    asset = db.get(Asset, order.asset_id)
    opener = db.get(User, order.opened_by) if order.opened_by else None
    return RepairOrderOut(
        id=order.id,
        asset_id=order.asset_id,
        asset_code=asset.asset_code if asset else "",
        brand_model=asset.brand_model if asset else None,
        opened_by=order.opened_by,
        opened_by_name=opener.name if opener else None,
        reason=order.reason,
        repair_type=order.repair_type,
        vendor=order.vendor,
        shipped_at=order.shipped_at,
        expected_return_at=order.expected_return_at,
        status=order.status,
        cost=order.cost,
        warranty_covered=order.warranty_covered,
        warranty_until=order.warranty_until,
        resolution=order.resolution,
        notes=order.notes,
        closed_by=order.closed_by,
        closed_at=order.closed_at,
        created_at=order.created_at,
    )


@router.post("/api/assets/{code}/repair-order", response_model=RepairOrderOut,
             status_code=status.HTTP_201_CREATED)
def open_repair(
    code: str, body: RepairOpenIn, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "资产不存在")
    if not (body.reason or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "报修原因必填")
    try:
        order = wf.open_order(
            db, asset, user.id,
            reason=body.reason, repair_type=body.repair_type, vendor=body.vendor,
            shipped_at=body.shipped_at, expected_return_at=body.expected_return_at,
            note=body.note,
        )
    except wf.IllegalRepairTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="repair.open",
                resource_type="asset", resource_id=code,
                payload={"order_id": order.id, "type": order.repair_type.value})
    return _enrich(db, order)


@router.get("/api/assets/{code}/repair-orders", response_model=list[RepairOrderOut])
def list_for_asset(
    code: str, db: Session = Depends(get_db), _: User = Depends(staff)
):
    asset = service.get_asset(db, code)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "资产不存在")
    rows = db.scalars(
        select(RepairOrder)
        .where(RepairOrder.asset_id == asset.id)
        .order_by(RepairOrder.created_at.desc())
    ).all()
    return [_enrich(db, r) for r in rows]


@router.get("/api/repair-orders", response_model=list[RepairOrderOut])
def list_orders(
    db: Session = Depends(get_db), _: User = Depends(staff),
    status_: str | None = None,
):
    stmt = select(RepairOrder).order_by(RepairOrder.created_at.desc())
    if status_:
        stmt = stmt.where(RepairOrder.status == status_)
    return [_enrich(db, r) for r in db.scalars(stmt).all()]


def _load_or_404(db: Session, order_id: int) -> RepairOrder:
    o = db.get(RepairOrder, order_id)
    if o is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "工单不存在")
    return o


@router.post("/api/repair-orders/{order_id}/update", response_model=RepairOrderOut)
def update_order(
    order_id: int, body: RepairUpdateIn, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    order = _load_or_404(db, order_id)
    try:
        order = wf.update_order(
            db, order, vendor=body.vendor, shipped_at=body.shipped_at,
            expected_return_at=body.expected_return_at, note=body.note,
        )
    except wf.IllegalRepairTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="repair.update",
                resource_type="repair_order", resource_id=str(order_id))
    return _enrich(db, order)


@router.post("/api/repair-orders/{order_id}/complete", response_model=RepairOrderOut)
def complete_order(
    order_id: int, body: RepairCompleteIn, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    order = _load_or_404(db, order_id)
    try:
        order = wf.complete_order(
            db, order, user.id,
            cost=body.cost, warranty_covered=body.warranty_covered,
            warranty_until=body.warranty_until, resolution=body.resolution,
        )
    except wf.IllegalRepairTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="repair.complete",
                resource_type="repair_order", resource_id=str(order_id),
                payload={"cost": str(body.cost or ""),
                         "warranty_covered": body.warranty_covered})
    return _enrich(db, order)


@router.post("/api/repair-orders/{order_id}/cancel", response_model=RepairOrderOut)
def cancel_order(
    order_id: int, body: RepairCancelIn, db: Session = Depends(get_db),
    user: User = Depends(it_admin),
):
    order = _load_or_404(db, order_id)
    try:
        order = wf.cancel_order(db, order, user.id, body.reason)
    except wf.IllegalRepairTransition as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="repair.cancel",
                resource_type="repair_order", resource_id=str(order_id))
    return _enrich(db, order)

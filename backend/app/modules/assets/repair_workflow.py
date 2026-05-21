"""维修工单工作流(Phase 2)。

报修 → 工单 open → (送修)in_progress → 完结/取消;同步资产状态:
- 开单时 service.repair 把资产 → maintenance;
- 完结/取消时 service.return_asset 把资产回 idle。
一台资产同时只允许一张未关闭工单(open/in_progress)。
"""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.assets import service
from app.modules.assets.models import (
    Asset,
    AssetStatus,
    RepairOrder,
    RepairOrderStatus,
    RepairType,
)


class IllegalRepairTransition(Exception):
    pass


_OPEN_STATES = (RepairOrderStatus.open, RepairOrderStatus.in_progress)


def open_order(
    db: Session,
    asset: Asset,
    operator_id: int,
    *,
    reason: str,
    repair_type: RepairType,
    vendor: str | None,
    shipped_at: date | None,
    expected_return_at: date | None,
    note: str | None = None,
) -> RepairOrder:
    if asset.status == AssetStatus.scrapped:
        raise IllegalRepairTransition("已报废资产无法报修")
    existing = db.scalar(
        select(RepairOrder).where(
            RepairOrder.asset_id == asset.id,
            RepairOrder.status.in_(_OPEN_STATES),
        )
    )
    if existing is not None:
        raise IllegalRepairTransition("该资产已有进行中的维修工单")
    if repair_type == RepairType.external and not (vendor or "").strip():
        raise IllegalRepairTransition("外送维修必须填维修商")

    # If asset is already maintenance (legacy path with no order), don't try to
    # transition again — state machine forbids no-op self-loop.
    if asset.status != AssetStatus.maintenance:
        service.repair(db, asset, operator_id, reason)

    order = RepairOrder(
        asset_id=asset.id,
        opened_by=operator_id,
        reason=reason.strip(),
        repair_type=repair_type,
        vendor=(vendor or None),
        shipped_at=shipped_at,
        expected_return_at=expected_return_at,
        status=(
            RepairOrderStatus.in_progress
            if shipped_at is not None
            else RepairOrderStatus.open
        ),
        notes=note,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def update_order(
    db: Session,
    order: RepairOrder,
    *,
    vendor: str | None = None,
    shipped_at: date | None = None,
    expected_return_at: date | None = None,
    note: str | None = None,
) -> RepairOrder:
    if order.status not in _OPEN_STATES:
        raise IllegalRepairTransition("已关闭工单不可修改")
    if vendor is not None:
        order.vendor = vendor or None
    if shipped_at is not None:
        order.shipped_at = shipped_at
        if order.status == RepairOrderStatus.open:
            order.status = RepairOrderStatus.in_progress
    if expected_return_at is not None:
        order.expected_return_at = expected_return_at
    if note is not None:
        order.notes = note
    db.commit()
    db.refresh(order)
    return order


def complete_order(
    db: Session,
    order: RepairOrder,
    operator_id: int,
    *,
    cost: Decimal | None,
    warranty_covered: bool,
    warranty_until: date | None,
    resolution: str,
) -> RepairOrder:
    if order.status not in _OPEN_STATES:
        raise IllegalRepairTransition("仅开单/进行中可完结")
    if not (resolution or "").strip():
        raise IllegalRepairTransition("完结需要填写解决说明")
    asset = db.get(Asset, order.asset_id)
    if asset is None:
        raise IllegalRepairTransition("资产已不存在")

    order.cost = cost
    order.warranty_covered = warranty_covered
    order.warranty_until = warranty_until
    order.resolution = resolution.strip()
    order.status = RepairOrderStatus.completed
    order.closed_by = operator_id
    order.closed_at = datetime.now(UTC)
    db.commit()

    if asset.status == AssetStatus.maintenance:
        service.return_asset(db, asset, operator_id, f"维修完结 · {resolution[:80]}")
    db.refresh(order)
    return order


def cancel_order(
    db: Session, order: RepairOrder, operator_id: int, reason: str
) -> RepairOrder:
    if order.status not in _OPEN_STATES:
        raise IllegalRepairTransition("仅开单/进行中可取消")
    if not (reason or "").strip():
        raise IllegalRepairTransition("取消必须填写原因")
    asset = db.get(Asset, order.asset_id)
    order.status = RepairOrderStatus.cancelled
    order.resolution = reason.strip()
    order.closed_by = operator_id
    order.closed_at = datetime.now(UTC)
    db.commit()
    if asset is not None and asset.status == AssetStatus.maintenance:
        service.return_asset(db, asset, operator_id, f"维修取消 · {reason[:80]}")
    db.refresh(order)
    return order

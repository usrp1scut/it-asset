"""Phase 2 Excel reports for the inventory module.

Two exports — kept here (not in `service.py`) because they don't mutate state
and they pull together a handful of cross-table joins that the service layer
otherwise has no reason to know about.

* SKU snapshot — current items + balance, respects the same `mode` / `q`
  filters as the list endpoint.
* Transaction ledger — every stock movement (in / out / adjust / return) for a
  date range, with operator names and SKU codes pre-resolved.
"""

import io
from datetime import UTC, date, datetime, time, timedelta

from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.inventory.models import (
    InventoryLocation,
    InventoryOrder,
    InventoryTransaction,
    ItemCategory,
    ManagementMode,
    Sku,
    TransactionType,
)
from app.modules.inventory.service import total_available
from app.modules.users.models import User

_MODE_CN = {
    ManagementMode.asset: "资产",
    ManagementMode.inventory: "配件",
    ManagementMode.consumable: "耗材",
    ManagementMode.accessory: "附件",
}

_TXN_CN = {
    TransactionType.purchase_in: "采购入库",
    TransactionType.manual_in: "手动入库",
    TransactionType.issue_out: "发放",
    TransactionType.return_in: "退库",
    TransactionType.transfer_out: "调拨出",
    TransactionType.transfer_in: "调拨入",
    TransactionType.adjustment: "调整",
    TransactionType.damage_out: "损耗",
    TransactionType.scrap_out: "报废出库",
}

_SKU_HEADERS = [
    "SKU 编码", "名称", "分类", "品牌", "规格", "单位",
    "管理模式", "当前可用", "安全库存", "最高库存", "单价", "默认库位", "状态",
]

_TXN_HEADERS = [
    "时间", "SKU 编码", "物品名称", "类型", "数量",
    "操作前库存", "操作后库存", "库位", "操作人", "领用人", "备注",
]


def export_sku_workbook(
    db: Session, *, mode: str | None = None, q: str | None = None
) -> bytes:
    """SKU snapshot — current items + available balance."""
    wb = Workbook()
    ws = wb.active
    ws.title = "库存物品"
    ws.append(_SKU_HEADERS)

    stmt = select(Sku).where(Sku.status != "deleted")
    if mode:
        stmt = stmt.where(Sku.management_mode == mode)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Sku.name.ilike(like) | Sku.sku_code.ilike(like))

    cats = {c.id: c.name for c in db.scalars(select(ItemCategory))}
    locs = {loc.id: loc.name for loc in db.scalars(select(InventoryLocation))}

    for sku in db.scalars(stmt.order_by(Sku.sku_code)):
        ws.append([
            sku.sku_code,
            sku.name,
            cats.get(sku.category_id, ""),
            sku.brand or "",
            sku.spec or "",
            sku.unit,
            _MODE_CN.get(sku.management_mode, sku.management_mode.value),
            total_available(db, sku.id),
            sku.safety_stock,
            sku.max_stock if sku.max_stock is not None else "",
            float(sku.price) if sku.price is not None else "",
            locs.get(sku.default_location_id, ""),
            sku.status,
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _txn_conditions(date_from: date | None, date_to: date | None, sku_id: int | None):
    """Shared WHERE conditions for the ledger (date_to inclusive)."""
    conds = []
    if date_from:
        conds.append(
            InventoryTransaction.created_at >= datetime.combine(date_from, time.min, tzinfo=UTC)
        )
    if date_to:
        conds.append(
            InventoryTransaction.created_at
            < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=UTC)
        )
    if sku_id is not None:
        conds.append(InventoryTransaction.sku_id == sku_id)
    return conds


def _resolve_refs(db: Session, rows: list[InventoryTransaction]):
    """Pre-resolve sku / operator / location display fields for a batch of rows."""
    sku_ids = {r.sku_id for r in rows}
    op_ids = {r.operator_id for r in rows if r.operator_id is not None}
    loc_ids = {r.location_id for r in rows}
    skus = {s.id: s for s in db.scalars(select(Sku).where(Sku.id.in_(sku_ids or [0])))}
    ops = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(op_ids or [0])))}
    locs = {
        loc.id: loc.name
        for loc in db.scalars(
            select(InventoryLocation).where(InventoryLocation.id.in_(loc_ids or [0]))
        )
    }
    return skus, ops, locs


def _resolve_recipients(db: Session, rows: list[InventoryTransaction]) -> dict[int, str]:
    """Map related_order_id → recipient (领用人) name. For issue/发放 movements
    the linked order's requester is the employee the stock went to."""
    order_ids = {r.related_order_id for r in rows if r.related_order_id is not None}
    orders = {
        o.id: o.requester_id
        for o in db.scalars(
            select(InventoryOrder).where(InventoryOrder.id.in_(order_ids or [0]))
        )
    }
    req_ids = {rid for rid in orders.values() if rid is not None}
    names = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(req_ids or [0])))}
    return {oid: names.get(rid, "") for oid, rid in orders.items() if rid is not None}


def list_txns(
    db: Session,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    sku_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Paginated, enriched stock-movement ledger for the frontend viewer."""
    conds = _txn_conditions(date_from, date_to, sku_id)
    total = db.scalar(
        select(func.count()).select_from(InventoryTransaction).where(*conds)
    ) or 0
    rows = list(
        db.scalars(
            select(InventoryTransaction)
            .where(*conds)
            .order_by(InventoryTransaction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    skus, ops, locs = _resolve_refs(db, rows)
    recips = _resolve_recipients(db, rows)
    items = [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "sku_code": skus[r.sku_id].sku_code if r.sku_id in skus else f"#{r.sku_id}",
            "sku_name": skus[r.sku_id].name if r.sku_id in skus else "",
            "type": r.transaction_type.value,
            "type_label": _TXN_CN.get(r.transaction_type, r.transaction_type.value),
            "quantity": r.quantity,
            "before_quantity": r.before_quantity,
            "after_quantity": r.after_quantity,
            "location": locs.get(r.location_id, ""),
            "operator": ops.get(r.operator_id, "") if r.operator_id else "",
            "recipient": recips.get(r.related_order_id, "") if r.related_order_id else "",
            "remark": r.remark or "",
        }
        for r in rows
    ]
    return items, total


def export_txn_workbook(
    db: Session,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    sku_id: int | None = None,
) -> bytes:
    """Stock movement ledger for a date range (date_to is inclusive)."""
    wb = Workbook()
    ws = wb.active
    ws.title = "库存流水"
    ws.append(_TXN_HEADERS)

    stmt = (
        select(InventoryTransaction)
        .where(*_txn_conditions(date_from, date_to, sku_id))
        .order_by(InventoryTransaction.created_at.desc())
    )
    rows = list(db.scalars(stmt))
    skus, ops, locs = _resolve_refs(db, rows)
    recips = _resolve_recipients(db, rows)

    for r in rows:
        sku = skus.get(r.sku_id)
        ws.append([
            r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            sku.sku_code if sku else f"#{r.sku_id}",
            sku.name if sku else "",
            _TXN_CN.get(r.transaction_type, r.transaction_type.value),
            r.quantity,
            r.before_quantity,
            r.after_quantity,
            locs.get(r.location_id, ""),
            ops.get(r.operator_id, "") if r.operator_id else "",
            recips.get(r.related_order_id, "") if r.related_order_id else "",
            r.remark or "",
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

"""Inventory core — concurrency-safe stock movements.

THE invariant of this module (first-conversation architectural priority):
the transaction ledger is the source of truth; the balance row
(inventory_stocks) is mutated only while holding a row lock
(SELECT … FOR UPDATE) and may never go negative. Every balance change
writes a paired ledger row in the same DB transaction. No oversell.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.inventory.models import (
    EmployeeItemIssue,
    InventoryOrder,
    InventoryOrderItem,
    InventoryStock,
    InventoryTransaction,
    OrderType,
    Sku,
    SkuCodeCounter,
    TransactionType,
)


class InsufficientStock(ValueError):
    pass


def generate_sku_code(db: Session, category_code: str) -> str:
    """Allocate the next sku_code for a category, concurrency-safe.

    Locks the counter row (SELECT … FOR UPDATE) so parallel creates under
    the same category code can't collide. Mirrors generate_asset_code.
    """
    prefix = category_code.upper()
    counter = db.execute(
        select(SkuCodeCounter).where(SkuCodeCounter.prefix == prefix).with_for_update()
    ).scalar_one_or_none()
    if counter is None:
        counter = SkuCodeCounter(prefix=prefix, next_val=1)
        db.add(counter)
        db.flush()
    n = counter.next_val
    counter.next_val = n + 1
    db.flush()
    return f"{prefix}-{n:03d}"


def _order_no(order_type: OrderType) -> str:
    return f"{order_type.value.upper()}-{uuid.uuid4().hex[:10]}"


def _lock_stock(db: Session, sku_id: int, location_id: int) -> InventoryStock:
    """Return the balance row for (sku, location) locked FOR UPDATE.

    Creates a zero row first if absent — the fresh row is implicitly
    write-locked by the inserting transaction, so the subsequent
    SELECT … FOR UPDATE still serialises concurrent callers.
    """
    stock = db.execute(
        select(InventoryStock)
        .where(InventoryStock.sku_id == sku_id, InventoryStock.location_id == location_id)
        .with_for_update()
    ).scalar_one_or_none()
    if stock is None:
        stock = InventoryStock(
            sku_id=sku_id, location_id=location_id, quantity_available=0
        )
        db.add(stock)
        db.flush()
        stock = db.execute(
            select(InventoryStock)
            .where(InventoryStock.id == stock.id)
            .with_for_update()
        ).scalar_one()
    return stock


def apply_movement(
    db: Session,
    *,
    sku_id: int,
    location_id: int,
    delta: int,
    txn_type: TransactionType,
    operator_id: int | None,
    order_id: int | None = None,
    remark: str | None = None,
) -> InventoryTransaction:
    """Atomic balance change + ledger row. `delta` signed (+in / -out).

    Caller owns the transaction boundary (commit/rollback).
    """
    stock = _lock_stock(db, sku_id, location_id)
    before = stock.quantity_available
    after = before + delta
    if after < 0:
        raise InsufficientStock(
            f"库存不足:可用 {before},本次出库 {-delta}"
        )
    stock.quantity_available = after
    txn = InventoryTransaction(
        sku_id=sku_id,
        location_id=location_id,
        transaction_type=txn_type,
        quantity=delta,
        before_quantity=before,
        after_quantity=after,
        related_order_id=order_id,
        operator_id=operator_id,
        remark=remark,
    )
    db.add(txn)
    db.flush()
    return txn


def _resolve_location(db: Session, sku: Sku, location_id: int | None) -> int:
    loc = location_id or sku.default_location_id
    if loc is None:
        raise ValueError("未指定库存地点,且 SKU 无默认地点")
    return loc


def receive(
    db: Session,
    *,
    sku_id: int,
    quantity: int,
    location_id: int | None,
    operator_id: int | None,
    unit_price=None,
    manual: bool = False,
    remark: str | None = None,
) -> InventoryOrder:
    if quantity <= 0:
        raise ValueError("入库数量必须为正")
    sku = db.get(Sku, sku_id)
    if sku is None:
        raise ValueError("SKU 不存在")
    loc = _resolve_location(db, sku, location_id)
    order = InventoryOrder(
        order_no=_order_no(OrderType.purchase_in),
        order_type=OrderType.purchase_in,
        operator_id=operator_id,
        target_location_id=loc,
        remark=remark,
    )
    db.add(order)
    db.flush()
    db.add(
        InventoryOrderItem(
            order_id=order.id, sku_id=sku_id, quantity=quantity, unit_price=unit_price
        )
    )
    apply_movement(
        db,
        sku_id=sku_id,
        location_id=loc,
        delta=quantity,
        txn_type=TransactionType.manual_in if manual else TransactionType.purchase_in,
        operator_id=operator_id,
        order_id=order.id,
        remark=remark,
    )
    db.commit()
    db.refresh(order)
    return order


def issue(
    db: Session,
    *,
    sku_id: int,
    quantity: int,
    user_id: int,
    location_id: int | None,
    operator_id: int | None,
    remark: str | None = None,
) -> InventoryOrder:
    """Issue stock to an employee. Raises InsufficientStock if oversold."""
    if quantity <= 0:
        raise ValueError("发放数量必须为正")
    sku = db.get(Sku, sku_id)
    if sku is None:
        raise ValueError("SKU 不存在")
    loc = _resolve_location(db, sku, location_id)
    order = InventoryOrder(
        order_no=_order_no(OrderType.issue),
        order_type=OrderType.issue,
        requester_id=user_id,
        operator_id=operator_id,
        source_location_id=loc,
        remark=remark,
    )
    db.add(order)
    db.flush()
    db.add(InventoryOrderItem(order_id=order.id, sku_id=sku_id, quantity=quantity))
    apply_movement(
        db,
        sku_id=sku_id,
        location_id=loc,
        delta=-quantity,
        txn_type=TransactionType.issue_out,
        operator_id=operator_id,
        order_id=order.id,
        remark=remark,
    )
    db.add(
        EmployeeItemIssue(
            user_id=user_id,
            sku_id=sku_id,
            quantity=quantity,
            issue_order_id=order.id,
            need_return=sku.need_return,
        )
    )
    db.commit()
    db.refresh(order)
    return order


def return_stock(
    db: Session,
    *,
    sku_id: int,
    quantity: int,
    location_id: int | None,
    operator_id: int | None,
    remark: str | None = None,
) -> InventoryOrder:
    if quantity <= 0:
        raise ValueError("退库数量必须为正")
    sku = db.get(Sku, sku_id)
    if sku is None:
        raise ValueError("SKU 不存在")
    loc = _resolve_location(db, sku, location_id)
    order = InventoryOrder(
        order_no=_order_no(OrderType.return_),
        order_type=OrderType.return_,
        operator_id=operator_id,
        target_location_id=loc,
        remark=remark,
    )
    db.add(order)
    db.flush()
    db.add(InventoryOrderItem(order_id=order.id, sku_id=sku_id, quantity=quantity))
    apply_movement(
        db,
        sku_id=sku_id,
        location_id=loc,
        delta=quantity,
        txn_type=TransactionType.return_in,
        operator_id=operator_id,
        order_id=order.id,
        remark=remark,
    )
    db.commit()
    db.refresh(order)
    return order


def adjust(
    db: Session,
    *,
    sku_id: int,
    target_quantity: int,
    location_id: int | None,
    operator_id: int | None,
    remark: str | None = None,
) -> InventoryOrder:
    """Manual stock correction — set a location's balance to `target_quantity`
    (盘盈 / 盘亏 / 损耗 / 清零). Writes a signed `adjustment` ledger row for the
    diff so the change is auditable.
    """
    if target_quantity < 0:
        raise ValueError("调整后数量不能为负")
    sku = db.get(Sku, sku_id)
    if sku is None:
        raise ValueError("SKU 不存在")
    loc = _resolve_location(db, sku, location_id)
    stock = _lock_stock(db, sku_id, loc)
    delta = target_quantity - stock.quantity_available
    if delta == 0:
        raise ValueError("调整后数量与当前库存一致,无需调整")
    order = InventoryOrder(
        order_no=_order_no(OrderType.adjustment),
        order_type=OrderType.adjustment,
        operator_id=operator_id,
        target_location_id=loc,
        remark=remark,
    )
    db.add(order)
    db.flush()
    db.add(InventoryOrderItem(order_id=order.id, sku_id=sku_id, quantity=delta))
    apply_movement(
        db,
        sku_id=sku_id,
        location_id=loc,
        delta=delta,
        txn_type=TransactionType.adjustment,
        operator_id=operator_id,
        order_id=order.id,
        remark=remark,
    )
    db.commit()
    db.refresh(order)
    return order


def total_available(db: Session, sku_id: int) -> int:
    rows = db.scalars(
        select(InventoryStock.quantity_available).where(InventoryStock.sku_id == sku_id)
    ).all()
    return sum(rows)


def low_stock_skus(db: Session) -> list[tuple[Sku, int]]:
    """SKUs whose total available is below safety_stock."""
    out: list[tuple[Sku, int]] = []
    for sku in db.scalars(select(Sku).where(Sku.status == "active")):
        avail = total_available(db, sku.id)
        if avail < sku.safety_stock:
            out.append((sku, avail))
    return out

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ManagementMode(enum.StrEnum):
    asset = "asset"            # 一物一码(走资产模块)
    inventory = "inventory"    # 低值配件,按库存,可归还
    consumable = "consumable"  # 耗材,领用即消耗
    accessory = "accessory"    # 绑定主资产的配件


class TransactionType(enum.StrEnum):
    purchase_in = "purchase_in"
    manual_in = "manual_in"
    issue_out = "issue_out"
    return_in = "return_in"
    transfer_out = "transfer_out"
    transfer_in = "transfer_in"
    adjustment = "adjustment"
    damage_out = "damage_out"
    scrap_out = "scrap_out"


class OrderType(enum.StrEnum):
    purchase_in = "purchase_in"
    issue = "issue"
    return_ = "return"
    transfer = "transfer"
    adjustment = "adjustment"
    damage = "damage"
    scrap = "scrap"


class IssueStatus(enum.StrEnum):
    issued = "issued"
    returned = "returned"
    consumed = "consumed"
    lost = "lost"
    damaged = "damaged"


class ItemCategory(Base):
    __tablename__ = "item_categories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("item_categories.id"))
    management_mode: Mapped[ManagementMode] = mapped_column(
        Enum(ManagementMode, name="management_mode"), default=ManagementMode.inventory
    )


class Sku(Base):
    __tablename__ = "skus"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sku_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("item_categories.id"))
    brand: Mapped[str | None] = mapped_column(String(128))
    model: Mapped[str | None] = mapped_column(String(128))
    spec: Mapped[str | None] = mapped_column(String(255))
    unit: Mapped[str] = mapped_column(String(16), default="个")
    management_mode: Mapped[ManagementMode] = mapped_column(
        Enum(ManagementMode, name="management_mode"), default=ManagementMode.inventory
    )
    need_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    need_return: Mapped[bool] = mapped_column(Boolean, default=False)
    safety_stock: Mapped[int] = mapped_column(Integer, default=0)
    max_stock: Mapped[int | None] = mapped_column(Integer)
    monthly_use: Mapped[int | None] = mapped_column(Integer)
    default_location_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_locations.id"))
    price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(16), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InventoryLocation(Base):
    __tablename__ = "inventory_locations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    type: Mapped[str | None] = mapped_column(String(32))
    manager_id: Mapped[int | None] = mapped_column(BigInteger)
    address: Mapped[str | None] = mapped_column(String(255))
    remark: Mapped[str | None] = mapped_column(Text)


class InventoryStock(Base):
    """Balance row — mutated only under SELECT … FOR UPDATE.

    Derived from / kept in lock-step with inventory_transactions (the ledger,
    the source of truth). Never goes negative.
    """

    __tablename__ = "inventory_stocks"
    __table_args__ = (UniqueConstraint("sku_id", "location_id", name="uq_stock_sku_loc"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("inventory_locations.id"))
    quantity_available: Mapped[int] = mapped_column(Integer, default=0)
    quantity_locked: Mapped[int] = mapped_column(Integer, default=0)
    quantity_damaged: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("inventory_locations.id"))
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name="transaction_type")
    )
    quantity: Mapped[int] = mapped_column(Integer)  # signed: +in / -out
    before_quantity: Mapped[int] = mapped_column(Integer)
    after_quantity: Mapped[int] = mapped_column(Integer)
    related_order_id: Mapped[int | None] = mapped_column(BigInteger)
    operator_id: Mapped[int | None] = mapped_column(BigInteger)
    remark: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InventoryOrder(Base):
    __tablename__ = "inventory_orders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType, name="order_type"))
    status: Mapped[str] = mapped_column(String(16), default="confirmed")
    requester_id: Mapped[int | None] = mapped_column(BigInteger)
    approver_id: Mapped[int | None] = mapped_column(BigInteger)
    operator_id: Mapped[int | None] = mapped_column(BigInteger)
    source_location_id: Mapped[int | None] = mapped_column(BigInteger)
    target_location_id: Mapped[int | None] = mapped_column(BigInteger)
    remark: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InventoryOrderItem(Base):
    __tablename__ = "inventory_order_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("inventory_orders.id"), index=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    remark: Mapped[str | None] = mapped_column(Text)


class EmployeeItemIssue(Base):
    __tablename__ = "employee_item_issues"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    issue_order_id: Mapped[int | None] = mapped_column(BigInteger)
    need_return: Mapped[bool] = mapped_column(Boolean, default=False)
    expected_return_date: Mapped[date | None] = mapped_column(Date)
    actual_return_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[IssueStatus] = mapped_column(
        Enum(IssueStatus, name="issue_status"), default=IssueStatus.issued
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

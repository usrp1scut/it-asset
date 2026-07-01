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
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AssetClass(enum.StrEnum):
    personal = "personal"          # 个人发放:走领用/归还/离职回收
    infrastructure = "infrastructure"  # 基础设施(网络设备):仅台账+位置


class AssetStatus(enum.StrEnum):
    # PRD v0.2 §5.1 — 4 态。idle 含旧"库存中/待入库"。
    in_use = "in_use"
    idle = "idle"
    maintenance = "maintenance"
    scrapped = "scrapped"


class AssetType(Base):
    __tablename__ = "asset_types"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("asset_types.id"))
    code_prefix: Mapped[str] = mapped_column(String(16))  # PC / MON / NET …
    asset_class: Mapped[AssetClass] = mapped_column(
        Enum(AssetClass, name="asset_class"), default=AssetClass.personal
    )
    depreciation_years: Mapped[int | None] = mapped_column(Integer)
    icon: Mapped[str | None] = mapped_column(String(32))   # named SVG (laptop / monitor / …)
    color: Mapped[str | None] = mapped_column(String(16))  # hex incl. # (e.g. #3370FF)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    asset_class: Mapped[AssetClass] = mapped_column(Enum(AssetClass, name="asset_class"))
    asset_type_id: Mapped[int | None] = mapped_column(ForeignKey("asset_types.id"))

    brand_model: Mapped[str | None] = mapped_column(String(255))  # 自由文本,不拆分
    spec: Mapped[str | None] = mapped_column(Text)                # 配置自由文本
    serial_number: Mapped[str | None] = mapped_column(String(128), index=True)
    legacy_code: Mapped[str | None] = mapped_column(String(64))   # 旧临时编号(gw-1 等)

    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, name="asset_status"), default=AssetStatus.idle, index=True
    )

    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    owner_name: Mapped[str | None] = mapped_column(String(255))   # 使用人原文兜底
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    department_name: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))

    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_price: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    warranty_expire_date: Mapped[date | None] = mapped_column(Date)
    supplier: Mapped[str | None] = mapped_column(String(255))
    remark: Mapped[str | None] = mapped_column(Text)

    scrap_candidate: Mapped[bool] = mapped_column(Boolean, default=False)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    qr_code_url: Mapped[str | None] = mapped_column(String(512))
    photo_urls: Mapped[list | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(BigInteger)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AssetAssignment(Base):
    __tablename__ = "asset_assignments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="active")  # active | returned
    operator_id: Mapped[int | None] = mapped_column(BigInteger)
    remark: Mapped[str | None] = mapped_column(Text)
    # Lark receipt-confirmation card: message id (to update it in place) + when
    # the employee tapped 确认收到. NULL = no card sent / not yet acknowledged.
    receipt_msg_id: Mapped[str | None] = mapped_column(String(128))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AssetChangeLog(Base):
    __tablename__ = "asset_change_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    action: Mapped[str] = mapped_column(String(32))  # create|assign|return|repair|scrap|update
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str | None] = mapped_column(String(32))
    from_owner_id: Mapped[int | None] = mapped_column(BigInteger)
    to_owner_id: Mapped[int | None] = mapped_column(BigInteger)
    operator_id: Mapped[int | None] = mapped_column(BigInteger)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssetAccessory(Base):
    __tablename__ = "asset_accessories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)  # 主资产
    sku_id: Mapped[int | None] = mapped_column(BigInteger)  # 配件按库存管理时
    asset_accessory_id: Mapped[int | None] = mapped_column(
        ForeignKey("assets.id")
    )  # 配件本身一物一码时
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    binding_type: Mapped[str] = mapped_column(String(32), default="follow")  # follow | independent
    need_return: Mapped[bool] = mapped_column(Boolean, default=True)
    remark: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssetCodeCounter(Base):
    """Per-prefix allocator for asset codes (PRD §13.1).

    One row per prefix (PC/MON/NET…). Allocation locks the row
    (SELECT … FOR UPDATE) so concurrent inserts never collide — explicitly
    NOT `max(code)+1`. Prefixes are data, so new ones need no DDL.
    """

    __tablename__ = "asset_code_counters"

    prefix: Mapped[str] = mapped_column(String(16), primary_key=True)
    next_val: Mapped[int] = mapped_column(Integer, default=1)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(BigInteger, index=True)
    action: Mapped[str] = mapped_column(String(64))
    resource_type: Mapped[str] = mapped_column(String(64), index=True)
    resource_id: Mapped[str | None] = mapped_column(String(64))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    ip: Mapped[str | None] = mapped_column(String(64))
    ua: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ScrapRequestStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    disposed = "disposed"


class DispositionMethod(enum.StrEnum):
    recycle = "recycle"      # 回收
    resale = "resale"        # 转售
    writeoff = "writeoff"    # 报销/直接核销
    exchange = "exchange"    # 换货抵扣
    other = "other"


class ScrapRequest(Base):
    """报废处置工作流(Phase 2):申请 → 审批 → 处置 → 资产 scrapped。

    资产状态在 disposed 阶段才真正翻 scrapped;之前都停留在原态,
    `Asset.scrap_candidate=True` 标识"有进行中的报废申请"。
    """

    __tablename__ = "scrap_requests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    proposer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[ScrapRequestStatus] = mapped_column(
        Enum(ScrapRequestStatus, name="scrap_request_status"),
        default=ScrapRequestStatus.pending,
    )

    approver_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approve_remark: Mapped[str | None] = mapped_column(Text)

    disposition_method: Mapped[DispositionMethod | None] = mapped_column(
        Enum(DispositionMethod, name="disposition_method")
    )
    residual_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    disposed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    disposed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disposal_remark: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RepairType(enum.StrEnum):
    in_house = "in_house"      # 内部修
    external = "external"      # 外送维修商


class RepairOrderStatus(enum.StrEnum):
    open = "open"              # 已报修,未送出
    in_progress = "in_progress"  # 维修中(已送出 / 自修中)
    completed = "completed"    # 已完结,资产归还
    cancelled = "cancelled"    # 取消,资产归还


class RepairOrder(Base):
    """维修工单(Phase 2)——绑定到资产,记录送修商/费用/保修等运营数据。

    开单时调用 service.repair 把资产置 maintenance;完结/取消时调
    service.return_asset 让资产回到 idle。一台资产同时只能有一张未关闭工单。
    """

    __tablename__ = "repair_orders"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    opened_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    repair_type: Mapped[RepairType] = mapped_column(
        Enum(RepairType, name="repair_type"), default=RepairType.in_house
    )
    vendor: Mapped[str | None] = mapped_column(String(255))
    shipped_at: Mapped[date | None] = mapped_column(Date)
    expected_return_at: Mapped[date | None] = mapped_column(Date)

    status: Mapped[RepairOrderStatus] = mapped_column(
        Enum(RepairOrderStatus, name="repair_order_status"),
        default=RepairOrderStatus.open,
    )

    cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    warranty_covered: Mapped[bool] = mapped_column(Boolean, default=False)
    warranty_until: Mapped[date | None] = mapped_column(Date)
    resolution: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    closed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

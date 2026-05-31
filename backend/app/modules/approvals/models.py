import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class RequestType(enum.StrEnum):
    consumable = "consumable"  # 耗材/配件领用 — fulfil 自动扣库存
    asset = "asset"            # 固定资产领用 — IT 后续手工分配


class ApprovalStatus(enum.StrEnum):
    pending = "pending"      # 等部门主管
    approved = "approved"    # 等 IT 发放
    rejected = "rejected"
    fulfilled = "fulfilled"  # 完成


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    request_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    request_type: Mapped[RequestType] = mapped_column(Enum(RequestType, name="request_type"))
    requester_id: Mapped[int] = mapped_column(BigInteger, index=True)
    approver_id: Mapped[int | None] = mapped_column(BigInteger)
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="approval_status"), default=ApprovalStatus.pending, index=True
    )
    payload_json: Mapped[dict] = mapped_column(JSONB)
    lark_message_id: Mapped[str | None] = mapped_column(String(64))
    decided_by: Mapped[int | None] = mapped_column(BigInteger)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(Text)  # 审批意见
    auto_approved: Mapped[bool] = mapped_column(Boolean, default=False)  # 命中自动审批规则
    fulfilled_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AutoApprovalRule(Base):
    """Singleton (row id=1) — when enabled, a matching consumable request is
    auto-approved at submit time (status → approved, awaiting IT 发放).
    null threshold = that dimension is unbounded."""

    __tablename__ = "auto_approval_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    consumable_only: Mapped[bool] = mapped_column(Boolean, default=True)
    # Skip auto-approval if any item's SKU is flagged need_approval.
    respect_sku_flag: Mapped[bool] = mapped_column(Boolean, default=True)
    max_total_qty: Mapped[int | None] = mapped_column(BigInteger)
    max_total_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    updated_by: Mapped[int | None] = mapped_column(BigInteger)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

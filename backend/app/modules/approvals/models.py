import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, String, func
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
    fulfilled_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

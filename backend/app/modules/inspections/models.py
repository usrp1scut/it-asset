import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class InspectionStatus(enum.StrEnum):
    open = "open"
    closed = "closed"


class ConfirmStatus(enum.StrEnum):
    pending = "pending"
    ok = "ok"
    mismatch = "mismatch"


class InspectionTask(Base):
    __tablename__ = "inspection_tasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    scope_type: Mapped[str] = mapped_column(String(32), default="personal_in_use")
    status: Mapped[InspectionStatus] = mapped_column(
        Enum(InspectionStatus, name="inspection_status"), default=InspectionStatus.open
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[int | None] = mapped_column(BigInteger)


class InspectionItem(Base):
    __tablename__ = "inspection_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("inspection_tasks.id"), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    expected_owner_id: Mapped[int | None] = mapped_column(BigInteger)
    confirmed_by: Mapped[int | None] = mapped_column(BigInteger)
    confirm_status: Mapped[ConfirmStatus] = mapped_column(
        Enum(ConfirmStatus, name="confirm_status"), default=ConfirmStatus.pending
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    remark: Mapped[str | None] = mapped_column(Text)

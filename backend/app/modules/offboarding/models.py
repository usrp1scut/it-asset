"""离职归还(Offboarding)模型 — PHASE3 §2.

把一名离职员工名下「所有需归还的固定资产」组织成一个 case 视角:逐件确认
归还 / 登记丢失,全部处理完才能关闭。归还复用资产现有的 return 流程;丢失挂
一张报废申请走财务核销。资产关联用 asset_id(不可变),编号变更不影响。
"""
import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class OffboardingStatus(enum.StrEnum):
    in_progress = "in_progress"  # 进行中
    overdue = "overdue"          # 已逾期(过了最后工作日仍有待归还)
    completed = "completed"      # 已完成


class OffboardingItemStatus(enum.StrEnum):
    return_pending = "return_pending"  # 待归还
    returned = "returned"              # 已归还
    lost = "lost"                      # 丢失登记(走报废核销)


class ItemCondition(enum.StrEnum):
    good = "good"
    damaged = "damaged"


class OffboardingCase(Base):
    __tablename__ = "offboarding_cases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    case_no: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    user_name: Mapped[str | None] = mapped_column(String(255))        # 快照
    department_name: Mapped[str | None] = mapped_column(String(255))  # 快照
    last_day: Mapped[date | None] = mapped_column(Date)
    reason: Mapped[str | None] = mapped_column(Text)
    hr_channel: Mapped[str] = mapped_column(String(64), default="manual")  # manual | lark_event:user.left
    status: Mapped[OffboardingStatus] = mapped_column(
        Enum(OffboardingStatus, name="offboarding_status"),
        default=OffboardingStatus.in_progress,
        index=True,
    )
    assigned_it_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by: Mapped[int | None] = mapped_column(BigInteger)
    # When IT confirmed the case and the leaver/manager were notified. Stays
    # NULL on auto-created cases until IT explicitly notifies — auto-creation
    # alerts IT only, never the employee (avoids false-alarm spam).
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OffboardingItem(Base):
    __tablename__ = "offboarding_items"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("offboarding_cases.id"), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    asset_code: Mapped[str] = mapped_column(String(32))            # 快照(展示用)
    brand_model: Mapped[str | None] = mapped_column(String(255))  # 快照
    snapshot_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))  # 建单时价值快照
    status: Mapped[OffboardingItemStatus] = mapped_column(
        Enum(OffboardingItemStatus, name="offboarding_item_status"),
        default=OffboardingItemStatus.return_pending,
    )
    condition: Mapped[ItemCondition | None] = mapped_column(
        Enum(ItemCondition, name="offboarding_item_condition")
    )
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    handler_id: Mapped[int | None] = mapped_column(BigInteger)
    remark: Mapped[str | None] = mapped_column(Text)

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LotteryDraw(Base):
    """One抽奖 round: a random pick of N winners from active employees, with an
    optional inventory item recorded as the prize."""

    __tablename__ = "lottery_draws"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    # Prize tier (special/first/second/third) — display-only, drives the
    # big-screen stage theme color. Nullable: older draws have no tier.
    tier: Mapped[str | None] = mapped_column(String(16))
    prize_sku_id: Mapped[int | None] = mapped_column(ForeignKey("skus.id"))
    winner_count: Mapped[int] = mapped_column(Integer)
    created_by: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LotteryWinner(Base):
    __tablename__ = "lottery_winners"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    draw_id: Mapped[int] = mapped_column(ForeignKey("lottery_draws.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

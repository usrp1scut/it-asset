import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.inventory.models import Sku
from app.modules.lottery.models import LotteryDraw, LotteryWinner
from app.modules.users.models import User, UserStatus


class LotteryError(ValueError):
    pass


def eligible_user_ids(db: Session) -> list[int]:
    """The draw pool: active (在职), non-deleted, **Lark** users.

    Requiring a lark_open_id excludes locally-created / password-only accounts
    (the bootstrap admin, service accounts) so only real Lark employees can win.
    """
    return list(
        db.scalars(
            select(User.id).where(
                User.status == UserStatus.active,
                User.deleted_at.is_(None),
                User.lark_open_id.is_not(None),
            )
        )
    )


def run_draw(
    db: Session,
    *,
    name: str,
    winner_count: int,
    prize_sku_id: int | None,
    operator_id: int | None,
) -> LotteryDraw:
    """Pick `winner_count` distinct winners uniformly at random from active
    employees. Uses a system-RNG so the draw isn't trivially predictable."""
    name = (name or "").strip() or "抽奖"
    if winner_count < 1:
        raise LotteryError("中奖人数至少为 1")
    if prize_sku_id is not None and db.get(Sku, prize_sku_id) is None:
        raise LotteryError("关联的库存物品不存在")
    pool = eligible_user_ids(db)
    if not pool:
        raise LotteryError("当前没有在职用户可抽")
    if winner_count > len(pool):
        raise LotteryError(f"中奖人数({winner_count})不能超过在职用户数({len(pool)})")

    winner_ids = secrets.SystemRandom().sample(pool, winner_count)
    draw = LotteryDraw(
        name=name,
        winner_count=winner_count,
        prize_sku_id=prize_sku_id,
        created_by=operator_id,
    )
    db.add(draw)
    db.flush()
    for uid in winner_ids:
        db.add(LotteryWinner(draw_id=draw.id, user_id=uid))
    db.commit()
    db.refresh(draw)
    return draw

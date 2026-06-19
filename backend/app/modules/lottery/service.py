import secrets

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.modules.inventory.models import Sku
from app.modules.lottery.models import LotteryDraw, LotteryWinner
from app.modules.users.models import User, UserStatus


class LotteryError(ValueError):
    pass


# Prize tiers the stage theme understands; None is also allowed (untiered draw).
ALLOWED_TIERS = {"special", "first", "second", "third"}


def _eligible_where():
    """Shared predicate for the draw pool: active (在职), non-deleted, **Lark**
    users. Requiring a lark_open_id excludes locally-created / password-only
    accounts (the bootstrap admin, service accounts) so only real Lark
    employees can win."""
    return (
        User.status == UserStatus.active,
        User.deleted_at.is_(None),
        User.lark_open_id.is_not(None),
    )


def eligible_user_ids(db: Session) -> list[int]:
    return list(db.scalars(select(User.id).where(*_eligible_where())))


def eligible_names(db: Session) -> list[str]:
    """Display names of the draw pool — feeds the big-screen rolling animation
    (the slot-machine effect flashes real candidate names)."""
    return list(db.scalars(select(User.name).where(*_eligible_where())))


def run_draw(
    db: Session,
    *,
    name: str,
    tier: str | None,
    winner_count: int,
    prize_sku_id: int | None,
    operator_id: int | None,
) -> LotteryDraw:
    """Pick `winner_count` distinct winners uniformly at random from active
    employees. Uses a system-RNG so the draw isn't trivially predictable.

    防重抽: the activity name is the event key — a name that has already been
    drawn is rejected, so the same event can't be quietly re-rolled. Re-drawing
    requires a different (visible, audited) name.
    """
    name = (name or "").strip()
    if not name:
        raise LotteryError("请填写活动名称")
    if tier is not None and tier not in ALLOWED_TIERS:
        raise LotteryError("无效的奖项等级")
    if db.scalar(select(LotteryDraw.id).where(LotteryDraw.name == name)):
        raise LotteryError(f"活动「{name}」已抽过奖,不能重复抽奖;如需重抽请换一个活动名称")
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
        tier=tier,
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


def delete_draw(db: Session, draw_id: int) -> bool:
    """Remove a single draw and its winners. Returns False if it doesn't exist."""
    draw = db.get(LotteryDraw, draw_id)
    if draw is None:
        return False
    db.execute(delete(LotteryWinner).where(LotteryWinner.draw_id == draw_id))
    db.delete(draw)
    db.commit()
    return True


def clear_draws(db: Session) -> int:
    """Wipe all draw history (winners first, FK has no cascade). Returns the
    number of draws removed.

    Note: this also frees previously-used activity names — 防重抽 keys off
    existing draw names, so a cleared name can be drawn again. That's fine:
    clearing is a deliberate, audited action.
    """
    ids = list(db.scalars(select(LotteryDraw.id)))
    if ids:
        db.execute(delete(LotteryWinner))
        db.execute(delete(LotteryDraw))
        db.commit()
    return len(ids)

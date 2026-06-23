import secrets
from datetime import UTC, datetime

import anyio
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.lark.client import get_lark_client
from app.modules.inventory import service as inv
from app.modules.inventory.models import (
    InventoryStock,
    ItemCategory,
    Sku,
    TransactionType,
)
from app.modules.lottery.models import LotteryDraw, LotteryWinner
from app.modules.users.models import User, UserStatus


class LotteryError(ValueError):
    pass


# Prize-tier display labels for the winner DM (mirror the frontend TIERS).
_TIER_LABEL = {"special": "特等奖", "first": "一等奖", "second": "二等奖", "third": "三等奖"}


def _dm(open_id: str | None, text: str) -> None:
    """Send a Lark DM, no-op-safe — never raises into business code (Lark
    unconfigured, no open_id, or a transient API error all just skip)."""
    c = get_lark_client()
    if not c.configured or not open_id:
        return
    try:
        anyio.run(c.send_user, open_id, text)
    except Exception:  # noqa: BLE001 — notification must not break the flow
        pass


# Prize tiers the stage theme understands; None is also allowed (untiered draw).
ALLOWED_TIERS = {"special", "first", "second", "third"}

# The default 奖品 (prize) category — seeded + ensured by migration. Lottery
# prizes must be SKUs under this category. Matched by the stable `code`, not the
# (renameable) name.
PRIZE_CATEGORY_CODE = "JP"


def prize_category(db: Session) -> ItemCategory | None:
    return db.scalar(select(ItemCategory).where(ItemCategory.code == PRIZE_CATEGORY_CODE))


def list_prize_skus(db: Session) -> list[tuple[Sku, int]]:
    """In-stock prize SKUs: (sku, available) for active 奖品-category SKUs with
    available > 0 — the only items a draw may link to."""
    cat = prize_category(db)
    if cat is None:
        return []
    out: list[tuple[Sku, int]] = []
    for sku in db.scalars(
        select(Sku).where(Sku.category_id == cat.id, Sku.status == "active").order_by(Sku.name)
    ):
        avail = inv.total_available(db, sku.id)
        if avail > 0:
            out.append((sku, avail))
    return out


def _validate_prize(db: Session, prize_sku_id: int) -> None:
    sku = db.get(Sku, prize_sku_id)
    if sku is None:
        raise LotteryError("关联的库存物品不存在")
    cat = prize_category(db)
    if cat is None or sku.category_id != cat.id:
        raise LotteryError("只能关联「奖品」分类下的物品")
    if inv.total_available(db, prize_sku_id) <= 0:
        raise LotteryError("该奖品暂无库存,不能关联")


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


def event_winner_ids(db: Session, name: str) -> set[int]:
    """User ids that already won under this activity name (across its draws)."""
    name = (name or "").strip()
    if not name:
        return set()
    return set(
        db.scalars(
            select(LotteryWinner.user_id)
            .join(LotteryDraw, LotteryDraw.id == LotteryWinner.draw_id)
            .where(LotteryDraw.name == name)
        )
    )


def available_pool(db: Session, *, name: str | None, exclude_winners: bool) -> list[int]:
    """The drawable pool. When `exclude_winners`, drop anyone who already won
    under the same activity `name` so a person can't win twice in one event."""
    pool = eligible_user_ids(db)
    if exclude_winners and name:
        won = event_winner_ids(db, name)
        pool = [uid for uid in pool if uid not in won]
    return pool


def run_draw(
    db: Session,
    *,
    name: str,
    tier: str | None,
    winner_count: int,
    prize_sku_id: int | None,
    operator_id: int | None,
    exclude_winners: bool = True,
) -> LotteryDraw:
    """Pick `winner_count` distinct winners uniformly at random from active
    employees. Uses a system-RNG so the draw isn't trivially predictable.

    Re-drawing is unrestricted. `exclude_winners` drops people who already won
    under the same activity name, so multiple rounds of one event don't let the
    same person win twice.
    """
    name = (name or "").strip()
    if not name:
        raise LotteryError("请填写活动名称")
    if tier is not None and tier not in ALLOWED_TIERS:
        raise LotteryError("无效的奖项等级")
    if winner_count < 1:
        raise LotteryError("中奖人数至少为 1")
    if prize_sku_id is not None:
        _validate_prize(db, prize_sku_id)
    pool = available_pool(db, name=name, exclude_winners=exclude_winners)
    if not pool:
        if exclude_winners:
            raise LotteryError("可抽人数为 0:在职 Lark 员工都已在本活动中过奖")
        raise LotteryError("当前没有在职用户可抽")
    if winner_count > len(pool):
        raise LotteryError(f"中奖人数({winner_count})不能超过可抽人数({len(pool)})")

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
    number of draws removed. A deliberate, audited action."""
    ids = list(db.scalars(select(LotteryDraw.id)))
    if ids:
        db.execute(delete(LotteryWinner))
        db.execute(delete(LotteryDraw))
        db.commit()
    return len(ids)


class _DrawMissing(Exception):
    """Internal sentinel: the draw id doesn't exist (router → 404)."""


def _pick_winners(
    winners: list[LotteryWinner], winner_ids: list[int] | None
) -> list[LotteryWinner]:
    """Chosen subset (winner_ids is None → all)."""
    if winner_ids is None:
        return list(winners)
    wanted = set(winner_ids)
    return [w for w in winners if w.id in wanted]


def confirm_stock_out(
    db: Session, *, draw_id: int, operator_id: int | None, winner_ids: list[int] | None = None
) -> tuple[LotteryDraw, int]:
    """Deliver the prize to the selected winners (winner_ids=None → all): deduct
    one unit per selected, not-yet-delivered winner and stamp each one's
    delivered_at. The draw-level stock_out_at is set once every winner is
    delivered. Drawing never touches stock — only this does.

    Deducts across locations (most-stocked first) through the locked ledger, so
    it can't oversell or go negative. Returns (draw, units_deducted).
    """
    draw = db.get(LotteryDraw, draw_id)
    if draw is None:
        raise _DrawMissing
    if draw.prize_sku_id is None:
        raise LotteryError("该抽奖未关联奖品,无需出库")

    winners = list(db.scalars(select(LotteryWinner).where(LotteryWinner.draw_id == draw.id)))
    target = [w for w in _pick_winners(winners, winner_ids) if w.delivered_at is None]
    if not target:
        raise LotteryError("没有可发放的中奖者(可能已全部发放,或未选择)")

    qty = len(target)
    rows = db.execute(
        select(InventoryStock.location_id, InventoryStock.quantity_available)
        .where(
            InventoryStock.sku_id == draw.prize_sku_id,
            InventoryStock.quantity_available > 0,
        )
        .order_by(InventoryStock.quantity_available.desc())
    ).all()
    if sum(avail for _, avail in rows) < qty:
        total = sum(avail for _, avail in rows)
        raise LotteryError(f"库存不足:奖品可用 {total},需发放 {qty}")

    try:
        remaining = qty
        for loc_id, avail in rows:
            if remaining <= 0:
                break
            take = min(remaining, avail)
            inv.apply_movement(
                db,
                sku_id=draw.prize_sku_id,
                location_id=loc_id,
                delta=-take,
                txn_type=TransactionType.issue_out,
                operator_id=operator_id,
                remark=f"抽奖出库:{draw.name}",
            )
            remaining -= take
    except inv.InsufficientStock as e:
        db.rollback()
        raise LotteryError(f"库存不足:{e}") from e

    now = datetime.now(UTC)
    for w in target:
        w.delivered_at = now
    if all(w.delivered_at is not None for w in winners):
        draw.stock_out_at = now
    db.commit()
    db.refresh(draw)
    return draw, qty


def notify_winners(
    db: Session, *, draw_id: int, operator_id: int | None, winner_ids: list[int] | None = None
) -> tuple[LotteryDraw, int]:
    """DM the selected winners (winner_ids=None → all) on Lark. Manual action
    (never auto on draw). Skips winners already notified; the draw-level
    notified_at is set once every winner is notified. Returns (draw, dm_count).

    DMs are no-op-safe: if Lark isn't configured nothing is sent, but the chosen
    winners are still stamped notified (the act is recorded; re-notify skips them).
    """
    draw = db.get(LotteryDraw, draw_id)
    if draw is None:
        raise _DrawMissing

    rows = db.execute(
        select(LotteryWinner, User.lark_open_id, User.name)
        .join(User, User.id == LotteryWinner.user_id)
        .where(LotteryWinner.draw_id == draw.id)
    ).all()
    if not rows:
        raise LotteryError("该抽奖没有中奖者")

    all_winners = [w for w, _, _ in rows]
    chosen_ids = {w.id for w in _pick_winners(all_winners, winner_ids)}
    target = [(w, oid, nm) for w, oid, nm in rows if w.id in chosen_ids and w.notified_at is None]
    if not target:
        raise LotteryError("没有可通知的中奖者(可能已全部通知,或未选择)")

    tier_label = _TIER_LABEL.get(draw.tier or "", "")
    prize = db.get(Sku, draw.prize_sku_id) if draw.prize_sku_id else None
    suffix = f",奖品:{prize.name}" if prize else ""
    now = datetime.now(UTC)
    sent = 0
    for w, open_id, name in target:
        text = (
            f"🎉 恭喜 {name}!你在「{draw.name}」{tier_label}抽奖中中奖啦{suffix}。"
            "请留意后续领奖通知~"
        )
        _dm(open_id, text)
        w.notified_at = now
        sent += 1

    if all(w.notified_at is not None for w in all_winners):
        draw.notified_at = now
    db.commit()
    db.refresh(draw)
    return draw, sent

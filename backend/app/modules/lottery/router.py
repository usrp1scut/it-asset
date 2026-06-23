from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.inventory.models import Sku
from app.modules.lottery import service
from app.modules.lottery.models import LotteryDraw, LotteryWinner
from app.modules.lottery.schemas import DrawIn
from app.modules.users.models import Role, User

router = APIRouter(prefix="/api/lottery", tags=["lottery"])
# Everyone except plain employees (sys_admin auto-passes via require_roles).
lottery_user = require_roles(
    Role.manager, Role.it_admin, Role.procurement, Role.finance, Role.hr
)


def _draw_out(db: Session, draw: LotteryDraw) -> dict:
    winners = db.execute(
        select(LotteryWinner.user_id, User.name)
        .join(User, User.id == LotteryWinner.user_id)
        .where(LotteryWinner.draw_id == draw.id)
        .order_by(LotteryWinner.id)
    ).all()
    prize = db.get(Sku, draw.prize_sku_id) if draw.prize_sku_id else None
    return {
        "id": draw.id,
        "name": draw.name,
        "tier": draw.tier,
        "winner_count": draw.winner_count,
        "prize_sku_id": draw.prize_sku_id,
        "prize_name": prize.name if prize else None,
        "stock_out_at": draw.stock_out_at.isoformat() if draw.stock_out_at else None,
        "notified_at": draw.notified_at.isoformat() if draw.notified_at else None,
        "created_at": draw.created_at.isoformat(),
        "winners": [{"user_id": uid, "name": nm} for uid, nm in winners],
    }


@router.get("/eligible-count")
def eligible_count(
    name: str | None = None,
    exclude_winners: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(lottery_user),
) -> dict:
    """Drawable count. With name + exclude_winners, excludes prior winners of
    that activity so the UI shows the real remaining pool."""
    return {
        "count": len(service.available_pool(db, name=name, exclude_winners=exclude_winners))
    }


@router.get("/prizes")
def list_prizes(db: Session = Depends(get_db), _: User = Depends(lottery_user)) -> list[dict]:
    """In-stock 奖品-category SKUs — the only items a draw may link to."""
    return [
        {
            "id": s.id,
            "name": s.name,
            "sku_code": s.sku_code,
            "unit": s.unit,
            "available": avail,
        }
        for s, avail in service.list_prize_skus(db)
    ]


@router.get("/pool")
def pool_names(db: Session = Depends(get_db), _: User = Depends(lottery_user)) -> dict:
    """Display names of the eligible pool — drives the big-screen rolling
    (slot-machine) animation so it flashes real candidate names."""
    return {"names": service.eligible_names(db)}


@router.post("/draws", status_code=status.HTTP_201_CREATED)
def create_draw(body: DrawIn, db: Session = Depends(get_db), user: User = Depends(lottery_user)):
    try:
        draw = service.run_draw(
            db,
            name=body.name,
            tier=body.tier,
            winner_count=body.winner_count,
            prize_sku_id=body.prize_sku_id,
            operator_id=user.id,
            exclude_winners=body.exclude_winners,
        )
    except service.LotteryError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    write_audit(
        db, actor_user_id=user.id, action="lottery.draw",
        resource_type="lottery", resource_id=str(draw.id),
        payload={
            "tier": draw.tier,
            "winner_count": draw.winner_count,
            "prize_sku_id": draw.prize_sku_id,
            "exclude_winners": body.exclude_winners,
        },
    )
    return _draw_out(db, draw)


@router.get("/draws")
def list_draws(db: Session = Depends(get_db), _: User = Depends(lottery_user)):
    rows = db.scalars(
        select(LotteryDraw).order_by(LotteryDraw.id.desc()).limit(50)
    ).all()
    return [_draw_out(db, d) for d in rows]


@router.get("/draws/{draw_id}")
def get_draw(draw_id: int, db: Session = Depends(get_db), _: User = Depends(lottery_user)):
    draw = db.get(LotteryDraw, draw_id)
    if draw is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "抽奖记录不存在")
    return _draw_out(db, draw)


@router.delete("/draws", status_code=status.HTTP_200_OK)
def clear_draws(db: Session = Depends(get_db), user: User = Depends(lottery_user)) -> dict:
    """Clear all 抽奖 history. Audited (the draws are gone but the act of
    clearing is recorded in audit_logs)."""
    deleted = service.clear_draws(db)
    write_audit(
        db, actor_user_id=user.id, action="lottery.clear",
        resource_type="lottery", resource_id="*", payload={"deleted": deleted},
    )
    return {"deleted": deleted}


@router.delete("/draws/{draw_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_draw(draw_id: int, db: Session = Depends(get_db), user: User = Depends(lottery_user)):
    if not service.delete_draw(db, draw_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "抽奖记录不存在")
    write_audit(
        db, actor_user_id=user.id, action="lottery.delete",
        resource_type="lottery", resource_id=str(draw_id),
    )


@router.post("/draws/{draw_id}/confirm-stock-out")
def confirm_stock_out(
    draw_id: int, db: Session = Depends(get_db), user: User = Depends(lottery_user)
):
    """Deliver the prize: deduct winner_count units from stock (one per winner)."""
    try:
        draw = service.confirm_stock_out(db, draw_id=draw_id, operator_id=user.id)
    except service._DrawMissing as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "抽奖记录不存在") from e
    except service.LotteryError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    write_audit(
        db, actor_user_id=user.id, action="lottery.stock_out",
        resource_type="lottery", resource_id=str(draw.id),
        payload={"prize_sku_id": draw.prize_sku_id, "qty": draw.winner_count},
    )
    return _draw_out(db, draw)


@router.post("/draws/{draw_id}/notify")
def notify_winners(
    draw_id: int, db: Session = Depends(get_db), user: User = Depends(lottery_user)
):
    """DM each winner on Lark (manual). Idempotent; no-op-safe if Lark is off."""
    try:
        draw, sent = service.notify_winners(db, draw_id=draw_id, operator_id=user.id)
    except service._DrawMissing as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "抽奖记录不存在") from e
    except service.LotteryError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    write_audit(
        db, actor_user_id=user.id, action="lottery.notify",
        resource_type="lottery", resource_id=str(draw.id),
        payload={"winner_count": draw.winner_count},
    )
    return {**_draw_out(db, draw), "notified": sent}

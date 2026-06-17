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
lottery_user = require_roles(Role.manager, Role.it_admin, Role.procurement, Role.finance)


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
        "winner_count": draw.winner_count,
        "prize_sku_id": draw.prize_sku_id,
        "prize_name": prize.name if prize else None,
        "created_at": draw.created_at.isoformat(),
        "winners": [{"user_id": uid, "name": nm} for uid, nm in winners],
    }


@router.get("/eligible-count")
def eligible_count(db: Session = Depends(get_db), _: User = Depends(lottery_user)) -> dict:
    return {"count": len(service.eligible_user_ids(db))}


@router.post("/draws", status_code=status.HTTP_201_CREATED)
def create_draw(body: DrawIn, db: Session = Depends(get_db), user: User = Depends(lottery_user)):
    try:
        draw = service.run_draw(
            db,
            name=body.name,
            winner_count=body.winner_count,
            prize_sku_id=body.prize_sku_id,
            operator_id=user.id,
        )
    except service.LotteryError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    write_audit(
        db, actor_user_id=user.id, action="lottery.draw",
        resource_type="lottery", resource_id=str(draw.id),
        payload={"winner_count": draw.winner_count, "prize_sku_id": draw.prize_sku_id},
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

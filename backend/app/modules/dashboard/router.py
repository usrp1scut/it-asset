from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.deps import get_db, require_roles
from app.modules.assets.models import AuditLog
from app.modules.dashboard import service
from app.modules.users.models import Role, User

router = APIRouter(tags=["dashboard"])

staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)
it_admin = require_roles(Role.it_admin)


@router.get("/api/dashboard/overview")
def overview(db: Session = Depends(get_db), _: User = Depends(staff)) -> dict:
    return service.overview(db)


@router.get("/api/audit-logs")
def audit_logs(
    db: Session = Depends(get_db),
    _: User = Depends(it_admin),
    page: int = 1,
    size: int = 30,
) -> dict:
    total = db.scalar(select(func.count()).select_from(AuditLog)) or 0
    rows = db.scalars(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    actor_ids = {r.actor_user_id for r in rows if r.actor_user_id is not None}
    names = (
        {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(actor_ids)))}
        if actor_ids
        else {}
    )
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "actor_user_id": r.actor_user_id,
                "actor_name": names.get(r.actor_user_id),
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "payload": r.payload,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
    }

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db, require_roles
from app.modules.users.models import Department, Role, User, UserStatus
from app.modules.users.schemas import UserPickOut

router = APIRouter(prefix="/api/users", tags=["users"])

staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)


@router.get("", response_model=list[UserPickOut])
def search_users(
    db: Session = Depends(get_db),
    _: User = Depends(staff),
    q: str | None = None,
    limit: int = 20,
):
    """Searchable active-employee list for assignment/transfer pickers."""
    stmt = select(User).where(User.status == UserStatus.active)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(User.name.ilike(like) | User.email.ilike(like))
    users = db.scalars(stmt.order_by(User.name).limit(min(limit, 50))).all()
    dept = {d.id: d.name for d in db.scalars(select(Department))}
    out: list[UserPickOut] = []
    for u in users:
        o = UserPickOut.model_validate(u)
        o.department_name = dept.get(u.department_id)
        out.append(o)
    return out

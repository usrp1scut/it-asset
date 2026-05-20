from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db, require_roles
from app.modules.users.models import Department, Role, User, UserStatus
from app.modules.users.schemas import RoleChangeIn, UserManageOut, UserPickOut

router = APIRouter(prefix="/api/users", tags=["users"])

staff = require_roles(Role.it_admin, Role.manager, Role.finance, Role.procurement)
admin = require_roles(Role.it_admin)  # sys_admin passes implicitly

# Promotable role surface: sys_admin is bootstrap-only, not mintable from UI.
_ASSIGNABLE = {Role.employee, Role.manager, Role.it_admin, Role.finance, Role.procurement}


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


@router.get("/manage", response_model=list[UserManageOut])
def list_for_manage(
    db: Session = Depends(get_db),
    _: User = Depends(admin),
    q: str | None = None,
    limit: int = 50,
):
    """All users (incl. inactive) with role/status, for the management page."""
    stmt = select(User).where(User.deleted_at.is_(None))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(User.name.ilike(like) | User.email.ilike(like))
    rows = db.scalars(stmt.order_by(User.name).limit(min(limit, 200))).all()
    dept = {d.id: d.name for d in db.scalars(select(Department))}
    out: list[UserManageOut] = []
    for u in rows:
        o = UserManageOut.model_validate(u)
        o.department_name = dept.get(u.department_id)
        out.append(o)
    return out


@router.patch("/{user_id}/role", response_model=UserManageOut)
def change_role(
    user_id: int,
    body: RoleChangeIn,
    db: Session = Depends(get_db),
    actor: User = Depends(admin),
):
    if body.role not in _ASSIGNABLE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "sys_admin 不可通过界面授予"
        )
    if user_id == actor.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "不能修改自己的角色;请让另一位管理员代为调整",
        )
    target = db.get(User, user_id)
    if target is None or target.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    if target.role == Role.sys_admin:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "不可降级 sys_admin(系统级账号)"
        )
    before = target.role
    target.role = body.role
    db.commit()
    db.refresh(target)
    write_audit(
        db, actor_user_id=actor.id, action="user.role_change",
        resource_type="user", resource_id=str(user_id),
        payload={"from": before.value, "to": body.role.value},
    )
    dept_name = None
    if target.department_id:
        dept = db.get(Department, target.department_id)
        dept_name = dept.name if dept else None
    o = UserManageOut.model_validate(target)
    o.department_name = dept_name
    return o

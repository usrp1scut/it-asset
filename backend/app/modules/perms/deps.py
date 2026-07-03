"""`require_perm` — 配置化鉴权依赖,取代写死的 `require_roles`.

sys_admin 无条件放行;其余读 role_permissions 矩阵(锁定模块硬钉 it_admin)。
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.modules.perms import service
from app.modules.users.models import Role, User


def require_perm(module: str, action: str = "view"):
    def _checker(
        user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ) -> User:
        if user.role == Role.sys_admin:
            return user
        if not service.allowed(db, user.role, module, action):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "无该功能权限")
        return user

    return _checker

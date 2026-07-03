"""角色-模块权限矩阵.

一行 = 某角色对某功能模块的授权(可查看 / 可管理)。IT 在「角色权限」页勾选保存;
后端 `require_perm` 读这张表决定放行。sys_admin 永远全权(不入表);employee 走 H5
(入表但默认全 false)。锁定模块(用户管理/角色权限)在代码里硬钉 it_admin,不受
表内值影响,避免把自己锁死。
"""
from sqlalchemy import Boolean, Enum, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.modules.users.models import Role


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role", "module", name="uq_role_module"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"))
    module: Mapped[str] = mapped_column(String(32), index=True)
    can_view: Mapped[bool] = mapped_column(Boolean, default=False)
    can_manage: Mapped[bool] = mapped_column(Boolean, default=False)

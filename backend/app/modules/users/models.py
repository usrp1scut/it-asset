import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Role(enum.StrEnum):
    employee = "employee"
    manager = "manager"
    it_admin = "it_admin"
    procurement = "procurement"  # 行政/采购
    finance = "finance"
    sys_admin = "sys_admin"


class UserStatus(enum.StrEnum):
    active = "active"
    inactive = "inactive"  # 离职/停用 — 不硬删,保留历史归属


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    lark_department_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    # open_id is per-app; union_id is stable across apps in the same tenant — keep both.
    lark_open_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    lark_union_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    lark_user_id: Mapped[str | None] = mapped_column(String(64))

    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    mobile: Mapped[str | None] = mapped_column(String(32))

    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    manager_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    # bcrypt hash. Null for Lark-only users; required for password login.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"), default=Role.employee)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"), default=UserStatus.active
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

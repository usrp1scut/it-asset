"""角色权限矩阵 service.

单一真相 = `role_permissions` 表,启动时按 catalog.DEFAULTS 幂等补齐(不覆盖已有,
保留 IT 的编辑)。`allowed()` 是后端唯一放行判据;`effective_for()` 给前端下发导航/
按钮显隐用的有效权限。锁定模块永远只认 it_admin,不受表内值影响。
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.perms.catalog import (
    DEFAULTS,
    EDITABLE_ROLES,
    LOCKED_KEYS,
    MODE,
    MODULE_KEYS,
    MODULES,
    STORED_ROLES,
)
from app.modules.perms.models import RolePermission
from app.modules.users.models import Role


class PermError(ValueError):
    pass


def seed_defaults(db: Session) -> None:
    """Ensure a row exists for every (stored role, module). Idempotent — only
    fills gaps, so a newly added module gets sane defaults and existing admin
    edits are preserved."""
    existing = {(p.role, p.module) for p in db.scalars(select(RolePermission))}
    added = False
    for module in MODULE_KEYS:
        view_roles, manage_roles = DEFAULTS[module]
        for role in STORED_ROLES:
            if (role, module) in existing:
                continue
            db.add(
                RolePermission(
                    role=role,
                    module=module,
                    can_view=role in view_roles,
                    can_manage=role in manage_roles,
                )
            )
            added = True
    if added:
        db.commit()


def _row(db: Session, role: Role, module: str) -> RolePermission | None:
    return db.scalar(
        select(RolePermission).where(
            RolePermission.role == role, RolePermission.module == module
        )
    )


def allowed(db: Session, role: Role, module: str, action: str) -> bool:
    """Enforcement judge. sys_admin is handled by the caller (require_perm)."""
    if module in LOCKED_KEYS:
        return role == Role.it_admin  # hard-pinned, table-independent
    row = _row(db, role, module)
    if row is None:
        return False
    return (row.can_view or row.can_manage) if action == "view" else row.can_manage


def effective_for(db: Session, role: Role) -> dict[str, dict[str, bool]]:
    """Per-module {view, manage} for the current user — drives frontend gating."""
    if role == Role.sys_admin:
        return {m: {"view": True, "manage": True} for m in MODULE_KEYS}
    rows = {
        p.module: p
        for p in db.scalars(select(RolePermission).where(RolePermission.role == role))
    }
    out: dict[str, dict[str, bool]] = {}
    for module in MODULE_KEYS:
        if module in LOCKED_KEYS:
            on = role == Role.it_admin
            out[module] = {"view": on, "manage": on}
        else:
            r = rows.get(module)
            view = bool(r and (r.can_view or r.can_manage))
            out[module] = {"view": view, "manage": bool(r and r.can_manage)}
    return out


def get_matrix(db: Session) -> dict:
    """Catalog + current grants for the editable roles (for the admin page)."""
    rows = {
        (p.role, p.module): p
        for p in db.scalars(select(RolePermission))
    }
    grants: dict[str, dict[str, dict[str, bool]]] = {}
    for m in MODULE_KEYS:
        grants[m] = {}
        for role in EDITABLE_ROLES:
            r = rows.get((role, m))
            grants[m][role.value] = {
                "can_view": bool(r and r.can_view),
                "can_manage": bool(r and r.can_manage),
            }
    return {
        "modules": MODULES,
        "roles": [r.value for r in EDITABLE_ROLES],
        "grants": grants,
    }


def set_matrix(db: Session, changes: list) -> None:
    """Apply grant edits. Rejects locked/pinned modules and non-editable roles;
    manage implies view."""
    editable_role_vals = {r.value for r in EDITABLE_ROLES}
    for c in changes:
        if c.module not in MODULE_KEYS:
            raise PermError(f"未知模块 {c.module}")
        if MODE[c.module] != "config":
            raise PermError(f"「{c.module}」不可在此配置")
        if c.role not in editable_role_vals:
            raise PermError(f"角色 {c.role} 不可编辑")
        row = _row(db, Role(c.role), c.module)
        can_manage = c.can_manage
        can_view = c.can_view or can_manage  # manage implies view
        if row is None:
            row = RolePermission(role=Role(c.role), module=c.module)
            db.add(row)
        row.can_view = can_view
        row.can_manage = can_manage
    db.commit()

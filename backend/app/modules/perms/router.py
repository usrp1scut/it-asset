"""角色权限矩阵 API — 仅 IT / 系统管理员(模块 locked)。"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import write_audit
from app.deps import get_db
from app.modules.perms import service
from app.modules.perms.deps import require_perm
from app.modules.perms.schemas import MatrixUpdate
from app.modules.users.models import User

router = APIRouter(prefix="/api/role-permissions", tags=["perms"])
viewer = require_perm("perms", "view")   # locked → it_admin / sys_admin
editor = require_perm("perms", "manage")


@router.get("")
def get_matrix(db: Session = Depends(get_db), _: User = Depends(viewer)) -> dict:
    return service.get_matrix(db)


@router.put("")
def set_matrix(
    body: MatrixUpdate, db: Session = Depends(get_db), user: User = Depends(editor)
) -> dict:
    try:
        service.set_matrix(db, body.changes)
    except service.PermError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    write_audit(db, actor_user_id=user.id, action="role_permissions.update",
                resource_type="role_permissions",
                payload={"changes": len(body.changes)})
    return service.get_matrix(db)

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db import get_db
from app.modules.users.models import Role, User, UserStatus

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    payload = decode_token(creds.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token")
    user = db.get(User, int(payload["sub"]))
    if user is None or user.deleted_at is not None or user.status != UserStatus.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found or inactive")
    return user


def require_roles(*roles: Role):
    """Dependency factory — 403 unless the current user holds one of `roles`.

    sys_admin always passes (full access, see PRD §4).
    """

    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role != Role.sys_admin and user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "insufficient role")
        return user

    return _checker


# Re-export so routers can `from app.deps import get_db`.
__all__ = ["get_db", "get_current_user", "require_roles"]

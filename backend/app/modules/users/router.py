from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import create_access_token
from app.deps import get_current_user, get_db
from app.lark.client import LarkNotConfigured, get_lark_client
from app.modules.users.models import Role, User
from app.modules.users.schemas import LoginResult, MeResult, UserOut
from app.modules.users.service import upsert_user_from_lark

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LarkCallbackIn(BaseModel):
    code: str


class DevLoginIn(BaseModel):
    email: str
    name: str | None = None
    role: Role = Role.employee


@router.get("/lark/config")
def lark_config() -> dict:
    """Public, non-secret config the frontend JSSDK needs for 免登."""
    s = get_settings()
    return {"app_id": s.lark_app_id, "variant": s.lark_variant, "configured": bool(s.lark_app_id)}


@router.post("/lark/callback", response_model=LoginResult)
async def lark_callback(body: LarkCallbackIn, db: Session = Depends(get_db)) -> LoginResult:
    try:
        profile = await get_lark_client().exchange_login_code(body.code)
    except LarkNotConfigured as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    user = upsert_user_from_lark(db, profile)
    token = create_access_token(str(user.id), {"role": user.role})
    return LoginResult(token=token, user=UserOut.model_validate(user))


@router.post("/dev-login", response_model=LoginResult)
def dev_login(body: DevLoginIn, db: Session = Depends(get_db)) -> LoginResult:
    """Debug-only shortcut so the app is usable before Lark webview is wired.

    Disabled unless APP_DEBUG=true.
    """
    if not get_settings().app_debug:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    user = db.query(User).filter(User.email == body.email).one_or_none()
    if user is None:
        user = User(name=body.name or body.email.split("@")[0], email=body.email, role=body.role)
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token(str(user.id), {"role": user.role})
    return LoginResult(token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=MeResult)
def me(user: User = Depends(get_current_user)) -> MeResult:
    perms = ["*"] if user.role == Role.sys_admin else [user.role.value]
    return MeResult(user=UserOut.model_validate(user), permissions=perms)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout() -> None:
    """Stateless JWT — client discards the token. Endpoint kept for symmetry."""
    return None

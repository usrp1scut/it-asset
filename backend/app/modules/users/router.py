import hashlib
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
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


class PasswordLoginIn(BaseModel):
    email: str
    password: str


class PasswordChangeIn(BaseModel):
    old_password: str
    new_password: str


@router.get("/lark/config")
def lark_config() -> dict:
    """Public, non-secret config the frontend JSSDK needs for 免登."""
    s = get_settings()
    return {
        "app_id": s.lark_app_id,
        "variant": s.lark_variant,
        "configured": bool(s.lark_app_id),
        "jssdk_url": s.lark_jssdk_url_resolved,
    }


@router.get("/lark/jssdk-sign")
async def lark_jssdk_sign(
    url: str, _: User = Depends(get_current_user)
) -> dict:
    """Sign a JSSDK config for the current page URL so the frontend can call
    `h5sdk.config(...)` before capability-gated APIs (e.g. `tt.scanCode`).

    The `url` must be the page URL excluding the hash fragment — Lark requires
    a byte-exact match. Caller is responsible for passing
    `window.location.href.split('#')[0]`.

    Feishu rejects signatures whose `timestamp` differs from its server clock
    by more than ~5 minutes with errno 2601002 "signature is expired", so
    host clock drift on the prod box will look like a signature/url problem.
    """
    s = get_settings()
    if not s.lark_app_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Lark 未配置")
    try:
        ticket = await get_lark_client().get_jsapi_ticket()
    except LarkNotConfigured as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
    nonce_str = secrets.token_hex(8)
    timestamp = int(time.time())
    raw = f"jsapi_ticket={ticket}&noncestr={nonce_str}&timestamp={timestamp}&url={url}"
    signature = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    # `serverTime` lets the frontend detect host clock drift — Feishu rejects
    # signatures whose timestamp is more than ~5min off its own clock with
    # errno 2601002 "signature is expired".
    return {
        "appId": s.lark_app_id,
        "timestamp": timestamp,
        "nonceStr": nonce_str,
        "signature": signature,
        "serverTime": timestamp,
    }


@router.post("/lark/callback", response_model=LoginResult)
async def lark_callback(body: LarkCallbackIn, db: Session = Depends(get_db)) -> LoginResult:
    try:
        profile = await get_lark_client().exchange_login_code(body.code)
    except LarkNotConfigured as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    user = upsert_user_from_lark(db, profile)
    token = create_access_token(str(user.id), {"role": user.role})
    return LoginResult(token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=LoginResult)
def password_login(body: PasswordLoginIn, db: Session = Depends(get_db)) -> LoginResult:
    """Email + password login (the only path that works when APP_DEBUG=false)."""
    email = body.email.strip().lower()
    user = (
        db.query(User)
        .filter(User.email.is_not(None))
        .filter(User.email.ilike(email))
        .one_or_none()
    )
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "邮箱或密码错误")
    if user.deleted_at is not None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "账号已停用")
    token = create_access_token(str(user.id), {"role": user.role})
    return LoginResult(token=token, user=UserOut.model_validate(user))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChangeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if user.password_hash and not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "原密码不正确")
    if len(body.new_password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "新密码至少 8 位")
    user.password_hash = hash_password(body.new_password)
    db.commit()


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

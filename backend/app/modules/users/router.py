import hashlib
import logging
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import get_current_user, get_db, require_roles
from app.lark.client import LarkNotConfigured, get_lark_client
from app.modules.users.models import Role, User
from app.modules.users.schemas import LoginResult, MeResult, UserOut
from app.modules.users.service import upsert_user_from_lark

logger = logging.getLogger(__name__)

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
    url: str,
    force: bool = False,
    _: User = Depends(get_current_user),
) -> dict:
    """Sign a JSSDK config for the current page URL so the frontend can call
    `h5sdk.config(...)` before capability-gated APIs (e.g. `tt.scanCode`).

    The `url` must be the page URL excluding the hash fragment — Lark requires
    a byte-exact match. Caller is responsible for passing
    `window.location.href.split('#')[0]`.

    `force=true` bypasses the Redis ticket cache and refetches `jsapi_ticket`
    — used by the frontend to retry once on errno 2601002 ("signature is
    expired") when the cached ticket may have been rotated server-side before
    its advertised expiry.

    Echoes the URL the signature was computed against (`signedUrl`) so the
    frontend can compare it byte-for-byte with `window.location.href` if Lark
    keeps rejecting — query encoding / trailing slashes are common gotchas.
    """
    s = get_settings()
    if not s.lark_app_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Lark 未配置")
    try:
        ticket = await get_lark_client().get_jsapi_ticket(force=force)
    except LarkNotConfigured as e:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
    nonce_str = secrets.token_hex(8)
    # CRITICAL: Lark international (open.larksuite.com) expects `timestamp`
    # in MILLISECONDS, not seconds — confirmed by Lark's official sample
    # (lark-samples/web_app_with_jssdk/python/server.py) which signs with
    # `timestamp = int(time.time()) * 1000`. Sending seconds (a value
    # ~1.78e9) makes Lark interpret it as 1970-01-21, way past the ±5min
    # window, returning errno 2601002 "signature is expired" — the most
    # misleading error label this project has ever debugged.
    #
    # Also: use Lark's own server time (HTTP Date header) so a skewed
    # host clock can't poison the signature on top of the unit mismatch.
    local_now_s = int(time.time())
    real_now_s = await get_lark_client().probe_real_unix_time()
    base_seconds = real_now_s if real_now_s is not None else local_now_s
    timestamp = base_seconds * 1000  # milliseconds per Lark spec
    clock_drift = (local_now_s - real_now_s) if real_now_s is not None else None
    raw = f"jsapi_ticket={ticket}&noncestr={nonce_str}&timestamp={timestamp}&url={url}"
    signature = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    # Truncated preview so the frontend popup can verify a ticket was
    # actually returned (rules out an empty/garbage ticket masquerading as a
    # signing failure). Never expose the full ticket — it's a credential.
    ticket_preview = (
        f"{ticket[:4]}…{ticket[-4:]}" if ticket and len(ticket) >= 8 else "(空)"
    )
    # Log the full signing inputs (with ticket truncated) to server stderr so
    # `docker logs` can show exactly what we signed when Lark rejects with
    # errno 2601002. Mirror everything the frontend popup shows + the raw
    # pre-hash string + the host-clock-vs-real-UTC drift so we can spot a
    # skewed host without any extra ssh.
    logger.warning(
        "[Lark JSSDK sign] appId=%s apiBase=%s ticket=%s(len=%d) "
        "noncestr=%s timestamp=%d_ms (real_utc_s=%s, host_drift_s=%s) "
        "url=%s force=%s -> signature=%s",
        s.lark_app_id,
        get_lark_client().api_base,
        ticket_preview,
        len(ticket or ""),
        nonce_str,
        timestamp,
        real_now_s,
        clock_drift,
        url,
        force,
        signature,
    )
    return {
        "appId": s.lark_app_id,
        "timestamp": timestamp,
        "nonceStr": nonce_str,
        "signature": signature,
        # Diagnostics — never required by JSSDK, only consumed by error popups.
        # All "Time" fields below are in SECONDS for human-readable comparison;
        # only `timestamp` is in milliseconds (per Lark's spec).
        "serverTime": base_seconds,
        "hostLocalTime": local_now_s,
        "realUtcTime": real_now_s,
        "hostClockDrift": clock_drift,
        "signedUrl": url,
        "ticketFresh": force,
        "ticketPreview": ticket_preview,
        "ticketLength": len(ticket or ""),
        "apiBase": get_lark_client().api_base,
    }


@router.get("/lark/jssdk-sign-debug")
async def lark_jssdk_sign_debug(
    url: str,
    user: User = Depends(require_roles(Role.sys_admin)),
) -> dict:
    """Admin-only: full signing chain in cleartext (incl. raw pre-hash string
    and full ticket) so we can paste it into Lark's signature debug sandbox
    and isolate whether the algorithm itself, the ticket, or the URL is what
    Lark rejects. Restricted to sys_admin — the ticket is a credential.
    """
    s = get_settings()
    if not s.lark_app_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Lark 未配置")
    try:
        ticket = await get_lark_client().get_jsapi_ticket(force=True)
    except (LarkNotConfigured, RuntimeError) as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
    nonce_str = "DIAG" + secrets.token_hex(4)
    # Milliseconds — see jssdk-sign comment for the (painful) reason why.
    timestamp = int(time.time()) * 1000
    raw = f"jsapi_ticket={ticket}&noncestr={nonce_str}&timestamp={timestamp}&url={url}"
    signature = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    logger.warning("[Lark JSSDK debug] requested by user_id=%s url=%s", user.id, url)
    return {
        "appId": s.lark_app_id,
        "apiBase": get_lark_client().api_base,
        "ticket": ticket,
        "ticketLength": len(ticket),
        "nonceStr": nonce_str,
        "timestamp": timestamp,
        "url": url,
        "rawSignedString": raw,
        "signature": signature,
        "now": int(time.time()),
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

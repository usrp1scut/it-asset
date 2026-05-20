from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

ALGORITHM = "HS256"


def _enc(p: str) -> bytes:
    # bcrypt caps at 72 bytes; truncate utf-8 bytes to avoid raising on long /
    # multibyte passwords. Standard mitigation, consistent across hash & verify.
    return p.encode("utf-8")[:72]


def hash_password(plaintext: str) -> str:
    return bcrypt.hashpw(_enc(plaintext), bcrypt.gensalt()).decode()


def verify_password(plaintext: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_enc(plaintext), hashed.encode())
    except ValueError:
        return False


def create_access_token(subject: str, extra: dict | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None

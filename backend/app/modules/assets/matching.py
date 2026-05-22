"""Phase 0 owner/department fuzzy matching.

The imported ledger writes 使用人/部门 as free text. Lark contact sync
gives us the authoritative directory. Exact `name ==` matching fails on
the real data: trailing/full-width spaces, "张 伟", "张伟(研发)",
"张伟 13800000000", or pinyin ("Zhang Wei" / "zhangwei") vs the Chinese
Lark name. This builds an index once and resolves with ordered tiers,
only auto-accepting a *unique* hit (ambiguous → stays needs_review for
a human, never silently mis-assigned).
"""

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.models import Department, User, UserStatus

try:
    from pypinyin import lazy_pinyin
except ImportError:  # pragma: no cover - dependency declared in pyproject
    lazy_pinyin = None

_PAREN = re.compile(r"[(（].*?[)）]")
_PAREN_INNER = re.compile(r"[(（](.+?)[)）]")
_PHONE_TAIL = re.compile(r"[\s,，;；/|-]*\d[\d\s-]{5,}$")
_WS = re.compile(r"\s+")


def name_variants(name: str | None) -> list[str]:
    """Split a combined display name like 'Jacob（谢博）' into its matchable
    parts, so a dirty record holding only the English name *or* only the
    Chinese alias still resolves."""
    if not name:
        return []
    variants = {name}
    for inner in _PAREN_INNER.findall(name):
        if inner.strip():
            variants.add(inner.strip())
    outside = _PAREN.sub("", name).strip()
    if outside:
        variants.add(outside)
    return [v for v in variants if v]


def name_key(raw: str | None) -> str:
    """Whitespace/format-insensitive key (keeps CJK, drops noise)."""
    if not raw:
        return ""
    s = unicodedata.normalize("NFKC", str(raw))
    s = _PAREN.sub("", s)
    s = _PHONE_TAIL.sub("", s)
    return _WS.sub("", s).strip().casefold()


def _pinyin_key(name: str) -> str:
    if lazy_pinyin is None or not name:
        return ""
    return "".join(lazy_pinyin(unicodedata.normalize("NFKC", name))).casefold()


def _email_local(email: str | None) -> str:
    return email.split("@")[0].casefold() if email else ""


class UserIndex:
    """name/pinyin/email-local → unique user id (None if absent/ambiguous)."""

    def __init__(self, users: list[User]) -> None:
        self._by_name: dict[str, set[int]] = {}
        self._by_pinyin: dict[str, set[int]] = {}
        self._by_email: dict[str, set[int]] = {}
        for u in users:
            # index each part of a combined name ('Jacob（谢博）' → Jacob, 谢博)
            for variant in name_variants(u.name):
                self._add(self._by_name, name_key(variant), u.id)
                self._add(self._by_pinyin, _pinyin_key(variant), u.id)
            self._add(self._by_email, _email_local(u.email), u.id)

    @staticmethod
    def _add(idx: dict[str, set[int]], key: str, uid: int) -> None:
        if key:
            idx.setdefault(key, set()).add(uid)

    def resolve(self, raw: str | None) -> int | None:
        key = name_key(raw)
        if not key:
            return None
        for idx in (self._by_name, self._by_email, self._by_pinyin):
            hit = idx.get(key)
            if hit is None:
                continue
            if len(hit) == 1:
                return next(iter(hit))
            return None  # ambiguous on this tier → human review, never guess
        return None


def build_user_index(db: Session) -> UserIndex:
    users = db.scalars(
        select(User).where(
            User.status == UserStatus.active, User.deleted_at.is_(None)
        )
    ).all()
    return UserIndex(list(users))


def build_dept_index(db: Session) -> dict[str, int]:
    idx: dict[str, set[int]] = {}
    for d in db.scalars(select(Department)):
        UserIndex._add(idx, name_key(d.name), d.id)
    return {k: next(iter(v)) for k, v in idx.items() if len(v) == 1}

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.security import hash_password
from app.modules.users.models import Department, Role, User, UserStatus


def ensure_initial_admin(db: Session) -> bool:
    """Idempotent first-run admin bootstrap from env (INITIAL_ADMIN_*).

    Returns True iff a new admin row was created on this call. Safe to call
    on every startup; later runs with the same email are no-ops.
    """
    s = get_settings()
    if not (s.initial_admin_email and s.initial_admin_password):
        return False
    email = s.initial_admin_email.strip()
    existing = db.scalar(select(User).where(User.email.ilike(email)))
    if existing is not None:
        return False
    db.add(
        User(
            name=s.initial_admin_name or "管理员",
            email=email,
            role=Role.it_admin,
            status=UserStatus.active,
            password_hash=hash_password(s.initial_admin_password),
        )
    )
    db.commit()
    return True


def _display_name(profile: dict) -> str:
    """Display name the way Lark shows it — the main name plus the alias
    (别名 / nickname) in parens, e.g. 'Jacob(谢博)'."""
    name = (profile.get("name") or profile.get("en_name") or "").strip()
    alias = (profile.get("nickname") or "").strip()
    if name and alias and alias != name:
        return f"{name}（{alias}）"
    return name or alias or "未命名"


def upsert_user_from_lark(db: Session, profile: dict) -> User:
    """Idempotently create/update a user from a Lark profile.

    Match priority: union_id (stable across apps) → open_id. Lark is the source
    of truth for identity fields; role/status are managed locally and untouched.
    """
    union_id = profile.get("union_id")
    open_id = profile.get("open_id")

    user: User | None = None
    if union_id:
        user = db.scalar(select(User).where(User.lark_union_id == union_id))
    if user is None and open_id:
        user = db.scalar(select(User).where(User.lark_open_id == open_id))

    if user is None:
        user = User(name=_display_name(profile))
        db.add(user)

    user.lark_union_id = union_id or user.lark_union_id
    user.lark_open_id = open_id or user.lark_open_id
    user.lark_user_id = profile.get("user_id") or user.lark_user_id
    if profile.get("name") or profile.get("en_name") or profile.get("nickname"):
        user.name = _display_name(profile)
    user.email = profile.get("email") or user.email
    user.mobile = profile.get("mobile") or user.mobile

    # Link to the user's primary department. sync_directory upserts departments
    # before users, so the local Department row already exists by now (when the
    # department is within the app's authorised scope). Lark may prepend "0"
    # (the organisation root sentinel) to the list, so iterate and pick the
    # first id that resolves to a synced Department.
    for dept_id in profile.get("department_ids") or []:
        if not dept_id or dept_id == "0":
            continue
        dept = db.scalar(
            select(Department).where(Department.lark_department_id == dept_id)
        )
        if dept is not None:
            user.department_id = dept.id
            break

    db.commit()
    db.refresh(user)
    return user


def upsert_department(db: Session, item: dict) -> Department:
    """Idempotent upsert keyed by the Lark open_department_id.

    open_department_id is always present and stable; the tenant-custom
    department_id is optional and often blank. Users reference their
    departments by the same open id, so both sides must key on it.
    """
    lark_id = item.get("open_department_id") or item.get("department_id")
    dept = db.scalar(select(Department).where(Department.lark_department_id == lark_id))
    if dept is None:
        dept = Department(lark_department_id=lark_id, name=item.get("name") or "")
        db.add(dept)
    else:
        dept.name = item.get("name") or dept.name
    db.commit()
    db.refresh(dept)
    return dept


def reconcile_user_status(
    db: Session, present_open_ids: set[str], resigned_open_ids: set[str] | None = None
) -> int:
    """Mark Lark-sourced active users as inactive (离职) when the directory says
    they left: no longer present in the synced scope, or flagged resigned/exited.

    Safety:
    - A transient empty sync (nobody returned) is a no-op, so an API hiccup can
      never deactivate the whole company.
    - Only users with a Lark open_id are touched — locally-created accounts
      (e.g. the bootstrap admin) are never deactivated.
    - Deactivate-only: a deliberate local 停用 or a re-joined employee is left
      to manual control (we never auto-reactivate here).
    """
    if not present_open_ids:
        return 0
    resigned = resigned_open_ids or set()
    n = 0
    for u in db.scalars(
        select(User).where(User.lark_open_id.is_not(None), User.status == UserStatus.active)
    ):
        if u.lark_open_id not in present_open_ids or u.lark_open_id in resigned:
            u.status = UserStatus.inactive
            n += 1
    if n:
        db.commit()
    return n


async def sync_directory(db: Session) -> dict:
    """Pull departments + users from Lark and idempotently upsert them.

    Degrades to a no-op when Lark isn't configured so the daily beat job stays
    green pre-credentials. Endpoint/field details should be verified against the
    real tenant during integration (DEVELOPMENT_PLAN §11 risk).
    """
    from app.lark.client import LarkNotConfigured, get_lark_client

    client = get_lark_client()
    if not client.configured:
        return {"skipped": "lark_not_configured"}

    def _chunks(seq: list, n: int):
        for i in range(0, len(seq), n):
            yield seq[i : i + n]

    try:
        # 1) read the app's authorised scope (user_ids + department_ids),
        #    paginating. This is the source of truth for what we may sync —
        #    department traversal alone misses 指定成员 grants.
        user_ids: list[str] = []
        dept_ids: list[str] = []
        page_token: str | None = None
        while True:
            params = {"page_size": 100}
            if page_token:
                params["page_token"] = page_token
            data = await client.get_json("/open-apis/contact/v3/scopes", params)
            user_ids += data.get("user_ids", []) or []
            dept_ids += data.get("department_ids", []) or []
            if not data.get("has_more"):
                break
            page_token = data.get("page_token")

        depts_synced = 0
        for batch in _chunks(dept_ids, 50):
            data = await client.get_json(
                "/open-apis/contact/v3/departments/batch",
                {"department_ids": batch, "department_id_type": "open_department_id"},
            )
            for d in data.get("items", []):
                upsert_department(db, d)
                depts_synced += 1

        users_synced = 0
        users_with_dept = 0
        users_with_nickname = 0
        diag_fields: list[str] = []
        diag_department_ids = None
        present_open_ids: set[str] = set()
        resigned_open_ids: set[str] = set()
        for batch in _chunks(user_ids, 50):
            data = await client.get_json(
                "/open-apis/contact/v3/users/batch",
                {
                    "user_ids": batch,
                    "user_id_type": "open_id",
                    # request department membership as open_department_id so it
                    # matches how departments are keyed (see upsert_department)
                    "department_id_type": "open_department_id",
                },
            )
            items = data.get("items", [])
            # Capture the shape of the first profile Lark actually returns —
            # surfaces why department / alias fields may come back empty
            # (a missing field = the app lacks the scope to read it).
            if items and not diag_fields:
                diag_fields = sorted(items[0].keys())
                diag_department_ids = items[0].get("department_ids")
            for u in items:
                if (u.get("nickname") or "").strip():
                    users_with_nickname += 1
                oid = u.get("open_id")
                if oid:
                    present_open_ids.add(oid)
                    st = u.get("status") or {}
                    if st.get("is_resigned") or st.get("is_exited"):
                        resigned_open_ids.add(oid)
                synced = upsert_user_from_lark(db, u)
                users_synced += 1
                if synced.department_id is not None:
                    users_with_dept += 1

        # mark departed employees inactive (gone from the directory or resigned)
        deactivated = reconcile_user_status(db, present_open_ids, resigned_open_ids)

        # reconcile assets with the directory: auto-link unlinked owners by
        # fuzzy name match, and refresh owner_name / department snapshots
        from app.modules.assets.service import reconcile_asset_owners

        asset_recon = reconcile_asset_owners(db)
    except LarkNotConfigured:
        return {"skipped": "lark_not_configured"}

    return {
        "scope_users": len(user_ids),
        "scope_depts": len(dept_ids),
        "departments": depts_synced,
        "users": users_synced,
        "users_with_department": users_with_dept,
        "users_with_nickname": users_with_nickname,
        "deactivated": deactivated,
        "assets_linked": asset_recon["linked"],
        "assets_refreshed": asset_recon["refreshed"],
        "diag_user_fields": diag_fields,
        "diag_sample_department_ids": diag_department_ids,
    }

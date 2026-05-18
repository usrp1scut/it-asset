from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.users.models import Department, User


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
        user = User(name=profile.get("name") or profile.get("en_name") or "未命名")
        db.add(user)

    user.lark_union_id = union_id or user.lark_union_id
    user.lark_open_id = open_id or user.lark_open_id
    user.lark_user_id = profile.get("user_id") or user.lark_user_id
    if profile.get("name"):
        user.name = profile["name"]
    user.email = profile.get("email") or user.email
    user.mobile = profile.get("mobile") or user.mobile

    db.commit()
    db.refresh(user)
    return user


def upsert_department(db: Session, item: dict) -> Department:
    """Idempotent upsert keyed by Lark department_id."""
    lark_id = item.get("department_id") or item.get("open_department_id")
    dept = db.scalar(select(Department).where(Department.lark_department_id == lark_id))
    if dept is None:
        dept = Department(lark_department_id=lark_id, name=item.get("name") or "")
        db.add(dept)
    else:
        dept.name = item.get("name") or dept.name
    db.commit()
    db.refresh(dept)
    return dept


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

    try:
        depts = await client.get_paginated(
            "/open-apis/contact/v3/departments",
            {"parent_department_id": "0", "fetch_child": True, "page_size": 50},
        )
        for d in depts:
            upsert_department(db, d)

        users_synced = 0
        for d in depts:
            members = await client.get_paginated(
                "/open-apis/contact/v3/users/find_by_department",
                {"department_id": d.get("department_id"), "page_size": 50},
            )
            for m in members:
                upsert_user_from_lark(db, m)
                users_synced += 1
    except LarkNotConfigured:
        return {"skipped": "lark_not_configured"}

    return {"departments": len(depts), "users": users_synced}

import uuid

from app.db import SessionLocal
from app.lark import client as client_mod
from app.modules.users.models import User, UserStatus
from app.modules.users.service import (
    reconcile_user_status,
    sync_directory,
    upsert_department,
    upsert_user_from_lark,
)
from app.worker import celery_app
from sqlalchemy import select


def test_task_registered():
    assert "users.sync_contacts" in celery_app.tasks


async def test_sync_is_noop_without_credentials(monkeypatch):
    unconfigured = client_mod.LarkClient()
    unconfigured._app_id = ""
    unconfigured._app_secret = ""
    monkeypatch.setattr(client_mod, "get_lark_client", lambda: unconfigured)

    db = SessionLocal()
    try:
        result = await sync_directory(db)
    finally:
        db.close()
    assert result == {"skipped": "lark_not_configured"}


def test_display_name_combines_alias():
    """Lark name + alias (nickname) → combined display name 'Jacob(谢博)'."""
    db = SessionLocal()
    try:
        user = upsert_user_from_lark(
            db,
            {
                "open_id": f"ou-{uuid.uuid4().hex[:10]}",
                "name": "Jacob",
                "nickname": "谢博",
            },
        )
        assert user.name == "Jacob（谢博）"
        # no alias → plain name
        plain = upsert_user_from_lark(
            db, {"open_id": f"ou-{uuid.uuid4().hex[:10]}", "name": "Alice"}
        )
        assert plain.name == "Alice"
    finally:
        db.close()


def test_reconcile_refreshes_and_auto_links():
    """Sync reconcile: refresh linked assets + fuzzy-bind unlinked ones."""
    from app.modules.assets.service import (
        assign,
        create_asset,
        reconcile_asset_owners,
    )

    db = SessionLocal()
    try:
        # unique Chinese alias so the shared test DB stays unambiguous
        alias = f"谢博{uuid.uuid4().hex[:6]}"
        user = upsert_user_from_lark(
            db,
            {"open_id": f"ou-{uuid.uuid4().hex[:10]}", "name": "Jacob", "nickname": alias},
        )
        assert user.name == f"Jacob（{alias}）"

        # already-linked asset whose display drifted → gets refreshed
        linked = create_asset(db, {"asset_class": "personal"}, "PC", None)
        assign(db, linked, user.id, operator_id=user.id, note=None)
        linked.owner_name = "stale"
        db.commit()

        # dirty asset carrying only the Chinese alias as free text → auto-bound
        dirty = create_asset(
            db,
            {"asset_class": "personal", "owner_name": alias, "needs_review": True},
            "PC",
            None,
        )
        assert dirty.owner_user_id is None

        res = reconcile_asset_owners(db)
        db.refresh(linked)
        db.refresh(dirty)

        assert linked.owner_name == f"Jacob（{alias}）"     # snapshot refreshed
        assert dirty.owner_user_id == user.id             # fuzzy-matched on alias
        assert dirty.owner_name == f"Jacob（{alias}）"
        assert dirty.needs_review is False
        assert res["linked"] >= 1 and res["refreshed"] >= 1
    finally:
        db.close()


def test_user_sync_links_primary_department():
    """A user's department_ids resolves to the local Department even when
    Lark prepends '0' (the organisation root sentinel)."""
    db = SessionLocal()
    try:
        open_dept_id = f"od-{uuid.uuid4().hex[:10]}"
        dept = upsert_department(
            db, {"open_department_id": open_dept_id, "name": "测试事业部"}
        )
        # Lark puts "0" (org root) before the real department id — the sync
        # should skip it and resolve the real one.
        user = upsert_user_from_lark(
            db,
            {
                "open_id": f"ou-{uuid.uuid4().hex[:10]}",
                "name": "部门关联测试",
                "department_ids": ["0", open_dept_id],
            },
        )
        assert user.department_id == dept.id
    finally:
        db.close()


def test_reconcile_deactivates_departed_users():
    """Sync reconcile: a Lark user no longer in the directory → inactive (离职);
    one still present stays active; a resigned-but-present one → inactive."""
    db = SessionLocal()
    departing = staying = resigned = None
    try:
        oa = f"ou-{uuid.uuid4().hex[:10]}"
        ob = f"ou-{uuid.uuid4().hex[:10]}"
        oc = f"ou-{uuid.uuid4().hex[:10]}"
        departing = upsert_user_from_lark(db, {"open_id": oa, "name": "Departing"})
        staying = upsert_user_from_lark(db, {"open_id": ob, "name": "Staying"})
        resigned = upsert_user_from_lark(db, {"open_id": oc, "name": "Resigned"})

        # everyone currently active in the directory — used as the "present" set
        # so reconcile only touches the ones we deliberately drop/flag.
        all_active = set(
            db.scalars(
                select(User.lark_open_id).where(
                    User.lark_open_id.is_not(None), User.status == UserStatus.active
                )
            )
        )
        present = all_active - {oa}  # A dropped out of the directory
        n = reconcile_user_status(db, present, resigned_open_ids={oc})
        assert n >= 2  # at least A (gone) + C (resigned)

        for u in (departing, staying, resigned):
            db.refresh(u)
        assert departing.status == UserStatus.inactive   # gone → 离职
        assert resigned.status == UserStatus.inactive     # resigned flag → 离职
        assert staying.status == UserStatus.active        # still present → unchanged

        # Safety: an empty sync (nobody returned) must never deactivate anyone.
        staying.status = UserStatus.active
        db.commit()
        assert reconcile_user_status(db, set()) == 0
        db.refresh(staying)
        assert staying.status == UserStatus.active
    finally:
        for u in (departing, staying, resigned):
            if u is not None:
                db.delete(db.get(User, u.id))
        db.commit()
        db.close()


def test_login_does_not_overwrite_synced_name():
    """Login path (update_name=False) keeps the synced 中文 name even when the
    login profile carries only an English name; contact sync still updates it;
    a brand-new login user still gets a name on creation."""
    db = SessionLocal()
    try:
        oid = f"ou-{uuid.uuid4().hex[:10]}"
        # contact sync sets the localized name
        u = upsert_user_from_lark(db, {"open_id": oid, "name": "谢博"})
        assert u.name == "谢博"
        # login returns only the English name → must NOT overwrite
        again = upsert_user_from_lark(db, {"open_id": oid, "name": "Jacob"}, update_name=False)
        assert again.id == u.id
        assert again.name == "谢博"
        # a later contact sync still refreshes the name (default update_name=True)
        synced = upsert_user_from_lark(db, {"open_id": oid, "name": "谢博（PM）"})
        assert synced.name == "谢博（PM）"
        # a brand-new user via the login path still gets a name on creation
        fresh = upsert_user_from_lark(
            db, {"open_id": f"ou-{uuid.uuid4().hex[:10]}", "name": "NewGuy"}, update_name=False
        )
        assert fresh.name == "NewGuy"
    finally:
        db.close()

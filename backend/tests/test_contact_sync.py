import uuid

from app.db import SessionLocal
from app.lark import client as client_mod
from app.modules.users.service import (
    sync_directory,
    upsert_department,
    upsert_user_from_lark,
)
from app.worker import celery_app


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
    """A user's department_ids[0] (open_department_id) links to the local
    Department, which is keyed by the same open_department_id."""
    db = SessionLocal()
    try:
        open_dept_id = f"od-{uuid.uuid4().hex[:10]}"
        dept = upsert_department(
            db, {"open_department_id": open_dept_id, "name": "测试事业部"}
        )
        user = upsert_user_from_lark(
            db,
            {
                "open_id": f"ou-{uuid.uuid4().hex[:10]}",
                "name": "部门关联测试",
                "department_ids": [open_dept_id],
            },
        )
        assert user.department_id == dept.id
    finally:
        db.close()

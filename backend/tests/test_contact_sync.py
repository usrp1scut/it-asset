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


def test_refresh_owner_snapshots_tracks_directory():
    """A directory rename propagates onto assets owned by that user."""
    from app.modules.assets.service import (
        assign,
        create_asset,
        refresh_owner_snapshots,
    )

    db = SessionLocal()
    try:
        user = upsert_user_from_lark(
            db, {"open_id": f"ou-{uuid.uuid4().hex[:10]}", "name": "旧名"}
        )
        asset = create_asset(db, {"asset_class": "personal"}, "PC", None)
        assign(db, asset, user.id, operator_id=user.id, note=None)
        assert asset.owner_name == "旧名"

        user.name = "新名（Alias）"
        db.commit()
        n = refresh_owner_snapshots(db)
        db.refresh(asset)
        assert n >= 1
        assert asset.owner_name == "新名（Alias）"
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

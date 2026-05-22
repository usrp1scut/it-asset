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

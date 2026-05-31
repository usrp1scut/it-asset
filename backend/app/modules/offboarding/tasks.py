import anyio

from app.config import get_settings
from app.db import SessionLocal
from app.lark.client import LarkNotConfigured, get_lark_client
from app.modules.offboarding import service
from app.worker import celery_app


async def _alert(text: str) -> bool:
    settings = get_settings()
    client = get_lark_client()
    if not client.configured or not settings.lark_alert_chat_id:
        return False
    try:
        await client.send_text(settings.lark_alert_chat_id, text)
        return True
    except LarkNotConfigured:
        return False


@celery_app.task(name="offboarding.scan_overdue")
def scan_overdue() -> dict:
    """Daily scan: flip in-progress cases past their last day (with pending
    items) to overdue, then alert IT. No-op-safe before Lark is configured."""
    db = SessionLocal()
    try:
        flipped = service.scan_overdue(db)
    finally:
        db.close()
    pushed = (
        anyio.run(_alert, f"【离职归还】有 {flipped} 个工单已逾期仍未归还,请跟进。")
        if flipped
        else False
    )
    return {"flipped": flipped, "pushed": pushed}

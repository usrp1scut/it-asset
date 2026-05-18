import anyio

from app.config import get_settings
from app.db import SessionLocal
from app.lark.client import LarkNotConfigured, get_lark_client
from app.modules.inventory.service import low_stock_skus
from app.worker import celery_app


async def _notify(lines: list[str]) -> bool:
    settings = get_settings()
    client = get_lark_client()
    if not client.configured or not settings.lark_alert_chat_id:
        return False
    try:
        await client.send_text(
            settings.lark_alert_chat_id, "库存预警:\n" + "\n".join(lines)
        )
        return True
    except LarkNotConfigured:
        return False


@celery_app.task(name="inventory.scan_low_stock")
def scan_low_stock() -> dict:
    """Daily low-stock scan. Pushes a Lark alert when configured; always
    returns the summary so the beat job is green pre-credentials."""
    db = SessionLocal()
    try:
        low = low_stock_skus(db)
        lines = [
            f"{s.name}({s.sku_code}) 当前 {avail},安全 {s.safety_stock}"
            for s, avail in low
        ]
    finally:
        db.close()
    pushed = anyio.run(_notify, lines) if lines else False
    return {"low_stock_count": len(lines), "pushed": pushed}

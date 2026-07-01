"""领用确认卡片 — send an interactive Lark card on asset assign / stock issue,
and record the employee's tap of 「确认收到」 (updating the card in place).

All Lark I/O is no-op-safe: if Lark isn't configured / the user has no open_id /
the API errors, the business flow is never broken.
"""

import logging
from datetime import UTC, datetime

import anyio

from app.lark.cards import receipt_card
from app.lark.client import get_lark_client
from app.modules.assets.models import Asset, AssetAssignment
from app.modules.inventory.models import EmployeeItemIssue, Sku

log = logging.getLogger(__name__)

ASSET = "asset"
ISSUE = "issue"


def _asset_card_parts(db, rec: AssetAssignment) -> tuple[str, list[str]]:
    asset = db.get(Asset, rec.asset_id)
    code = asset.asset_code if asset else "—"
    model = (asset.brand_model if asset else None) or "—"
    return "资产领用确认", [
        "你有一项资产被分配,请核对后点「确认收到」:",
        f"**资产编号**:{code}",
        f"**名称/型号**:{model}",
    ]


def _issue_card_parts(db, rec: EmployeeItemIssue) -> tuple[str, list[str]]:
    sku = db.get(Sku, rec.sku_id)
    name = sku.name if sku else "—"
    unit = (sku.unit if sku else None) or ""
    return "物品领用确认", [
        "你领用了以下物品,请核对后点「确认收到」:",
        f"**物品**:{name}",
        f"**数量**:{rec.quantity} {unit}",
    ]


def _load(db, kind: str, record_id: int):
    model = AssetAssignment if kind == ASSET else EmployeeItemIssue
    return db.get(model, record_id)


def _parts(db, kind: str, rec) -> tuple[str, list[str]]:
    return _asset_card_parts(db, rec) if kind == ASSET else _issue_card_parts(db, rec)


def send_receipt(db, *, kind: str, record_id: int, open_id: str | None) -> None:
    """Send the confirmation card for a just-created assignment/issue and store
    its message id on the record. No-op-safe."""
    client = get_lark_client()
    if not client.configured or not open_id:
        return
    rec = _load(db, kind, record_id)
    if rec is None:
        return
    title, lines = _parts(db, kind, rec)
    card = receipt_card(title=title, lines=lines, ack_value={"ack": kind, "id": record_id})
    try:
        msg_id = anyio.run(client.send_user_card, open_id, card)
    except Exception:  # noqa: BLE001 — notification must not break the flow
        log.exception("send_receipt failed (kind=%s id=%s)", kind, record_id)
        return
    if msg_id:
        rec.receipt_msg_id = msg_id
        db.commit()


def confirm_receipt(db, *, kind: str, record_id: int) -> bool:
    """Record the employee's 确认收到 and update the card in place. Idempotent:
    returns False if the record is missing or was already acknowledged."""
    if kind not in (ASSET, ISSUE):
        return False
    rec = _load(db, kind, record_id)
    if rec is None or rec.acknowledged_at is not None:
        return False
    now = datetime.now(UTC)
    rec.acknowledged_at = now
    db.commit()
    # Update the card to its acknowledged state (best-effort).
    if rec.receipt_msg_id:
        title, lines = _parts(db, kind, rec)
        card = receipt_card(
            title=title,
            lines=lines,
            ack_value={"ack": kind, "id": record_id},
            acknowledged=True,
            ack_time=now.astimezone().strftime("%Y-%m-%d %H:%M"),
        )
        client = get_lark_client()
        if client.configured:
            try:
                anyio.run(client.update_card, rec.receipt_msg_id, card)
            except Exception:  # noqa: BLE001 — ack is already recorded
                log.exception("confirm_receipt: card update failed (kind=%s id=%s)",
                              kind, record_id)
    return True

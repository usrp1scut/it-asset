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


def confirm_receipt(db, *, kind: str, record_id: int) -> tuple[bool, dict | None]:
    """Record the employee's 确认收到 and return ``(newly_recorded, ack_card)``.

    ``ack_card`` is the acknowledged-state card JSON, which the WS card-action
    handler echoes straight back in its callback response — updating the card
    *in place* without a second API call, so it stays inside Lark's ~3 s
    callback window (the old out-of-band PATCH could time out / fail silently,
    which is why taps appeared to do nothing). ``ack_card`` is ``None`` only
    when the record is missing or the kind is unknown.

    Idempotent: a repeat tap returns ``newly_recorded=False`` but still yields
    the acknowledged card, so a stale button (whose earlier update was lost)
    still flips to 已确认 when tapped again.
    """
    if kind not in (ASSET, ISSUE):
        return False, None
    rec = _load(db, kind, record_id)
    if rec is None:
        return False, None
    newly = rec.acknowledged_at is None
    if newly:
        rec.acknowledged_at = datetime.now(UTC)
        db.commit()
    title, lines = _parts(db, kind, rec)
    card = receipt_card(
        title=title,
        lines=lines,
        ack_value={"ack": kind, "id": record_id},
        acknowledged=True,
        ack_time=rec.acknowledged_at.astimezone().strftime("%Y-%m-%d %H:%M"),
    )
    return newly, card

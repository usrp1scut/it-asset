"""Lark Event Subscription via long-connection (WebSocket).

Pure-intranet friendly: the backend dials OUT to Lark over a persistent
WebSocket and events/card-callbacks are pushed down that connection — no
public inbound URL, no tunnel. Signature/encryption are handled by the
official SDK at the transport layer.

Run as a standalone long-lived process (see the `lark-ws` compose service).
Reuses approvals.service.apply_card_decision so webhook and WS share one
code path. Degrades to a clean exit when credentials are absent so the
service does not crash-loop before the app is configured.
"""

import json
import logging

import lark_oapi as lark

from app.config import get_settings
from app.db import SessionLocal
from app.modules.approvals import service
from app.modules.offboarding import service as offboarding_service

log = logging.getLogger("lark.ws")


def _on_user_deleted(data) -> None:
    """Contact `user.deleted` (员工离职/移除) → auto-create an offboarding case.
    Alerts IT only; the leaver is messaged later via the IT-confirm gate."""
    try:
        obj = getattr(getattr(data, "event", None), "object", None)
        open_id = getattr(obj, "open_id", None)
        user_id = getattr(obj, "user_id", None)
        if not (open_id or user_id):
            log.warning("user.deleted event without an id; skipping")
            return
        db = SessionLocal()
        try:
            case = offboarding_service.create_from_lark(
                db, lark_open_id=open_id, lark_user_id=user_id
            )
            log.info("offboarding auto-create from user.deleted: %s", case.case_no if case else None)
        finally:
            db.close()
    except Exception:  # noqa: BLE001 — a bad event must not kill the connection
        log.exception("failed handling user.deleted")


def _on_card_action(data) -> None:
    """P2 card-action callback → apply the embedded approve/reject."""
    try:
        action = getattr(getattr(data, "event", None), "action", None)
        value = getattr(action, "value", None)
        if isinstance(value, str):
            value = json.loads(value)
        value = value or {}
        db = SessionLocal()
        try:
            ok = service.apply_card_decision(
                db, value.get("approval_id"), value.get("decision")
            )
            log.info("card decision applied=%s value=%s", ok, value)
        finally:
            db.close()
    except Exception:  # noqa: BLE001 — a bad callback must not kill the connection
        log.exception("failed handling card action")


def build_client() -> "lark.ws.Client | None":
    s = get_settings()
    if not (s.lark_app_id and s.lark_app_secret):
        log.warning("Lark not configured — long-connection client not started")
        return None

    builder = lark.EventDispatcherHandler.builder(
        s.lark_verification_token, s.lark_encrypt_key
    ).register_p2_card_action_trigger(_on_card_action)
    # Contact user-deleted registration is SDK-version dependent — wire it only
    # if this build exposes it, so an older SDK doesn't break the connection.
    reg = getattr(builder, "register_p2_contact_user_deleted_v3", None)
    if reg is not None:
        builder = reg(_on_user_deleted)
    else:
        log.warning(
            "SDK lacks contact.user.deleted_v3 trigger — offboarding auto-create disabled"
        )
    handler = builder.build()
    # domain is a base-URL string; reuse the settings value (variant-aware,
    # honours explicit overrides).
    return lark.ws.Client(
        s.lark_app_id,
        s.lark_app_secret,
        event_handler=handler,
        domain=s.lark_api_base_url,
        log_level=lark.LogLevel.INFO,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    client = build_client()
    if client is None:
        return
    client.start()  # blocking — maintains the long connection


if __name__ == "__main__":
    main()

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

log = logging.getLogger("lark.ws")


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

    handler = (
        lark.EventDispatcherHandler.builder(
            s.lark_verification_token, s.lark_encrypt_key
        )
        .register_p2_card_action_trigger(_on_card_action)
        .build()
    )
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

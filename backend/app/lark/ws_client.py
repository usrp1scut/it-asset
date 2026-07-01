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
import os
import threading
import time

import lark_oapi as lark

from app.config import get_settings
from app.db import SessionLocal
from app.modules.approvals import service
from app.modules.offboarding import service as offboarding_service

log = logging.getLogger("lark.ws")

# Liveness file touched by a background thread; the container healthcheck reads
# its freshness to tell a frozen WS process from a live one.
_HEARTBEAT_FILE = os.environ.get("LARK_WS_HEARTBEAT", "/tmp/lark_ws_alive")


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
            log.info(
                "offboarding auto-create from user.deleted: %s",
                case.case_no if case else None,
            )
        finally:
            db.close()
    except Exception:  # noqa: BLE001 — a bad event must not kill the connection
        log.exception("failed handling user.deleted")


def _ack_response(content: dict):
    """Wrap a card-action callback body in the SDK response type, if available.
    Returning it makes Lark show the toast / swap the card synchronously; if the
    SDK shape differs we fall back to None (best-effort, never crash)."""
    try:
        from lark_oapi.event.callback.model.p2_card_action_trigger import (
            P2CardActionTriggerResponse,
        )

        return P2CardActionTriggerResponse(content)
    except Exception:  # noqa: BLE001 — response is best-effort feedback only
        log.exception("could not build card-action response")
        return None


def _on_card_action(data):
    """P2 card-action callback → apply an approval decision, or a 领用确认 ack.

    For the 领用确认 tap we return a response carrying a toast + the acknowledged
    card, so the employee gets instant feedback and the button flips to 已确认
    in place (no fragile second API call)."""
    try:
        event = getattr(data, "event", None)
        action = getattr(event, "action", None)
        value = getattr(action, "value", None)
        if isinstance(value, str):
            value = json.loads(value)
        value = value or {}
        op_open_id = getattr(getattr(event, "operator", None), "open_id", None)
        db = SessionLocal()
        try:
            if value.get("ack"):
                from app.lark import receipts

                newly, card = receipts.confirm_receipt(
                    db, kind=value.get("ack"), record_id=value.get("id")
                )
                log.info("receipt ack newly=%s found=%s value=%s",
                         newly, card is not None, value)
                if card is None:
                    return _ack_response(
                        {"toast": {"type": "error", "content": "未找到该领用记录"}}
                    )
                return _ack_response({
                    "toast": {
                        "type": "success",
                        "content": "已确认收到,感谢!" if newly else "已确认过啦",
                    },
                    "card": {"type": "raw", "data": card},
                })
            ok = service.apply_card_decision(
                db, value.get("approval_id"), value.get("decision"),
                operator_open_id=op_open_id,
            )
            log.info("card decision applied=%s value=%s", ok, value)
            return None
        finally:
            db.close()
    except Exception:  # noqa: BLE001 — a bad callback must not kill the connection
        log.exception("failed handling card action")
        return None


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


def _start_heartbeat() -> None:
    """Touch the liveness file every 30s so the healthcheck can distinguish a
    live WS loop from a fully frozen process (a hung process stops touching it)."""

    def loop() -> None:
        while True:
            try:
                with open(_HEARTBEAT_FILE, "w") as f:
                    f.write(str(int(time.time())))
            except OSError:
                log.warning("could not write heartbeat file %s", _HEARTBEAT_FILE)
            time.sleep(30)

    threading.Thread(target=loop, name="lark-ws-heartbeat", daemon=True).start()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    client = build_client()
    if client is None:
        return
    _start_heartbeat()
    # client.start() blocks while the long connection is up. The SDK reconnects
    # internally, but if start() ever returns/raises the connection is gone —
    # loop with backoff so 领用确认 / approval callbacks keep being delivered
    # instead of the process quietly dying (SIGTERM on shutdown still exits us).
    backoff = 1
    while True:
        began = time.monotonic()
        try:
            client.start()
            log.warning("lark-ws connection closed; reconnecting")
        except Exception:  # noqa: BLE001 — keep the callback pipe alive
            log.exception("lark-ws connection error; reconnecting")
        if time.monotonic() - began > 60:
            backoff = 1  # a healthy long-lived connection just ended; reset
        time.sleep(backoff)
        backoff = min(backoff * 2, 30)


if __name__ == "__main__":
    main()

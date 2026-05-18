"""Lark Event Subscription security — AES decrypt + signature + token.

Implements the v2 Event Subscription contract:
  * if an Encrypt Key is set, the body is {"encrypt": "<base64>"}; decrypt with
    AES-256-CBC, key = sha256(encrypt_key), IV = first 16 bytes of the blob.
  * verify X-Lark-Signature = sha256(timestamp + nonce + encrypt_key + body).
  * the decoded payload carries `token`; it must equal the verification token.

When neither token nor encrypt key is configured we are in local-dev mode and
checks are skipped (config docstring warns this is not for production).
"""

import base64
import hashlib
import json

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from app.config import get_settings


class WebhookAuthError(Exception):
    pass


def _decrypt(encrypt_b64: str, encrypt_key: str) -> str:
    blob = base64.b64decode(encrypt_b64)
    key = hashlib.sha256(encrypt_key.encode()).digest()
    iv, ciphertext = blob[:16], blob[16:]
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()
    pad_len = padded[-1]
    return padded[:-pad_len].decode("utf-8")


def verify_signature(
    timestamp: str, nonce: str, encrypt_key: str, body: bytes, signature: str
) -> bool:
    digest = hashlib.sha256(
        timestamp.encode() + nonce.encode() + encrypt_key.encode() + body
    ).hexdigest()
    return digest == signature


def process_webhook(headers: dict, raw_body: bytes) -> dict:
    """Return the verified, decoded webhook payload (raises on auth failure)."""
    settings = get_settings()
    body = json.loads(raw_body or b"{}")

    if settings.lark_encrypt_key:
        if "encrypt" not in body:
            raise WebhookAuthError("encrypt key configured but payload not encrypted")
        sig = headers.get("x-lark-signature")
        ts = headers.get("x-lark-request-timestamp", "")
        nonce = headers.get("x-lark-request-nonce", "")
        # Signature header is present on event callbacks (not the initial
        # url_verification handshake); enforce it when supplied.
        if sig and not verify_signature(
            ts, nonce, settings.lark_encrypt_key, raw_body, sig
        ):
            raise WebhookAuthError("bad signature")
        body = json.loads(_decrypt(body["encrypt"], settings.lark_encrypt_key))

    if settings.lark_verification_token:
        token = body.get("token") or body.get("header", {}).get("token")
        if token != settings.lark_verification_token:
            raise WebhookAuthError("bad verification token")

    return body

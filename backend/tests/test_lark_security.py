import base64
import hashlib
import json
import os

from app.config import Settings
from app.lark import security
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


def _encrypt(plain: str, key: str) -> str:
    k = hashlib.sha256(key.encode()).digest()
    iv = os.urandom(16)
    data = plain.encode()
    pad = 16 - len(data) % 16
    data += bytes([pad]) * pad
    enc = Cipher(algorithms.AES(k), modes.CBC(iv)).encryptor()
    return base64.b64encode(iv + enc.update(data) + enc.finalize()).decode()


def test_decrypt_roundtrip():
    msg = json.dumps({"hello": "世界", "n": 1})
    assert security._decrypt(_encrypt(msg, "k3y"), "k3y") == msg


def test_verify_signature():
    body = b'{"a":1}'
    sig = hashlib.sha256(b"ts" + b"nonce" + b"ek" + body).hexdigest()
    assert security.verify_signature("ts", "nonce", "ek", body, sig)
    assert not security.verify_signature("ts", "nonce", "ek", body, "deadbeef")


def test_token_enforced_when_configured(monkeypatch):
    monkeypatch.setattr(
        security, "get_settings",
        lambda: Settings(lark_verification_token="VT", lark_encrypt_key=""),
    )
    # good token passes through
    ok = security.process_webhook({}, json.dumps({"token": "VT", "x": 1}).encode())
    assert ok["x"] == 1
    # bad token rejected
    try:
        security.process_webhook({}, json.dumps({"token": "nope"}).encode())
        raise AssertionError("should have raised")
    except security.WebhookAuthError:
        pass


def test_encrypted_payload_decoded(monkeypatch):
    monkeypatch.setattr(
        security, "get_settings",
        lambda: Settings(lark_verification_token="", lark_encrypt_key="EK"),
    )
    inner = json.dumps({"type": "url_verification", "challenge": "abc"})
    body = json.dumps({"encrypt": _encrypt(inner, "EK")}).encode()
    out = security.process_webhook({}, body)
    assert out["challenge"] == "abc"

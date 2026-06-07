import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin"):
    j = client.post(
        "/api/auth/dev-login",
        json={"email": f"{role}-{uuid.uuid4().hex[:8]}@c.com", "role": role},
    ).json()
    return {"Authorization": f"Bearer {j['token']}"}, j["user"]


def _type_id(h, prefix: str) -> int:
    types = client.get("/api/asset-types", headers=h).json()
    return next(t["id"] for t in types if t["code_prefix"] == prefix)


def test_inspection_remind_targets_pending_owners():
    admin, _ = _login("it_admin")
    emp_h, emp = _login("employee")
    pc = _type_id(admin, "PC")
    # an in-use personal asset assigned to the employee → the inspection item
    # has a responsible person to remind.
    code = client.post(
        "/api/assets", json={"asset_type_id": pc, "brand_model": "盘点机"}, headers=admin
    ).json()["asset_code"]
    client.post(f"/api/assets/{code}/assign", json={"user_id": emp["id"]}, headers=admin)
    task = client.post(
        "/api/inspections",
        json={"name": f"催办测试{uuid.uuid4().hex[:4]}", "scope_type": "personal_in_use"},
        headers=admin,
    ).json()
    tid = task["id"]

    r = client.post(f"/api/inspections/{tid}/remind", headers=admin)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["targets"] >= 1  # at least our assigned asset's owner
    # Every targeted owner is either DM'd or skipped (no open_id / Lark off) —
    # env-agnostic invariant. Test users have no open_id, so nothing real sends.
    assert body["reminded"] + body["not_sent"] == body["targets"]
    assert "ownerless_pending" in body and "lark_configured" in body

    # A closed task can't be reminded.
    assert client.post(f"/api/inspections/{tid}/close", headers=admin).status_code == 200
    assert client.post(f"/api/inspections/{tid}/remind", headers=admin).status_code == 409

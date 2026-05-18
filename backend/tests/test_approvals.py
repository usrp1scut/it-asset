import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str):
    j = client.post(
        "/api/auth/dev-login",
        json={"email": f"{role}-{uuid.uuid4().hex[:8]}@c.com", "role": role},
    ).json()
    return {"Authorization": f"Bearer {j['token']}"}, j["user"]


def _stocked_sku(h, qty: int) -> int:
    loc = client.post(
        "/api/inventory/locations", json={"name": f"L-{uuid.uuid4().hex[:5]}"}, headers=h
    ).json()["id"]
    sku = client.post(
        "/api/skus",
        json={"sku_code": f"SK-{uuid.uuid4().hex[:8]}", "name": "鼠标",
              "default_location_id": loc, "safety_stock": 0},
        headers=h,
    ).json()
    client.post("/api/inventory/receive",
                json={"sku_id": sku["id"], "quantity": qty}, headers=h)
    return sku["id"]


def test_submit_approve_fulfill_deducts_stock():
    admin, _ = _login("it_admin")
    emp_h, emp = _login("employee")
    sid = _stocked_sku(admin, 10)

    r = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 3}],
              "reason": "会议室需要"},
        headers=emp_h,
    )
    assert r.status_code == 201
    rid = r.json()["id"]
    assert r.json()["status"] == "pending"

    a = client.post(f"/api/approvals/{rid}/approve", headers=admin)
    assert a.json()["status"] == "approved"
    f = client.post(f"/api/approvals/{rid}/fulfill", headers=admin)
    assert f.status_code == 200 and f.json()["status"] == "fulfilled"

    # stock deducted 10 -> 7
    skus = client.get("/api/skus", headers=admin).json()["items"]
    assert next(s for s in skus if s["id"] == sid)["available"] == 7
    # employee sees the issue
    me = client.get("/api/m/me", headers=emp_h).json()
    assert any(i["sku_id"] == sid for i in me["issues"])


def test_reject_and_bad_state():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 5)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "x"},
        headers=emp_h,
    ).json()["id"]
    assert client.post(f"/api/approvals/{rid}/reject", headers=admin).json()["status"] == "rejected"
    # cannot fulfill a rejected request
    assert client.post(f"/api/approvals/{rid}/fulfill", headers=admin).status_code == 409


def test_fulfill_insufficient_stock_blocked():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 2)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 9}],
              "reason": "too many"},
        headers=emp_h,
    ).json()["id"]
    client.post(f"/api/approvals/{rid}/approve", headers=admin)
    assert client.post(f"/api/approvals/{rid}/fulfill", headers=admin).status_code == 409


def test_employee_cannot_approve():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 3)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "x"},
        headers=emp_h,
    ).json()["id"]
    assert client.post(f"/api/approvals/{rid}/approve", headers=emp_h).status_code == 403


def test_lark_webhook_url_verification():
    r = client.post("/api/lark/webhook", json={"type": "url_verification",
                                               "challenge": "abc123"})
    assert r.status_code == 200 and r.json()["challenge"] == "abc123"


def test_dashboard_pending_reflects_requests():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 4)
    client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "x"},
        headers=emp_h,
    )
    ov = client.get("/api/dashboard/overview", headers=admin).json()
    assert ov["stats"]["pending_approvals"] >= 1
    assert len(ov["recent_approvals"]) >= 1

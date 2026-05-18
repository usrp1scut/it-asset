import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _admin() -> dict:
    tok = client.post(
        "/api/auth/dev-login",
        json={"email": f"dash-{uuid.uuid4().hex[:8]}@c.com", "role": "it_admin"},
    ).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


def test_overview_shape():
    h = _admin()
    # create + assign an asset so there is lifecycle to aggregate
    emp = client.post(
        "/api/auth/dev-login", json={"email": f"e-{uuid.uuid4().hex[:6]}@c.com"}
    ).json()["user"]
    pc = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=h
    ).json()
    client.post(
        f"/api/assets/{pc['asset_code']}/assign",
        json={"user_id": emp["id"]}, headers=h,
    )

    o = client.get("/api/dashboard/overview", headers=h).json()
    s = o["stats"]
    assert s["total_assets"] >= 1
    assert isinstance(s["pending_approvals"], int)  # real once Sprint 4 landed
    assert {"in_use_count", "idle_count", "maintenance_count", "scrapped_count"} <= s.keys()
    assert len(o["status_distribution"]) == 4
    for k in ("assignment", "return", "repair"):
        assert len(o["trends"][k]) == 12
    assert isinstance(o["recent_assignments"], list)
    assert isinstance(o["recent_approvals"], list)


def test_audit_logs_admin_only():
    h = _admin()
    client.post("/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=h)
    r = client.get("/api/audit-logs", headers=h)
    assert r.status_code == 200
    assert r.json()["total"] >= 1

    emp = client.post(
        "/api/auth/dev-login", json={"email": f"e-{uuid.uuid4().hex[:6]}@c.com"}
    ).json()["token"]
    assert client.get(
        "/api/audit-logs", headers={"Authorization": f"Bearer {emp}"}
    ).status_code == 403


def test_inspection_flow():
    h = _admin()
    emp = client.post(
        "/api/auth/dev-login", json={"email": f"e-{uuid.uuid4().hex[:6]}@c.com"}
    ).json()
    pc = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=h
    ).json()
    client.post(
        f"/api/assets/{pc['asset_code']}/assign",
        json={"user_id": emp["user"]["id"]}, headers=h,
    )

    task = client.post(
        "/api/inspections", json={"name": "2026 Q2 盘点"}, headers=h
    ).json()
    assert task["item_count"] >= 1

    emp_h = {"Authorization": f"Bearer {emp['token']}"}
    c = client.post(
        f"/api/inspections/{task['id']}/items/{pc['asset_code']}/confirm",
        json={"status": "ok"}, headers=emp_h,
    )
    assert c.status_code == 200 and c.json()["confirm_status"] == "ok"

    detail = client.get(f"/api/inspections/{task['id']}", headers=h).json()
    assert detail["progress"]["ok"] >= 1

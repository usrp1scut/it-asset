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
    # detail items now include brand_model / owner_name / asset_status / location
    assert any("brand_model" in it and "asset_status" in it for it in detail["items"])

    # list endpoint shows the task with progress
    lst = client.get("/api/inspections", headers=h).json()
    assert any(t["id"] == task["id"] and t["progress"]["ok"] >= 1 for t in lst)


def test_inspection_scopes_and_mismatches():
    h = _admin()
    # personal_in_use with no in-use assets → empty task is still valid
    t1 = client.post(
        "/api/inspections",
        json={"name": "scope-personal_in_use", "scope_type": "personal_in_use"},
        headers=h,
    )
    assert t1.status_code == 201 and t1.json()["scope_type"] == "personal_in_use"

    # infrastructure scope
    net = client.post(
        "/api/assets", json={"asset_class": "infrastructure", "prefix": "NET"}, headers=h
    ).json()
    t2 = client.post(
        "/api/inspections",
        json={"name": "scope-infra", "scope_type": "infrastructure"},
        headers=h,
    ).json()
    assert t2["scope_type"] == "infrastructure" and t2["item_count"] >= 1

    # bad scope
    bad = client.post(
        "/api/inspections", json={"name": "x", "scope_type": "nonsense"}, headers=h
    )
    assert bad.status_code == 400

    # by_location without location → 400
    miss = client.post(
        "/api/inspections", json={"name": "x", "scope_type": "by_location"}, headers=h
    )
    assert miss.status_code == 400

    # mismatch flow
    emp = client.post(
        "/api/auth/dev-login", json={"email": f"m-{uuid.uuid4().hex[:6]}@c.com"}
    ).json()
    client.post(
        f"/api/inspections/{t2['id']}/items/{net['asset_code']}/confirm",
        json={"status": "mismatch", "remark": "序列号对不上"},
        headers={"Authorization": f"Bearer {emp['token']}"},
    )
    mm = client.get(f"/api/inspections/{t2['id']}/mismatches", headers=h)
    assert mm.status_code == 200
    assert any(i["asset_code"] == net["asset_code"] and i["remark"] for i in mm.json())

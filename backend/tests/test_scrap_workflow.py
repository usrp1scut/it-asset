import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin") -> tuple[dict, dict]:
    j = client.post(
        "/api/auth/dev-login",
        json={"email": f"{role}-{uuid.uuid4().hex[:8]}@c.com", "role": role},
    ).json()
    return {"Authorization": f"Bearer {j['token']}"}, j["user"]


def _create_asset(h: dict) -> dict:
    return client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=h,
    ).json()


def test_full_scrap_workflow():
    a_h, a_user = _login("it_admin")  # proposer
    b_h, b_user = _login("it_admin")  # approver
    asset = _create_asset(a_h)
    code = asset["asset_code"]

    # 1) submit
    r = client.post(
        f"/api/assets/{code}/scrap-request",
        json={"reason": "硬盘损坏,无法点亮"}, headers=a_h,
    )
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["status"] == "pending" and req["proposer_id"] == a_user["id"]
    rid = req["id"]

    # asset stays idle and gains scrap_candidate=true
    detail = client.get(f"/api/assets/{code}", headers=a_h).json()["asset"]
    assert detail["status"] == "idle" and detail["scrap_candidate"] is True

    # 2) self-approve forbidden
    self_app = client.post(
        f"/api/scrap-requests/{rid}/approve", json={}, headers=a_h,
    )
    assert self_app.status_code == 409 and "自己" in self_app.json()["detail"]

    # cannot dispose before approve
    early = client.post(
        f"/api/scrap-requests/{rid}/dispose",
        json={"disposition_method": "recycle"}, headers=b_h,
    )
    assert early.status_code == 409

    # 3) another admin approves
    ap = client.post(
        f"/api/scrap-requests/{rid}/approve",
        json={"remark": "确认报废"}, headers=b_h,
    )
    assert ap.status_code == 200 and ap.json()["status"] == "approved"
    assert ap.json()["approver_id"] == b_user["id"]

    # cannot submit a second request while one is open
    dup = client.post(
        f"/api/assets/{code}/scrap-request",
        json={"reason": "重复"}, headers=a_h,
    )
    assert dup.status_code == 409

    # 4) dispose flips asset → scrapped
    d = client.post(
        f"/api/scrap-requests/{rid}/dispose",
        json={"disposition_method": "resale", "residual_value": "100.50",
              "remark": "二手平台转售"},
        headers=b_h,
    )
    assert d.status_code == 200 and d.json()["status"] == "disposed"
    final = client.get(f"/api/assets/{code}", headers=a_h).json()["asset"]
    assert final["status"] == "scrapped"


def test_reject_requires_remark_and_clears_flag():
    a_h, _ = _login("it_admin")
    b_h, _ = _login("it_admin")
    code = _create_asset(a_h)["asset_code"]
    req = client.post(
        f"/api/assets/{code}/scrap-request",
        json={"reason": "测试"}, headers=a_h,
    ).json()

    empty = client.post(
        f"/api/scrap-requests/{req['id']}/reject", json={"remark": ""}, headers=b_h,
    )
    assert empty.status_code == 409

    ok = client.post(
        f"/api/scrap-requests/{req['id']}/reject",
        json={"remark": "信息不全,重新核实"}, headers=b_h,
    )
    assert ok.status_code == 200 and ok.json()["status"] == "rejected"

    detail = client.get(f"/api/assets/{code}", headers=a_h).json()["asset"]
    assert detail["scrap_candidate"] is False


def test_list_filters_and_employee_cannot_view():
    a_h, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    code = _create_asset(a_h)["asset_code"]
    client.post(
        f"/api/assets/{code}/scrap-request",
        json={"reason": "测试列表"}, headers=a_h,
    )

    assert client.get("/api/scrap-requests", headers=emp_h).status_code == 403

    lst = client.get(
        "/api/scrap-requests", params={"status_": "pending"}, headers=a_h,
    ).json()
    assert any(r["asset_code"] == code for r in lst)

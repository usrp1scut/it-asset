import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin") -> str:
    email = f"{role}-{uuid.uuid4().hex[:8]}@company.com"
    r = client.post("/api/auth/dev-login", json={"email": email, "role": role})
    assert r.status_code == 200
    return r.json()["token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_create_generates_code_and_lists():
    admin = _login()
    body = {"asset_class": "personal", "prefix": "PC", "brand_model": "Apple Mac mini"}
    r = client.post("/api/assets", json=body, headers=_h(admin))
    assert r.status_code == 201
    code = r.json()["asset_code"]
    assert code.startswith("PC-") and len(code) == 7  # PC-#### no year
    assert r.json()["status"] == "idle"

    lst = client.get("/api/assets?status=idle", headers=_h(admin))
    assert lst.status_code == 200
    assert any(i["asset_code"] == code for i in lst.json()["items"])


def test_sequential_codes_no_collision():
    admin = _login()
    codes = {
        client.post(
            "/api/assets", json={"asset_class": "personal", "prefix": "ZZ"}, headers=_h(admin)
        ).json()["asset_code"]
        for _ in range(5)
    }
    assert len(codes) == 5  # all unique


def test_state_machine_and_infrastructure_rule():
    admin = _login()
    emp = client.post(
        "/api/auth/dev-login", json={"email": f"e-{uuid.uuid4().hex[:6]}@c.com"}
    ).json()["user"]

    # personal: idle -> assign -> in_use ; scrapped is terminal
    pc = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()
    a = client.post(
        f"/api/assets/{pc['asset_code']}/assign",
        json={"user_id": emp["id"]}, headers=_h(admin),
    )
    assert a.status_code == 200 and a.json()["status"] == "in_use"

    client.post(f"/api/assets/{pc['asset_code']}/scrap", json={}, headers=_h(admin))
    again = client.post(
        f"/api/assets/{pc['asset_code']}/assign",
        json={"user_id": emp["id"]}, headers=_h(admin),
    )
    assert again.status_code == 409  # scrapped is terminal

    # infrastructure cannot be assigned
    net = client.post(
        "/api/assets", json={"asset_class": "infrastructure", "prefix": "NET"}, headers=_h(admin)
    ).json()
    r = client.post(
        f"/api/assets/{net['asset_code']}/assign",
        json={"user_id": emp["id"]}, headers=_h(admin),
    )
    assert r.status_code == 409


def test_detail_has_lifecycle():
    admin = _login()
    pc = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()
    d = client.get(f"/api/assets/{pc['asset_code']}", headers=_h(admin))
    assert d.status_code == 200
    actions = [e["action"] for e in d.json()["lifecycle"]]
    assert "create" in actions


def test_employee_cannot_list():
    emp = _login("employee")
    assert client.get("/api/assets", headers=_h(emp)).status_code == 403

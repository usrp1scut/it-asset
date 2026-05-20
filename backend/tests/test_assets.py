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


def test_qrcode_returns_svg():
    admin = _login()
    code = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()["asset_code"]
    r = client.get(f"/api/assets/{code}/qrcode", headers=_h(admin))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in r.text

    missing = client.get("/api/assets/PC-9999/qrcode", headers=_h(admin))
    assert missing.status_code == 404


def test_assign_backfills_owner_and_clears_review():
    admin = _login()
    emp = client.post(
        "/api/auth/dev-login",
        json={"email": f"e-{uuid.uuid4().hex[:6]}@c.com", "name": "李测试"},
    ).json()["user"]
    pc = client.post(
        "/api/assets",
        json={"asset_class": "personal", "prefix": "PC",
              "owner_name": "实习生(脏)", "needs_review": True},
        headers=_h(admin),
    ).json()
    code = pc["asset_code"]

    a = client.post(
        f"/api/assets/{code}/assign", json={"user_id": emp["id"]}, headers=_h(admin)
    ).json()
    assert a["owner_user_id"] == emp["id"]
    assert a["owner_name"] == "李测试"          # backfilled from directory
    assert a["needs_review"] is False           # explicit assign resolves review

    r = client.post(f"/api/assets/{code}/return", json={}, headers=_h(admin)).json()
    assert r["owner_user_id"] is None
    assert r["owner_name"] is None              # no stale 责任人 after return


def test_attachment_upload_list_fetch_delete():
    import base64

    admin = _login()
    code = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()["asset_code"]
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
    )

    up = client.post(
        f"/api/assets/{code}/attachments",
        files={"file": ("photo.png", png, "image/png")},
        headers=_h(admin),
    )
    assert up.status_code == 201, up.text
    items = up.json()
    assert len(items) == 1 and items[0]["name"] == "photo.png"
    key = items[0]["key"]

    lst = client.get(f"/api/assets/{code}/attachments", headers=_h(admin))
    assert lst.status_code == 200 and len(lst.json()) == 1

    raw = client.get(
        f"/api/assets/{code}/attachments/raw", params={"key": key}, headers=_h(admin)
    )
    assert raw.status_code == 200
    assert raw.headers["content-type"] == "image/png"
    assert raw.content == png

    bad = client.post(
        f"/api/assets/{code}/attachments",
        files={"file": ("x.exe", b"MZ", "application/octet-stream")},
        headers=_h(admin),
    )
    assert bad.status_code == 400

    d = client.request(
        "DELETE", f"/api/assets/{code}/attachments",
        params={"key": key}, headers=_h(admin),
    )
    assert d.status_code == 200
    assert client.get(f"/api/assets/{code}/attachments", headers=_h(admin)).json() == []


def test_labels_pdf_generation():
    admin = _login()
    codes = [
        client.post(
            "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
        ).json()["asset_code"]
        for _ in range(3)
    ]

    r = client.post("/api/assets/labels", json={"codes": codes}, headers=_h(admin))
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and len(r.content) > 1000

    assert client.post(
        "/api/assets/labels", json={"codes": []}, headers=_h(admin)
    ).status_code == 400

    miss = client.post(
        "/api/assets/labels", json={"codes": ["PC-9999"]}, headers=_h(admin)
    )
    assert miss.status_code == 404


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


def test_transfer_reassigns_owner():
    admin = _login()
    e1 = client.post("/api/auth/dev-login",
                     json={"email": f"a-{uuid.uuid4().hex[:6]}@c.com"}).json()["user"]
    e2 = client.post("/api/auth/dev-login",
                     json={"email": f"b-{uuid.uuid4().hex[:6]}@c.com"}).json()["user"]
    pc = client.post("/api/assets", json={"asset_class": "personal", "prefix": "PC"},
                     headers=_h(admin)).json()
    code = pc["asset_code"]
    client.post(f"/api/assets/{code}/assign", json={"user_id": e1["id"]}, headers=_h(admin))

    r = client.post(f"/api/assets/{code}/transfer",
                    json={"to_user_id": e2["id"], "reason": "转岗"}, headers=_h(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "in_use" and r.json()["owner_user_id"] == e2["id"]
    actions = [e["action"] for e in
               client.get(f"/api/assets/{code}", headers=_h(admin)).json()["lifecycle"]]
    assert "transfer" in actions


def test_transfer_requires_in_use():
    admin = _login()
    e1 = client.post("/api/auth/dev-login",
                     json={"email": f"c-{uuid.uuid4().hex[:6]}@c.com"}).json()["user"]
    idle = client.post("/api/assets", json={"asset_class": "personal", "prefix": "PC"},
                       headers=_h(admin)).json()
    assert client.post(f"/api/assets/{idle['asset_code']}/transfer",
                       json={"to_user_id": e1["id"]}, headers=_h(admin)).status_code == 409
    net = client.post("/api/assets",
                      json={"asset_class": "infrastructure", "prefix": "NET"},
                      headers=_h(admin)).json()
    assert client.post(f"/api/assets/{net['asset_code']}/transfer",
                       json={"to_user_id": e1["id"]}, headers=_h(admin)).status_code == 409

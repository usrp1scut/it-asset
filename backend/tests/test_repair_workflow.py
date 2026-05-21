import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _h(role: str = "it_admin") -> dict:
    tok = client.post(
        "/api/auth/dev-login",
        json={"email": f"{role}-{uuid.uuid4().hex[:8]}@c.com", "role": role},
    ).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


def _new_asset(h: dict) -> str:
    return client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=h,
    ).json()["asset_code"]


def test_open_complete_lifecycle():
    h = _h()
    code = _new_asset(h)

    r = client.post(
        f"/api/assets/{code}/repair-order",
        json={"reason": "B 键失灵", "repair_type": "external", "vendor": "Apple 上海"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["status"] == "open" and order["vendor"] == "Apple 上海"
    oid = order["id"]

    detail = client.get(f"/api/assets/{code}", headers=h).json()["asset"]
    assert detail["status"] == "maintenance"

    # second order on same asset → 409
    dup = client.post(
        f"/api/assets/{code}/repair-order",
        json={"reason": "x", "repair_type": "in_house"}, headers=h,
    )
    assert dup.status_code == 409

    # update — shipped_at flips to in_progress
    upd = client.post(
        f"/api/repair-orders/{oid}/update",
        json={"shipped_at": "2026-05-21", "note": "已送修"}, headers=h,
    )
    assert upd.status_code == 200 and upd.json()["status"] == "in_progress"

    # complete needs resolution
    bad = client.post(
        f"/api/repair-orders/{oid}/complete", json={"resolution": ""}, headers=h,
    )
    assert bad.status_code == 409

    done = client.post(
        f"/api/repair-orders/{oid}/complete",
        json={
            "cost": "350.00", "warranty_covered": True,
            "warranty_until": "2027-05-20", "resolution": "更换键盘模组",
        },
        headers=h,
    ).json()
    assert done["status"] == "completed" and done["cost"] == "350.00"

    # asset returned to idle
    final = client.get(f"/api/assets/{code}", headers=h).json()["asset"]
    assert final["status"] == "idle"


def test_external_requires_vendor_and_cancel_returns_asset():
    h = _h()
    code = _new_asset(h)

    bad = client.post(
        f"/api/assets/{code}/repair-order",
        json={"reason": "x", "repair_type": "external"}, headers=h,
    )
    assert bad.status_code == 409 and "维修商" in bad.json()["detail"]

    o = client.post(
        f"/api/assets/{code}/repair-order",
        json={"reason": "电池更换", "repair_type": "in_house"}, headers=h,
    ).json()
    assert client.get(f"/api/assets/{code}", headers=h).json()["asset"]["status"] == "maintenance"

    cancel = client.post(
        f"/api/repair-orders/{o['id']}/cancel",
        json={"reason": "误报,实际为软件问题"}, headers=h,
    )
    assert cancel.status_code == 200 and cancel.json()["status"] == "cancelled"
    assert client.get(f"/api/assets/{code}", headers=h).json()["asset"]["status"] == "idle"


def test_listings():
    h = _h()
    code = _new_asset(h)
    client.post(
        f"/api/assets/{code}/repair-order",
        json={"reason": "测试列表", "repair_type": "in_house"}, headers=h,
    )

    glob = client.get("/api/repair-orders", params={"status_": "open"}, headers=h).json()
    assert any(r["asset_code"] == code for r in glob)

    per_asset = client.get(f"/api/assets/{code}/repair-orders", headers=h).json()
    assert per_asset and per_asset[0]["asset_code"] == code

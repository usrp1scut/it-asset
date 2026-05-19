import uuid
from concurrent.futures import ThreadPoolExecutor

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _admin() -> dict:
    email = f"inv-{uuid.uuid4().hex[:8]}@c.com"
    tok = client.post(
        "/api/auth/dev-login", json={"email": email, "role": "it_admin"}
    ).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


def _emp() -> int:
    return client.post(
        "/api/auth/dev-login", json={"email": f"u-{uuid.uuid4().hex[:6]}@c.com"}
    ).json()["user"]["id"]


def _loc(h) -> int:
    return client.post(
        "/api/inventory/locations", json={"name": f"仓-{uuid.uuid4().hex[:5]}"}, headers=h
    ).json()["id"]


def _cat(h) -> int:
    r = client.post(
        "/api/item-categories",
        json={"name": "测试分类", "code": uuid.uuid4().hex[:8].upper()},
        headers=h,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _sku(h, loc, safety=5) -> dict:
    r = client.post(
        "/api/skus",
        json={"category_id": _cat(h), "name": "测试鼠标", "safety_stock": safety,
              "default_location_id": loc, "unit": "个"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_receive_issue_return_flow():
    h = _admin()
    loc = _loc(h)
    sku = _sku(h, loc)
    sid = sku["id"]
    emp = _emp()

    assert client.post("/api/inventory/receive",
                       json={"sku_id": sid, "quantity": 20}, headers=h).status_code == 200
    assert client.post("/api/inventory/issue",
                       json={"sku_id": sid, "quantity": 3, "user_id": emp},
                       headers=h).status_code == 200
    assert client.post("/api/inventory/return",
                       json={"sku_id": sid, "quantity": 1}, headers=h).status_code == 200

    listing = client.get(f"/api/skus?q={sku['sku_code']}", headers=h).json()["items"][0]
    assert listing["available"] == 18  # 20 - 3 + 1
    assert listing["level"] == "normal"

    txns = client.get(f"/api/skus/{sku['sku_code']}/transactions", headers=h).json()
    assert len(txns) == 3
    # ledger after_quantity must track the running balance
    assert txns[0]["after_quantity"] == 18


def test_oversell_blocked():
    h = _admin()
    loc = _loc(h)
    sku = _sku(h, loc)
    sid = sku["id"]
    emp = _emp()
    client.post("/api/inventory/receive",
                json={"sku_id": sid, "quantity": 5}, headers=h)
    # 6 > 5 available -> rejected, balance untouched
    r = client.post("/api/inventory/issue",
                     json={"sku_id": sid, "quantity": 6, "user_id": emp}, headers=h)
    assert r.status_code == 409
    avail = client.get(f"/api/skus?q={sku['sku_code']}", headers=h).json()["items"][0]
    assert avail["available"] == 5


def test_concurrent_issue_no_oversell():
    """20 parallel issues of 1 unit against stock of 10 → exactly 10 succeed,
    10 get 409, final available == 0. Proves the FOR UPDATE row lock."""
    h = _admin()
    loc = _loc(h)
    sku = _sku(h, loc, safety=0)
    sid = sku["id"]
    emp = _emp()
    client.post("/api/inventory/receive",
                json={"sku_id": sid, "quantity": 10}, headers=h)

    def issue_one(_):
        return client.post(
            "/api/inventory/issue",
            json={"sku_id": sid, "quantity": 1, "user_id": emp}, headers=h,
        ).status_code

    with ThreadPoolExecutor(max_workers=10) as ex:
        codes = list(ex.map(issue_one, range(20)))

    assert codes.count(200) == 10
    assert codes.count(409) == 10
    final = client.get(f"/api/skus?q={sku['sku_code']}", headers=h).json()["items"][0]
    assert final["available"] == 0


def test_low_stock_scan_task():
    from app.modules.inventory.tasks import scan_low_stock

    h = _admin()
    loc = _loc(h)
    sku = _sku(h, loc, safety=10)
    client.post("/api/inventory/receive",
                json={"sku_id": sku["id"], "quantity": 2}, headers=h)
    res = scan_low_stock()
    assert res["low_stock_count"] >= 1
    assert res["pushed"] is False  # no chat id configured in tests

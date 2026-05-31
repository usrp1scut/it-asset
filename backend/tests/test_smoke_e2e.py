"""End-to-end smoke test — walks the whole main path in one go.

Unlike the per-module unit tests, this proves the modules wire together:
asset lifecycle (create → assign → inspect → repair → scrap), infrastructure
status toggle, the consumable request→approve→fulfill chain, and the dashboard
overview. It's the "fixed data, run the main path" check from the arch review,
runnable as part of `pytest`.
"""
import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin", name: str | None = None) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@smoke.com"
    body: dict = {"email": email, "role": role}
    if name:
        body["name"] = name
    r = client.post("/api/auth/dev-login", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _h(login: dict) -> dict:
    return {"Authorization": f"Bearer {login['token']}"}


def _type_id(h: dict, prefix: str) -> int:
    types = client.get("/api/asset-types", headers=h).json()
    return next(t["id"] for t in types if t["code_prefix"] == prefix)


def _status(h: dict, code: str) -> str:
    return client.get(f"/api/assets/{code}", headers=h).json()["asset"]["status"]


def test_full_lifecycle_smoke():
    admin, admin2 = _login(), _login()
    h, h2 = _h(admin), _h(admin2)
    emp = _login("employee", name="冒烟员工")
    he = _h(emp)
    emp_id = emp["user"]["id"]

    pc_type, net_type = _type_id(h, "PC"), _type_id(h, "NET")

    # 1) create a personal asset via its type
    created = client.post(
        "/api/assets", json={"asset_type_id": pc_type, "brand_model": "Smoke Laptop"}, headers=h
    )
    assert created.status_code == 201, created.text
    a = created.json()
    code = a["asset_code"]
    assert a["status"] == "idle"
    assert a["asset_type_icon"] == "laptop"  # category icon metadata flows through

    # 2) assign to the employee → in_use, owner backfilled, review cleared
    assigned = client.post(f"/api/assets/{code}/assign", json={"user_id": emp_id}, headers=h).json()
    assert assigned["status"] == "in_use"
    assert assigned["owner_user_id"] == emp_id
    assert assigned["needs_review"] is False

    # 3) inspection over in-use personal assets → confirm this asset → close
    task = client.post(
        "/api/inspections", json={"name": "冒烟盘点", "scope_type": "personal_in_use"}, headers=h
    )
    assert task.status_code in (200, 201), task.text
    tid = task.json()["id"]
    confirm = client.post(
        f"/api/inspections/{tid}/items/{code}/confirm", json={"status": "ok"}, headers=h
    )
    assert confirm.status_code == 200 and confirm.json()["confirm_status"] == "ok"
    assert client.post(f"/api/inspections/{tid}/close", headers=h).status_code == 200

    # 4) repair: open → maintenance → complete → idle
    order = client.post(
        f"/api/assets/{code}/repair-order",
        json={"repair_type": "in_house", "reason": "冒烟报修"},
        headers=h,
    )
    assert order.status_code in (200, 201), order.text
    oid = order.json()["id"]
    assert _status(h, code) == "maintenance"
    done = client.post(f"/api/repair-orders/{oid}/complete", json={"resolution": "冒烟修复"}, headers=h)
    assert done.status_code == 200, done.text
    assert _status(h, code) == "idle"

    # 5) scrap: request (admin) → approve (a different admin) → dispose → scrapped
    sr = client.post(f"/api/assets/{code}/scrap-request", json={"reason": "冒烟报废"}, headers=h)
    assert sr.status_code in (200, 201), sr.text
    sid = sr.json()["id"]
    assert client.post(f"/api/scrap-requests/{sid}/approve", json={"remark": "同意"}, headers=h2).status_code == 200
    disposed = client.post(
        f"/api/scrap-requests/{sid}/dispose",
        json={"disposition_method": "recycle", "residual_value": 100},
        headers=h2,
    )
    assert disposed.status_code == 200, disposed.text
    assert _status(h, code) == "scrapped"

    # 6) infrastructure: create → 启用 (in_use) → 停用 (idle) via the status action
    infra = client.post("/api/assets", json={"asset_type_id": net_type}, headers=h).json()
    icode = infra["asset_code"]
    assert infra["status"] == "idle"
    assert client.post(f"/api/assets/{icode}/status", json={"status": "in_use"}, headers=h).json()["status"] == "in_use"
    assert client.post(f"/api/assets/{icode}/status", json={"status": "idle"}, headers=h).json()["status"] == "idle"

    # 7) inventory + consumable request → approve → fulfill (stock deducted)
    loc = client.post(
        "/api/inventory/locations", json={"name": f"冒烟仓{uuid.uuid4().hex[:4]}", "type": "warehouse"}, headers=h
    ).json()
    loc_id = loc["id"]
    cat = client.post(
        "/api/item-categories",
        json={"name": f"冒烟耗材{uuid.uuid4().hex[:4]}", "code": f"SK{uuid.uuid4().hex[:3].upper()}", "management_mode": "consumable"},
        headers=h,
    )
    assert cat.status_code in (200, 201), cat.text
    cat_id = cat.json()["id"]
    sku = client.post(
        "/api/skus",
        json={
            "category_id": cat_id,
            "name": "冒烟网线",
            "management_mode": "consumable",
            "unit": "根",
            "safety_stock": 5,
            "default_location_id": loc_id,
        },
        headers=h,
    )
    assert sku.status_code == 201, sku.text
    sku_id = sku.json()["id"]
    assert client.post(
        "/api/inventory/receive", json={"sku_id": sku_id, "quantity": 20, "location_id": loc_id}, headers=h
    ).status_code == 200

    req = client.post(
        "/api/m/requests",
        json={
            "request_type": "consumable",
            "items": [{"sku_id": sku_id, "qty": 2}],
            "reason": "冒烟领用",
            "urgency": "normal",
            "deliver_to": "self_desk",
        },
        headers=he,
    )
    assert req.status_code in (200, 201), req.text
    rid = req.json()["id"]
    assert req.json()["status"] == "pending"
    approved = client.post(f"/api/approvals/{rid}/approve", headers=h)
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    fulfilled = client.post(f"/api/approvals/{rid}/fulfill", headers=h)
    assert fulfilled.status_code == 200, fulfilled.text
    assert fulfilled.json()["status"] == "fulfilled"

    # 8) dashboard overview is computable and reflects a non-empty ledger
    ov = client.get("/api/dashboard/overview", headers=h).json()
    assert ov["stats"]["total_assets"] > 0
    assert "low_stock_skus" in ov

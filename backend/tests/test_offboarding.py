import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin", name: str | None = None) -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@off.com"
    body: dict = {"email": email, "role": role}
    if name:
        body["name"] = name
    return client.post("/api/auth/dev-login", json=body).json()


def _h(login: dict) -> dict:
    return {"Authorization": f"Bearer {login['token']}"}


def _type_id(h: dict, prefix: str) -> int:
    types = client.get("/api/asset-types", headers=h).json()
    return next(t["id"] for t in types if t["code_prefix"] == prefix)


def _make_in_use_asset(h: dict, pc: int, owner_id: int, price: float) -> str:
    code = client.post(
        "/api/assets", json={"asset_type_id": pc, "brand_model": "Off Laptop", "purchase_price": price}, headers=h
    ).json()["asset_code"]
    client.post(f"/api/assets/{code}/assign", json={"user_id": owner_id}, headers=h)
    return code


def test_offboarding_full_flow():
    admin = _login()
    h = _h(admin)
    emp = _login("employee", name="离职员工")
    emp_id = emp["user"]["id"]
    pc = _type_id(h, "PC")

    code_a = _make_in_use_asset(h, pc, emp_id, 8000)
    code_b = _make_in_use_asset(h, pc, emp_id, 3000)

    # create a case → snapshots the employee's two in-use assets
    case = client.post("/api/offboarding", json={"user_id": emp_id, "last_day": "2026-06-30", "reason": "离职"}, headers=h)
    assert case.status_code == 201, case.text
    cd = case.json()
    cid = cd["id"]
    assert cd["case_no"].startswith("OFF-")
    assert cd["total_items"] == 2
    assert cd["pending_items"] == 2
    assert float(cd["total_value"]) == 11000.0
    assert {i["asset_code"] for i in cd["items"]} == {code_a, code_b}

    # can't close while items pending
    assert client.post(f"/api/offboarding/{cid}/close", headers=h).status_code == 409

    # return A → asset back to idle, owner cleared
    r = client.post(f"/api/offboarding/{cid}/items/{code_a}/return", json={"condition": "good"}, headers=h)
    assert r.status_code == 200
    asset_a = client.get(f"/api/assets/{code_a}", headers=h).json()["asset"]
    assert asset_a["status"] == "idle" and asset_a["owner_user_id"] is None
    assert r.json()["returned_items"] == 1 and r.json()["pending_items"] == 1

    # register B as lost → raises a scrap request (finance write-off)
    lost = client.post(f"/api/offboarding/{cid}/items/{code_b}/lost", json={"remark": "找不到了"}, headers=h)
    assert lost.status_code == 200
    assert lost.json()["lost_items"] == 1 and lost.json()["pending_items"] == 0
    scraps = client.get("/api/scrap-requests?status_=pending", headers=h).json()
    assert any(s["asset_code"] == code_b for s in scraps)

    # now closeable
    closed = client.post(f"/api/offboarding/{cid}/close", headers=h)
    assert closed.status_code == 200 and closed.json()["status"] == "completed"


def test_offboarding_notify_gate():
    """Creation must NOT notify the leaver (notified_at stays null); the
    IT-triggered /notify is what stamps it."""
    admin = _login()
    h = _h(admin)
    emp = _login("employee")
    emp_id = emp["user"]["id"]
    pc = _type_id(h, "PC")
    _make_in_use_asset(h, pc, emp_id, 5000)

    case = client.post("/api/offboarding", json={"user_id": emp_id}, headers=h).json()
    assert case["notified_at"] is None  # auto-create alerts IT only, not the employee

    notified = client.post(f"/api/offboarding/{case['id']}/notify", headers=h)
    assert notified.status_code == 200
    assert notified.json()["notified_at"] is not None

    # idempotent — re-notify keeps the original stamp, still 200
    again = client.post(f"/api/offboarding/{case['id']}/notify", headers=h)
    assert again.status_code == 200 and again.json()["notified_at"] is not None


def test_offboarding_create_from_lark(monkeypatch):
    """A Lark user.left event resolves the user by lark_open_id and builds a
    case without messaging the employee."""
    from app.db import SessionLocal
    from app.modules.offboarding import service
    from app.modules.users.models import User

    admin = _login()
    h = _h(admin)
    emp = _login("employee")
    emp_id = emp["user"]["id"]
    pc = _type_id(h, "PC")
    _make_in_use_asset(h, pc, emp_id, 6000)

    # tag the employee with a lark open_id (the directory sync would set this)
    db = SessionLocal()
    try:
        u = db.get(User, emp_id)
        u.lark_open_id = f"ou_{uuid.uuid4().hex[:10]}"
        db.commit()
        open_id = u.lark_open_id
    finally:
        db.close()

    db = SessionLocal()
    try:
        case = service.create_from_lark(db, lark_open_id=open_id)
        assert case is not None
        assert case.hr_channel == "lark_event:user.left"
        assert case.notified_at is None
    finally:
        db.close()


def test_offboarding_rejects_duplicate_open_case():
    admin = _login()
    h = _h(admin)
    emp = _login("employee")
    emp_id = emp["user"]["id"]
    client.post("/api/offboarding", json={"user_id": emp_id}, headers=h)
    dup = client.post("/api/offboarding", json={"user_id": emp_id}, headers=h)
    assert dup.status_code == 400


def test_offboarding_overdue_scan():
    admin = _login()
    h = _h(admin)
    emp = _login("employee")
    emp_id = emp["user"]["id"]
    pc = _type_id(h, "PC")
    _make_in_use_asset(h, pc, emp_id, 5000)
    # last day already passed, with a pending item
    cid = client.post(
        "/api/offboarding", json={"user_id": emp_id, "last_day": "2020-01-01"}, headers=h
    ).json()["id"]
    flipped = client.post("/api/offboarding/scan-overdue", headers=h).json()["flipped"]
    assert flipped >= 1
    assert client.get(f"/api/offboarding/{cid}", headers=h).json()["status"] == "overdue"

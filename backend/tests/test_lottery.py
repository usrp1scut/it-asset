import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin"):
    j = client.post(
        "/api/auth/dev-login",
        json={"email": f"{role}-{uuid.uuid4().hex[:8]}@lot.com", "role": role},
    ).json()
    return {"Authorization": f"Bearer {j['token']}"}, j["user"]


def _make_lark_users(n: int) -> list[int]:
    """Create n active users with a lark_open_id (the directory-sourced kind)."""
    from app.db import SessionLocal
    from app.modules.users.service import upsert_user_from_lark

    db = SessionLocal()
    try:
        ids = [
            upsert_user_from_lark(
                db, {"open_id": f"ou-{uuid.uuid4().hex[:10]}", "name": f"Lark用户{i}"}
            ).id
            for i in range(n)
        ]
        return ids
    finally:
        db.close()


def test_lottery_pool_is_lark_users_only():
    from app.db import SessionLocal
    from app.modules.lottery.service import eligible_user_ids

    lark_ids = _make_lark_users(3)
    non_lark = _login("employee")[1]["id"]  # dev-login → no lark_open_id

    db = SessionLocal()
    try:
        pool = set(eligible_user_ids(db))
    finally:
        db.close()
    assert all(lid in pool for lid in lark_ids)  # Lark users are eligible
    assert non_lark not in pool  # password / local account excluded


def test_lottery_draw_picks_distinct_lark_winners():
    admin, _ = _login("it_admin")
    _make_lark_users(4)  # ensure the Lark pool is big enough
    _login("employee")  # a non-Lark user that must never be drawn

    from app.db import SessionLocal
    from app.modules.lottery.service import eligible_user_ids

    r = client.post(
        "/api/lottery/draws",
        json={"name": f"测试抽奖{uuid.uuid4().hex[:6]}", "winner_count": 2, "tier": "first"},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["winner_count"] == 2
    assert d["tier"] == "first"  # tier round-trips
    ids = [w["user_id"] for w in d["winners"]]
    assert len(set(ids)) == 2  # distinct
    assert all(w["name"] for w in d["winners"])  # enriched names

    db = SessionLocal()
    try:
        pool = set(eligible_user_ids(db))
    finally:
        db.close()
    assert all(i in pool for i in ids)  # every winner is a Lark user

    hist = client.get("/api/lottery/draws", headers=admin).json()
    assert any(x["id"] == d["id"] for x in hist)


def test_lottery_validation():
    admin, _ = _login("it_admin")
    _make_lark_users(2)  # keep the pool non-empty so over-pool is the failure
    tag = uuid.uuid4().hex[:6]
    elig = client.get("/api/lottery/eligible-count", headers=admin).json()["count"]

    # more winners than the active pool → 400
    over = client.post(
        "/api/lottery/draws",
        json={"name": f"超额{tag}", "winner_count": elig + 1},
        headers=admin,
    )
    assert over.status_code == 400

    # blank name → 400 (a name is always required)
    blank = client.post("/api/lottery/draws", json={"winner_count": 1}, headers=admin)
    assert blank.status_code == 400

    # < 1 winner is rejected by the schema (422)
    assert client.post(
        "/api/lottery/draws", json={"name": f"零{tag}", "winner_count": 0}, headers=admin
    ).status_code == 422

    # unknown prize SKU → 400
    bad = client.post(
        "/api/lottery/draws",
        json={"name": f"坏SKU{tag}", "winner_count": 1, "prize_sku_id": 999999999},
        headers=admin,
    )
    assert bad.status_code == 400

    # invalid tier → 400
    bad_tier = client.post(
        "/api/lottery/draws",
        json={"name": f"坏档{tag}", "winner_count": 1, "tier": "platinum"},
        headers=admin,
    )
    assert bad_tier.status_code == 400


def test_lottery_redraw_unrestricted():
    # Re-drawing the same name+tier is allowed (no 防重抽) — each is its own draw.
    admin, _ = _login("it_admin")
    _make_lark_users(4)
    name = f"年会{uuid.uuid4().hex[:6]}"
    body = {"name": name, "winner_count": 1, "tier": "first"}
    first = client.post("/api/lottery/draws", json=body, headers=admin)
    again = client.post("/api/lottery/draws", json=body, headers=admin)
    assert first.status_code == 201
    assert again.status_code == 201
    assert first.json()["id"] != again.json()["id"]
    # both rounds are recorded
    hist = client.get("/api/lottery/draws", headers=admin).json()
    assert sum(1 for d in hist if d["name"] == name) == 2


def test_lottery_delete_single_draw():
    admin, _ = _login("it_admin")
    _make_lark_users(2)
    name = f"删除单条{uuid.uuid4().hex[:6]}"
    d = client.post(
        "/api/lottery/draws", json={"name": name, "winner_count": 1}, headers=admin
    ).json()

    # delete it
    assert client.delete(f"/api/lottery/draws/{d['id']}", headers=admin).status_code == 204
    # gone from history + fetch-by-id 404
    assert client.get(f"/api/lottery/draws/{d['id']}", headers=admin).status_code == 404
    assert all(x["id"] != d["id"] for x in client.get("/api/lottery/draws", headers=admin).json())
    # deleting a missing draw → 404
    assert client.delete(f"/api/lottery/draws/{d['id']}", headers=admin).status_code == 404


def test_lottery_clear_history():
    admin, _ = _login("it_admin")
    _make_lark_users(2)
    tag = uuid.uuid4().hex[:6]
    client.post("/api/lottery/draws", json={"name": f"清A{tag}", "winner_count": 1}, headers=admin)
    client.post("/api/lottery/draws", json={"name": f"清B{tag}", "winner_count": 1}, headers=admin)

    r = client.delete("/api/lottery/draws", headers=admin)
    assert r.status_code == 200
    assert r.json()["deleted"] >= 2
    # history is now empty
    assert client.get("/api/lottery/draws", headers=admin).json() == []


def test_lottery_delete_requires_role():
    # plain employees cannot delete / clear history
    emp, _ = _login("employee")
    assert client.delete("/api/lottery/draws/1", headers=emp).status_code == 403
    assert client.delete("/api/lottery/draws", headers=emp).status_code == 403


def test_lottery_access_excludes_only_employees():
    # plain employees are blocked…
    emp, _ = _login("employee")
    assert client.post(
        "/api/lottery/draws", json={"name": "x", "winner_count": 1}, headers=emp
    ).status_code == 403
    assert client.get("/api/lottery/draws", headers=emp).status_code == 403

    # …but any other role (e.g. finance, neither admin nor employee) may use it
    fin, _ = _login("finance")
    _make_lark_users(2)
    assert client.get("/api/lottery/eligible-count", headers=fin).status_code == 200
    r = client.post(
        "/api/lottery/draws",
        json={"name": f"财务抽{uuid.uuid4().hex[:6]}", "winner_count": 1},
        headers=fin,
    )
    assert r.status_code == 201


def test_lottery_hr_can_use():
    hr, _ = _login("hr")
    _make_lark_users(2)
    assert client.get("/api/lottery/eligible-count", headers=hr).status_code == 200
    r = client.post(
        "/api/lottery/draws",
        json={"name": f"HR抽{uuid.uuid4().hex[:6]}", "winner_count": 1},
        headers=hr,
    )
    assert r.status_code == 201

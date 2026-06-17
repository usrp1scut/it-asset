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
        json={"name": f"测试抽奖{uuid.uuid4().hex[:6]}", "winner_count": 2},
        headers=admin,
    )
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["winner_count"] == 2
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

    # blank name → 400 (the 防重抽 event key is required)
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


def test_lottery_rejects_duplicate_name():
    admin, _ = _login("it_admin")
    _make_lark_users(3)
    name = f"年会一等奖{uuid.uuid4().hex[:6]}"
    first = client.post(
        "/api/lottery/draws", json={"name": name, "winner_count": 1}, headers=admin
    )
    assert first.status_code == 201
    # same name → rejected (防重抽)
    again = client.post(
        "/api/lottery/draws", json={"name": name, "winner_count": 1}, headers=admin
    )
    assert again.status_code == 400
    assert "已抽过奖" in again.json()["detail"]


def test_lottery_admin_only():
    emp, _ = _login("employee")
    assert client.post(
        "/api/lottery/draws", json={"winner_count": 1}, headers=emp
    ).status_code == 403
    assert client.get("/api/lottery/draws", headers=emp).status_code == 403

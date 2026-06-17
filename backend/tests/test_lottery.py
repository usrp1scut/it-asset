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


def test_lottery_draw_picks_distinct_active_winners():
    admin, _ = _login("it_admin")
    for _ in range(4):  # make sure the active pool is big enough
        _login("employee")
    elig = client.get("/api/lottery/eligible-count", headers=admin).json()["count"]
    assert elig >= 4

    r = client.post(
        "/api/lottery/draws", json={"name": "测试抽奖", "winner_count": 2}, headers=admin
    )
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["winner_count"] == 2
    assert len(d["winners"]) == 2
    ids = [w["user_id"] for w in d["winners"]]
    assert len(set(ids)) == 2  # distinct
    assert all(w["name"] for w in d["winners"])  # enriched names

    hist = client.get("/api/lottery/draws", headers=admin).json()
    assert any(x["id"] == d["id"] for x in hist)


def test_lottery_validation():
    admin, _ = _login("it_admin")
    elig = client.get("/api/lottery/eligible-count", headers=admin).json()["count"]

    # more winners than the active pool → 400
    over = client.post(
        "/api/lottery/draws", json={"winner_count": elig + 1}, headers=admin
    )
    assert over.status_code == 400

    # < 1 winner is rejected by the schema (422)
    assert client.post(
        "/api/lottery/draws", json={"winner_count": 0}, headers=admin
    ).status_code == 422

    # unknown prize SKU → 400
    bad = client.post(
        "/api/lottery/draws",
        json={"winner_count": 1, "prize_sku_id": 999999999},
        headers=admin,
    )
    assert bad.status_code == 400


def test_lottery_admin_only():
    emp, _ = _login("employee")
    assert client.post(
        "/api/lottery/draws", json={"winner_count": 1}, headers=emp
    ).status_code == 403
    assert client.get("/api/lottery/draws", headers=emp).status_code == 403

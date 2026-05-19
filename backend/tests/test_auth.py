import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_me_requires_auth():
    assert client.get("/api/auth/me").status_code == 401


def test_dev_login_then_me():
    email = f"sprint1-{uuid.uuid4().hex[:8]}@company.com"
    r = client.post("/api/auth/dev-login", json={"email": email, "name": "测试员"})
    assert r.status_code == 200
    token = r.json()["token"]
    assert r.json()["user"]["email"] == email

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == email
    assert me.json()["permissions"] == ["employee"]


def test_invalid_token_rejected():
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


def test_user_search_picker():
    admin = client.post(
        "/api/auth/dev-login",
        json={"email": f"adm-{uuid.uuid4().hex[:8]}@c.com", "role": "it_admin"},
    ).json()["token"]
    h = {"Authorization": f"Bearer {admin}"}
    name = f"张测试{uuid.uuid4().hex[:5]}"
    client.post(
        "/api/auth/dev-login",
        json={"email": f"{uuid.uuid4().hex[:6]}@c.com", "name": name},
    )

    assert client.get("/api/users").status_code == 401  # auth required
    hit = client.get(f"/api/users?q={name}", headers=h)
    assert hit.status_code == 200
    rows = hit.json()
    assert any(u["name"] == name for u in rows)
    assert all({"id", "name", "email", "department_name"} <= set(u) for u in rows)

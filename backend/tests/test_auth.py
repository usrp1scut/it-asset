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


def _login(role: str = "it_admin") -> tuple[dict, dict]:
    j = client.post(
        "/api/auth/dev-login",
        json={"email": f"{role}-{uuid.uuid4().hex[:8]}@c.com", "role": role},
    ).json()
    return {"Authorization": f"Bearer {j['token']}"}, j["user"]


def test_role_change_requires_admin_and_guards():
    admin_h, admin = _login("it_admin")
    other_h, other = _login("employee")

    # admin can list /manage and gets role field
    rows = client.get(
        "/api/users/manage", params={"q": other["email"]}, headers=admin_h,
    ).json()
    assert any(r["id"] == other["id"] and "role" in r for r in rows)
    # non-admin cannot list, cannot PATCH (do this BEFORE we promote `other`)
    assert client.get("/api/users/manage", headers=other_h).status_code == 403
    forbidden = client.patch(
        f"/api/users/{other['id']}/role",
        json={"role": "employee"}, headers=other_h,
    )
    assert forbidden.status_code == 403

    # cannot mint sys_admin via UI
    bad = client.patch(
        f"/api/users/{other['id']}/role",
        json={"role": "sys_admin"}, headers=admin_h,
    )
    assert bad.status_code == 400
    # missing user → 404
    miss = client.patch(
        "/api/users/999999/role", json={"role": "employee"}, headers=admin_h,
    )
    assert miss.status_code == 404
    # cannot change self
    self_chg = client.patch(
        f"/api/users/{admin['id']}/role",
        json={"role": "employee"}, headers=admin_h,
    )
    assert self_chg.status_code == 400 and "自己" in self_chg.json()["detail"]

    # promote other → it_admin (last so it doesn't poison earlier role checks)
    r = client.patch(
        f"/api/users/{other['id']}/role",
        json={"role": "it_admin"}, headers=admin_h,
    )
    assert r.status_code == 200 and r.json()["role"] == "it_admin"

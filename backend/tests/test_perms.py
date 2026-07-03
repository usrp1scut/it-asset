import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _h(role: str) -> dict:
    tok = client.post(
        "/api/auth/dev-login", json={"email": f"{role}-{uuid.uuid4().hex[:8]}@p.com", "role": role}
    ).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


def _set(h: dict, role: str, module: str, view: bool, manage: bool):
    return client.put(
        "/api/role-permissions",
        json={"changes": [
            {"role": role, "module": module, "can_view": view, "can_manage": manage}
        ]},
        headers=h,
    )


def test_default_matrix_matches_current_rules():
    g = client.get("/api/role-permissions", headers=_h("it_admin")).json()["grants"]
    assert g["assets"]["manager"]["can_view"] and not g["assets"]["manager"]["can_manage"]
    assert g["inventory"]["procurement"]["can_manage"]      # 采购可管库存
    assert g["seatmap"]["hr"]["can_view"]                    # HR 可看座位图
    assert not g["assets"]["hr"]["can_view"]                 # HR 默认看不到资产台账
    assert g["lottery"]["finance"]["can_manage"]             # 抽奖人人可用


def test_matrix_toggle_changes_effective_access():
    admin = _h("it_admin")
    hr = _h("hr")
    assert client.get("/api/assets", headers=hr).status_code == 403   # default deny
    assert _set(admin, "hr", "assets", True, False).status_code == 200
    try:
        assert client.get("/api/assets", headers=hr).status_code == 200          # view granted
        r = client.post("/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=hr)
        assert r.status_code == 403                                              # but not manage
    finally:
        _set(admin, "hr", "assets", False, False)  # revert (shared DB)
    assert client.get("/api/assets", headers=hr).status_code == 403


def test_locked_and_pinned_modules_not_editable():
    admin = _h("it_admin")
    assert _set(admin, "finance", "users", True, True).status_code == 409    # locked
    assert _set(admin, "finance", "perms", True, True).status_code == 409    # locked
    assert _set(admin, "finance", "approvals", True, False).status_code == 409  # pinned
    assert _set(admin, "bogus", "assets", True, False).status_code == 409    # bad role


def test_role_permissions_page_is_it_admin_only():
    assert client.get("/api/role-permissions", headers=_h("manager")).status_code == 403
    assert client.get("/api/role-permissions", headers=_h("finance")).status_code == 403
    assert client.get("/api/role-permissions", headers=_h("it_admin")).status_code == 200
    assert client.get("/api/role-permissions", headers=_h("sys_admin")).status_code == 200


def test_sys_admin_bypass_and_employee_denied():
    assert client.get("/api/assets", headers=_h("sys_admin")).status_code == 200
    emp = _h("employee")
    assert client.get("/api/assets", headers=emp).status_code == 403
    assert client.get("/api/inventory/locations", headers=emp).status_code == 403


def test_effective_permissions_shape():
    mgr = client.get("/api/auth/permissions", headers=_h("manager")).json()
    assert mgr["assets"] == {"view": True, "manage": False}
    assert mgr["users"] == {"view": False, "manage": False}   # locked, not it_admin
    sa = client.get("/api/auth/permissions", headers=_h("sys_admin")).json()
    assert sa["users"]["manage"] is True                       # sys_admin all
    it = client.get("/api/auth/permissions", headers=_h("it_admin")).json()
    assert it["users"]["manage"] is True                       # locked → it_admin

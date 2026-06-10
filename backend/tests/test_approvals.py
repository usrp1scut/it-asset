import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str):
    j = client.post(
        "/api/auth/dev-login",
        json={"email": f"{role}-{uuid.uuid4().hex[:8]}@c.com", "role": role},
    ).json()
    return {"Authorization": f"Bearer {j['token']}"}, j["user"]


def _stocked_sku(h, qty: int) -> int:
    loc = client.post(
        "/api/inventory/locations", json={"name": f"L-{uuid.uuid4().hex[:5]}"}, headers=h
    ).json()["id"]
    cat = client.post(
        "/api/item-categories",
        json={"name": "鼠标", "code": uuid.uuid4().hex[:8].upper()},
        headers=h,
    ).json()
    sku = client.post(
        "/api/skus",
        json={"category_id": cat["id"], "name": "鼠标",
              "default_location_id": loc, "safety_stock": 0},
        headers=h,
    ).json()
    client.post("/api/inventory/receive",
                json={"sku_id": sku["id"], "quantity": qty}, headers=h)
    return sku["id"]


def test_submit_approve_fulfill_deducts_stock():
    admin, _ = _login("it_admin")
    emp_h, emp = _login("employee")
    sid = _stocked_sku(admin, 10)

    r = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 3}],
              "reason": "会议室需要"},
        headers=emp_h,
    )
    assert r.status_code == 201
    rid = r.json()["id"]
    assert r.json()["status"] == "pending"

    a = client.post(f"/api/approvals/{rid}/approve", headers=admin)
    assert a.json()["status"] == "approved"
    f = client.post(f"/api/approvals/{rid}/fulfill", headers=admin)
    assert f.status_code == 200 and f.json()["status"] == "fulfilled"

    # stock deducted 10 -> 7
    skus = client.get("/api/skus", headers=admin).json()["items"]
    assert next(s for s in skus if s["id"] == sid)["available"] == 7
    # employee sees the issue, enriched with the SKU name (not just #id)
    me = client.get("/api/m/me", headers=emp_h).json()
    issue = next(i for i in me["issues"] if i["sku_id"] == sid)
    assert issue["sku_name"] == "鼠标"  # _stocked_sku names it 鼠标
    assert issue["unit"] == "个"
    assert issue["quantity"] == 3


def test_reject_and_bad_state():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 5)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "x"},
        headers=emp_h,
    ).json()["id"]
    assert client.post(f"/api/approvals/{rid}/reject", headers=admin).json()["status"] == "rejected"
    # cannot fulfill a rejected request
    assert client.post(f"/api/approvals/{rid}/fulfill", headers=admin).status_code == 409


def test_fulfill_insufficient_stock_blocked():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 2)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 9}],
              "reason": "too many"},
        headers=emp_h,
    ).json()["id"]
    client.post(f"/api/approvals/{rid}/approve", headers=admin)
    assert client.post(f"/api/approvals/{rid}/fulfill", headers=admin).status_code == 409


def test_employee_cannot_approve():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 3)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "x"},
        headers=emp_h,
    ).json()["id"]
    assert client.post(f"/api/approvals/{rid}/approve", headers=emp_h).status_code == 403


def test_lark_webhook_url_verification():
    r = client.post("/api/lark/webhook", json={"type": "url_verification",
                                               "challenge": "abc123"})
    assert r.status_code == 200 and r.json()["challenge"] == "abc123"


def test_apply_card_decision_shared_path():
    from app.db import SessionLocal
    from app.modules.approvals import service

    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 3)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "x"},
        headers=emp_h,
    ).json()["id"]

    db = SessionLocal()
    try:
        assert service.apply_card_decision(db, rid, "approve") is True
        # idempotent: already decided -> no-op
        assert service.apply_card_decision(db, rid, "reject") is False
        # unknown / malformed -> no-op
        assert service.apply_card_decision(db, 999999999, "approve") is False
        assert service.apply_card_decision(db, rid, "bogus") is False
    finally:
        db.close()


def test_dashboard_pending_reflects_requests():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 4)
    client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "x"},
        headers=emp_h,
    )
    ov = client.get("/api/dashboard/overview", headers=admin).json()
    assert ov["stats"]["pending_approvals"] >= 1
    assert len(ov["recent_approvals"]) >= 1


def test_approval_enriched_names_and_items():
    admin, _ = _login("it_admin")
    emp_h, emp = _login("employee")
    sid = _stocked_sku(admin, 10)
    req = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 2}],
              "reason": "会议室"},
        headers=emp_h,
    ).json()
    # the create response is already enriched
    assert req["requester_name"] == emp["name"]
    assert req["items"] and req["items"][0]["name"] == "鼠标"
    assert req["items"][0]["qty"] == 2

    # approve with a note → enriched approver_name + decision_note + decided_at
    a = client.post(f"/api/approvals/{req['id']}/approve",
                    json={"note": "同意,下周发"}, headers=admin).json()
    assert a["status"] == "approved"
    assert a["decision_note"] == "同意,下周发"
    assert a["approver_name"] is not None and a["decided_at"] is not None


def test_approval_batch_and_scope_all():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 10)
    ids = []
    for _ in range(3):
        ids.append(client.post(
            "/api/m/requests",
            json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
                  "reason": "批量"},
            headers=emp_h,
        ).json()["id"])

    res = client.post("/api/approvals/batch",
                      json={"ids": ids, "action": "approve", "note": "批量通过"},
                      headers=admin)
    assert res.status_code == 200 and res.json()["done"] == 3

    # re-running is forgiving — all now non-pending, so skipped
    again = client.post("/api/approvals/batch",
                        json={"ids": ids, "action": "approve"}, headers=admin).json()
    assert again["done"] == 0 and again["skipped"] == 3

    # scope=all surfaces the approved ones (the approval-centre history view)
    all_rows = client.get("/api/approvals?scope=all", headers=admin).json()
    got = {r["id"]: r for r in all_rows}
    assert all(got[i]["status"] == "approved" for i in ids)


def _set_rule(h, **kw):
    body = {"enabled": True, "consumable_only": True, "respect_sku_flag": True,
            "max_total_qty": None, "max_total_amount": None}
    body.update(kw)
    return client.put("/api/approvals/auto-rule", json=body, headers=h)


def _submit(emp_h, sid, qty=1):
    return client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": qty}], "reason": "x"},
        headers=emp_h,
    ).json()


def test_auto_approval_rule_qty_and_off():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    sid = _stocked_sku(admin, 50)
    try:
        # off (default) → pending
        client.put("/api/approvals/auto-rule", json={"enabled": False}, headers=admin)
        r = _submit(emp_h, sid, 1)
        assert r["status"] == "pending" and r["auto_approved"] is False

        # on, qty threshold 5 → within auto-approves, over stays pending
        _set_rule(admin, max_total_qty=5)
        r = _submit(emp_h, sid, 3)
        assert r["status"] == "approved" and r["auto_approved"] is True
        assert "自动审批" in (r["decision_note"] or "")
        r = _submit(emp_h, sid, 9)
        assert r["status"] == "pending" and r["auto_approved"] is False
    finally:
        client.put("/api/approvals/auto-rule", json={"enabled": False}, headers=admin)


def test_auto_approval_respects_sku_flag_and_amount():
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    try:
        _set_rule(admin, max_total_qty=100)

        # a SKU flagged need_approval blocks auto-approval
        loc = client.post("/api/inventory/locations",
                          json={"name": f"L-{uuid.uuid4().hex[:5]}"}, headers=admin).json()["id"]
        cat = client.post("/api/item-categories",
                          json={"name": "键盘", "code": uuid.uuid4().hex[:8].upper()},
                          headers=admin).json()
        sku = client.post("/api/skus",
                          json={"category_id": cat["id"], "name": "需审批键盘",
                                "default_location_id": loc, "safety_stock": 0,
                                "need_approval": True},
                          headers=admin).json()
        client.post("/api/inventory/receive",
                    json={"sku_id": sku["id"], "quantity": 10}, headers=admin)
        assert _submit(emp_h, sku["id"], 1)["status"] == "pending"

        # amount threshold: give a normal SKU a price, set a low cap → pending
        sid = _stocked_sku(admin, 50)
        from app.db import SessionLocal
        from app.modules.inventory.models import Sku
        db = SessionLocal()
        try:
            db.get(Sku, sid).price = 200
            db.commit()
        finally:
            db.close()
        _set_rule(admin, max_total_qty=100, max_total_amount=100)  # 200×1 > 100
        assert _submit(emp_h, sid, 1)["status"] == "pending"
        _set_rule(admin, max_total_qty=100, max_total_amount=1000)  # 200×1 ≤ 1000
        assert _submit(emp_h, sid, 1)["status"] == "approved"
    finally:
        client.put("/api/approvals/auto-rule", json={"enabled": False}, headers=admin)


def test_approvals_scope_visibility_gate():
    """Employees may only list their own requests; browsing scopes are gated."""
    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    mgr_h, _ = _login("manager")
    assert client.get("/api/approvals?scope=all", headers=emp_h).status_code == 403
    assert client.get("/api/approvals", headers=emp_h).status_code == 403  # default for_me
    assert client.get("/api/approvals?scope=mine", headers=emp_h).status_code == 200
    assert client.get("/api/approvals?scope=all", headers=mgr_h).status_code == 200
    assert client.get("/api/approvals?scope=all", headers=admin).status_code == 200


def test_card_decision_attributes_operator():
    """A Lark card decision is attributed to the real operator (by open_id)."""
    from app.db import SessionLocal
    from app.modules.approvals import service
    from app.modules.users.models import User

    admin, _ = _login("it_admin")
    emp_h, _ = _login("employee")
    mgr_h, mgr = _login("manager")
    sid = _stocked_sku(admin, 5)
    # shared dev DB: make sure the auto-approval rule can't eat the request
    client.put("/api/approvals/auto-rule", json={"enabled": False}, headers=admin)
    rid = client.post(
        "/api/m/requests",
        json={"request_type": "consumable", "items": [{"sku_id": sid, "qty": 1}],
              "reason": "归属测试"},
        headers=emp_h,
    ).json()["id"]

    open_id = f"ou_{uuid.uuid4().hex[:10]}"
    db = SessionLocal()
    try:
        u = db.get(User, mgr["id"])
        u.lark_open_id = open_id
        db.commit()
        assert service.apply_card_decision(db, rid, "approve", operator_open_id=open_id)
    finally:
        db.close()

    row = next(
        r for r in client.get("/api/approvals?scope=all", headers=admin).json()
        if r["id"] == rid
    )
    assert row["status"] == "approved"
    assert row["approver_name"] == mgr["name"]  # the real operator, not "first user"
    assert "Lark 卡片操作" in (row["decision_note"] or "")
    assert "未识别" not in row["decision_note"]

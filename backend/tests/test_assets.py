import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin") -> str:
    email = f"{role}-{uuid.uuid4().hex[:8]}@company.com"
    r = client.post("/api/auth/dev-login", json={"email": email, "role": role})
    assert r.status_code == 200
    return r.json()["token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_create_generates_code_and_lists():
    admin = _login()
    body = {"asset_class": "personal", "prefix": "PC", "brand_model": "Apple Mac mini"}
    r = client.post("/api/assets", json=body, headers=_h(admin))
    assert r.status_code == 201
    code = r.json()["asset_code"]
    assert code.startswith("PC-") and len(code) == 7  # PC-#### no year
    assert r.json()["status"] == "idle"

    lst = client.get("/api/assets?status=idle", headers=_h(admin))
    assert lst.status_code == 200
    assert any(i["asset_code"] == code for i in lst.json()["items"])


def test_list_assets_regex_search():
    admin = _login()
    tag = uuid.uuid4().hex[:6].upper()  # unique so only our two assets match
    a = client.post(
        "/api/assets",
        json={"asset_class": "personal", "prefix": "PC", "serial_number": f"RX-{tag}-A1"},
        headers=_h(admin),
    ).json()["asset_code"]
    b = client.post(
        "/api/assets",
        json={"asset_class": "personal", "prefix": "PC", "serial_number": f"RX-{tag}-B2"},
        headers=_h(admin),
    ).json()["asset_code"]

    # Regex matches only the "A<digit>" serial — substring search couldn't.
    r = client.get(
        "/api/assets", params={"regex": "true", "q": f"RX-{tag}-A[0-9]"}, headers=_h(admin)
    )
    assert r.status_code == 200
    codes = {i["asset_code"] for i in r.json()["items"]}
    assert a in codes and b not in codes

    # Invalid regex (unclosed class) → clean 400, never a 500.
    bad = client.get("/api/assets", params={"regex": "true", "q": "PC-["}, headers=_h(admin))
    assert bad.status_code == 400


def test_asset_type_crud_and_create_via_type():
    admin = _login()

    # the migration seeds standard prefixes — should be listed, with the
    # PC type carrying its default icon/color from the icon migration.
    types = client.get("/api/asset-types", headers=_h(admin)).json()
    assert {t["code_prefix"] for t in types} >= {"PC", "MON", "NET"}
    pc = next(t for t in types if t["code_prefix"] == "PC")
    assert pc["icon"] == "laptop"
    assert pc["color"] == "#3370FF"

    # create a new type (code_prefix is upper-cased server-side) with icon/color
    c = client.post(
        "/api/asset-types",
        json={
            "name": "投影仪",
            "code_prefix": "prj",
            "asset_class": "infrastructure",
            "icon": "device",
            "color": "#0086A8",
        },
        headers=_h(admin),
    )
    assert c.status_code == 201
    new_type = c.json()
    assert new_type["code_prefix"] == "PRJ"
    assert new_type["asset_class"] == "infrastructure"
    assert new_type["asset_count"] == 0
    assert new_type["icon"] == "device"
    assert new_type["color"] == "#0086A8"

    # create an asset by type — prefix + asset_class come from the type,
    # and the type's name/icon/color are surfaced on the asset payload
    r = client.post(
        "/api/assets",
        json={"asset_type_id": new_type["id"]},
        headers=_h(admin),
    )
    assert r.status_code == 201
    a = r.json()
    assert a["asset_code"].startswith("PRJ-")
    assert a["asset_class"] == "infrastructure"
    assert a["asset_type_id"] == new_type["id"]
    assert a["asset_type_name"] == "投影仪"
    assert a["asset_type_icon"] == "device"
    assert a["asset_type_color"] == "#0086A8"

    # type now has an asset → delete refused
    refused = client.delete(f"/api/asset-types/{new_type['id']}", headers=_h(admin))
    assert refused.status_code == 409

    # legacy (asset_class + prefix) path stays accepted
    legacy = client.post(
        "/api/assets",
        json={"asset_class": "personal", "prefix": "PC"},
        headers=_h(admin),
    )
    assert legacy.status_code == 201
    assert legacy.json()["asset_code"].startswith("PC-")

    # neither type_id nor prefix → 400
    bad = client.post("/api/assets", json={"brand_model": "x"}, headers=_h(admin))
    assert bad.status_code == 400

    # update the type — name + icon/color
    u = client.put(
        f"/api/asset-types/{new_type['id']}",
        json={"name": "投影设备", "icon": "monitor", "color": "#7E5EE5"},
        headers=_h(admin),
    )
    assert u.status_code == 200
    assert u.json()["name"] == "投影设备"
    assert u.json()["icon"] == "monitor"
    assert u.json()["color"] == "#7E5EE5"

    # icon can be cleared back to null by sending an empty string
    cleared = client.put(
        f"/api/asset-types/{new_type['id']}",
        json={"icon": ""},
        headers=_h(admin),
    )
    assert cleared.status_code == 200
    assert cleared.json()["icon"] is None


def test_backfill_assets_links_by_prefix():
    admin = _login()
    # legacy asset created via the prefix path → no asset_type_id
    legacy = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"},
        headers=_h(admin),
    ).json()
    before = client.get(f"/api/assets/{legacy['asset_code']}", headers=_h(admin)).json()
    assert before["asset"]["asset_type_id"] is None

    r = client.post("/api/asset-types/backfill-assets", headers=_h(admin))
    assert r.status_code == 200
    summary = r.json()
    assert summary["scanned"] >= 1 and summary["updated"] >= 1

    # the legacy asset now points at the PC type seeded by the migration
    after = client.get(f"/api/assets/{legacy['asset_code']}", headers=_h(admin)).json()
    assert after["asset"]["asset_type_id"] is not None


def test_qr_payload_deep_link_when_configured():
    from app.config import get_settings
    from app.modules.assets.service import qr_payload

    s = get_settings()
    old = s.public_base_url
    try:
        s.public_base_url = ""
        assert qr_payload("PC-0001") == "PC-0001"
        s.public_base_url = "https://assets.example.com/"  # trailing slash trimmed
        assert qr_payload("PC-0001") == "https://assets.example.com/assets?code=PC-0001"
    finally:
        s.public_base_url = old


def test_qrcode_returns_svg():
    admin = _login()
    code = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()["asset_code"]
    r = client.get(f"/api/assets/{code}/qrcode", headers=_h(admin))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")
    assert "<svg" in r.text

    missing = client.get("/api/assets/PC-9999/qrcode", headers=_h(admin))
    assert missing.status_code == 404


def test_assign_backfills_owner_and_clears_review():
    admin = _login()
    emp = client.post(
        "/api/auth/dev-login",
        json={"email": f"e-{uuid.uuid4().hex[:6]}@c.com", "name": "李测试"},
    ).json()["user"]
    pc = client.post(
        "/api/assets",
        json={"asset_class": "personal", "prefix": "PC",
              "owner_name": "实习生(脏)", "needs_review": True},
        headers=_h(admin),
    ).json()
    code = pc["asset_code"]

    a = client.post(
        f"/api/assets/{code}/assign", json={"user_id": emp["id"]}, headers=_h(admin)
    ).json()
    assert a["owner_user_id"] == emp["id"]
    assert a["owner_name"] == "李测试"          # backfilled from directory
    assert a["needs_review"] is False           # explicit assign resolves review

    r = client.post(f"/api/assets/{code}/return", json={}, headers=_h(admin)).json()
    assert r["owner_user_id"] is None
    assert r["owner_name"] is None              # no stale 责任人 after return


def test_update_ignores_owner_name_on_personal_asset():
    admin = _login()
    # personal: owner_name is directory-derived — a free-text edit is ignored,
    # while other fields still update
    pc = client.post(
        "/api/assets",
        json={"asset_class": "personal", "prefix": "PC", "owner_name": "原始名"},
        headers=_h(admin),
    ).json()
    r = client.put(
        f"/api/assets/{pc['asset_code']}",
        json={"owner_name": "乱改的", "location": "上海·张江"},
        headers=_h(admin),
    )
    assert r.status_code == 200
    assert r.json()["owner_name"] == "原始名"          # free-text edit ignored
    assert r.json()["location"] == "上海·张江"          # other fields still apply

    # infrastructure can't be assigned — its text owner / department stay editable
    net = client.post(
        "/api/assets", json={"asset_class": "infrastructure", "prefix": "NET"},
        headers=_h(admin),
    ).json()
    r2 = client.put(
        f"/api/assets/{net['asset_code']}",
        json={"owner_name": "机房管理员", "department_name": "IT 部"},
        headers=_h(admin),
    )
    assert r2.status_code == 200
    assert r2.json()["owner_name"] == "机房管理员"
    assert r2.json()["department_name"] == "IT 部"


def test_attachment_upload_list_fetch_delete():
    import base64

    admin = _login()
    code = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()["asset_code"]
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII="
    )

    up = client.post(
        f"/api/assets/{code}/attachments",
        files={"file": ("photo.png", png, "image/png")},
        headers=_h(admin),
    )
    assert up.status_code == 201, up.text
    items = up.json()
    assert len(items) == 1 and items[0]["name"] == "photo.png"
    key = items[0]["key"]

    lst = client.get(f"/api/assets/{code}/attachments", headers=_h(admin))
    assert lst.status_code == 200 and len(lst.json()) == 1

    raw = client.get(
        f"/api/assets/{code}/attachments/raw", params={"key": key}, headers=_h(admin)
    )
    assert raw.status_code == 200
    assert raw.headers["content-type"] == "image/png"
    assert raw.content == png

    bad = client.post(
        f"/api/assets/{code}/attachments",
        files={"file": ("x.exe", b"MZ", "application/octet-stream")},
        headers=_h(admin),
    )
    assert bad.status_code == 400

    d = client.request(
        "DELETE", f"/api/assets/{code}/attachments",
        params={"key": key}, headers=_h(admin),
    )
    assert d.status_code == 200
    assert client.get(f"/api/assets/{code}/attachments", headers=_h(admin)).json() == []


def test_labels_pdf_generation():
    admin = _login()
    codes = [
        client.post(
            "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
        ).json()["asset_code"]
        for _ in range(3)
    ]

    r = client.post("/api/assets/labels", json={"codes": codes}, headers=_h(admin))
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF") and len(r.content) > 1000

    assert client.post(
        "/api/assets/labels", json={"codes": []}, headers=_h(admin)
    ).status_code == 400

    miss = client.post(
        "/api/assets/labels", json={"codes": ["PC-9999"]}, headers=_h(admin)
    )
    assert miss.status_code == 404


def test_labels_start_offset_for_partial_sheet_reuse():
    """start_offset blanks leading slots so a partially-used sheet can be
    reused — leading skips can push labels onto a second page, and an
    out-of-range offset is clamped (never errors)."""
    import re

    from app.modules.assets.labels import LAYOUTS, LabelRow, render_labels_pdf

    def pages(b: bytes) -> int:
        return int(re.search(rb"/Count (\d+)", b).group(1))

    rows = [LabelRow(asset_code=f"PC-{n:04d}") for n in range(2)]
    per_page = LAYOUTS["standard"].cols * LAYOUTS["standard"].rows
    # 2 labels normally fit one page…
    assert pages(render_labels_pdf(rows, "standard", start_offset=0)) == 1
    # …but starting at the last slot pushes the 2nd onto page 2.
    assert pages(render_labels_pdf(rows, "standard", start_offset=per_page - 1)) == 2

    # HTTP path accepts + clamps an absurd offset (still one valid PDF page).
    admin = _login()
    code = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()["asset_code"]
    r = client.post(
        "/api/assets/labels",
        json={"codes": [code], "layout": "standard", "start_offset": 999},
        headers=_h(admin),
    )
    assert r.status_code == 200 and r.content.startswith(b"%PDF")


def test_sequential_codes_no_collision():
    admin = _login()
    codes = {
        client.post(
            "/api/assets", json={"asset_class": "personal", "prefix": "ZZ"}, headers=_h(admin)
        ).json()["asset_code"]
        for _ in range(5)
    }
    assert len(codes) == 5  # all unique


def test_generate_code_floored_past_manual_and_lagging_counter():
    """Auto-allocation must never collide with an existing (manual / imported)
    code or a counter that started behind real data. Uses a unique prefix so
    the shared dev DB can't interfere."""
    from app.db import SessionLocal
    from app.modules.assets import service
    from app.modules.assets.models import Asset, AssetCodeCounter, AssetStatus

    prefix = f"QA{uuid.uuid4().hex[:4].upper()}"  # 6 chars, fits String(32)
    db = SessionLocal()
    try:
        # A manually-entered code sits at #50; the counter is still at 1
        # (simulating import-without-bump and a fresh/lagging counter).
        db.add(Asset(asset_code=f"{prefix}-0050", asset_class="personal",
                     status=AssetStatus.idle))
        db.add(AssetCodeCounter(prefix=prefix, next_val=1))
        db.commit()

        first = service.generate_asset_code(db, prefix)
        db.commit()
        assert first == f"{prefix}-0051"  # floored to max(50)+1, not 0001

        second = service.generate_asset_code(db, prefix)
        db.commit()
        assert second == f"{prefix}-0052"  # then plain sequential
    finally:
        db.query(Asset).filter(Asset.asset_code.like(f"{prefix}-%")).delete(
            synchronize_session=False
        )
        db.query(AssetCodeCounter).filter(AssetCodeCounter.prefix == prefix).delete(
            synchronize_session=False
        )
        db.commit()
        db.close()


def test_state_machine_and_infrastructure_rule():
    admin = _login()
    emp = client.post(
        "/api/auth/dev-login", json={"email": f"e-{uuid.uuid4().hex[:6]}@c.com"}
    ).json()["user"]

    # personal: idle -> assign -> in_use ; scrapped is terminal
    pc = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()
    a = client.post(
        f"/api/assets/{pc['asset_code']}/assign",
        json={"user_id": emp["id"]}, headers=_h(admin),
    )
    assert a.status_code == 200 and a.json()["status"] == "in_use"

    client.post(f"/api/assets/{pc['asset_code']}/scrap", json={}, headers=_h(admin))
    again = client.post(
        f"/api/assets/{pc['asset_code']}/assign",
        json={"user_id": emp["id"]}, headers=_h(admin),
    )
    assert again.status_code == 409  # scrapped is terminal

    # infrastructure cannot be assigned
    net = client.post(
        "/api/assets", json={"asset_class": "infrastructure", "prefix": "NET"}, headers=_h(admin)
    ).json()
    r = client.post(
        f"/api/assets/{net['asset_code']}/assign",
        json={"user_id": emp["id"]}, headers=_h(admin),
    )
    assert r.status_code == 409


def test_detail_has_lifecycle():
    admin = _login()
    pc = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()
    d = client.get(f"/api/assets/{pc['asset_code']}", headers=_h(admin))
    assert d.status_code == 200
    actions = [e["action"] for e in d.json()["lifecycle"]]
    assert "create" in actions


def test_employee_cannot_list():
    emp = _login("employee")
    assert client.get("/api/assets", headers=_h(emp)).status_code == 403


def test_transfer_reassigns_owner():
    admin = _login()
    e1 = client.post("/api/auth/dev-login",
                     json={"email": f"a-{uuid.uuid4().hex[:6]}@c.com"}).json()["user"]
    e2 = client.post("/api/auth/dev-login",
                     json={"email": f"b-{uuid.uuid4().hex[:6]}@c.com"}).json()["user"]
    pc = client.post("/api/assets", json={"asset_class": "personal", "prefix": "PC"},
                     headers=_h(admin)).json()
    code = pc["asset_code"]
    client.post(f"/api/assets/{code}/assign", json={"user_id": e1["id"]}, headers=_h(admin))

    r = client.post(f"/api/assets/{code}/transfer",
                    json={"to_user_id": e2["id"], "reason": "转岗"}, headers=_h(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "in_use" and r.json()["owner_user_id"] == e2["id"]
    actions = [e["action"] for e in
               client.get(f"/api/assets/{code}", headers=_h(admin)).json()["lifecycle"]]
    assert "transfer" in actions


def test_delete_asset_soft_removes_from_ledger():
    admin = _login()
    code = client.post(
        "/api/assets", json={"asset_class": "personal", "prefix": "PC"}, headers=_h(admin)
    ).json()["asset_code"]
    # present before delete
    assert any(
        i["asset_code"] == code
        for i in client.get("/api/assets", headers=_h(admin)).json()["items"]
    )

    d = client.delete(f"/api/assets/{code}", headers=_h(admin))
    assert d.status_code == 200

    # gone from list and detail 404s after soft-delete
    assert all(
        i["asset_code"] != code
        for i in client.get("/api/assets", headers=_h(admin)).json()["items"]
    )
    assert client.get(f"/api/assets/{code}", headers=_h(admin)).status_code == 404
    # deleting an already-deleted / missing asset → 404
    assert client.delete(f"/api/assets/{code}", headers=_h(admin)).status_code == 404


def test_transfer_requires_in_use():
    admin = _login()
    e1 = client.post("/api/auth/dev-login",
                     json={"email": f"c-{uuid.uuid4().hex[:6]}@c.com"}).json()["user"]
    idle = client.post("/api/assets", json={"asset_class": "personal", "prefix": "PC"},
                       headers=_h(admin)).json()
    assert client.post(f"/api/assets/{idle['asset_code']}/transfer",
                       json={"to_user_id": e1["id"]}, headers=_h(admin)).status_code == 409
    net = client.post("/api/assets",
                      json={"asset_class": "infrastructure", "prefix": "NET"},
                      headers=_h(admin)).json()
    assert client.post(f"/api/assets/{net['asset_code']}/transfer",
                       json={"to_user_id": e1["id"]}, headers=_h(admin)).status_code == 409


def _type_id(admin: str, prefix: str) -> int:
    types = client.get("/api/asset-types", headers=_h(admin)).json()
    return next(t["id"] for t in types if t["code_prefix"] == prefix)


def test_infrastructure_status_toggle():
    admin = _login()
    net = client.post("/api/assets",
                      json={"asset_class": "infrastructure", "prefix": "NET"},
                      headers=_h(admin)).json()
    code = net["asset_code"]
    assert net["status"] == "idle"

    # 启用: idle -> in_use (no owner involved)
    r = client.post(f"/api/assets/{code}/status", json={"status": "in_use"},
                    headers=_h(admin))
    assert r.status_code == 200
    assert r.json()["status"] == "in_use"
    assert r.json()["owner_user_id"] is None

    # 停用: in_use -> idle
    r = client.post(f"/api/assets/{code}/status", json={"status": "idle"},
                    headers=_h(admin))
    assert r.status_code == 200 and r.json()["status"] == "idle"

    # scrapped is refused here (must go through the scrap flow)
    bad = client.post(f"/api/assets/{code}/status", json={"status": "scrapped"},
                      headers=_h(admin))
    assert bad.status_code == 409

    # the lifecycle records the direct status change
    detail = client.get(f"/api/assets/{code}", headers=_h(admin)).json()
    assert any(e["action"] == "status_change" for e in detail["lifecycle"])


def test_personal_asset_status_endpoint_refused():
    admin = _login()
    pc = client.post("/api/assets", json={"asset_class": "personal", "prefix": "PC"},
                     headers=_h(admin)).json()
    # personal assets must use assign/return — direct status change is refused
    r = client.post(f"/api/assets/{pc['asset_code']}/status",
                    json={"status": "in_use"}, headers=_h(admin))
    assert r.status_code == 409


def test_infrastructure_repair_completes_back_to_idle():
    admin = _login()
    net = client.post("/api/assets",
                      json={"asset_class": "infrastructure", "prefix": "NET"},
                      headers=_h(admin)).json()
    code = net["asset_code"]
    # open a repair order → maintenance
    opened = client.post(f"/api/assets/{code}/repair-order",
                         json={"repair_type": "in_house", "reason": "端口故障"},
                         headers=_h(admin))
    assert opened.status_code in (200, 201), opened.text
    detail = client.get(f"/api/assets/{code}", headers=_h(admin)).json()
    assert detail["asset"]["status"] == "maintenance"
    order_id = opened.json()["id"]

    # completing must bring an infra asset back to idle (not error on return)
    done = client.post(f"/api/repair-orders/{order_id}/complete",
                       json={"resolution": "更换端口"}, headers=_h(admin))
    assert done.status_code == 200, done.text
    assert client.get(f"/api/assets/{code}", headers=_h(admin)).json()["asset"]["status"] == "idle"


def test_change_type_recodes_and_syncs_class():
    admin = _login()
    pc_type, mon_type = _type_id(admin, "PC"), _type_id(admin, "MON")
    # create as PC (personal) via the type path
    a = client.post("/api/assets", json={"asset_type_id": pc_type},
                    headers=_h(admin)).json()
    old_code = a["asset_code"]
    assert old_code.startswith("PC-")

    # change to MON → re-coded under new prefix, class still personal, icon swapped
    r = client.post(f"/api/assets/{old_code}/change-type",
                    json={"asset_type_id": mon_type}, headers=_h(admin))
    assert r.status_code == 200
    b = r.json()
    new_code = b["asset_code"]
    assert new_code.startswith("MON-")
    assert new_code != old_code
    assert b["asset_type_id"] == mon_type
    assert b["asset_type_icon"] == "monitor"

    # old code is gone, new code resolves and carries a change_type lifecycle entry
    assert client.get(f"/api/assets/{old_code}", headers=_h(admin)).status_code == 404
    detail = client.get(f"/api/assets/{new_code}", headers=_h(admin)).json()
    assert any(e["action"] == "change_type" for e in detail["lifecycle"])


def test_change_type_to_infrastructure_blocked_while_assigned():
    admin = _login()
    emp = client.post("/api/auth/dev-login",
                      json={"email": f"ct-{uuid.uuid4().hex[:6]}@c.com"}).json()["user"]
    pc_type, net_type = _type_id(admin, "PC"), _type_id(admin, "NET")
    a = client.post("/api/assets", json={"asset_type_id": pc_type},
                    headers=_h(admin)).json()
    code = a["asset_code"]
    client.post(f"/api/assets/{code}/assign", json={"user_id": emp["id"]},
                headers=_h(admin))

    # NET is infrastructure → refuse while the asset is assigned to a person
    blocked = client.post(f"/api/assets/{code}/change-type",
                          json={"asset_type_id": net_type}, headers=_h(admin))
    assert blocked.status_code == 409

    # after return it's allowed
    client.post(f"/api/assets/{code}/return", json={}, headers=_h(admin))
    ok = client.post(f"/api/assets/{code}/change-type",
                     json={"asset_type_id": net_type}, headers=_h(admin))
    assert ok.status_code == 200
    assert ok.json()["asset_class"] == "infrastructure"
    assert ok.json()["asset_code"].startswith("NET-")

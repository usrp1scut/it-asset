import uuid

from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def _login(role: str = "it_admin", name: str | None = None) -> dict:
    body: dict = {"email": f"{role}-{uuid.uuid4().hex[:8]}@seat.com", "role": role}
    if name:
        body["name"] = name
    return client.post("/api/auth/dev-login", json=body).json()


def _h(login: dict) -> dict:
    return {"Authorization": f"Bearer {login['token']}"}


def _type_id(h: dict, prefix: str) -> int:
    types = client.get("/api/asset-types", headers=h).json()
    return next(t["id"] for t in types if t["code_prefix"] == prefix)


def _asset(h: dict, tid: int, model: str = "Seat Laptop") -> tuple[str, int]:
    a = client.post(
        "/api/assets", json={"asset_type_id": tid, "brand_model": model}, headers=h
    ).json()
    return a["asset_code"], a["id"]


def _loc(h: dict, code: str) -> str | None:
    return client.get(f"/api/assets/{code}", headers=h).json()["asset"]["location"]


def _seat(detail: dict, no: str) -> dict:
    return next(s for s in detail["seats"] if s["seat_no"] == no)


def _mk_numbered_map(h: dict, name: str, rows: int, cols: int) -> dict:
    """Create a map, fill every cell with a zone-A seat, auto-number it."""
    mid = client.post(
        "/api/seatmaps", json={"name": name, "rows": rows, "cols": cols}, headers=h
    ).json()["map"]["id"]
    cells = {"seats": [{"row": r, "col": c, "zone": "A"} for r in range(rows) for c in range(cols)]}
    client.put(f"/api/seatmaps/{mid}/layout", json=cells, headers=h)
    det = client.post(f"/api/seatmaps/{mid}/autonumber", json={}, headers=h).json()
    return {"id": mid, "detail": det}


def test_seatmap_layout_and_autonumber():
    h = _h(_login())
    body = {"name": f"3F-{uuid.uuid4().hex[:4]}", "rows": 2, "cols": 3}
    m = client.post("/api/seatmaps", json=body, headers=h).json()
    mid = m["map"]["id"]
    assert m["seats"] == []

    cells = {"seats": [{"row": r, "col": c, "zone": "A"} for r in range(2) for c in range(3)]}
    det = client.put(f"/api/seatmaps/{mid}/layout", json=cells, headers=h).json()
    assert len(det["seats"]) == 6
    assert all(s["seat_no"] is None for s in det["seats"])

    det = client.post(f"/api/seatmaps/{mid}/autonumber", json={}, headers=h).json()
    assert sorted(s["seat_no"] for s in det["seats"]) == [f"A0{i}" for i in range(1, 7)]


def test_seatmap_seat_person_brings_assets_and_writes_location():
    h = _h(_login())
    emp_id = _login("employee")["user"]["id"]
    tid = _type_id(h, "PC")
    code, _ = _asset(h, tid)
    client.post(f"/api/assets/{code}/assign", json={"user_id": emp_id}, headers=h)  # in-use

    name = f"3F-{uuid.uuid4().hex[:4]}"
    mk = _mk_numbered_map(h, name, 2, 2)
    seat = _seat(mk["detail"], "A01")
    det = client.post(
        f"/api/seatmaps/{mk['id']}/seats/{seat['id']}/assign-user",
        json={"user_id": emp_id, "move_assets": True}, headers=h,
    ).json()

    occupied = _seat(det, "A01")
    assert occupied["user_id"] == emp_id
    assert any(a["asset_code"] == code for a in occupied["assets"])
    assert _loc(h, code) == f"{name}-A01"


def test_seatmap_move_person_between_seats():
    """把已落座的人分到另一工位:旧工位自动腾空,人和名下资产跟着走。"""
    h = _h(_login())
    emp_id = _login("employee")["user"]["id"]
    tid = _type_id(h, "PC")
    code, _ = _asset(h, tid)
    client.post(f"/api/assets/{code}/assign", json={"user_id": emp_id}, headers=h)  # in-use

    name = f"3F-{uuid.uuid4().hex[:4]}"
    mk = _mk_numbered_map(h, name, 1, 2)
    mid, det = mk["id"], mk["detail"]
    a01, a02 = _seat(det, "A01"), _seat(det, "A02")

    # 先坐 A01(带入名下资产)
    d1 = client.post(
        f"/api/seatmaps/{mid}/seats/{a01['id']}/assign-user",
        json={"user_id": emp_id, "move_assets": True}, headers=h,
    ).json()
    assert _seat(d1, "A01")["user_id"] == emp_id
    assert any(a["asset_code"] == code for a in _seat(d1, "A01")["assets"])

    # 再拖到 A02 —— A01 应自动腾空,人和资产都到 A02
    d2 = client.post(
        f"/api/seatmaps/{mid}/seats/{a02['id']}/assign-user",
        json={"user_id": emp_id, "move_assets": True}, headers=h,
    ).json()
    assert _seat(d2, "A01")["user_id"] is None
    assert _seat(d2, "A01")["assets"] == []
    assert _seat(d2, "A02")["user_id"] == emp_id
    assert any(a["asset_code"] == code for a in _seat(d2, "A02")["assets"])
    assert _loc(h, code) == f"{name}-A02"


def test_seatmap_place_and_clear_asset():
    h = _h(_login())
    tid = _type_id(h, "PC")
    code, aid = _asset(h, tid)

    name = f"3F-{uuid.uuid4().hex[:4]}"
    mk = _mk_numbered_map(h, name, 1, 2)
    seat = _seat(mk["detail"], "A02")

    client.post(f"/api/seatmaps/{mk['id']}/seats/{seat['id']}/place-asset",
                json={"asset_id": aid}, headers=h)
    assert _loc(h, code) == f"{name}-A02"

    client.post(f"/api/seatmaps/{mk['id']}/seats/{seat['id']}/clear", headers=h)
    assert _loc(h, code) is None


def test_seatmap_candidates_excludes_seated_and_placed():
    h = _h(_login())
    ptoken = uuid.uuid4().hex[:8]
    emp_id = _login("employee", name=f"座测{ptoken}")["user"]["id"]
    tid = _type_id(h, "PC")
    atoken = uuid.uuid4().hex[:8]
    code, aid = _asset(h, tid, model=f"SeatDev-{atoken}")

    name = f"3F-{uuid.uuid4().hex[:4]}"
    mk = _mk_numbered_map(h, name, 1, 2)
    mid = mk["id"]

    def people_has():
        r = client.get(f"/api/seatmaps/{mid}/candidates", params={"q": ptoken}, headers=h).json()
        return any(p["id"] == emp_id for p in r["people"])

    def assets_has():
        r = client.get(f"/api/seatmaps/{mid}/candidates", params={"q": atoken}, headers=h).json()
        return any(a["id"] == aid for a in r["assets"])

    assert people_has() and assets_has()  # neither seated nor placed yet

    client.post(f"/api/seatmaps/{mid}/seats/{_seat(mk['detail'], 'A01')['id']}/assign-user",
                json={"user_id": emp_id, "move_assets": False}, headers=h)
    client.post(f"/api/seatmaps/{mid}/seats/{_seat(mk['detail'], 'A02')['id']}/place-asset",
                json={"asset_id": aid}, headers=h)

    assert not people_has()  # now seated → excluded
    assert not assets_has()  # now placed → excluded


def test_seatmap_delete_map_clears_location():
    h = _h(_login())
    tid = _type_id(h, "PC")
    code, aid = _asset(h, tid)

    name = f"3F-{uuid.uuid4().hex[:4]}"
    mk = _mk_numbered_map(h, name, 1, 1)
    client.post(f"/api/seatmaps/{mk['id']}/seats/{mk['detail']['seats'][0]['id']}/place-asset",
                json={"asset_id": aid}, headers=h)
    assert _loc(h, code) == f"{name}-A01"

    assert client.delete(f"/api/seatmaps/{mk['id']}", headers=h).status_code == 204
    assert client.get(f"/api/seatmaps/{mk['id']}", headers=h).status_code == 404
    assert _loc(h, code) is None


def test_seatmap_export_pdf():
    h = _h(_login())
    mk = _mk_numbered_map(h, f"3F-{uuid.uuid4().hex[:4]}", 2, 2)
    r = client.get(f"/api/seatmaps/{mk['id']}/export", headers=h)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:5] == b"%PDF-"
    # export is view-gated → an employee can't
    emp = _h(_login("employee"))
    assert client.get(f"/api/seatmaps/{mk['id']}/export", headers=emp).status_code == 403


def test_seatmap_pdf_name_fits_without_truncation():
    """导出时工位姓名不应被截断:够长就缩字号,再长折两行,极端才省略。"""
    from app.modules.seatmap import pdf as seatmap_pdf
    from fpdf import FPDF

    p = FPDF(orientation="L", unit="mm", format="A4")
    p.add_page()
    font = seatmap_pdf._register_font(p)

    # 中等长度名字:在合理格宽内应完整显示(仅缩字号,不出现省略号)
    name = "王小明abc"
    lines, _ = seatmap_pdf._name_lines(p, font, name, 22.0, 9.0)
    assert "".join(lines) == name
    assert "…" not in "".join(lines)

    # 很长的名字:折成不超过两行,仍不截断
    long_name = "测试超长姓名王小明ABCDEFG"
    llines, _ = seatmap_pdf._name_lines(p, font, long_name, 22.0, 9.0)
    assert 1 <= len(llines) <= 2
    assert "".join(llines) == long_name


def test_seatmap_requires_roles():
    emp_h = _h(_login("employee"))
    assert client.get("/api/seatmaps", headers=emp_h).status_code == 403
    assert client.post("/api/seatmaps", json={"name": "x"}, headers=emp_h).status_code == 403

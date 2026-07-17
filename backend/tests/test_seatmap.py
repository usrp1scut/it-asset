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


def test_seatmap_drag_onto_occupied_seat_swaps():
    """拖到有人的工位 = 换位:从工位拖来两人对调,从侧栏拖来对方回侧栏。"""
    h = _h(_login())
    tok = uuid.uuid4().hex[:6]
    a_id = _login("employee", name=f"甲{tok}")["user"]["id"]
    b_id = _login("employee", name=f"乙{tok}")["user"]["id"]
    c_id = _login("employee", name=f"丙{tok}")["user"]["id"]
    tid = _type_id(h, "PC")
    ca, _ = _asset(h, tid)
    cb, _ = _asset(h, tid)
    client.post(f"/api/assets/{ca}/assign", json={"user_id": a_id}, headers=h)
    client.post(f"/api/assets/{cb}/assign", json={"user_id": b_id}, headers=h)

    name = f"3F-{uuid.uuid4().hex[:4]}"
    mk = _mk_numbered_map(h, name, 1, 2)
    mid = mk["id"]
    s1 = _seat(mk["detail"], "A01")["id"]
    s2 = _seat(mk["detail"], "A02")["id"]

    def seat_user(det, no):
        return _seat(det, no)["user_id"]

    for uid, sid in ((a_id, s1), (b_id, s2)):
        client.post(f"/api/seatmaps/{mid}/seats/{sid}/assign-user",
                    json={"user_id": uid, "move_assets": True}, headers=h)
    assert _loc(h, ca) == f"{name}-A01"
    assert _loc(h, cb) == f"{name}-A02"

    # 甲(A01)拖到乙所在的 A02 -> 两人对调,各自资产跟着走
    d = client.post(f"/api/seatmaps/{mid}/seats/{s2}/assign-user",
                    json={"user_id": a_id, "move_assets": True}, headers=h).json()
    assert seat_user(d, "A02") == a_id
    assert seat_user(d, "A01") == b_id      # 乙被换到甲原来的工位,而不是被挤没
    assert _loc(h, ca) == f"{name}-A02"
    assert _loc(h, cb) == f"{name}-A01"

    # 丙从侧栏拖到甲所在的 A02 -> 甲回侧栏(未落座),其资产移出工位
    d = client.post(f"/api/seatmaps/{mid}/seats/{s2}/assign-user",
                    json={"user_id": c_id, "move_assets": True}, headers=h).json()
    assert seat_user(d, "A02") == c_id
    assert seat_user(d, "A01") == b_id      # 乙不受影响
    assert a_id not in [s["user_id"] for s in d["seats"]]  # 甲已不在图上
    assert _loc(h, ca) is None             # 甲的资产随之移出工位
    # 甲回到侧栏候选名单
    cand = client.get(f"/api/seatmaps/{mid}/candidates", params={"q": f"甲{tok}"}, headers=h).json()
    assert any(p["id"] == a_id for p in cand["people"])


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


def test_seatmap_layout_optimistic_lock():
    """两人同时编辑:拿旧版本保存会被 409 挡下,而不是静默吃掉对方新加的工位。"""
    h = _h(_login())
    name = f"3F-{uuid.uuid4().hex[:4]}"
    mid = client.post(
        "/api/seatmaps", json={"name": name, "rows": 2, "cols": 2}, headers=h
    ).json()["map"]["id"]
    v0 = client.get(f"/api/seatmaps/{mid}", headers=h).json()["map"]["version"]

    # A 保存:版本推进
    d1 = client.put(
        f"/api/seatmaps/{mid}/layout",
        json={"seats": [{"row": 0, "col": 0, "zone": "A"}], "version": v0},
        headers=h,
    ).json()
    assert d1["map"]["version"] == v0 + 1

    # B 拿着进编辑时的旧版本保存 -> 409,且 A 的工位没被吃掉
    r = client.put(
        f"/api/seatmaps/{mid}/layout",
        json={"seats": [{"row": 1, "col": 1, "zone": "A"}], "version": v0},
        headers=h,
    )
    assert r.status_code == 409
    d2 = client.get(f"/api/seatmaps/{mid}", headers=h).json()
    assert [(s["row"], s["col"]) for s in d2["seats"]] == [(0, 0)]

    # B 刷新后用新版本保存 -> 通过
    r = client.put(
        f"/api/seatmaps/{mid}/layout",
        json={"seats": [{"row": 1, "col": 1, "zone": "A"}], "version": d2["map"]["version"]},
        headers=h,
    )
    assert r.status_code == 200

    # 扩展画布也推进版本 -> 旧快照保存同样被挡
    stale = r.json()["map"]["version"]
    client.post(f"/api/seatmaps/{mid}/grow", json={"edge": "bottom"}, headers=h)
    r = client.put(
        f"/api/seatmaps/{mid}/layout",
        json={"seats": [{"row": 1, "col": 1, "zone": "A"}], "version": stale},
        headers=h,
    )
    assert r.status_code == 409

    # 落座这类占用变更不推进版本 -> 不会误伤正在编辑布局的人
    cur = client.get(f"/api/seatmaps/{mid}", headers=h).json()["map"]["version"]
    emp = _login("employee")["user"]["id"]
    sid = client.get(f"/api/seatmaps/{mid}", headers=h).json()["seats"][0]["id"]
    client.post(f"/api/seatmaps/{mid}/seats/{sid}/assign-user",
                json={"user_id": emp, "move_assets": False}, headers=h)
    assert client.get(f"/api/seatmaps/{mid}", headers=h).json()["map"]["version"] == cur


def test_seatmap_labels_save_update_clear_and_clash():
    """空白格位置备注(窗/机房/前台):随布局一起存,替换式语义,与工位互斥。"""
    h = _h(_login())
    name = f"3F-{uuid.uuid4().hex[:4]}"
    mid = client.post(
        "/api/seatmaps", json={"name": name, "rows": 2, "cols": 2}, headers=h
    ).json()["map"]["id"]
    seats = [{"row": 0, "col": 0, "zone": "A"}, {"row": 0, "col": 1, "zone": "A"}]

    # 工位在第一行,备注贴在下面的空白格
    det = client.put(
        f"/api/seatmaps/{mid}/layout",
        json={"seats": seats, "labels": [
            {"row": 1, "col": 0, "text": "窗"}, {"row": 1, "col": 1, "text": "机房"},
        ]},
        headers=h,
    ).json()
    assert len(det["seats"]) == 2
    assert sorted(lb["text"] for lb in det["labels"]) == ["机房", "窗"]

    # 改文案 + 删掉一个
    det2 = client.put(
        f"/api/seatmaps/{mid}/layout",
        json={"seats": seats, "labels": [{"row": 1, "col": 0, "text": "前台"}]},
        headers=h,
    ).json()
    assert [(lb["row"], lb["col"], lb["text"]) for lb in det2["labels"]] == [(1, 0, "前台")]

    # 不传 labels -> 清空(替换式)
    det3 = client.put(f"/api/seatmaps/{mid}/layout", json={"seats": seats}, headers=h).json()
    assert det3["labels"] == []

    # 同一格既是工位又是备注 -> 409
    bad = {"seats": [{"row": 0, "col": 0, "zone": "A"}],
           "labels": [{"row": 0, "col": 0, "text": "窗"}]}
    assert client.put(f"/api/seatmaps/{mid}/layout", json=bad, headers=h).status_code == 409


def test_seatmap_seat_alias_replaces_display_not_ledger():
    """别名替代显示名,但台账 location 仍按自动编号走 —— 改别名不扰动台账历史。"""
    h = _h(_login())
    tid = _type_id(h, "PC")
    code, aid = _asset(h, tid)
    name = f"3F-{uuid.uuid4().hex[:4]}"
    mk = _mk_numbered_map(h, name, 1, 2)
    mid = mk["id"]
    sid = _seat(mk["detail"], "A01")["id"]
    client.post(f"/api/seatmaps/{mid}/seats/{sid}/place-asset", json={"asset_id": aid}, headers=h)
    assert _loc(h, code) == f"{name}-A01"

    # 起别名:显示名变别名,编号仍在,台账位置纹丝不动
    d = client.post(
        f"/api/seatmaps/{mid}/seats/{sid}/alias", json={"alias": "研发-12"}, headers=h
    ).json()
    s = _seat(d, "A01")
    assert s["alias"] == "研发-12"
    assert s["display_no"] == "研发-12"
    assert s["seat_no"] == "A01"
    assert _loc(h, code) == f"{name}-A01"

    # 重新自动编号不会覆盖别名
    d = client.post(f"/api/seatmaps/{mid}/autonumber", json={}, headers=h).json()
    assert _seat(d, "A01")["alias"] == "研发-12"

    # 清空别名 -> 回落到编号显示
    d = client.post(
        f"/api/seatmaps/{mid}/seats/{sid}/alias", json={"alias": "  "}, headers=h
    ).json()
    s = _seat(d, "A01")
    assert s["alias"] is None
    assert s["display_no"] == "A01"


def test_seatmap_grow_edges():
    """在边缘加行/列:下/右只扩画布,上/左还要把已有工位与备注整体平移。"""
    h = _h(_login())
    name = f"3F-{uuid.uuid4().hex[:4]}"
    mid = client.post(
        "/api/seatmaps", json={"name": name, "rows": 2, "cols": 2}, headers=h
    ).json()["map"]["id"]
    client.put(
        f"/api/seatmaps/{mid}/layout",
        json={"seats": [{"row": 0, "col": 0, "zone": "A"}],
              "labels": [{"row": 1, "col": 1, "text": "窗"}]},
        headers=h,
    )

    # 右 / 下:坐标不动
    d = client.post(
        f"/api/seatmaps/{mid}/grow", json={"edge": "right", "count": 2}, headers=h
    ).json()
    assert d["map"]["cols"] == 4
    assert (d["seats"][0]["row"], d["seats"][0]["col"]) == (0, 0)
    d = client.post(f"/api/seatmaps/{mid}/grow", json={"edge": "bottom"}, headers=h).json()
    assert d["map"]["rows"] == 3
    assert (d["seats"][0]["row"], d["seats"][0]["col"]) == (0, 0)
    assert (d["labels"][0]["row"], d["labels"][0]["col"]) == (1, 1)

    # 上:整体下移(工位 0->2,备注 1->3)
    d = client.post(f"/api/seatmaps/{mid}/grow", json={"edge": "top", "count": 2}, headers=h).json()
    assert d["map"]["rows"] == 5
    assert d["seats"][0]["row"] == 2
    assert d["labels"][0]["row"] == 3

    # 左:整体右移(工位 0->1,备注 1->2)
    d = client.post(f"/api/seatmaps/{mid}/grow", json={"edge": "left"}, headers=h).json()
    assert d["map"]["cols"] == 5
    assert d["seats"][0]["col"] == 1
    assert d["labels"][0]["col"] == 2
    # 相对位置保持不变:备注仍在工位的右下角
    assert (d["labels"][0]["row"] - d["seats"][0]["row"],
            d["labels"][0]["col"] - d["seats"][0]["col"]) == (1, 1)

    # 超出上限 -> 409
    r = client.post(f"/api/seatmaps/{mid}/grow", json={"edge": "right", "count": 40}, headers=h)
    assert r.status_code == 409


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

    # 很长的名字:折行后仍不截断
    long_name = "测试超长姓名王小明ABCDEFG"
    llines, _ = seatmap_pdf._name_lines(p, font, long_name, 22.0, 9.0)
    assert 1 <= len(llines) <= 3
    assert "".join(llines) == long_name

    # 通讯录显示名「名字(别名)」按括号拆行,而不是硬折成 `Lily (` / `李…`
    assert seatmap_pdf._name_parts("Lily（李小明）") == ["Lily", "李小明"]
    assert seatmap_pdf._name_parts("Lily(李小明)") == ["Lily", "李小明"]
    assert seatmap_pdf._name_parts("张三") == ["张三"]
    plines, _ = seatmap_pdf._name_lines(p, font, "Lily（李小明）", 24.0 - 2 * 1.92, 9.0)
    assert plines == ["Lily", "李小明"]


def test_seatmap_pdf_page_grows_for_big_maps():
    """页面迁就内容:小图仍是 A4;大图把页面放大,而不是把格子压小到放不下名字。"""
    from app.modules.seatmap import pdf as seatmap_pdf

    # 小图 -> A4 横向,格子取舒适值
    pw, ph, cell = seatmap_pdf._page_geometry(4, 6)
    assert (pw, ph) == seatmap_pdf._A4_LANDSCAPE
    assert cell == seatmap_pdf._TARGET_CELL

    # 128 工位那种大图 -> 页面变大,格子不被压缩
    bw, bh, bcell = seatmap_pdf._page_geometry(14, 25)
    assert bcell == seatmap_pdf._TARGET_CELL
    assert bw > pw and bh > ph
    assert bw <= seatmap_pdf._MAX_PAGE[0] and bh <= seatmap_pdf._MAX_PAGE[1]


def test_seatmap_requires_roles():
    emp_h = _h(_login("employee"))
    assert client.get("/api/seatmaps", headers=emp_h).status_code == 403
    assert client.post("/api/seatmaps", json={"name": "x"}, headers=emp_h).status_code == 403

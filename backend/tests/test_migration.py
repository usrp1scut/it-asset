import io
from datetime import date

from app.modules.assets.migration import (
    clean_date,
    clean_price,
    clean_serial,
    clean_status,
    clean_type,
    has_scrap_hint,
)
from app.modules.assets.models import AssetClass, AssetStatus
from openpyxl import Workbook


def test_clean_serial():
    assert clean_serial("无") == (None, None)
    assert clean_serial("") == (None, None)
    assert clean_serial("无,临时编号gw-1") == (None, "gw-1")
    assert clean_serial("无，临时编号x99-1") == (None, "x99-1")
    assert clean_serial("C02ZK5XAGD7M") == ("C02ZK5XAGD7M", None)


def test_clean_type():
    assert clean_type("网络设备")[:2] == (AssetClass.infrastructure, "NET")
    assert clean_type("PC")[:2] == (AssetClass.personal, "PC")
    assert clean_type("显示器")[:2] == (AssetClass.personal, "MON")
    cls, prefix, unknown = clean_type("外星科技")
    assert unknown is True and prefix == "OTH"


def test_clean_status_price_date_hint():
    assert clean_status("在用")[0] == AssetStatus.in_use
    assert clean_status("已报废")[0] == AssetStatus.scrapped
    assert clean_status("玄学")[1] is True  # unknown -> flag
    assert clean_price("1,999元") == 1999
    assert clean_price("") is None
    assert clean_date("2025/01/15") == date(2025, 1, 15)
    assert clean_date("") is None
    assert has_scrap_hint("已超10年，建议报废") is True
    assert has_scrap_hint("正常") is False


def _xlsx(rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(["资产编号", "类型", "品牌型号", "配置", "序列号",
               "所属部门", "使用人", "状态", "采购日期", "原值", "备注"])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_import_roundtrip():
    import uuid

    from app.main import app
    from fastapi.testclient import TestClient

    client = TestClient(app)

    tok = client.post(
        "/api/auth/dev-login",
        json={"email": f"mig-{uuid.uuid4().hex[:6]}@c.com", "role": "it_admin"},
    ).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}

    content = _xlsx([
        ["", "PC", "Apple Mac mini", "m4-16g-256g", "F16TJ42C1W",
         "研发部", "谢博", "在用", "", "", ""],
        ["", "PC", "联想", "4590-16g-256g", "无,临时编号gw-1",
         "", "实习生", "闲置", "", "", "已超10年，建议报废"],
        ["", "网络设备", "锐捷EAP262", "", "G1TC2V502692B", "", "", "在用", "", "", ""],
    ])
    r = client.post(
        "/api/assets/import",
        files={"file": ("stock.xlsx", content,
                         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=h,
    )
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["total"] == 3
    assert s["created"] == 3
    assert s["needs_review"] >= 2  # 实习生未匹配 + 部门待匹配

    # the dirty laptop row -> legacy_code + scrap_candidate
    lst = client.get("/api/assets?scrap_candidate=true&q=联想", headers=h).json()
    item = next(i for i in lst["items"] if i["brand_model"] == "联想")
    assert item["legacy_code"] == "gw-1"
    assert item["serial_number"] is None
    assert item["scrap_candidate"] is True
    assert item["asset_code"].startswith("PC-")

    # network device -> infrastructure + NET prefix
    net = client.get("/api/assets?q=锐捷", headers=h).json()["items"][0]
    assert net["asset_class"] == "infrastructure"
    assert net["asset_code"].startswith("NET-")

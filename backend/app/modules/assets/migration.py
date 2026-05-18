"""Phase 0 存量迁移 — 列映射与清洗(PRD §13.2)。

纯函数,便于单测。原则:容脏——绝大多数字段可空,无法确定的打 needs_review,
不卡门(PRD §3.2)。
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.modules.assets.models import AssetClass, AssetStatus

# 类型 → (asset_class, 编号前缀)
_TYPE_MAP: dict[str, tuple[AssetClass, str]] = {
    "PC": (AssetClass.personal, "PC"),
    "电脑": (AssetClass.personal, "PC"),
    "台式机": (AssetClass.personal, "PC"),
    "笔记本": (AssetClass.personal, "PC"),
    "显示器": (AssetClass.personal, "MON"),
    "手机": (AssetClass.personal, "PHN"),
    "平板": (AssetClass.personal, "PAD"),
    "sim卡": (AssetClass.personal, "SIM"),
    "SIM": (AssetClass.personal, "SIM"),
    "网络设备": (AssetClass.infrastructure, "NET"),
    "交换机": (AssetClass.infrastructure, "NET"),
    "路由器": (AssetClass.infrastructure, "NET"),
    "AP": (AssetClass.infrastructure, "NET"),
    # 打印机通常为共享设备、无固定使用人 → 基础设施
    "打印机": (AssetClass.infrastructure, "PRT"),
}

_STATUS_MAP = {
    "在用": AssetStatus.in_use,
    "闲置": AssetStatus.idle,
    "维修": AssetStatus.maintenance,
    "维修中": AssetStatus.maintenance,
    "报废": AssetStatus.scrapped,
    "已报废": AssetStatus.scrapped,
}

_SCRAP_HINTS = ("建议报废", "无法点亮", "损坏", "已超10年", "报废", "无法开机", "无法重装")


@dataclass
class CleanedRow:
    prefix: str
    data: dict
    needs_review: bool = False
    review_reasons: list[str] = field(default_factory=list)

    def flag(self, reason: str) -> None:
        self.needs_review = True
        self.review_reasons.append(reason)


def _s(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def clean_type(raw) -> tuple[AssetClass, str, bool]:
    s = _s(raw)
    if s:
        for key, (cls, prefix) in _TYPE_MAP.items():
            if key in s:
                return cls, prefix, False
    # 未知类型:默认个人发放,前缀 OTH,待核
    return AssetClass.personal, "OTH", True


def clean_serial(raw) -> tuple[str | None, str | None]:
    """返回 (serial_number, legacy_code)。'无'→None;'无,临时编号X'→legacy=X。"""
    s = _s(raw)
    if not s:
        return None, None
    if s.startswith("无"):
        # 例:无,临时编号gw-1 / 无，临时编号x99-1
        if "临时编号" in s:
            legacy = s.split("临时编号", 1)[1].strip(" ，,、:：")
            return None, legacy or None
        return None, None
    return s, None


def clean_status(raw) -> tuple[AssetStatus, bool]:
    s = _s(raw)
    if s:
        for key, st in _STATUS_MAP.items():
            if key in s:
                return st, False
    return AssetStatus.idle, True


def clean_date(raw) -> date | None:
    if raw is None or _s(raw) is None:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    txt = str(raw).strip().replace("/", "-").replace(".", "-")
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(txt, fmt).date()
        except ValueError:
            continue
    return None


def clean_price(raw) -> Decimal | None:
    s = _s(raw)
    if not s:
        return None
    s = s.replace(",", "").replace("¥", "").replace("元", "").strip()
    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def has_scrap_hint(remark) -> bool:
    s = _s(remark) or ""
    return any(h in s for h in _SCRAP_HINTS)


# 云文档表头 → 内部键
HEADER_ALIASES = {
    "资产编号": "asset_code",
    "类型": "type",
    "品牌型号": "brand_model",
    "配置": "spec",
    "序列号": "serial",
    "所属部门": "department",
    "使用人": "owner",
    "状态": "status",
    "采购日期": "purchase_date",
    "原值": "purchase_price",
    "备注": "remark",
}


def clean_row(row: dict) -> CleanedRow:
    """row: 以内部键(见 HEADER_ALIASES 值)取值的一行原始数据。"""
    asset_class, prefix, type_unknown = clean_type(row.get("type"))
    serial, legacy = clean_serial(row.get("serial"))
    status, status_unknown = clean_status(row.get("status"))
    remark = _s(row.get("remark"))

    data = {
        "asset_code": _s(row.get("asset_code")),
        "asset_class": asset_class,
        "brand_model": _s(row.get("brand_model")),
        "spec": _s(row.get("spec")),
        "serial_number": serial,
        "legacy_code": legacy,
        "status": status,
        "owner_name": _s(row.get("owner")),
        "department_name": _s(row.get("department")),
        "purchase_date": clean_date(row.get("purchase_date")),
        "purchase_price": clean_price(row.get("purchase_price")),
        "remark": remark,
        "scrap_candidate": has_scrap_hint(remark),
    }
    cleaned = CleanedRow(prefix=prefix, data=data)
    if type_unknown:
        cleaned.flag("类型无法识别")
    if status_unknown and _s(row.get("status")):
        cleaned.flag("状态无法识别")
    # owner/department matching needs the DB — decided in the import service,
    # which finalises needs_review.
    return cleaned

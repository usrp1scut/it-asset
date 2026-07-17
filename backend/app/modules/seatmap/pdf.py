"""座位图 → PDF(矢量平面图,非截图).

复用 labels.py 的 fpdf2 + 内置 CJK 字体(wqy-zenhei)。每个工位画成方格:顶部区域
色条 + 编号 + 占用人(或设备数),过道留空,空白格可带位置备注(窗/机房…)。

版面策略:**页面迁就内容,而不是把内容压进 A4**。
- 只画用到的范围(按工位/备注的外接矩形裁掉四周空白行列);
- 以「舒适格子边长」反推页面尺寸 —— 小图还是 A4,大图自动长成 A2/A1 这类
  平面图常见幅面。这样格子不会被压小到姓名放不下(旧版 128 工位图就是被
  压到 ~11mm,连 4.5pt 都塞不下,只能省略号截断)。
"""
from datetime import date
from pathlib import Path

from fpdf import FPDF
from sqlalchemy.orm import Session

from app.modules.seatmap import service
from app.modules.seatmap.models import FloorMap

_CJK_FONT_PATHS = [
    Path("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"),
    Path("/usr/share/fonts/wenquanyi/wqy-zenhei.ttc"),
]
_ZONE_RGB = {"A": (51, 112, 255), "B": (0, 180, 42), "C": (255, 136, 0), "D": (126, 94, 229)}
_GRAY = (150, 155, 165)

_TARGET_CELL = 24.0          # 舒适格子边长(mm):姓名能完整放下的尺寸
_MIN_CELL = 10.0
_A4_LANDSCAPE = (297.0, 210.0)   # 页面下限
_MAX_PAGE = (1189.0, 841.0)      # 页面上限(A0),超大图才会触顶
_MARGIN = 10.0
_GRID_TOP = 30.0                 # 让出标题 + 汇总 + 图例
_GAP = 1.4


def _register_font(pdf: FPDF) -> str:
    for p in _CJK_FONT_PATHS:
        if p.exists():
            pdf.add_font("cjk", style="", fname=str(p))
            return "cjk"
    return "Helvetica"


def _wrap(pdf: FPDF, font: str, text: str, max_w: float, pt: float, max_lines: int):
    """Greedy char-wrap `text` into ≤ max_lines lines each ≤ max_w at size pt.

    Returns (lines, fully_fit). If the whole string doesn't fit, the last line
    is ellipsized so nothing is silently cut without a `…` marker.
    """
    pdf.set_font(font, size=pt)
    lines: list[str] = []
    cur = ""
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if not cur or pdf.get_string_width(cur + ch) <= max_w:
            cur += ch
            i += 1
        else:
            lines.append(cur)
            cur = ""
            if len(lines) >= max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
        cur, i = "", n
    fully = i >= n and not cur
    if not fully and lines:  # overflow → ellipsize the last visible line
        ell = "…"
        last = lines[-1]
        while last and pdf.get_string_width(last + ell) > max_w:
            last = last[:-1]
        lines[-1] = (last + ell) if last else ell
    return lines, fully


def _name_parts(text: str) -> list[str]:
    """『Lily(李四)』→ ['Lily', '李四'].

    通讯录显示名是「名字(别名)」,按括号拆成两行远比硬折字好读
    (旧版会切成 `Lily (` / `李…`)。没有括号就整串一行。
    """
    t = (text or "").strip()
    for lp, rp in (("（", "）"), ("(", ")")):
        if lp in t:
            head, _, tail = t.partition(lp)
            head, tail = head.strip(), tail.strip().removesuffix(rp).strip()
            if head and tail:
                return [head, tail]
    return [t]


def _name_lines(
    pdf: FPDF, font: str, text: str, max_w: float, pt_hi: float, max_lines: int = 3
) -> tuple[list[str], float]:
    """把姓名完整放进格子:先按「名字/别名」拆行,再按需缩字号 + 折行。
    只有缩到最小字号仍放不下才省略。返回 (lines, pt)。"""
    segs = _name_parts(text)
    pt = pt_hi
    while pt >= 4.5:
        lines: list[str] = []
        ok = True
        for seg in segs:
            room = max_lines - len(lines)
            if room <= 0:
                ok = False
                break
            ls, fully = _wrap(pdf, font, seg, max_w, pt, room)
            if not fully:
                ok = False
                break
            lines += ls
        if ok and lines:
            return lines, pt
        pt -= 0.5
    lines, _ = _wrap(pdf, font, text, max_w, 4.5, max_lines)
    return lines, 4.5


def _page_geometry(rows_used: int, cols_used: int) -> tuple[float, float, float]:
    """(page_w, page_h, cell) —— 按舒适格子反推页面,再受最大幅面钳制。"""
    fit_w = (_MAX_PAGE[0] - 2 * _MARGIN - (cols_used - 1) * _GAP) / cols_used
    fit_h = (_MAX_PAGE[1] - _GRID_TOP - _MARGIN - (rows_used - 1) * _GAP) / rows_used
    cell = max(min(_TARGET_CELL, fit_w, fit_h), _MIN_CELL)
    grid_w = cols_used * cell + (cols_used - 1) * _GAP
    grid_h = rows_used * cell + (rows_used - 1) * _GAP
    pw = max(_A4_LANDSCAPE[0], grid_w + 2 * _MARGIN)
    ph = max(_A4_LANDSCAPE[1], grid_h + _GRID_TOP + _MARGIN)
    return pw, ph, cell


def render_seatmap_pdf(db: Session, m: FloorMap) -> bytes:
    payload = service.map_payload(db, m)
    seats = payload["seats"]
    labels = payload.get("labels") or []
    by_cell = {(s["row"], s["col"]): s for s in seats}
    total = len(seats)
    occupied = sum(1 for s in seats if s["user_id"] or s["assets"])
    with_assets = sum(1 for s in seats if s["assets"])
    zones = sorted({s["zone"] for s in seats if s["zone"]})

    # 只画用到的范围:四周成片的空行空列不该把格子压小
    used = [(s["row"], s["col"]) for s in seats] + [(lb["row"], lb["col"]) for lb in labels]
    if used:
        r0, r1 = min(r for r, _ in used), max(r for r, _ in used)
        c0, c1 = min(c for _, c in used), max(c for _, c in used)
    else:
        r0, r1, c0, c1 = 0, m.rows - 1, 0, m.cols - 1
    rows_used, cols_used = r1 - r0 + 1, c1 - c0 + 1

    pw, ph, cell = _page_geometry(rows_used, cols_used)
    pdf = FPDF(unit="mm", format=(pw, ph))  # 纵横由 format 直接给定
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    font = _register_font(pdf)

    # ── header ────────────────────────────────────────────────────────────────
    pdf.set_text_color(20, 20, 25)
    pdf.set_font(font, size=15)
    pdf.set_xy(_MARGIN, 8)
    pdf.cell(0, 8, f"座位图 · {m.name}")
    pdf.set_font(font, size=9)
    pdf.set_text_color(*_GRAY)
    pdf.set_xy(_MARGIN, 17)
    pdf.cell(0, 5, f"工位 {total} · 已坐 {occupied} · 空 {total - occupied} · 带资产 {with_assets}"
                   f"    导出 {date.today().isoformat()}")
    if len(zones) > 1:
        x, y = _MARGIN, 23.5
        for z in zones:
            pdf.set_fill_color(*_ZONE_RGB.get(z, _GRAY))
            pdf.rect(x, y, 3, 3, style="F")
            pdf.set_text_color(90, 95, 105)
            pdf.set_font(font, size=8)
            pdf.set_xy(x + 4, y - 1)
            n = sum(1 for s in seats if s["zone"] == z)
            label = f"{z} 区 · {n}"
            pdf.cell(20, 5, label)
            x += 6 + pdf.get_string_width(label)

    # ── grid ────────────────────────────────────────────────────────────────
    grid_w = cols_used * cell + (cols_used - 1) * _GAP
    left = _MARGIN + max(0.0, (pw - 2 * _MARGIN - grid_w) / 2)

    def cell_xy(r: int, c: int) -> tuple[float, float]:
        return left + (c - c0) * (cell + _GAP), _GRID_TOP + (r - r0) * (cell + _GAP)

    no_pt = min(max(cell * 0.42, 4.0), 7.0)
    nm_pt = min(max(cell * 0.5, 4.5), 9.0)
    pad = cell * 0.08

    for (r, c), s in by_cell.items():
        x, y = cell_xy(r, c)
        occ = bool(s["user_id"])
        nd = len(s["assets"])
        if occ:
            pdf.set_fill_color(230, 240, 253)
        elif nd:
            pdf.set_fill_color(225, 245, 238)
        else:
            pdf.set_fill_color(255, 255, 255)
        pdf.set_draw_color(205, 210, 220)
        pdf.set_line_width(0.2)
        pdf.rect(x, y, cell, cell, style="DF")
        pdf.set_fill_color(*_ZONE_RGB.get(s["zone"], _GRAY))
        pdf.rect(x, y, cell, max(cell * 0.12, 1.2), style="F")

        # seat number(设了别名就显示别名);别名可能较长,同样走自适应排版
        pdf.set_text_color(*_GRAY)
        no_lines, npt2 = _name_lines(
            pdf, font, s.get("display_no") or s["seat_no"] or "—", cell - 2 * pad, no_pt, 2
        )
        pdf.set_font(font, size=npt2)
        nlh = min(cell * 0.16, cell * 0.28 / max(len(no_lines), 1))
        for idx, ln in enumerate(no_lines):
            pdf.set_xy(x, y + cell * 0.16 + idx * nlh)
            pdf.cell(cell, nlh, ln, align="C")

        # occupant / device
        if occ:
            pdf.set_text_color(12, 68, 124)
            lines, npt = _name_lines(pdf, font, s["user_name"] or "已占", cell - 2 * pad, nm_pt)
            show_count = bool(nd) and len(lines) <= 2 and cell >= 16
            top, bottom = cell * 0.42, cell * (0.74 if show_count else 0.88)
            lh = min(cell * 0.22, (bottom - top) / len(lines))
            y0 = y + top + max(0.0, (bottom - top - lh * len(lines)) / 2)
            pdf.set_font(font, size=npt)
            for idx, ln in enumerate(lines):
                pdf.set_xy(x, y0 + idx * lh)
                pdf.cell(cell, lh, ln, align="C")
            if show_count:
                pdf.set_font(font, size=no_pt)
                pdf.set_xy(x, y + cell * 0.76)
                pdf.cell(cell, cell * 0.2, f"+{nd} 资产", align="C")
        elif nd:
            pdf.set_text_color(15, 110, 86)
            pdf.set_font(font, size=nm_pt)
            pdf.set_xy(x, y + cell * 0.46)
            pdf.cell(cell, cell * 0.3, f"{nd} 台", align="C")

    # ── position labels (窗 / 柜子 / 机房 / 前台 …) ────────────────────────────
    # Reference markers on blank cells: muted, no border — they orient the reader
    # without competing with the seats.
    for lb in labels:
        x, y = cell_xy(lb["row"], lb["col"])
        pdf.set_fill_color(242, 243, 245)
        pdf.rect(x, y, cell, cell, style="F")
        pdf.set_text_color(120, 126, 138)
        lines, lpt = _name_lines(pdf, font, lb["text"], cell - 2 * pad, nm_pt)
        pdf.set_font(font, size=lpt)
        lh = min(cell * 0.24, cell / max(len(lines), 1))
        y0 = y + max(0.0, (cell - lh * len(lines)) / 2)
        for idx, ln in enumerate(lines):
            pdf.set_xy(x, y0 + idx * lh)
            pdf.cell(cell, lh, ln, align="C")

    return bytes(pdf.output())

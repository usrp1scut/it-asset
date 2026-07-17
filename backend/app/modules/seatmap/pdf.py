"""座位图 → A4 横向 PDF(矢量平面图,非截图).

复用 labels.py 的 fpdf2 + 内置 CJK 字体(wqy-zenhei)。每个工位画成方格:顶部区域
色条 + 编号 + 占用人(或设备数),过道留空。自动缩放格子以铺满一页。
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


def _name_lines(
    pdf: FPDF, font: str, text: str, max_w: float, pt_hi: float
) -> tuple[list[str], float]:
    """Fit an occupant name without cutting it off: pick the largest font
    (≤ pt_hi, down to 4.5) at which the name wraps into ≤ 2 lines; only if it
    still overflows at 4.5pt do we ellipsize. Returns (lines, pt)."""
    pt = pt_hi
    while pt >= 4.5:
        lines, fully = _wrap(pdf, font, text, max_w, pt, 2)
        if fully:
            return lines, pt
        pt -= 0.5
    lines, _ = _wrap(pdf, font, text, max_w, 4.5, 2)
    return lines, 4.5


def render_seatmap_pdf(db: Session, m: FloorMap) -> bytes:
    payload = service.map_payload(db, m)
    seats = payload["seats"]
    by_cell = {(s["row"], s["col"]): s for s in seats}
    labels = payload.get("labels") or []
    total = len(seats)
    occupied = sum(1 for s in seats if s["user_id"] or s["assets"])
    with_assets = sum(1 for s in seats if s["assets"])
    zones = sorted({s["zone"] for s in seats if s["zone"]})

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    font = _register_font(pdf)
    pw, ph = 297.0, 210.0
    margin = 10.0

    # ── header ────────────────────────────────────────────────────────────────
    pdf.set_text_color(20, 20, 25)
    pdf.set_font(font, size=15)
    pdf.set_xy(margin, 8)
    pdf.cell(0, 8, f"座位图 · {m.name}")
    pdf.set_font(font, size=9)
    pdf.set_text_color(*_GRAY)
    pdf.set_xy(margin, 17)
    pdf.cell(0, 5, f"工位 {total} · 已坐 {occupied} · 空 {total - occupied} · 带资产 {with_assets}"
                   f"    导出 {date.today().isoformat()}")
    # zone legend
    if len(zones) > 1:
        x = margin
        y = 23.5
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
    grid_top = 30.0
    avail_w = pw - 2 * margin
    avail_h = ph - grid_top - margin
    gap = 1.4
    cols, rows = m.cols, m.rows
    cell = min((avail_w - (cols - 1) * gap) / cols, (avail_h - (rows - 1) * gap) / rows, 26.0)
    cell = max(cell, 6.0)
    grid_w = cols * cell + (cols - 1) * gap
    left = margin + (avail_w - grid_w) / 2

    no_pt = min(max(cell * 0.42, 4.0), 7.0)
    nm_pt = min(max(cell * 0.5, 4.5), 9.0)

    for (r, c), s in by_cell.items():
        x = left + c * (cell + gap)
        y = grid_top + r * (cell + gap)
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
        # zone accent stripe
        pdf.set_fill_color(*_ZONE_RGB.get(s["zone"], _GRAY))
        pdf.rect(x, y, cell, max(cell * 0.12, 1.2), style="F")

        # seat number
        pdf.set_text_color(*_GRAY)
        pdf.set_font(font, size=no_pt)
        pdf.set_xy(x, y + cell * 0.16)
        pdf.cell(cell, cell * 0.28, s["seat_no"] or "—", align="C")

        # occupant / device
        pad = cell * 0.12
        if occ:
            pdf.set_text_color(12, 68, 124)
            # fit the full name (shrink font, then wrap to 2 lines) so long
            # names aren't silently chopped off in the export
            lines, npt = _name_lines(pdf, font, s["user_name"] or "已占", cell - 2 * pad, nm_pt)
            show_count = bool(nd) and len(lines) == 1 and cell >= 16
            top, bottom = cell * 0.42, cell * (0.72 if show_count else 0.86)
            lh = min(cell * 0.24, (bottom - top) / len(lines))
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
        x = left + lb["col"] * (cell + gap)
        y = grid_top + lb["row"] * (cell + gap)
        pdf.set_fill_color(242, 243, 245)
        pdf.rect(x, y, cell, cell, style="F")
        pdf.set_text_color(120, 126, 138)
        lines, lpt = _name_lines(pdf, font, lb["text"], cell - 2 * (cell * 0.1), nm_pt)
        pdf.set_font(font, size=lpt)
        lh = min(cell * 0.26, cell / max(len(lines), 1))
        y0 = y + max(0.0, (cell - lh * len(lines)) / 2)
        for idx, ln in enumerate(lines):
            pdf.set_xy(x, y0 + idx * lh)
            pdf.cell(cell, lh, ln, align="C")

    return bytes(pdf.output())

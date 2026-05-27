"""Batch QR-label PDF for sticking onto real assets (PRD §7.7, Phase 2).

A4 portrait, 4 columns × 8 rows = 32 labels per page. Each cell is laid
out vertically:

    +--------------------+
    |   +----------+     |
    |   |  ▓▓▓▓▓▓  |     |  ← 24mm QR, centered, with 2-module quiet zone
    |   |  ▓▓▓▓▓▓  |     |
    |   +----------+     |
    |  PC-0099           |  ← asset_code (10pt mono)
    |  MacBook Pro M3    |  ← brand_model (7pt)
    |  张三 · IT 部      |  ← owner · dept (6.5pt)
    +--------------------+

The previous side-by-side layout left only ~1mm of whitespace around the
QR — too tight for a quiet zone — and the smaller 18mm QR pushed each
module below 0.62mm, which most phone cameras can't lock onto reliably.
Going vertical lets the QR be 24mm with a built-in 2-module border and
still leaves room for 3 text lines spanning the full cell width.

Chinese rendering needs a real CJK font — fpdf2's built-in Helvetica is
Latin-only. We register WenQuanYi Zen Hei from the Debian fonts-wqy-zenhei
package (installed in the Dockerfile) and reuse it for all label text.
"""

from dataclasses import dataclass
from pathlib import Path

import segno
from fpdf import FPDF

from app.modules.assets.service import qr_payload

# Page (mm)
_PAGE_W, _PAGE_H = 210, 297
_MARGIN = 5
_COLS, _ROWS = 4, 8
_CELL_W = (_PAGE_W - 2 * _MARGIN) / _COLS  # 50 mm
_CELL_H = (_PAGE_H - 2 * _MARGIN) / _ROWS  # 35.875 mm

# Per-cell layout (mm).
_PAD = 2
_QR_MM = 26
# ECC level — L (7% recovery) is appropriate for printed-once labels; it
# also keeps our 47-char URL payload at QR version 3 (29 data modules)
# instead of version 4 (33 modules) under ECC M.
_QR_ECC = "l"
# segno renders the QR with a quiet-zone border of N modules. We embed as
# SVG (vector) rather than PNG, so the printed modules stay crisp at any
# scale and there's no risk of pixel-level cropping/blur when the PDF is
# rasterized by a printer or viewer.
_QR_BORDER_MODULES = 2

# CJK font location (installed by Dockerfile via `apt-get install
# fonts-wqy-zenhei`). The .ttc file ships two faces; index 0 is regular.
_CJK_FONT_PATHS = [
    Path("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"),
    Path("/usr/share/fonts/wenquanyi/wqy-zenhei.ttc"),
]


@dataclass
class LabelRow:
    """One asset's data, projected into what the label needs."""

    asset_code: str
    brand_model: str | None = None
    spec: str | None = None
    owner_name: str | None = None
    department_name: str | None = None


def _draw_qr(pdf: FPDF, payload: str, x: float, y: float, size_mm: float) -> None:
    """Draw the QR onto the PDF as native rect primitives — one filled
    black rectangle per dark module, sitting on a white background rect
    for the quiet zone. This bypasses image embedding entirely (no PNG
    rasterizer pixel-rounding, no SVG-parser quirks), so the modules can
    never be cropped or compressed by the PDF viewer or printer driver.
    """
    qr = segno.make(payload, error=_QR_ECC)
    matrix = list(qr.matrix)
    data_modules = len(matrix)
    total_modules = data_modules + 2 * _QR_BORDER_MODULES
    module_mm = size_mm / total_modules

    # White quiet-zone background covering the whole QR box.
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(x, y, size_mm, size_mm, style="F")

    # Draw each dark module as a black filled square. We over-draw by
    # 0.5% so adjacent module rects share an edge cleanly (no white
    # hairline between them after PDF rasterization).
    pdf.set_fill_color(0, 0, 0)
    overlap = module_mm * 0.01
    for r, row in enumerate(matrix):
        for c, v in enumerate(row):
            if not v:
                continue
            mx = x + (c + _QR_BORDER_MODULES) * module_mm
            my = y + (r + _QR_BORDER_MODULES) * module_mm
            pdf.rect(
                mx, my, module_mm + overlap, module_mm + overlap, style="F"
            )


def _register_cjk_font(pdf: FPDF) -> str:
    """Register the bundled CJK font; return the family name to use.

    Falls back to Helvetica if no CJK font is on the system (label will
    render non-Chinese strings only — better than crashing for ASCII-only
    fleets).
    """
    for p in _CJK_FONT_PATHS:
        if p.exists():
            pdf.add_font("cjk", style="", fname=str(p))
            return "cjk"
    return "Helvetica"


def _truncate(s: str, max_chars: int) -> str:
    """Soft truncation so wide CJK strings still fit visually. Counts a
    CJK char as ~2 Latin chars so the width budget is honest."""
    if not s:
        return ""
    weight = 0
    out: list[str] = []
    for ch in s:
        w = 2 if ord(ch) > 0x2E80 else 1
        if weight + w > max_chars:
            return "".join(out) + "…"
        weight += w
        out.append(ch)
    return "".join(out)


def render_labels_pdf(rows: list[LabelRow]) -> bytes:
    """Render a 4×8 label sheet PDF with vertical QR-over-text layout."""
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    font = _register_cjk_font(pdf)

    for i, row in enumerate(rows):
        slot = i % (_COLS * _ROWS)
        if slot == 0:
            pdf.add_page()
        col, r = slot % _COLS, slot // _COLS
        x = _MARGIN + col * _CELL_W
        y = _MARGIN + r * _CELL_H

        # QR — top center, drawn as native PDF rect primitives (one rect
        # per dark module) so the printed output is mathematically exact
        # at any zoom level and impossible for a rasterizer to crop.
        qr_x = x + (_CELL_W - _QR_MM) / 2
        qr_y = y + 0.5
        _draw_qr(pdf, qr_payload(row.asset_code), qr_x, qr_y, _QR_MM)

        # Text — 3 lines, full cell width. The cell is 35.875mm tall and
        # the QR consumes 26.5mm of that, so we have ~9mm for text — tight,
        # so spacing is 2.8mm between line tops to fit cleanly.
        text_w = _CELL_W - 2 * _PAD
        text_x = x + _PAD
        text_y = qr_y + _QR_MM + 0.2

        # Line 1: asset_code (the human-readable backup if the QR fails).
        pdf.set_font(font, size=8.5)
        pdf.set_xy(text_x, text_y)
        pdf.cell(text_w, 3, row.asset_code, align="C")

        # Line 2: brand_model — primary descriptor.
        pdf.set_font(font, size=7)
        pdf.set_xy(text_x, text_y + 3)
        brand_line = row.brand_model or "—"
        if row.spec:
            joined = f"{brand_line} {row.spec}"
            brand_line = joined if len(joined) <= 24 else brand_line
        pdf.cell(text_w, 2.8, _truncate(brand_line, 30), align="C")

        # Line 3: owner [+ dept] — operations-critical row.
        owner_bits = [b for b in (row.owner_name, row.department_name) if b]
        owner_line = " · ".join(owner_bits) if owner_bits else "未分配"
        pdf.set_font(font, size=6.5)
        pdf.set_xy(text_x, text_y + 5.8)
        pdf.cell(text_w, 2.8, _truncate(owner_line, 32), align="C")

    return bytes(pdf.output())

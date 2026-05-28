"""Batch QR-label PDF for sticking onto real assets (PRD §7.7, Phase 2).

A4 portrait, 4 columns × 8 rows = 32 labels per page. Each cell is laid
out horizontally:

    +-----------+--------------------+
    |  +-----+  | PC-0002            |
    |  | ▓▓▓ |  | ThinkPad X1 Carbon |
    |  | ▓▓▓ |  | i7-1360P/16GB/512  |
    |  +-----+  | 张三 · IT 部       |
    +-----------+--------------------+

QR uses `micro=False` so it stays a standard QR (3 finder patterns) even
for the bare-asset_code payload — Lark scanCode + most generic scanners
don't decode Micro QR.

Chinese text needs a real TTF — fpdf2's built-in Helvetica is Latin-only
and would silently swallow CJK strings. The Dockerfile installs
fonts-wqy-zenhei (~7MB Debian package); we register
/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc and use it for all label
text. Falls back to Helvetica if the font isn't found.
"""

import io
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
_QR_MM = 22
_GAP = 2
_TEXT_X_OFFSET = _PAD + _QR_MM + _GAP   # 26 mm into cell
_TEXT_W = _CELL_W - _TEXT_X_OFFSET - _PAD  # 22 mm

# CJK font location, installed by the Dockerfile via apt fonts-wqy-zenhei.
_CJK_FONT_PATHS = [
    Path("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"),
    Path("/usr/share/fonts/wenquanyi/wqy-zenhei.ttc"),
]


@dataclass
class LabelRow:
    """Per-asset data projected into what one label needs."""

    asset_code: str
    brand_model: str | None = None
    spec: str | None = None
    owner_name: str | None = None
    department_name: str | None = None


def _qr_png_bytes(payload: str) -> bytes:
    buf = io.BytesIO()
    # micro=False forces a standard QR (3 finder patterns); without it
    # segno picks Micro QR for short payloads and Lark / most generic
    # scanners can't decode that.
    segno.make(payload, error="m", micro=False).save(
        buf, kind="png", scale=10, border=2
    )
    return buf.getvalue()


def _register_cjk_font(pdf: FPDF) -> str:
    """Register the bundled CJK font; return the family name to use.

    Falls back to Helvetica if no CJK font is on the system (label renders
    Latin-only — better than crashing for ASCII-only fleets).
    """
    for p in _CJK_FONT_PATHS:
        if p.exists():
            pdf.add_font("cjk", style="", fname=str(p))
            return "cjk"
    return "Helvetica"


def _truncate(s: str, max_units: int) -> str:
    """Soft truncate so wide CJK strings still fit visually. Counts a
    CJK char as ~2 Latin units so the printed-width budget is honest."""
    if not s:
        return ""
    weight = 0
    out: list[str] = []
    for ch in s:
        w = 2 if ord(ch) > 0x2E80 else 1
        if weight + w > max_units:
            return "".join(out) + "…"
        weight += w
        out.append(ch)
    return "".join(out)


def render_labels_pdf(rows: list[LabelRow]) -> bytes:
    """A4 PDF, 4×8 labels/page, QR on the left and 4 stacked text lines
    on the right."""
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

        # QR on the left, vertically centered.
        qr_x = x + _PAD
        qr_y = y + (_CELL_H - _QR_MM) / 2
        pdf.image(
            io.BytesIO(_qr_png_bytes(qr_payload(row.asset_code))),
            x=qr_x, y=qr_y, w=_QR_MM, h=_QR_MM,
        )

        # Text on the right, 4 lines on a *fixed* baseline grid. The grid
        # never collapses when a field is empty — keeps owner-line y the
        # same across every cell so labels line up horizontally across
        # the whole sheet, regardless of which assets have spec filled.
        tx = x + _TEXT_X_OFFSET
        # Vertically center the 4-line text block against the QR.
        # QR center y = qr_y + 11; block height ≈ 16mm so top = center − 8.
        block_top = qr_y + 11 - 8

        # Line 1: asset_code — 10pt, the human-readable backup.
        pdf.set_font(font, size=10)
        pdf.set_xy(tx, block_top)
        pdf.cell(_TEXT_W, 4, row.asset_code, align="L")

        # Line 2: brand_model — primary descriptor (7.5pt).
        pdf.set_font(font, size=7.5)
        pdf.set_xy(tx, block_top + 5.5)
        pdf.cell(_TEXT_W, 3.2, _truncate(row.brand_model or "—", 22), align="L")

        # Line 3: spec — secondary descriptor (6.5pt). Slot stays even
        # if spec is empty so line 4 keeps its position.
        pdf.set_font(font, size=6.5)
        if row.spec:
            pdf.set_xy(tx, block_top + 9.5)
            pdf.cell(_TEXT_W, 3, _truncate(row.spec, 26), align="L")

        # Line 4: owner · department — fixed y, regardless of whether
        # line 3 was rendered.
        owner_bits = [b for b in (row.owner_name, row.department_name) if b]
        owner_line = " · ".join(owner_bits) if owner_bits else "未分配"
        pdf.set_font(font, size=6.5)
        pdf.set_xy(tx, block_top + 13)
        pdf.cell(_TEXT_W, 3, _truncate(owner_line, 26), align="L")

    return bytes(pdf.output())

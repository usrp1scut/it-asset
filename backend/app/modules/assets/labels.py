"""Batch QR-label PDF for sticking onto real assets (PRD §7.7, Phase 2).

A4 portrait, 4 columns × 8 rows = 32 labels per page. Each cell has the QR
on the left (smaller than before — 18 mm so the asset metadata fits on the
right) and 4 stacked text lines: asset_code, brand_model, spec, owner.

Chinese rendering needs a real CJK font — fpdf2's built-in Helvetica is
Latin-only. We register WenQuanYi Zen Hei from the Debian fonts-wqy-zenhei
package (installed in the Dockerfile) and reuse it for all label text.
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
_QR_MM = 18
_GAP = 2
_TEXT_X_OFFSET = _PAD + _QR_MM + _GAP  # 22 mm into cell
_TEXT_W = _CELL_W - _TEXT_X_OFFSET - _PAD  # ~26 mm for text

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


def _qr_png_bytes(payload: str) -> bytes:
    buf = io.BytesIO()
    # Smaller printed size means we need a denser raster so scanner cameras
    # still recover the modules cleanly; scale=10 + border=0 keeps it sharp.
    segno.make(payload, error="m").save(buf, kind="png", scale=10, border=0)
    return buf.getvalue()


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
    """Render a 4×8 label sheet PDF.

    Each cell:

       +----+--------------------+
       | QR | PC-0099 (mono)    |
       | ▓▓ | MacBook Pro M3    |
       | ▓▓ | M3 Pro/18GB/512GB |
       |    | 张三 · IT 部       |
       +----+--------------------+
    """
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

        # QR — vertically centered in the cell, left side.
        qr_x = x + _PAD
        qr_y = y + (_CELL_H - _QR_MM) / 2
        # Payload encodes the deep-link URL if PUBLIC_BASE_URL is set so any
        # phone-camera scan resolves to a tap; falls back to the bare code.
        pdf.image(
            io.BytesIO(_qr_png_bytes(qr_payload(row.asset_code))),
            x=qr_x, y=qr_y, w=_QR_MM, h=_QR_MM,
        )

        # Text — 4 lines stacked, top-aligned with a small inset so the
        # baseline of line 1 doesn't ride the cell border.
        tx = x + _TEXT_X_OFFSET
        ty = y + _PAD + 2

        # Line 1: asset_code — bold-ish via larger size + monospace look.
        pdf.set_font(font, size=10)
        pdf.set_xy(tx, ty)
        pdf.cell(_TEXT_W, 4, row.asset_code, align="L")

        # Line 2: brand_model — primary descriptor.
        pdf.set_font(font, size=7.5)
        pdf.set_xy(tx, ty + 5)
        pdf.cell(_TEXT_W, 3.5, _truncate(row.brand_model or "—", 22), align="L")

        # Line 3: spec — secondary, lighter visual weight via smaller size.
        if row.spec:
            pdf.set_font(font, size=6.5)
            pdf.set_xy(tx, ty + 9)
            pdf.cell(_TEXT_W, 3, _truncate(row.spec, 26), align="L")

        # Line 4: owner [+ dept] — operations-critical row.
        owner_bits = [b for b in (row.owner_name, row.department_name) if b]
        owner_line = " · ".join(owner_bits) if owner_bits else "未分配"
        pdf.set_font(font, size=6.5)
        pdf.set_xy(tx, ty + (12.5 if row.spec else 9))
        pdf.cell(_TEXT_W, 3, _truncate(owner_line, 26), align="L")

    return bytes(pdf.output())

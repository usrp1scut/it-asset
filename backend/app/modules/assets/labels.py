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
_QR_MM = 24
# ECC level — L (7% recovery) is appropriate for printed-once labels; it
# also keeps our 47-char URL payload at QR version 3 (29 data modules)
# instead of version 4 (33 modules) under ECC M, which jumps printed
# module size from ~0.65mm to ~0.73mm at 24mm — across the threshold
# where phone-camera scanners stop locking on reliably.
_QR_ECC = "l"
# segno renders the QR with a quiet-zone border of N modules baked into
# the PNG. With ECC=L our URL payload encodes as v3 (29 modules); border=2
# adds 4 modules of whitespace, so the visible 24mm holds 33 modules at
# ~0.73mm each.
_QR_BORDER_MODULES = 2
_QR_PNG_SCALE = 15  # pixels per QR module — higher = sharper print edges.

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
    segno.make(payload, error=_QR_ECC).save(
        buf, kind="png", scale=_QR_PNG_SCALE, border=_QR_BORDER_MODULES
    )
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

        # QR — top center. The PNG includes its own 2-module quiet zone,
        # so the printed 24mm IS the QR including the standards-required
        # whitespace; we don't need extra cell padding around it.
        qr_x = x + (_CELL_W - _QR_MM) / 2
        qr_y = y + 1
        pdf.image(
            io.BytesIO(_qr_png_bytes(qr_payload(row.asset_code))),
            x=qr_x, y=qr_y, w=_QR_MM, h=_QR_MM,
        )

        # Text — 3 lines, full cell width.
        text_w = _CELL_W - 2 * _PAD
        text_x = x + _PAD
        text_y = qr_y + _QR_MM  # touch the QR's bottom quiet zone

        # Line 1: asset_code (the human-readable backup if the QR fails).
        pdf.set_font(font, size=9)
        pdf.set_xy(text_x, text_y)
        pdf.cell(text_w, 3.3, row.asset_code, align="C")

        # Line 2: brand_model — primary descriptor.
        pdf.set_font(font, size=7)
        pdf.set_xy(text_x, text_y + 3.5)
        brand_line = row.brand_model or "—"
        if row.spec:
            # Keep brand+spec on one line if it fits; otherwise just brand.
            joined = f"{brand_line} {row.spec}"
            brand_line = joined if len(joined) <= 24 else brand_line
        pdf.cell(text_w, 3, _truncate(brand_line, 30), align="C")

        # Line 3: owner [+ dept] — operations-critical row.
        owner_bits = [b for b in (row.owner_name, row.department_name) if b]
        owner_line = " · ".join(owner_bits) if owner_bits else "未分配"
        pdf.set_font(font, size=6.5)
        pdf.set_xy(text_x, text_y + 6.5)
        pdf.cell(text_w, 3, _truncate(owner_line, 32), align="C")

    return bytes(pdf.output())

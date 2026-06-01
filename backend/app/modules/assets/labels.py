"""Batch QR-label PDF for sticking onto real assets (PRD §7.7, Phase 2).

A4 portrait. Each cell is laid out horizontally — QR on the left,
asset_code / brand_model / spec / owner stacked on the right:

    +-----------+--------------------+
    |  +-----+  | PC-0002            |
    |  | ▓▓▓ |  | ThinkPad X1 Carbon |
    |  | ▓▓▓ |  | i7-1360P/16GB/512  |
    |  +-----+  | 张三 · IT 部       |
    +-----------+--------------------+

Three preset layouts (selectable per render call):

  compact  — 4×8 = 32/page, QR 18mm, smallest text (operations vibe)
  standard — 3×6 = 18/page, QR 26mm, comfortable text (default for staff)
  large    — 2×4 =  8/page, QR 40mm, big readable text (servers / printers)

QR uses `micro=False` so it stays a standard QR (3 finder patterns)
even for the bare-asset_code payload — Lark scanCode + most generic
scanners don't decode Micro QR.

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

# Page (mm) — fixed A4 portrait, 5mm safe margin.
_PAGE_W, _PAGE_H = 210, 297
_MARGIN = 5

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


@dataclass(frozen=True)
class Layout:
    """One label-grid preset.

    All sizes are in mm except font sizes (pt) and truncation budgets
    (units, where a CJK char is counted as ~2 Latin units).
    """

    id: str
    label: str           # human-friendly name shown in the picker
    cols: int
    rows: int
    qr_mm: float
    pad: float           # inset from cell edge on all sides
    gap: float           # space between QR and text block
    # Font sizes (pt) for the 4 stacked text lines
    pt_code: float
    pt_brand: float
    pt_spec: float
    pt_owner: float
    # Line baselines, expressed as offsets from block_top (mm)
    line_offsets: tuple[float, float, float, float]
    line_heights: tuple[float, float, float, float]
    # Truncation budgets in "weighted units" (CJK char counts as 2)
    trunc_brand: int
    trunc_spec: int
    trunc_owner: int


LAYOUTS: dict[str, Layout] = {
    "compact": Layout(
        id="compact",
        label="紧凑 · 4×8(32 张/页)",
        cols=4, rows=8, qr_mm=18, pad=2, gap=2,
        pt_code=10, pt_brand=7.5, pt_spec=6.5, pt_owner=6.5,
        line_offsets=(0, 5.5, 9.5, 13),
        line_heights=(4, 3.2, 3, 3),
        trunc_brand=22, trunc_spec=26, trunc_owner=26,
    ),
    "standard": Layout(
        id="standard",
        label="标准 · 3×6(18 张/页)",
        cols=3, rows=6, qr_mm=26, pad=3, gap=3,
        pt_code=13, pt_brand=10, pt_spec=8.5, pt_owner=8.5,
        line_offsets=(0, 7, 12.5, 17),
        line_heights=(5, 4.2, 4, 4),
        trunc_brand=28, trunc_spec=34, trunc_owner=34,
    ),
    "large": Layout(
        id="large",
        label="大号 · 2×4(8 张/页)",
        cols=2, rows=4, qr_mm=40, pad=4, gap=5,
        pt_code=18, pt_brand=13, pt_spec=11, pt_owner=11,
        line_offsets=(0, 9.5, 17, 23),
        line_heights=(7, 5.5, 5, 5),
        trunc_brand=36, trunc_spec=44, trunc_owner=44,
    ),
}

DEFAULT_LAYOUT = "compact"


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

    Falls back to Helvetica if no CJK font is on the system (label
    renders Latin-only — better than crashing for ASCII-only fleets).
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


def render_labels_pdf(
    rows: list[LabelRow], layout_id: str = DEFAULT_LAYOUT
) -> bytes:
    """Render labels using one of the named layouts in `LAYOUTS`."""
    layout = LAYOUTS.get(layout_id) or LAYOUTS[DEFAULT_LAYOUT]
    cell_w = (_PAGE_W - 2 * _MARGIN) / layout.cols
    cell_h = (_PAGE_H - 2 * _MARGIN) / layout.rows
    text_x_offset = layout.pad + layout.qr_mm + layout.gap
    text_w = cell_w - text_x_offset - layout.pad

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    font = _register_cjk_font(pdf)

    per_page = layout.cols * layout.rows
    for i, row in enumerate(rows):
        slot = i % per_page
        if slot == 0:
            pdf.add_page()
        col, r = slot % layout.cols, slot // layout.cols
        x = _MARGIN + col * cell_w
        y = _MARGIN + r * cell_h

        # QR — left side, vertically centered in the cell.
        qr_x = x + layout.pad
        qr_y = y + (cell_h - layout.qr_mm) / 2
        pdf.image(
            io.BytesIO(_qr_png_bytes(qr_payload(row.asset_code))),
            x=qr_x, y=qr_y, w=layout.qr_mm, h=layout.qr_mm,
        )

        # Text on the right. The 4-line block is vertically centered
        # against the QR; line baselines live on a fixed grid so labels
        # line up across the sheet regardless of which assets have spec.
        tx = x + text_x_offset
        block_top = qr_y + layout.qr_mm / 2 - (layout.line_offsets[-1] + layout.line_heights[-1]) / 2

        def line(idx: int, pt: float, text: str) -> None:
            pdf.set_font(font, size=pt)
            pdf.set_xy(tx, block_top + layout.line_offsets[idx])
            pdf.cell(text_w, layout.line_heights[idx], text, align="L")

        # Line 1: asset_code — always present.
        line(0, layout.pt_code, row.asset_code)

        # Line 2: brand_model.
        line(
            1,
            layout.pt_brand,
            _truncate(row.brand_model or "—", layout.trunc_brand),
        )

        # Line 3: spec — render only if non-empty (slot reserved
        # regardless so line 4 keeps its baseline).
        if row.spec:
            line(2, layout.pt_spec, _truncate(row.spec, layout.trunc_spec))

        # Line 4: owner · department.
        owner_bits = [b for b in (row.owner_name, row.department_name) if b]
        owner_line = " · ".join(owner_bits) if owner_bits else "未分配"
        line(3, layout.pt_owner, _truncate(owner_line, layout.trunc_owner))

    return bytes(pdf.output())


def list_layouts() -> list[dict[str, object]]:
    """Public summary of available layouts — frontend uses this to populate
    the layout picker without hardcoding the IDs."""
    return [
        {
            "id": lay.id,
            "label": lay.label,
            "cols": lay.cols,
            "rows": lay.rows,
            "per_page": lay.cols * lay.rows,
        }
        for lay in LAYOUTS.values()
    ]

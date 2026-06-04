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

    All sizes are in mm except font sizes (pt). Each text line auto-fits
    to the cell width at render time (see `_fit`), so there are no
    hand-tuned truncation budgets — the base font sizes below are the
    *maximum* used; long strings shrink a little then ellipsis-truncate.
    """

    id: str
    label: str           # human-friendly name shown in the picker
    cols: int
    rows: int
    qr_mm: float
    pad: float           # inset from cell edge on all sides
    gap: float           # space between QR and text block
    # Base (max) font sizes (pt) for the 4 stacked text lines
    pt_code: float
    pt_brand: float
    pt_spec: float
    pt_owner: float
    # Line baselines, expressed as offsets from block_top (mm)
    line_offsets: tuple[float, float, float, float]
    line_heights: tuple[float, float, float, float]
    # Physical die-cut geometry (mm). Set label_w/label_h to match a real
    # pre-cut sheet (e.g. A204 亚银 66×47): cells are then placed at
    # margin + i*(label + gap), so content lands on each physical label
    # instead of an evenly-divided grid — this is what fixes the "left column
    # drifts right / right column drifts left" you get when the page is split
    # evenly but the real label pitch differs. Leave None for generic
    # full-sheet presets (even division with a uniform _MARGIN). margin_*
    # default to symmetric auto-centering (computed from gaps) when None.
    label_w: float | None = None
    label_h: float | None = None
    gap_x: float = 0
    gap_y: float = 0
    margin_x: float | None = None
    margin_y: float | None = None


LAYOUTS: dict[str, Layout] = {
    "compact": Layout(
        id="compact",
        label="紧凑 · 4×8(32 张/页)",
        cols=4, rows=8, qr_mm=18, pad=2, gap=2,
        pt_code=10, pt_brand=7.5, pt_spec=6.5, pt_owner=6.5,
        line_offsets=(0, 5.5, 9.5, 13),
        line_heights=(4, 3.2, 3, 3),
    ),
    "standard": Layout(
        id="standard",
        label="标准 · 3×6(18 张/页)",
        cols=3, rows=6, qr_mm=26, pad=3, gap=3,
        pt_code=13, pt_brand=10, pt_spec=8.5, pt_owner=8.5,
        line_offsets=(0, 7, 12.5, 17),
        line_heights=(5, 4.2, 4, 4),
    ),
    "large": Layout(
        id="large",
        label="大号 · 2×4(8 张/页)",
        cols=2, rows=4, qr_mm=40, pad=4, gap=5,
        pt_code=18, pt_brand=13, pt_spec=11, pt_owner=11,
        line_offsets=(0, 9.5, 17, 23),
        line_heights=(7, 5.5, 5, 5),
    ),
    # Die-cut sheet preset — matches the physical 亚银模切 A204 sheet
    # (3×6 = 18 labels, each 66×47mm). Uses fixed label geometry so the
    # print registers on each pre-cut label. gap≈2mm → symmetric auto margins
    # (≈4mm sides, ≈2.5mm top/bottom). If a test print is still off by a hair,
    # tune gap_x/gap_y (label pitch) or set margin_x/margin_y explicitly.
    "a204": Layout(
        id="a204",
        label="亚银 A204 模切 · 3×6(66×47mm,18 张/页)",
        cols=3, rows=6, qr_mm=30, pad=3, gap=3,
        pt_code=12, pt_brand=9.5, pt_spec=8, pt_owner=8,
        line_offsets=(0, 7, 12.5, 17),
        line_heights=(5, 4.2, 4, 4),
        label_w=66, label_h=47, gap_x=2, gap_y=2,
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


def _fit(
    pdf: FPDF, font: str, text: str, max_w: float, base_pt: float,
    *, min_ratio: float = 0.8,
) -> tuple[float, str]:
    """Fit `text` into `max_w` mm using real font metrics.

    Strategy (shrink-to-fit): try the base point size; if it overflows,
    step the font down toward `base_pt * min_ratio` until it fits. If it
    still overflows at that floor, drop trailing characters and append an
    ellipsis. Returns the (point_size, text) to actually draw — so nothing
    ever spills into the neighbouring cell, and we shrink before we cut.
    """
    if not text:
        return base_pt, ""
    min_pt = base_pt * min_ratio
    pt = base_pt
    while pt >= min_pt:
        pdf.set_font(font, size=pt)
        if pdf.get_string_width(text) <= max_w:
            return pt, text
        pt -= 0.5
    # Floor reached and still too wide → ellipsis-truncate at the floor.
    pdf.set_font(font, size=min_pt)
    ell = "…"
    while text and pdf.get_string_width(text + ell) > max_w:
        text = text[:-1]
    return min_pt, (text + ell if text else ell)


def render_labels_pdf(
    rows: list[LabelRow], layout_id: str = DEFAULT_LAYOUT
) -> bytes:
    """Render labels using one of the named layouts in `LAYOUTS`."""
    layout = LAYOUTS.get(layout_id) or LAYOUTS[DEFAULT_LAYOUT]
    if layout.label_w is not None and layout.label_h is not None:
        # Physical die-cut sheet: fixed label size + gaps, so the print lands
        # on each pre-cut label. Pitch (label + gap) is what the page must be
        # stepped by — dividing the page evenly instead is exactly what makes
        # the outer columns/rows drift inward.
        cell_w, cell_h = layout.label_w, layout.label_h
        pitch_x, pitch_y = cell_w + layout.gap_x, cell_h + layout.gap_y
        margin_x = (
            layout.margin_x if layout.margin_x is not None
            else (_PAGE_W - layout.cols * cell_w - (layout.cols - 1) * layout.gap_x) / 2
        )
        margin_y = (
            layout.margin_y if layout.margin_y is not None
            else (_PAGE_H - layout.rows * cell_h - (layout.rows - 1) * layout.gap_y) / 2
        )
    else:
        # Generic full-sheet preset: divide the printable area evenly.
        cell_w = (_PAGE_W - 2 * _MARGIN) / layout.cols
        cell_h = (_PAGE_H - 2 * _MARGIN) / layout.rows
        pitch_x, pitch_y = cell_w, cell_h
        margin_x = margin_y = _MARGIN
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
        x = margin_x + col * pitch_x
        y = margin_y + r * pitch_y

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
        block_h = layout.line_offsets[-1] + layout.line_heights[-1]
        block_top = qr_y + layout.qr_mm / 2 - block_h / 2

        # Bind per-cell tx/block_top as defaults so the closure captures
        # this iteration's values (not the loop variable) — and stays clean
        # under flake8-bugbear B023.
        def line(idx: int, pt: float, text: str, *, _tx=tx, _top=block_top) -> None:
            if not text:
                return
            fit_pt, fit_text = _fit(pdf, font, text, text_w, pt)
            pdf.set_font(font, size=fit_pt)
            pdf.set_xy(_tx, _top + layout.line_offsets[idx])
            pdf.cell(text_w, layout.line_heights[idx], fit_text, align="L")

        # Line 1: asset_code — always present.
        line(0, layout.pt_code, row.asset_code)

        # Line 2: brand_model.
        line(1, layout.pt_brand, row.brand_model or "—")

        # Line 3: spec — render only if non-empty (slot reserved
        # regardless so line 4 keeps its baseline).
        if row.spec:
            line(2, layout.pt_spec, row.spec)

        # Line 4: owner · department.
        owner_bits = [b for b in (row.owner_name, row.department_name) if b]
        owner_line = " · ".join(owner_bits) if owner_bits else "未分配"
        line(3, layout.pt_owner, owner_line)

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

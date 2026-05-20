"""Batch QR-label PDF for sticking onto real assets (PRD §7.7, Phase 2).

A4 portrait, 4 columns × 8 rows = 32 labels per page. Each label is a QR
(encoded with the asset_code, same payload as the on-screen /qrcode
endpoint) with the asset_code printed beneath it. Page size + grid are
fixed for now; any office laser printer can use plain A4 label sheets at
this density.
"""

import io

import segno
from fpdf import FPDF

# Page (mm)
_PAGE_W, _PAGE_H = 210, 297
_MARGIN = 5
_COLS, _ROWS = 4, 8
_CELL_W = (_PAGE_W - 2 * _MARGIN) / _COLS  # 50 mm
_CELL_H = (_PAGE_H - 2 * _MARGIN) / _ROWS  # 35.875 mm
_QR_MM = 24
_TEXT_GAP = 1


def _qr_png_bytes(payload: str) -> bytes:
    buf = io.BytesIO()
    segno.make(payload, error="m").save(buf, kind="png", scale=8, border=0)
    return buf.getvalue()


def render_labels_pdf(codes: list[str]) -> bytes:
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    pdf.set_font("Helvetica", size=8)
    for i, code in enumerate(codes):
        slot = i % (_COLS * _ROWS)
        if slot == 0:
            pdf.add_page()
        col, row = slot % _COLS, slot // _COLS
        x = _MARGIN + col * _CELL_W
        y = _MARGIN + row * _CELL_H
        qr_x = x + (_CELL_W - _QR_MM) / 2
        qr_y = y + 2
        pdf.image(io.BytesIO(_qr_png_bytes(code)), x=qr_x, y=qr_y, w=_QR_MM, h=_QR_MM)
        pdf.set_xy(x, qr_y + _QR_MM + _TEXT_GAP)
        pdf.cell(_CELL_W, 4, code, align="C")
    return bytes(pdf.output())

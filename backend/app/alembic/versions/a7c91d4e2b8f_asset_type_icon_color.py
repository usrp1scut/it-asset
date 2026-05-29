"""asset_types: icon + color columns, with defaults backfilled by code_prefix

Revision ID: a7c91d4e2b8f
Revises: f4a2b1c3d5e7
Create Date: 2026-05-28 10:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7c91d4e2b8f"
down_revision: str | None = "f4a2b1c3d5e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Seeded prefix → (icon, color). Mirrors design_handoff prototype palette,
# extended with network/printer for the two PRD §13.1 infra prefixes.
DEFAULTS: list[tuple[str, str, str]] = [
    ("PC",  "laptop",  "#3370FF"),
    ("MON", "monitor", "#7E5EE5"),
    ("PHN", "phone",   "#D17A00"),
    ("PAD", "tablet",  "#00863C"),
    ("NET", "network", "#0086A8"),
    ("PRT", "printer", "#D4380D"),
]


def upgrade() -> None:
    op.add_column("asset_types", sa.Column("icon", sa.String(32), nullable=True))
    op.add_column("asset_types", sa.Column("color", sa.String(16), nullable=True))
    for prefix, icon, color in DEFAULTS:
        op.execute(
            f"UPDATE asset_types SET icon = '{icon}', color = '{color}' "
            f"WHERE code_prefix = '{prefix}' AND icon IS NULL"
        )


def downgrade() -> None:
    op.drop_column("asset_types", "color")
    op.drop_column("asset_types", "icon")

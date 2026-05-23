"""asset_types: asset_class column + seed standard types

Revision ID: f4a2b1c3d5e7
Revises: e4b5a2c1f8d6
Create Date: 2026-05-22 23:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f4a2b1c3d5e7"
down_revision: str | None = "e4b5a2c1f8d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    asset_class = sa.Enum(
        "personal", "infrastructure", name="asset_class", create_type=False
    )
    op.add_column(
        "asset_types",
        sa.Column("asset_class", asset_class, nullable=False, server_default="personal"),
    )
    # Seed the standard PRD §13.1 prefixes only when the table is empty —
    # idempotent and safe to re-run if the migration replays.
    op.execute("""
        INSERT INTO asset_types (name, code_prefix, asset_class)
        SELECT v.name, v.code_prefix, v.asset_class::asset_class
        FROM (VALUES
            ('电脑',     'PC',  'personal'),
            ('显示器',   'MON', 'personal'),
            ('网络设备', 'NET', 'infrastructure'),
            ('手机',     'PHN', 'personal'),
            ('平板电脑', 'PAD', 'personal'),
            ('打印机',   'PRT', 'infrastructure')
        ) AS v(name, code_prefix, asset_class)
        WHERE (SELECT COUNT(*) FROM asset_types) = 0
    """)


def downgrade() -> None:
    op.drop_column("asset_types", "asset_class")

"""lottery prize stock-out + default 奖品 category

Revision ID: c9e6f3b2a1d4
Revises: b8d5f2a1c9e3
Create Date: 2026-06-19 12:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9e6f3b2a1d4"
down_revision: str | None = "b8d5f2a1c9e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "lottery_draws",
        sa.Column("stock_out_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Default 奖品 (prize) category — idempotent, so re-runs / seed overlap are safe.
    op.execute(
        """
        INSERT INTO item_categories (name, code, management_mode)
        SELECT '奖品', 'JP', 'inventory'::management_mode
        WHERE NOT EXISTS (SELECT 1 FROM item_categories WHERE code = 'JP')
        """
    )


def downgrade() -> None:
    op.drop_column("lottery_draws", "stock_out_at")
    # Drop the seeded category only if nothing references it (a referenced
    # category means prize SKUs exist — leave it rather than break the FK).
    op.execute(
        """
        DELETE FROM item_categories
        WHERE code = 'JP'
          AND NOT EXISTS (SELECT 1 FROM skus WHERE skus.category_id = item_categories.id)
        """
    )

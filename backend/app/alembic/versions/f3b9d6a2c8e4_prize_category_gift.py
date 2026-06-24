"""rename 奖品 category code JP → GIFT (keep linked SKUs); ensure it exists

Revision ID: f3b9d6a2c8e4
Revises: e2a8c5b1f7d3
Create Date: 2026-06-24 10:00:00.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = "f3b9d6a2c8e4"
down_revision: str | None = "e2a8c5b1f7d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Rename the existing prize category's code (SKUs reference it by id, so they
    # stay linked). Only if a GIFT one doesn't already exist.
    op.execute(
        """
        UPDATE item_categories SET code = 'GIFT'
        WHERE code = 'JP'
          AND NOT EXISTS (SELECT 1 FROM item_categories WHERE code = 'GIFT')
        """
    )
    # Create it if neither code exists (e.g. it was deleted before this deploy).
    op.execute(
        """
        INSERT INTO item_categories (name, code, management_mode)
        SELECT '奖品', 'GIFT', 'inventory'::management_mode
        WHERE NOT EXISTS (SELECT 1 FROM item_categories WHERE code = 'GIFT')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE item_categories SET code = 'JP'
        WHERE code = 'GIFT'
          AND NOT EXISTS (SELECT 1 FROM item_categories WHERE code = 'JP')
        """
    )

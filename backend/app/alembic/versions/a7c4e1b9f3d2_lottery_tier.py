"""lottery draw tier

Revision ID: a7c4e1b9f3d2
Revises: f3a1c7e9d2b5
Create Date: 2026-06-18 10:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7c4e1b9f3d2"
down_revision: str | None = "f3a1c7e9d2b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("lottery_draws", sa.Column("tier", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("lottery_draws", "tier")

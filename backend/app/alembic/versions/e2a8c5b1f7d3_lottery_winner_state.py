"""per-winner delivered_at / notified_at

Revision ID: e2a8c5b1f7d3
Revises: d1f7a9c4e2b6
Create Date: 2026-06-23 10:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e2a8c5b1f7d3"
down_revision: str | None = "d1f7a9c4e2b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "lottery_winners",
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "lottery_winners",
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lottery_winners", "notified_at")
    op.drop_column("lottery_winners", "delivered_at")

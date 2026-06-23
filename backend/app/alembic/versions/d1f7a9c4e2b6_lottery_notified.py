"""lottery draw notified_at

Revision ID: d1f7a9c4e2b6
Revises: c9e6f3b2a1d4
Create Date: 2026-06-20 10:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d1f7a9c4e2b6"
down_revision: str | None = "c9e6f3b2a1d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "lottery_draws",
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lottery_draws", "notified_at")

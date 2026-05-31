"""offboarding_cases.notified_at — IT-confirmed notification gate

Revision ID: c9e4d6f2a1b3
Revises: b8d3c5e1f0a2
Create Date: 2026-05-31 14:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9e4d6f2a1b3"
down_revision: str | None = "b8d3c5e1f0a2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "offboarding_cases",
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("offboarding_cases", "notified_at")

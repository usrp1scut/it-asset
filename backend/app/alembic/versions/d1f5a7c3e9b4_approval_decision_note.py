"""approval_requests.decision_note — 审批意见

Revision ID: d1f5a7c3e9b4
Revises: c9e4d6f2a1b3
Create Date: 2026-05-31 16:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d1f5a7c3e9b4"
down_revision: str | None = "c9e4d6f2a1b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("approval_requests", sa.Column("decision_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("approval_requests", "decision_note")

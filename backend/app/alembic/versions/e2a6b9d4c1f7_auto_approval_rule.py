"""auto_approval_rules singleton + approval_requests.auto_approved

Revision ID: e2a6b9d4c1f7
Revises: d1f5a7c3e9b4
Create Date: 2026-05-31 18:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e2a6b9d4c1f7"
down_revision: str | None = "d1f5a7c3e9b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "approval_requests",
        sa.Column("auto_approved", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "auto_approval_rules",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("consumable_only", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("respect_sku_flag", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("max_total_qty", sa.BigInteger(), nullable=True),
        sa.Column("max_total_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("updated_by", sa.BigInteger(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("auto_approval_rules")
    op.drop_column("approval_requests", "auto_approved")

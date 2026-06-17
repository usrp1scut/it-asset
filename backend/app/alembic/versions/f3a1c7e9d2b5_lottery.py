"""lottery draws + winners

Revision ID: f3a1c7e9d2b5
Revises: e2a6b9d4c1f7
Create Date: 2026-06-11 10:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f3a1c7e9d2b5"
down_revision: str | None = "e2a6b9d4c1f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lottery_draws",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("prize_sku_id", sa.BigInteger(), nullable=True),
        sa.Column("winner_count", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["prize_sku_id"], ["skus.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "lottery_winners",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("draw_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["draw_id"], ["lottery_draws.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lottery_winners_draw_id"), "lottery_winners", ["draw_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_lottery_winners_draw_id"), table_name="lottery_winners")
    op.drop_table("lottery_winners")
    op.drop_table("lottery_draws")

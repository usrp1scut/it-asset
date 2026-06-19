"""add 'hr' to user_role enum

Revision ID: b8d5f2a1c9e3
Revises: a7c4e1b9f3d2
Create Date: 2026-06-19 10:00:00.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = "b8d5f2a1c9e3"
down_revision: str | None = "a7c4e1b9f3d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older PG;
    # autocommit_block runs it outside Alembic's per-migration transaction.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr'")


def downgrade() -> None:
    # Postgres can't drop a single enum value; leaving 'hr' in place is harmless
    # (no rows reference it after a downgrade of dependent features).
    pass

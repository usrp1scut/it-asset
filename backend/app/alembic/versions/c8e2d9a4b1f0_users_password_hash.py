"""users password_hash

Revision ID: c8e2d9a4b1f0
Revises: b7f3a1c2d4e5
Create Date: 2026-05-20 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'c8e2d9a4b1f0'
down_revision: str | None = 'b7f3a1c2d4e5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'users', sa.Column('password_hash', sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'password_hash')

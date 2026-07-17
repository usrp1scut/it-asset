"""seat alias — 座位编号的人读别名(显示时替代编号)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-17

"""
import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("seats", sa.Column("alias", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("seats", "alias")

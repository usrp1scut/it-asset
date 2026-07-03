"""role_permissions matrix

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-07-03 12:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c2d3e4f5a6b7"
down_revision: str | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_user_role = postgresql.ENUM(
    "employee", "manager", "it_admin", "procurement", "finance", "hr", "sys_admin",
    name="user_role", create_type=False,
)


def upgrade() -> None:
    op.create_table(
        "role_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("role", _user_role, nullable=False),
        sa.Column("module", sa.String(length=32), nullable=False),
        sa.Column("can_view", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("can_manage", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("role", "module", name="uq_role_module"),
    )
    op.create_index("ix_role_permissions_module", "role_permissions", ["module"])


def downgrade() -> None:
    op.drop_index("ix_role_permissions_module", table_name="role_permissions")
    op.drop_table("role_permissions")

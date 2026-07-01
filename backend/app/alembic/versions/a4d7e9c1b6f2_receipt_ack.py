"""asset_assignments + employee_item_issues: Lark receipt ack fields

Revision ID: a4d7e9c1b6f2
Revises: f3b9d6a2c8e4
Create Date: 2026-06-26 10:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a4d7e9c1b6f2"
down_revision: str | None = "f3b9d6a2c8e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("asset_assignments", "employee_item_issues"):
        op.add_column(table, sa.Column("receipt_msg_id", sa.String(length=128), nullable=True))
        op.add_column(
            table, sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    for table in ("asset_assignments", "employee_item_issues"):
        op.drop_column(table, "acknowledged_at")
        op.drop_column(table, "receipt_msg_id")

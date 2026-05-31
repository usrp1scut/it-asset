"""offboarding cases + items

Revision ID: b8d3c5e1f0a2
Revises: a7c91d4e2b8f
Create Date: 2026-05-31 12:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8d3c5e1f0a2"
down_revision: str | None = "a7c91d4e2b8f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "offboarding_cases",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("case_no", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("user_name", sa.String(length=255), nullable=True),
        sa.Column("department_name", sa.String(length=255), nullable=True),
        sa.Column("last_day", sa.Date(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("hr_channel", sa.String(length=64), nullable=False, server_default="manual"),
        sa.Column(
            "status",
            sa.Enum("in_progress", "overdue", "completed", name="offboarding_status"),
            nullable=False,
        ),
        sa.Column("assigned_it_id", sa.BigInteger(), nullable=True),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["assigned_it_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("case_no"),
    )
    op.create_index(op.f("ix_offboarding_cases_case_no"), "offboarding_cases", ["case_no"], unique=True)
    op.create_index(op.f("ix_offboarding_cases_user_id"), "offboarding_cases", ["user_id"], unique=False)
    op.create_index(op.f("ix_offboarding_cases_status"), "offboarding_cases", ["status"], unique=False)

    op.create_table(
        "offboarding_items",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("case_id", sa.BigInteger(), nullable=False),
        sa.Column("asset_id", sa.BigInteger(), nullable=False),
        sa.Column("asset_code", sa.String(length=32), nullable=False),
        sa.Column("brand_model", sa.String(length=255), nullable=True),
        sa.Column("snapshot_value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column(
            "status",
            sa.Enum("return_pending", "returned", "lost", name="offboarding_item_status"),
            nullable=False,
        ),
        sa.Column(
            "condition",
            sa.Enum("good", "damaged", name="offboarding_item_condition"),
            nullable=True,
        ),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("handler_id", sa.BigInteger(), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["case_id"], ["offboarding_cases.id"]),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_offboarding_items_case_id"), "offboarding_items", ["case_id"], unique=False)
    op.create_index(op.f("ix_offboarding_items_asset_id"), "offboarding_items", ["asset_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_offboarding_items_asset_id"), table_name="offboarding_items")
    op.drop_index(op.f("ix_offboarding_items_case_id"), table_name="offboarding_items")
    op.drop_table("offboarding_items")
    op.drop_index(op.f("ix_offboarding_cases_status"), table_name="offboarding_cases")
    op.drop_index(op.f("ix_offboarding_cases_user_id"), table_name="offboarding_cases")
    op.drop_index(op.f("ix_offboarding_cases_case_no"), table_name="offboarding_cases")
    op.drop_table("offboarding_cases")
    sa.Enum(name="offboarding_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="offboarding_item_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="offboarding_item_condition").drop(op.get_bind(), checkfirst=True)

"""seat map: floor_maps + seats + assets.seat_id

Revision ID: b1c2d3e4f5a6
Revises: a4d7e9c1b6f2
Create Date: 2026-07-02 12:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "a4d7e9c1b6f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "floor_maps",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("rows", sa.Integer(), nullable=False, server_default="6"),
        sa.Column("cols", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("created_by", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "seats",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("map_id", sa.BigInteger(), sa.ForeignKey("floor_maps.id"), nullable=False),
        sa.Column("row", sa.Integer(), nullable=False),
        sa.Column("col", sa.Integer(), nullable=False),
        sa.Column("seat_no", sa.String(length=16), nullable=True),
        sa.Column("zone", sa.String(length=16), nullable=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.UniqueConstraint("map_id", "row", "col", name="uq_seat_map_cell"),
    )
    op.create_index("ix_seats_map_id", "seats", ["map_id"])
    op.add_column(
        "assets",
        sa.Column(
            "seat_id",
            sa.BigInteger(),
            sa.ForeignKey("seats.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("assets", "seat_id")
    op.drop_index("ix_seats_map_id", table_name="seats")
    op.drop_table("seats")
    op.drop_table("floor_maps")

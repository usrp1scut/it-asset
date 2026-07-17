"""map labels — 座位图空白格位置备注(窗/柜子/机房/前台)

Revision ID: d4e5f6a7b8c9
Revises: c2d3e4f5a6b7
Create Date: 2026-07-16

"""
import sqlalchemy as sa
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "map_labels",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("map_id", sa.BigInteger(), nullable=False),
        sa.Column("row", sa.Integer(), nullable=False),
        sa.Column("col", sa.Integer(), nullable=False),
        sa.Column("text", sa.String(length=32), nullable=False),
        sa.ForeignKeyConstraint(["map_id"], ["floor_maps.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("map_id", "row", "col", name="uq_label_map_cell"),
    )
    op.create_index(op.f("ix_map_labels_map_id"), "map_labels", ["map_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_map_labels_map_id"), table_name="map_labels")
    op.drop_table("map_labels")

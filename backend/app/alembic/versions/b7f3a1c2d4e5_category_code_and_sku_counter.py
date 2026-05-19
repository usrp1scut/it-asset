"""item category code + sku_code counter

Revision ID: b7f3a1c2d4e5
Revises: a51b2fe67785
Create Date: 2026-05-19 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b7f3a1c2d4e5'
down_revision: str | None = 'a51b2fe67785'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'item_categories', sa.Column('code', sa.String(length=16), nullable=False)
    )
    op.create_index(
        op.f('ix_item_categories_code'), 'item_categories', ['code'], unique=True
    )
    op.create_table(
        'sku_code_counters',
        sa.Column('prefix', sa.String(length=16), nullable=False),
        sa.Column('next_val', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('prefix'),
    )


def downgrade() -> None:
    op.drop_table('sku_code_counters')
    op.drop_index(op.f('ix_item_categories_code'), table_name='item_categories')
    op.drop_column('item_categories', 'code')

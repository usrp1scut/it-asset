"""repair_orders (Phase 2)

Revision ID: e4b5a2c1f8d6
Revises: d3e9f2a8c4b7
Create Date: 2026-05-21 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'e4b5a2c1f8d6'
down_revision: str | None = 'd3e9f2a8c4b7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'repair_orders',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('asset_id', sa.BigInteger(), nullable=False),
        sa.Column('opened_by', sa.BigInteger(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column(
            'repair_type', sa.Enum('in_house', 'external', name='repair_type'),
            nullable=False,
        ),
        sa.Column('vendor', sa.String(length=255), nullable=True),
        sa.Column('shipped_at', sa.Date(), nullable=True),
        sa.Column('expected_return_at', sa.Date(), nullable=True),
        sa.Column(
            'status',
            sa.Enum('open', 'in_progress', 'completed', 'cancelled',
                    name='repair_order_status'),
            nullable=False,
        ),
        sa.Column('cost', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('warranty_covered', sa.Boolean(), nullable=False),
        sa.Column('warranty_until', sa.Date(), nullable=True),
        sa.Column('resolution', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('closed_by', sa.BigInteger(), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.ForeignKeyConstraint(['opened_by'], ['users.id']),
        sa.ForeignKeyConstraint(['closed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_repair_orders_asset_id'), 'repair_orders', ['asset_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_repair_orders_asset_id'), table_name='repair_orders')
    op.drop_table('repair_orders')
    sa.Enum(name='repair_order_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='repair_type').drop(op.get_bind(), checkfirst=True)

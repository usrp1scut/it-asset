"""scrap_requests workflow (Phase 2)

Revision ID: d3e9f2a8c4b7
Revises: c8e2d9a4b1f0
Create Date: 2026-05-21 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'd3e9f2a8c4b7'
down_revision: str | None = 'c8e2d9a4b1f0'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'scrap_requests',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('asset_id', sa.BigInteger(), nullable=False),
        sa.Column('proposer_id', sa.BigInteger(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'approved', 'rejected', 'disposed',
                    name='scrap_request_status'),
            nullable=False,
        ),
        sa.Column('approver_id', sa.BigInteger(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approve_remark', sa.Text(), nullable=True),
        sa.Column(
            'disposition_method',
            sa.Enum('recycle', 'resale', 'writeoff', 'exchange', 'other',
                    name='disposition_method'),
            nullable=True,
        ),
        sa.Column('residual_value', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('disposed_by', sa.BigInteger(), nullable=True),
        sa.Column('disposed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('disposal_remark', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['approver_id'], ['users.id']),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id']),
        sa.ForeignKeyConstraint(['disposed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['proposer_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_scrap_requests_asset_id'), 'scrap_requests', ['asset_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_scrap_requests_asset_id'), table_name='scrap_requests')
    op.drop_table('scrap_requests')
    sa.Enum(name='scrap_request_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='disposition_method').drop(op.get_bind(), checkfirst=True)

"""initial — empty baseline (Sprint 0)

Schema is introduced from Sprint 2 (assets) onward. This empty baseline exists
so `alembic upgrade head` runs green on a fresh database.

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-18
"""
from collections.abc import Sequence

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

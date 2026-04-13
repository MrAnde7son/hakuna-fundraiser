"""Add website and press_releases to jobtype enum

Revision ID: 005
Revises: 004
Create Date: 2026-04-12
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE jobtype ADD VALUE IF NOT EXISTS 'website'")
    op.execute("ALTER TYPE jobtype ADD VALUE IF NOT EXISTS 'press_releases'")


def downgrade() -> None:
    pass

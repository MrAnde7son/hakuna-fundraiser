"""Add focus_areas table

Revision ID: 002
Revises: 001
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "focus_areas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), unique=True, nullable=False),
        sa.Column("description", sa.String(1000)),
        sa.Column("keywords", JSONB, nullable=False, server_default="[]"),
        sa.Column("position", sa.Integer, default=0),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # Seed the three original directions
    op.execute("""
        INSERT INTO focus_areas (name, description, keywords, position)
        VALUES
            ('VM Scanning + Prioritization Agent',
             'Next-gen vulnerability scanning with advanced prioritization',
             '["scanning", "prioritization", "vulnerability scanner", "risk scoring"]',
             0),
            ('Autonomous Remediation',
             'Automated and agentic vulnerability remediation',
             '["remediation", "patch", "auto-fix", "patch management"]',
             1),
            ('Composable EM Platform',
             'Low-code exposure management platform for enterprises',
             '["exposure management", "attack surface", "asm", "easm", "caasm", "posture management"]',
             2)
    """)


def downgrade() -> None:
    op.drop_table("focus_areas")

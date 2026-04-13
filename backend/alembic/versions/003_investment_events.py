"""Add investment_events table and website_status/press_release_status to investors

Revision ID: 003
Revises: 002
Create Date: 2026-04-12
"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "investor_id",
            sa.Integer,
            sa.ForeignKey("investors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255)),
        sa.Column("event_date", sa.Date),
        sa.Column("round_stage", sa.String(100)),
        sa.Column("round_size_usd", sa.Integer),
        sa.Column(
            "source",
            sa.Enum("press_release", "website", "crunchbase", "news", "manual", name="eventsource"),
            default="manual",
        ),
        sa.Column("source_url", sa.String(1000)),
        sa.Column("headline", sa.String(500)),
        sa.Column("snippet", sa.Text),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index("ix_investment_events_investor_id", "investment_events", ["investor_id"])
    op.create_index("ix_investment_events_event_date", "investment_events", ["event_date"])
    op.create_index("ix_investment_events_domain", "investment_events", ["domain"])

    op.add_column("investors", sa.Column("website_status", sa.String(20), server_default="pending"))
    op.add_column("investors", sa.Column("press_release_status", sa.String(20), server_default="pending"))


def downgrade() -> None:
    op.drop_column("investors", "press_release_status")
    op.drop_column("investors", "website_status")
    op.drop_index("ix_investment_events_domain")
    op.drop_index("ix_investment_events_event_date")
    op.drop_index("ix_investment_events_investor_id")
    op.drop_table("investment_events")
    sa.Enum(name="eventsource").drop(op.get_bind())

"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investors",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("type", sa.Enum("vc", "angel", name="investortype"), default="vc"),
        sa.Column("website", sa.String(500)),
        sa.Column("crunchbase_id", sa.String(255)),
        sa.Column("fund_size_usd", sa.BigInteger),
        sa.Column("stage_focus", sa.String(255)),
        sa.Column("geo_focus", sa.String(255)),
        sa.Column("contact", sa.String(500)),
        sa.Column("notes", sa.String(2000)),
        sa.Column("raw_crunchbase", JSONB),
        sa.Column("raw_news", JSONB),
        sa.Column("ai_enrichment", JSONB),
        sa.Column(
            "enrichment_status",
            sa.Enum("pending", "running", "done", "failed", name="enrichmentstatus"),
            default="pending",
        ),
        sa.Column("crunchbase_status", sa.String(20), default="pending"),
        sa.Column("linkedin_status", sa.String(20), default="pending"),
        sa.Column("news_status", sa.String(20), default="pending"),
        sa.Column("sec_status", sa.String(20), default="pending"),
        sa.Column("ai_status", sa.String(20), default="pending"),
        sa.Column("last_enriched_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "partners",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "investor_id",
            sa.Integer,
            sa.ForeignKey("investors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500)),
        sa.Column("linkedin_url", sa.String(500)),
        sa.Column("linkedin_raw", JSONB),
        sa.Column("network_degree", sa.Integer),
    )

    op.create_table(
        "portfolio_companies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "investor_id",
            sa.Integer,
            sa.ForeignKey("investors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(255)),
        sa.Column("stage", sa.String(100)),
        sa.Column("description", sa.String(2000)),
        sa.Column(
            "conflict_type",
            sa.Enum(
                "blocking", "adjacent", "watching", "validating", "clear",
                name="conflicttype",
            ),
        ),
    )

    op.create_table(
        "outreach_notes",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "investor_id",
            sa.Integer,
            sa.ForeignKey("investors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "target", "contacted", "meeting", "passed", "closed",
                name="outreachstatus",
            ),
            default="target",
        ),
        sa.Column("contact_date", sa.DateTime(timezone=True)),
        sa.Column("notes", sa.Text),
        sa.Column("next_action", sa.Text),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "enrichment_jobs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "investor_id",
            sa.Integer,
            sa.ForeignKey("investors.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_type",
            sa.Enum(
                "crunchbase", "linkedin", "sec_edgar", "news", "ai_enrichment", "full",
                name="jobtype",
            ),
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "running", "done", "failed", name="jobstatus"),
            default="pending",
        ),
        sa.Column("error_msg", sa.Text),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("enrichment_jobs")
    op.drop_table("outreach_notes")
    op.drop_table("portfolio_companies")
    op.drop_table("partners")
    op.drop_table("investors")
    op.execute("DROP TYPE IF EXISTS investortype")
    op.execute("DROP TYPE IF EXISTS enrichmentstatus")
    op.execute("DROP TYPE IF EXISTS conflicttype")
    op.execute("DROP TYPE IF EXISTS outreachstatus")
    op.execute("DROP TYPE IF EXISTS jobtype")
    op.execute("DROP TYPE IF EXISTS jobstatus")

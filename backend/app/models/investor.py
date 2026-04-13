from __future__ import annotations

import enum
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, BigInteger, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.partner import Partner
    from app.models.portfolio_company import PortfolioCompany
    from app.models.outreach_note import OutreachNote
    from app.models.enrichment_job import EnrichmentJob
    from app.models.investment_event import InvestmentEvent


class InvestorType(str, enum.Enum):
    vc = "vc"
    angel = "angel"


class EnrichmentStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class Investor(Base):
    __tablename__ = "investors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    type: Mapped[InvestorType] = mapped_column(Enum(InvestorType), default=InvestorType.vc)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    crunchbase_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fund_size_usd: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    stage_focus: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    geo_focus: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    raw_crunchbase: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    raw_news: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    raw_sec: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ai_enrichment: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    enrichment_status: Mapped[EnrichmentStatus] = mapped_column(
        Enum(EnrichmentStatus), default=EnrichmentStatus.pending
    )
    crunchbase_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", nullable=True)
    linkedin_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", nullable=True)
    news_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", nullable=True)
    sec_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", nullable=True)
    ai_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", nullable=True)
    website_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", nullable=True)
    press_release_status: Mapped[Optional[str]] = mapped_column(String(20), default="pending", nullable=True)

    last_enriched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    partners: Mapped[List["Partner"]] = relationship(back_populates="investor", cascade="all, delete-orphan")
    portfolio_companies: Mapped[List["PortfolioCompany"]] = relationship(
        back_populates="investor", cascade="all, delete-orphan"
    )
    outreach_notes: Mapped[List["OutreachNote"]] = relationship(
        back_populates="investor", cascade="all, delete-orphan"
    )
    enrichment_jobs: Mapped[List["EnrichmentJob"]] = relationship(
        back_populates="investor", cascade="all, delete-orphan"
    )
    investment_events: Mapped[List["InvestmentEvent"]] = relationship(
        back_populates="investor", cascade="all, delete-orphan"
    )

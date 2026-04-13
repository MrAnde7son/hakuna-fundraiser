from __future__ import annotations

import enum
from typing import Optional, TYPE_CHECKING
from datetime import datetime, date
from sqlalchemy import String, Text, ForeignKey, Enum, DateTime, Date, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.investor import Investor


class EventSource(str, enum.Enum):
    press_release = "press_release"
    website = "website"
    crunchbase = "crunchbase"
    news = "news"
    manual = "manual"


class InvestmentEvent(Base):
    __tablename__ = "investment_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id", ondelete="CASCADE"))
    company_name: Mapped[str] = mapped_column(String(255))
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    event_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    round_stage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    round_size_usd: Mapped[Optional[int]] = mapped_column(nullable=True)
    source: Mapped[EventSource] = mapped_column(Enum(EventSource), default=EventSource.manual)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    headline: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    investor: Mapped["Investor"] = relationship(back_populates="investment_events")

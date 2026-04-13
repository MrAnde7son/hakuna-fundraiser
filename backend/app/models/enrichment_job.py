from __future__ import annotations

import enum
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import Text, ForeignKey, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.investor import Investor


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"


class JobType(str, enum.Enum):
    crunchbase = "crunchbase"
    linkedin = "linkedin"
    sec_edgar = "sec_edgar"
    news = "news"
    ai_enrichment = "ai_enrichment"
    website = "website"
    press_releases = "press_releases"
    full = "full"


class EnrichmentJob(Base):
    __tablename__ = "enrichment_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id", ondelete="CASCADE"))
    job_type: Mapped[JobType] = mapped_column(Enum(JobType))
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.pending)
    error_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    investor: Mapped["Investor"] = relationship(back_populates="enrichment_jobs")

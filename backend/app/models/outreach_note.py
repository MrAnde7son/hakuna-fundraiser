from __future__ import annotations

import enum
from typing import Optional, TYPE_CHECKING
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.investor import Investor


class OutreachStatus(str, enum.Enum):
    target = "target"
    contacted = "contacted"
    meeting = "meeting"
    passed = "passed"
    closed = "closed"


class OutreachNote(Base):
    __tablename__ = "outreach_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id", ondelete="CASCADE"))
    status: Mapped[OutreachStatus] = mapped_column(
        Enum(OutreachStatus), default=OutreachStatus.target
    )
    contact_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    investor: Mapped["Investor"] = relationship(back_populates="outreach_notes")

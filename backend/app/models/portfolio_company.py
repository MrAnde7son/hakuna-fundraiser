from __future__ import annotations

import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.investor import Investor


class ConflictType(str, enum.Enum):
    blocking = "blocking"
    adjacent = "adjacent"
    watching = "watching"
    validating = "validating"
    clear = "clear"


class PortfolioCompany(Base):
    __tablename__ = "portfolio_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    investor_id: Mapped[int] = mapped_column(ForeignKey("investors.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    conflict_type: Mapped[Optional[ConflictType]] = mapped_column(Enum(ConflictType), nullable=True)

    investor: Mapped["Investor"] = relationship(back_populates="portfolio_companies")

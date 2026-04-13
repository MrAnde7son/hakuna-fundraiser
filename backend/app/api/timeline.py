"""Investment timeline endpoints.

Provides timeline data for investment events, pivotable by investor or domain.
"""
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.investment_event import InvestmentEvent
from app.models.investor import Investor
from app.api.schemas import TimelineEntry, TimelineResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/timeline", tags=["timeline"])


SORT_COLUMNS = {
    "date": InvestmentEvent.event_date,
    "company": InvestmentEvent.company_name,
    "investor": Investor.name,
    "domain": InvestmentEvent.domain,
    "stage": InvestmentEvent.round_stage,
    "amount": InvestmentEvent.round_size_usd,
    "source": InvestmentEvent.source,
}


@router.get("", response_model=TimelineResponse)
async def get_timeline(
    investor_id: Optional[int] = Query(None),
    domain: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    sort_by: str = Query("date_desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Get investment timeline events with filters, sorting, and pagination.

    `sort_by` accepts `<column>_<asc|desc>` where column is one of
    date, company, investor, domain, stage, amount, source.
    """
    base = (
        select(InvestmentEvent, Investor.name.label("investor_name"))
        .join(Investor, InvestmentEvent.investor_id == Investor.id)
    )

    if investor_id:
        base = base.where(InvestmentEvent.investor_id == investor_id)
    if domain:
        base = base.where(InvestmentEvent.domain == domain)
    if source:
        base = base.where(InvestmentEvent.source == source)
    if year_from:
        base = base.where(
            func.extract("year", InvestmentEvent.event_date) >= year_from
        )
    if year_to:
        base = base.where(
            func.extract("year", InvestmentEvent.event_date) <= year_to
        )

    # Parse sort_by
    key, _, direction = sort_by.rpartition("_")
    if key not in SORT_COLUMNS or direction not in ("asc", "desc"):
        key, direction = "date", "desc"
    col = SORT_COLUMNS[key]
    if direction == "asc":
        order = col.asc().nullslast()
    else:
        order = col.desc().nullsfirst()
    # Tiebreaker for stable pagination
    query = base.order_by(order, InvestmentEvent.id.desc())

    total_result = await db.execute(
        select(func.count()).select_from(base.subquery())
    )
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    items = [
        TimelineEntry(
            id=ev.id,
            investor_id=ev.investor_id,
            investor_name=inv_name,
            company_name=ev.company_name,
            domain=ev.domain,
            event_date=ev.event_date,
            round_stage=ev.round_stage,
            round_size_usd=ev.round_size_usd,
            source=ev.source.value if hasattr(ev.source, "value") else ev.source,
            source_url=ev.source_url,
            headline=ev.headline,
        )
        for ev, inv_name in rows
    ]
    return TimelineResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/domains", response_model=List[dict])
async def get_domains(db: AsyncSession = Depends(get_db)):
    """Get all unique domains with event counts."""
    result = await db.execute(
        select(
            InvestmentEvent.domain,
            func.count(InvestmentEvent.id).label("count"),
            func.min(InvestmentEvent.event_date).label("earliest"),
            func.max(InvestmentEvent.event_date).label("latest"),
        )
        .where(InvestmentEvent.domain.isnot(None))
        .group_by(InvestmentEvent.domain)
        .order_by(func.count(InvestmentEvent.id).desc())
    )
    return [
        {
            "domain": row.domain,
            "count": row.count,
            "earliest": row.earliest.isoformat() if row.earliest else None,
            "latest": row.latest.isoformat() if row.latest else None,
        }
        for row in result.all()
    ]


@router.get("/stats", response_model=dict)
async def get_timeline_stats(db: AsyncSession = Depends(get_db)):
    """Get aggregate stats for the timeline dashboard."""
    total = await db.execute(select(func.count(InvestmentEvent.id)))
    total_count = total.scalar() or 0

    by_domain = await db.execute(
        select(
            InvestmentEvent.domain,
            func.count(InvestmentEvent.id),
        )
        .where(InvestmentEvent.domain.isnot(None))
        .group_by(InvestmentEvent.domain)
    )

    by_year = await db.execute(
        select(
            func.extract("year", InvestmentEvent.event_date).label("year"),
            func.count(InvestmentEvent.id),
        )
        .where(InvestmentEvent.event_date.isnot(None))
        .group_by("year")
        .order_by("year")
    )

    investors_with_events = await db.execute(
        select(func.count(func.distinct(InvestmentEvent.investor_id)))
    )

    return {
        "total_events": total_count,
        "investors_with_events": investors_with_events.scalar() or 0,
        "by_domain": {row[0]: row[1] for row in by_domain.all()},
        "by_year": {str(int(row[0])): row[1] for row in by_year.all() if row[0]},
    }

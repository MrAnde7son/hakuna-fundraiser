"""Investor CRUD and enrichment endpoints."""
import csv
import io
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import select, func, cast, literal_column
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.investor import Investor, EnrichmentStatus, InvestorType
from app.models.partner import Partner
from app.models.portfolio_company import PortfolioCompany, ConflictType
from app.models.outreach_note import OutreachNote
from app.models.enrichment_job import EnrichmentJob
from app.models.investment_event import InvestmentEvent
from app.models.focus_area import FocusArea
from app.api.schemas import (
    InvestorCreate, InvestorOut, InvestorListItem, InvestorListResponse,
    PartnerOut, PortfolioCompanyOut,
    OutreachNoteCreate, OutreachNoteOut,
    EnrichmentJobOut, DomainConflictRow,
    InvestmentEventOut,
)
from app.tasks.worker import enrich_investor_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/investors", tags=["investors"])


@router.get("", response_model=InvestorListResponse)
async def list_investors(
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    enrichment_status: Optional[str] = Query(None),
    conflict_severity: Optional[str] = Query(None),
    space_gap: Optional[str] = Query(None),
    sort_by: str = Query("name"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List investors with DB-side filtering, sorting, and pagination."""
    blocking_subq = (
        select(
            PortfolioCompany.investor_id.label("investor_id"),
            func.count(PortfolioCompany.id).label("blocking_count"),
        )
        .where(PortfolioCompany.conflict_type == ConflictType.blocking)
        .group_by(PortfolioCompany.investor_id)
        .subquery()
    )
    blocking_count_col = func.coalesce(blocking_subq.c.blocking_count, 0).label("blocking_count")

    # Count of true entries in ai_enrichment.space_coverage; safe when JSON is null/missing.
    coverage_count_col = func.coalesce(
        func.jsonb_array_length(
            func.jsonb_path_query_array(
                func.coalesce(Investor.ai_enrichment, cast("{}", JSONB)),
                literal_column("'$.space_coverage.* ? (@ == true)'::jsonpath"),
            )
        ),
        0,
    ).label("coverage_count")

    base = (
        select(Investor, blocking_count_col, coverage_count_col)
        .outerjoin(blocking_subq, blocking_subq.c.investor_id == Investor.id)
    )

    if type:
        base = base.where(Investor.type == type)
    if search and search.strip():
        term = f"%{search.strip()}%"
        base = base.where(
            func.coalesce(Investor.name, "").ilike(term)
            | func.coalesce(Investor.website, "").ilike(term)
            | func.coalesce(Investor.stage_focus, "").ilike(term)
        )
    if enrichment_status:
        base = base.where(Investor.enrichment_status == enrichment_status)
    if conflict_severity:
        base = base.where(
            func.jsonb_array_length(
                func.coalesce(
                    Investor.ai_enrichment["vm_em_portfolio_map"][conflict_severity],
                    cast("[]", JSONB),
                )
            ) > 0
        )
    if space_gap:
        # Show funds WITHOUT a bet in this space
        base = base.where(
            func.coalesce(
                Investor.ai_enrichment["space_coverage"][space_gap].astext,
                "false",
            ) != "true"
        )

    sort_columns = {
        "name": func.lower(Investor.name),
        "type": Investor.type,
        "stage": Investor.stage_focus,
        "blocking": blocking_count_col,
        "coverage": coverage_count_col,
        "last_enriched": Investor.last_enriched_at,
        "status": Investor.enrichment_status,
    }
    primary = sort_columns.get(sort_by, func.lower(Investor.name))
    primary = primary.desc().nullslast() if sort_dir == "desc" else primary.asc().nullslast()
    if sort_by == "name":
        base = base.order_by(primary)
    else:
        base = base.order_by(primary, func.lower(Investor.name))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0

    offset = (page - 1) * page_size
    rows = (await db.execute(base.limit(page_size).offset(offset))).all()

    items = [
        InvestorListItem(
            id=inv.id,
            name=inv.name,
            type=inv.type.value if isinstance(inv.type, InvestorType) else inv.type,
            website=inv.website,
            stage_focus=inv.stage_focus,
            enrichment_status=inv.enrichment_status.value if isinstance(inv.enrichment_status, EnrichmentStatus) else inv.enrichment_status,
            last_enriched_at=inv.last_enriched_at,
            ai_enrichment=inv.ai_enrichment,
            blocking_count=blocking_count,
        )
        for inv, blocking_count, _coverage_count in rows
    ]

    return InvestorListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=InvestorOut, status_code=201)
async def create_investor(
    data: InvestorCreate,
    auto_enrich: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    """Create a new investor and optionally trigger enrichment."""
    existing = await db.execute(select(Investor).where(Investor.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(400, detail="Investor '{}' already exists".format(data.name))

    investor = Investor(
        name=data.name,
        type=InvestorType(data.type) if data.type in ("vc", "angel") else InvestorType.vc,
        website=data.website,
        contact=data.contact,
        stage_focus=data.stage_focus,
        geo_focus=data.geo_focus,
        notes=data.notes,
    )
    db.add(investor)
    await db.commit()
    await db.refresh(investor)

    if auto_enrich:
        enrich_investor_task.delay(investor.id)

    return investor


@router.get("/{investor_id}", response_model=InvestorOut)
async def get_investor(investor_id: int, db: AsyncSession = Depends(get_db)):
    """Get full investor details."""
    result = await db.execute(select(Investor).where(Investor.id == investor_id))
    investor = result.scalar_one_or_none()
    if not investor:
        raise HTTPException(404, "Investor not found")
    return investor


@router.delete("/{investor_id}", status_code=204)
async def delete_investor(investor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Investor).where(Investor.id == investor_id))
    investor = result.scalar_one_or_none()
    if not investor:
        raise HTTPException(404, "Investor not found")
    await db.delete(investor)
    await db.commit()


@router.post("/{investor_id}/enrich", status_code=202)
async def trigger_enrichment(investor_id: int, db: AsyncSession = Depends(get_db)):
    """Manually trigger re-enrichment for an investor."""
    result = await db.execute(select(Investor).where(Investor.id == investor_id))
    investor = result.scalar_one_or_none()
    if not investor:
        raise HTTPException(404, "Investor not found")

    investor.enrichment_status = EnrichmentStatus.pending
    await db.commit()

    enrich_investor_task.delay(investor_id)
    return {"message": "Enrichment queued for {}".format(investor.name)}


@router.get("/{investor_id}/partners", response_model=List[PartnerOut])
async def get_partners(investor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Partner).where(Partner.investor_id == investor_id)
    )
    return result.scalars().all()


@router.get("/{investor_id}/portfolio", response_model=List[PortfolioCompanyOut])
async def get_portfolio(investor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PortfolioCompany).where(PortfolioCompany.investor_id == investor_id)
    )
    return result.scalars().all()


@router.get("/{investor_id}/outreach", response_model=List[OutreachNoteOut])
async def get_outreach_notes(investor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OutreachNote)
        .where(OutreachNote.investor_id == investor_id)
        .order_by(OutreachNote.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{investor_id}/outreach", response_model=OutreachNoteOut, status_code=201)
async def create_outreach_note(
    investor_id: int,
    data: OutreachNoteCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Investor).where(Investor.id == investor_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Investor not found")

    note = OutreachNote(
        investor_id=investor_id,
        status=data.status,
        notes=data.notes,
        next_action=data.next_action,
        contact_date=data.contact_date,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.get("/{investor_id}/events", response_model=List[InvestmentEventOut])
async def get_investment_events(investor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InvestmentEvent)
        .where(InvestmentEvent.investor_id == investor_id)
        .order_by(InvestmentEvent.event_date.desc().nullsfirst())
    )
    return result.scalars().all()


@router.get("/{investor_id}/jobs", response_model=List[EnrichmentJobOut])
async def get_enrichment_jobs(investor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EnrichmentJob)
        .where(EnrichmentJob.investor_id == investor_id)
        .order_by(EnrichmentJob.created_at.desc())
    )
    return result.scalars().all()


@router.post("/import/csv", status_code=201)
async def import_csv(
    file: UploadFile = File(...),
    auto_enrich: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    """Import investors from a CSV file."""
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = []
    updated = []
    skipped = []

    for row in reader:
        name = row.get("name", "").strip()
        if not name:
            continue

        result = await db.execute(select(Investor).where(Investor.name == name))
        existing = result.scalar_one_or_none()
        if existing:
            # Update existing investor with new CSV fields
            changed = False
            website = row.get("website", "").strip() or None
            contact = row.get("contact", "").strip() or None
            stage = row.get("stage", "").strip() or None
            notes = row.get("notes", "").strip() or None
            if website and not existing.website:
                existing.website = website
                changed = True
            if contact and not existing.contact:
                existing.contact = contact
                changed = True
            if stage and not existing.stage_focus:
                existing.stage_focus = stage
                changed = True
            if notes and not existing.notes:
                existing.notes = notes
                changed = True
            if changed:
                updated.append({"id": existing.id, "name": name})
            else:
                skipped.append(name)
            continue

        inv_type = row.get("type", "vc").strip()
        investor = Investor(
            name=name,
            type=InvestorType(inv_type) if inv_type in ("vc", "angel") else InvestorType.vc,
            website=row.get("website", "").strip() or None,
            contact=row.get("contact", "").strip() or None,
            stage_focus=row.get("stage", "").strip() or None,
            notes=row.get("notes", "").strip() or None,
        )
        db.add(investor)
        await db.flush()
        created.append({"id": investor.id, "name": name})

    await db.commit()

    if auto_enrich:
        try:
            for inv in created:
                enrich_investor_task.delay(inv["id"])
        except Exception:
            logger.warning("Could not queue enrichment tasks – is Redis/Celery running?")

    return {
        "created": len(created),
        "updated": len(updated),
        "skipped": len(skipped),
        "investors": created,
        "updated_investors": updated,
    }


@router.post("/enrich-all", status_code=202)
async def enrich_all(db: AsyncSession = Depends(get_db)):
    """Trigger enrichment for all investors."""
    result = await db.execute(select(Investor.id))
    ids = [row[0] for row in result.all()]

    for inv_id in ids:
        enrich_investor_task.delay(inv_id)

    return {"message": "Enrichment queued for {} investors".format(len(ids))}


@router.get("/strategy/matrix", response_model=List[DomainConflictRow])
async def domain_conflicts(db: AsyncSession = Depends(get_db)):
    """Generate domain conflict matrix: investors x target domains."""
    domain_result = await db.execute(select(FocusArea).order_by(FocusArea.position, FocusArea.id))
    domains = domain_result.scalars().all()

    inv_result = await db.execute(
        select(Investor)
        .where(Investor.ai_enrichment.isnot(None))
        .options(selectinload(Investor.portfolio_companies))
    )
    investors = inv_result.scalars().all()

    severity_order = {"blocking": 3, "adjacent": 2, "watching": 1, "clear": 0}

    def _score(vm_map, portfolio_companies, keywords):
        """Score an investor against a domain's keywords.

        Checks vm_em_portfolio_map at each conflict level first,
        then falls back to raw portfolio company text matching.
        """
        kws = [k.lower() for k in (keywords or [])]
        if not kws:
            return "clear"

        # 1. Check vm_em_portfolio_map at each severity level
        for level in ("blocking", "adjacent", "watching"):
            entries = vm_map.get(level, [])
            if any(kw in entry.lower() for entry in entries for kw in kws):
                return level

        # 2. Fallback: match against portfolio company text
        hits = 0
        for pc in portfolio_companies:
            text = f"{pc.name} {pc.category or ''} {pc.description or ''}".lower()
            if any(kw in text for kw in kws):
                hits += 1
        if hits >= 2:
            return "adjacent"
        if hits == 1:
            return "watching"
        return "clear"

    rows = []
    for inv in investors:
        ai = inv.ai_enrichment or {}
        vm_map = ai.get("vm_em_portfolio_map", {})

        scores = {}
        for domain in domains:
            scores[str(domain.id)] = _score(vm_map, inv.portfolio_companies, domain.keywords)

        all_scores = list(scores.values()) or ["clear"]
        worst = max(all_scores, key=lambda x: severity_order.get(x, 0))

        rows.append(DomainConflictRow(
            investor_id=inv.id,
            investor_name=inv.name,
            scores=scores,
            worst_conflict=worst,
        ))

    return rows

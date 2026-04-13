from __future__ import annotations

"""Seed data endpoint for initial investor import."""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.investor import Investor, InvestorType
from app.tasks.worker import enrich_investor_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/seed", tags=["seed"])

SEED_INVESTORS = [
    {"name": "Cyberstarts", "website": "https://cyberstarts.com"},
    {"name": "YL Ventures", "website": "https://ylventures.com"},
    {"name": "Ballistic Ventures", "website": "https://www.ballisticventures.com"},
    {"name": "SYN Ventures", "website": "https://www.synventures.com"},
    {"name": "Team8", "website": "https://team8.vc"},
    {"name": "Ten Eleven Ventures", "website": "https://www.teneventures.com"},
    {"name": "Glilot Capital", "website": "https://www.glilotcapital.com"},
    {"name": "Hetz Ventures", "website": "https://hetz.vc"},
    {"name": "Vesey Ventures", "website": "https://veseyventures.com"},
    {"name": "Menlo Ventures", "website": "https://www.menlovc.com"},
    {"name": "NFX", "website": "https://www.nfx.com"},
    {"name": "Blumberg Capital", "website": "https://blumbergcapital.com"},
    {"name": "TLV Partners", "website": "https://www.tlv.partners"},
    {"name": "New Era Ventures", "website": "https://www.neweracap.com"},
    {"name": "Leaders Fund", "website": "https://leadersfund.com"},
    {"name": "Sequoia", "website": "https://www.sequoiacap.com"},
    {"name": "Accel", "website": "https://www.accel.com"},
    {"name": "Lightspeed", "website": "https://lsvp.com"},
    {"name": "Index Ventures", "website": "https://www.indexventures.com"},
    {"name": "Bessemer", "website": "https://www.bvp.com"},
    {"name": "Felicis", "website": "https://www.felicis.com"},
    {"name": "Greylock", "website": "https://greylock.com"},
    {"name": "Insight Partners", "website": "https://www.insightpartners.com"},
    {"name": "Intel Capital", "website": "https://www.intelcapital.com"},
    {"name": "Notable Ventures", "website": "https://notablecap.com"},
    {"name": "Striker Capital", "website": "https://strikercapital.com"},
    {"name": "DTC Capital", "website": "https://www.dtcapital.com"},
    {"name": "Lama Partners", "website": "https://lamapartners.com"},
    {"name": "Vine Ventures", "website": "https://www.vinevc.com"},
    {"name": "Jibe Ventures", "website": "https://www.jibeventures.com"},
    {"name": "83North", "website": "https://www.83north.com"},
    {"name": "Craft Ventures", "website": "https://www.craftventures.com"},
    {"name": "Viola Ventures", "website": "https://www.viola-group.com"},
    {"name": "F2", "website": "https://f2vc.com"},
    {"name": "Holly Ventures", "website": "https://holly.vc"},
    {"name": "White Rabbit", "website": "https://www.whiterabbit.vc"},
    {"name": "Picture Capital", "website": "https://picture.capital"},
    {"name": "Battery Ventures", "website": "https://www.battery.com"},
    {"name": "Amiti VC", "website": "https://amiti.vc"},
    {"name": "Evolution Equity Partners", "website": "https://www.evolutionequity.com"},
    {"name": "CRV", "website": "https://www.crv.com"},
    {"name": "Ibex", "website": "https://ibexinvestors.com"},
    {"name": "Cyber Club London", "website": "https://cyberclub.london"},
    {"name": "Grove Ventures", "website": "https://www.grove.vc"},
    {"name": "Tenable Ventures", "website": "https://www.tenable.com/partners/venture"},
    {"name": "Stage One", "website": "https://www.stageonevc.com"},
    {"name": "Hanaco", "website": "https://hanacovc.com"},
    {"name": "Bullet VC", "website": "https://bullet.vc"},
    {"name": "Meron Capital", "website": "https://meroncapital.com"},
    {"name": "mtf.vc", "website": "https://mtf.vc"},
]


async def seed_investors_on_startup() -> None:
    """Auto-seed the database with initial investors on application startup."""
    async with async_session() as db:
        existing = await db.execute(select(Investor).limit(1))
        if existing.scalar_one_or_none():
            logger.info("Database already has investors, skipping auto-seed")
            return

        logger.info("Seeding database with %d investors", len(SEED_INVESTORS))
        created_ids = []
        for entry in SEED_INVESTORS:
            investor = Investor(
                name=entry["name"],
                type=InvestorType.vc,
                website=entry.get("website"),
            )
            db.add(investor)
            await db.flush()
            created_ids.append(investor.id)

        await db.commit()

        try:
            for inv_id in created_ids:
                enrich_investor_task.delay(inv_id)
        except Exception:
            logger.warning("Could not queue enrichment tasks – is Redis/Celery running?")

        logger.info("Auto-seeded %d investors", len(created_ids))


@router.post("", status_code=201)
async def seed_investors(
    auto_enrich: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Seed the database with the initial investor list."""
    created = []
    updated = []
    skipped = []

    for entry in SEED_INVESTORS:
        name = entry["name"]
        result = await db.execute(select(Investor).where(Investor.name == name))
        existing = result.scalar_one_or_none()
        if existing:
            # Update existing investor with any new fields from seed data
            changed = False
            if entry.get("website") and not existing.website:
                existing.website = entry["website"]
                changed = True
            if changed:
                updated.append({"id": existing.id, "name": name})
            else:
                skipped.append(name)
            continue

        investor = Investor(
            name=name,
            type=InvestorType.vc,
            website=entry.get("website"),
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

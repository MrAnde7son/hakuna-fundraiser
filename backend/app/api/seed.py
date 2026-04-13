"""Seed data endpoint for initial investor import."""
from __future__ import annotations

import csv
import logging
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models.investor import Investor, InvestorType
from app.tasks.worker import enrich_investor_task

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/seed", tags=["seed"])

SEED_CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "seed_investors.csv"


@lru_cache(maxsize=1)
def load_seed_investors() -> list[dict]:
    """Load seed investors from the CSV bundled with the app."""
    with SEED_CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    entries: list[dict] = []
    for row in rows:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        type_raw = (row.get("type") or "vc").strip().lower()
        try:
            inv_type = InvestorType(type_raw)
        except ValueError:
            inv_type = InvestorType.vc
        entries.append({
            "name": name,
            "type": inv_type,
            "website": (row.get("website") or "").strip() or None,
            "contact": (row.get("contact") or "").strip() or None,
            "stage_focus": (row.get("stage") or "").strip() or None,
            "notes": (row.get("notes") or "").strip() or None,
        })
    return entries


async def seed_investors_on_startup() -> None:
    """Auto-seed the database with initial investors on application startup."""
    seed_entries = load_seed_investors()
    async with async_session() as db:
        existing = await db.execute(select(Investor).limit(1))
        if existing.scalar_one_or_none():
            logger.info("Database already has investors, skipping auto-seed")
            return

        logger.info("Seeding database with %d investors", len(seed_entries))
        created_ids = []
        for entry in seed_entries:
            investor = Investor(
                name=entry["name"],
                type=entry["type"],
                website=entry["website"],
                contact=entry["contact"],
                stage_focus=entry["stage_focus"],
                notes=entry["notes"],
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

    for entry in load_seed_investors():
        name = entry["name"]
        result = await db.execute(select(Investor).where(Investor.name == name))
        existing = result.scalar_one_or_none()
        if existing:
            changed = False
            if entry["website"] and not existing.website:
                existing.website = entry["website"]
                changed = True
            if entry["contact"] and not existing.contact:
                existing.contact = entry["contact"]
                changed = True
            if entry["stage_focus"] and not existing.stage_focus:
                existing.stage_focus = entry["stage_focus"]
                changed = True
            if entry["notes"] and not existing.notes:
                existing.notes = entry["notes"]
                changed = True
            if changed:
                updated.append({"id": existing.id, "name": name})
            else:
                skipped.append(name)
            continue

        investor = Investor(
            name=name,
            type=entry["type"],
            website=entry["website"],
            contact=entry["contact"],
            stage_focus=entry["stage_focus"],
            notes=entry["notes"],
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

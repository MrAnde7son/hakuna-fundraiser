"""Full enrichment pipeline orchestrator.

Runs all enrichment sources for an investor and persists results.

Design:
  Phase 1 (parallel IO): Crunchbase, SEC EDGAR, website scrape, press releases,
                         news — all independent, run with asyncio.gather.
  Phase 2 (serial, depends on phase 1 partner data): LinkedIn enrichment.
  Phase 3 (depends on everything): AI enrichment + conflict mapping.

Every source is optional: when an API key is missing, its coroutine returns a
"skipped" marker and the pipeline continues. Only AI enrichment requires a key.
"""
from __future__ import annotations
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.investor import Investor, EnrichmentStatus
from app.models.partner import Partner
from app.models.portfolio_company import PortfolioCompany, ConflictType
from app.models.enrichment_job import EnrichmentJob, JobType, JobStatus
from app.models.investment_event import InvestmentEvent, EventSource
from app.enrichment import crunchbase, sec_edgar, news, ai_enrichment
from app.enrichment.website import scrape_investor_website
from app.enrichment.press_releases import scrape_press_releases
from app.services.slack import notify_failure

logger = logging.getLogger(__name__)


SKIPPED = {"__skipped__": True}


async def _create_job(session: AsyncSession, investor_id: int, job_type: JobType) -> EnrichmentJob:
    job = EnrichmentJob(investor_id=investor_id, job_type=job_type, status=JobStatus.running)
    session.add(job)
    await session.flush()
    return job


async def _complete_job(session: AsyncSession, job: EnrichmentJob, error: str | None = None):
    job.completed_at = datetime.now(timezone.utc)
    job.status = JobStatus.failed if error else JobStatus.done
    if error:
        job.error_msg = error
    await session.flush()


# ---------------------------------------------------------------------------
# Phase 1 fetchers — return (status, data) tuples, never raise
# ---------------------------------------------------------------------------

async def _fetch_crunchbase(name: str) -> tuple[str, dict]:
    if not get_settings().crunchbase_api_key:
        return "skipped", {}
    try:
        return "done", await crunchbase.enrich_investor(name)
    except Exception as e:
        logger.warning("Crunchbase fetch failed for %s: %s", name, e)
        return "failed", {"error": str(e)}


async def _fetch_sec(name: str) -> tuple[str, dict]:
    try:
        return "done", await sec_edgar.enrich_investor(name)
    except Exception as e:
        logger.warning("SEC fetch failed for %s: %s", name, e)
        return "failed", {"error": str(e)}


async def _fetch_website(website: str | None) -> tuple[str, dict]:
    if not website:
        return "skipped", {}
    try:
        return "done", await scrape_investor_website(website)
    except Exception as e:
        logger.warning("Website fetch failed for %s: %s", website, e)
        return "failed", {"error": str(e)}


async def _fetch_press(website: str | None, name: str) -> tuple[str, list[dict]]:
    if not website:
        return "skipped", []
    try:
        return "done", await scrape_press_releases(website, name)
    except Exception as e:
        logger.warning("Press releases fetch failed for %s: %s", name, e)
        return "failed", []


async def _fetch_news(name: str, partner_names: list[str] | None = None) -> tuple[str, dict]:
    try:
        return "done", await news.enrich_investor(name, partner_names)
    except Exception as e:
        logger.warning("News fetch failed for %s: %s", name, e)
        return "failed", {"error": str(e)}


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

async def run_pipeline(session: AsyncSession, investor_id: int) -> None:
    """Run the full enrichment pipeline for an investor."""
    result = await session.execute(select(Investor).where(Investor.id == investor_id))
    investor = result.scalar_one_or_none()
    if not investor:
        logger.error("Investor %d not found", investor_id)
        return

    investor.enrichment_status = EnrichmentStatus.running
    await session.flush()

    master_job = await _create_job(session, investor_id, JobType.full)
    sources_succeeded: list[str] = []

    # ------------------------------------------------------------------
    # Phase 1 — parallel independent fetches
    # ------------------------------------------------------------------
    jobs = {
        JobType.crunchbase: await _create_job(session, investor_id, JobType.crunchbase),
        JobType.sec_edgar: await _create_job(session, investor_id, JobType.sec_edgar),
        JobType.website: await _create_job(session, investor_id, JobType.website),
        JobType.press_releases: await _create_job(session, investor_id, JobType.press_releases),
        JobType.news: await _create_job(session, investor_id, JobType.news),
    }
    await session.commit()  # release locks before slow IO phase

    (
        (cb_status, crunchbase_data),
        (sec_status, sec_data),
        (web_status, website_data),
        (pr_status, pr_events),
        (news_status, news_data),
    ) = await asyncio.gather(
        _fetch_crunchbase(investor.name),
        _fetch_sec(investor.name),
        _fetch_website(investor.website),
        _fetch_press(investor.website, investor.name),
        _fetch_news(investor.name, None),
    )

    # Reload investor (session was committed)
    investor = (await session.execute(
        select(Investor).where(Investor.id == investor_id)
    )).scalar_one()

    # --- Persist Crunchbase ---
    investor.crunchbase_status = cb_status
    if cb_status == "done":
        investor.raw_crunchbase = crunchbase_data
        org = (crunchbase_data or {}).get("org") or {}
        if org and not investor.stage_focus:
            stage = org.get("investor_type")
            if isinstance(stage, list):
                stage = ", ".join(stage) if stage else None
            investor.stage_focus = stage

        for pc in crunchbase_data.get("portfolio", []):
            existing = await session.execute(
                select(PortfolioCompany).where(
                    PortfolioCompany.investor_id == investor_id,
                    PortfolioCompany.name == pc.get("name", ""),
                )
            )
            if not existing.scalar_one_or_none():
                session.add(PortfolioCompany(
                    investor_id=investor_id,
                    name=pc.get("name", "Unknown"),
                    category=pc.get("category", ""),
                    stage=pc.get("stage", ""),
                    description=pc.get("description", ""),
                ))

        for p in crunchbase_data.get("people", []):
            existing = await session.execute(
                select(Partner).where(
                    Partner.investor_id == investor_id,
                    Partner.name == p.get("name", ""),
                )
            )
            if not existing.scalar_one_or_none():
                session.add(Partner(
                    investor_id=investor_id,
                    name=p.get("name", ""),
                    title=p.get("title", ""),
                    linkedin_url=p.get("linkedin", ""),
                ))
        sources_succeeded.append("crunchbase")
    await _complete_job(
        session, jobs[JobType.crunchbase],
        crunchbase_data.get("error") if cb_status == "failed" else None,
    )

    # --- Persist SEC ---
    investor.sec_status = sec_status
    if sec_status == "done":
        investor.raw_sec = sec_data
        if sec_data.get("fund_size_usd") and not investor.fund_size_usd:
            investor.fund_size_usd = sec_data["fund_size_usd"]
        # Prefer Form ADV AUM if larger (firm-level, not fund-level)
        if sec_data.get("adv_aum_usd") and not investor.fund_size_usd:
            investor.fund_size_usd = sec_data["adv_aum_usd"]
        # Add related persons from Form D as partner stubs (free GP data)
        for person in sec_data.get("related_persons", []):
            name = person.get("name", "")
            if not name:
                continue
            existing = await session.execute(
                select(Partner).where(
                    Partner.investor_id == investor_id,
                    Partner.name == name,
                )
            )
            if not existing.scalar_one_or_none():
                title = ", ".join(person.get("relationships", [])) or "Related Person (Form D)"
                session.add(Partner(
                    investor_id=investor_id,
                    name=name,
                    title=title[:200],
                    linkedin_url="",
                ))
        sources_succeeded.append("sec_edgar")
    await _complete_job(
        session, jobs[JobType.sec_edgar],
        sec_data.get("error") if sec_status == "failed" else None,
    )

    # --- Persist Website ---
    investor.website_status = web_status
    if web_status == "done":
        for wc in website_data.get("portfolio", []):
            existing = await session.execute(
                select(PortfolioCompany).where(
                    PortfolioCompany.investor_id == investor_id,
                    PortfolioCompany.name == wc.get("name", ""),
                )
            )
            if not existing.scalar_one_or_none():
                session.add(PortfolioCompany(
                    investor_id=investor_id,
                    name=wc.get("name", "Unknown"),
                    category=wc.get("category", ""),
                    description=wc.get("description", ""),
                ))

        for wp in website_data.get("team", []):
            existing = await session.execute(
                select(Partner).where(
                    Partner.investor_id == investor_id,
                    Partner.name == wp.get("name", ""),
                )
            )
            if not existing.scalar_one_or_none():
                session.add(Partner(
                    investor_id=investor_id,
                    name=wp.get("name", ""),
                    title=wp.get("title", ""),
                    linkedin_url=wp.get("linkedin", ""),
                ))
        sources_succeeded.append("website")
    await _complete_job(
        session, jobs[JobType.website],
        website_data.get("error") if web_status == "failed" else None,
    )

    # --- Persist Press Releases ---
    investor.press_release_status = pr_status
    if pr_status == "done":
        for ev in pr_events:
            if ev.get("source_url"):
                existing = await session.execute(
                    select(InvestmentEvent).where(
                        InvestmentEvent.investor_id == investor_id,
                        InvestmentEvent.source_url == ev["source_url"],
                    )
                )
                if existing.scalar_one_or_none():
                    continue
            session.add(InvestmentEvent(
                investor_id=investor_id,
                company_name=ev["company_name"],
                domain=ev.get("domain"),
                event_date=ev.get("event_date"),
                round_stage=ev.get("round_stage"),
                round_size_usd=ev.get("round_size_usd"),
                source=EventSource.press_release,
                source_url=ev.get("source_url"),
                headline=ev.get("headline"),
                snippet=ev.get("snippet"),
            ))
        sources_succeeded.append("press_releases")
    await _complete_job(session, jobs[JobType.press_releases])

    # --- Persist News ---
    investor.news_status = news_status
    if news_status == "done":
        investor.raw_news = news_data
        sources_succeeded.append("news")
    await _complete_job(
        session, jobs[JobType.news],
        news_data.get("error") if news_status == "failed" else None,
    )

    await session.flush()

    # ------------------------------------------------------------------
    # Phase 2 — LinkedIn (depends on partner rows from phase 1)
    # ------------------------------------------------------------------
    # Proxycurl was sunset (HTTP 410 on every call). The replacement (NinjaPear)
    # has a different schema and no URL-based profile fetch, so migration is
    # deferred — skip this phase entirely until a replacement is wired up.
    linkedin_job = await _create_job(session, investor_id, JobType.linkedin)
    investor.linkedin_status = "skipped"
    await _complete_job(session, linkedin_job, "proxycurl_sunset")

    # ------------------------------------------------------------------
    # Phase 3 — AI enrichment (needs portfolio + news + partners)
    # ------------------------------------------------------------------
    ai_job = await _create_job(session, investor_id, JobType.ai_enrichment)
    try:
        portfolio_result = await session.execute(
            select(PortfolioCompany).where(PortfolioCompany.investor_id == investor_id)
        )
        portfolio_companies = [
            {"name": pc.name, "category": pc.category, "description": pc.description}
            for pc in portfolio_result.scalars().all()
        ]

        partners_result = await session.execute(
            select(Partner).where(Partner.investor_id == investor_id)
        )
        partners_for_ai = [
            {"name": p.name, "title": p.title}
            for p in partners_result.scalars().all()
        ]

        signals = news_data.get("signals", []) if isinstance(news_data, dict) else []

        ai_result = await ai_enrichment.run_ai_enrichment(
            investor_name=investor.name,
            portfolio_companies=portfolio_companies,
            news_signals=signals,
            partners=partners_for_ai,
            fund_size=str(investor.fund_size_usd) if investor.fund_size_usd else None,
            stage_focus=investor.stage_focus,
            geo_focus=investor.geo_focus,
        )

        investor.ai_enrichment = ai_result
        investor.ai_status = "done"
        sources_succeeded.append("ai")

        vm_map = ai_result.get("vm_em_portfolio_map", {}) or {}
        for conflict_level, entries in vm_map.items():
            if conflict_level not in ("blocking", "adjacent", "watching", "validating", "clear"):
                continue
            for entry in entries:
                parts = entry.split(" — ", 1) if " — " in entry else entry.split(" - ", 1)
                company_name = parts[0].strip()
                reason = parts[1].strip() if len(parts) > 1 else ""
                if not company_name:
                    continue
                pc_result = await session.execute(
                    select(PortfolioCompany).where(
                        PortfolioCompany.investor_id == investor_id,
                        PortfolioCompany.name.ilike(f"%{company_name}%"),
                    )
                )
                pc = pc_result.scalar_one_or_none()
                if pc:
                    pc.conflict_type = ConflictType(conflict_level)
                else:
                    session.add(PortfolioCompany(
                        investor_id=investor_id,
                        name=company_name,
                        category="ai_inferred",
                        description=reason[:2000],
                        conflict_type=ConflictType(conflict_level),
                    ))

        await session.flush()
        await _complete_job(session, ai_job)
    except Exception as e:
        investor.ai_status = "failed"
        await _complete_job(session, ai_job, str(e))
        logger.warning("AI enrichment failed for %s: %s", investor.name, e)

    # ------------------------------------------------------------------
    # Finalize
    # ------------------------------------------------------------------
    investor.last_enriched_at = datetime.now(timezone.utc)
    if sources_succeeded:
        investor.enrichment_status = EnrichmentStatus.done
        await _complete_job(session, master_job)
    else:
        investor.enrichment_status = EnrichmentStatus.failed
        await _complete_job(session, master_job, "All enrichment sources failed")
        await notify_failure(investor.name, "All enrichment sources failed")

    await session.commit()
    logger.info(
        "Enrichment complete for %s — sources succeeded: %s",
        investor.name,
        sources_succeeded,
    )

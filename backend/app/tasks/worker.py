from __future__ import annotations

"""Celery worker configuration and task definitions."""
import asyncio
import logging
import os
from datetime import timedelta

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

app = Celery("hakuna", broker=redis_url, backend=redis_url)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_rate_limit="3/m",
    beat_schedule={
        "weekly-re-enrichment": {
            "task": "app.tasks.worker.re_enrich_all",
            "schedule": crontab(hour=2, minute=0, day_of_week=1),  # Monday 2am UTC
        },
    },
)


def _get_sync_db_url() -> str:
    return os.environ.get(
        "CELERY_DATABASE_URL",
        "postgresql://hakuna:hakuna@localhost:5432/hakuna",
    )


def _run_async(coro):
    """Run an async function in a new event loop for Celery tasks."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def enrich_investor_task(self, investor_id: int):
    """Run the full enrichment pipeline for a single investor."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.enrichment.pipeline import run_pipeline

    async_db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://hakuna:hakuna@localhost:5432/hakuna",
    )

    async def _run():
        engine = create_async_engine(async_db_url)
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        async with async_session() as session:
            await run_pipeline(session, investor_id)
        await engine.dispose()

    try:
        _run_async(_run())
        logger.info("Enrichment task completed for investor %d", investor_id)
    except Exception as exc:
        logger.error("Enrichment task failed for investor %d: %s", investor_id, exc)
        raise self.retry(exc=exc)


@app.task
def re_enrich_all():
    """Re-enrich all investors. Triggered weekly by beat schedule."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.models.investor import Investor

    async_db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://hakuna:hakuna@localhost:5432/hakuna",
    )

    async def _get_investor_ids():
        engine = create_async_engine(async_db_url)
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        async with async_session() as session:
            result = await session.execute(select(Investor.id))
            ids = [row[0] for row in result.all()]
        await engine.dispose()
        return ids

    investor_ids = _run_async(_get_investor_ids())
    logger.info("Scheduling re-enrichment for %d investors", len(investor_ids))

    for inv_id in investor_ids:
        enrich_investor_task.delay(inv_id)

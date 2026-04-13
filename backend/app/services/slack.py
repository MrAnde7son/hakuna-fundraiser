"""Slack notification service for enrichment failures."""
import logging
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)


async def notify_failure(investor_name: str, error: str):
    """Post enrichment failure to Slack webhook if configured."""
    settings = get_settings()
    if not settings.slack_webhook_url:
        return

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                settings.slack_webhook_url,
                json={
                    "text": f":warning: Enrichment failed for *{investor_name}*\n```{error}```",
                },
            )
    except Exception as e:
        logger.warning("Failed to send Slack notification: %s", e)

from __future__ import annotations

"""Crunchbase Basic API enrichment.

Fetches fund size, founding year, investment count, portfolio companies,
recent investments, and partner names.
"""
import logging
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = logging.getLogger(__name__)
BASE_URL = "https://api.crunchbase.com/api/v4"


class CrunchbaseError(Exception):
    pass


def _headers() -> dict:
    return {"X-cb-user-key": get_settings().crunchbase_api_key}


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
async def _get(client: httpx.AsyncClient, path: str, params: dict | None = None) -> dict:
    resp = await client.get(f"{BASE_URL}{path}", headers=_headers(), params=params or {})
    resp.raise_for_status()
    return resp.json()


async def search_organization(name: str) -> dict | None:
    """Search Crunchbase for an organization by name."""
    settings = get_settings()
    if not settings.crunchbase_api_key:
        logger.warning("No Crunchbase API key configured — skipping")
        return None

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            data = await _get(client, "/searches/organizations", {
                "query": name,
                "field_ids": "identifier,short_description,num_investments_funding_rounds,"
                             "founded_on,investor_type,location_identifiers,"
                             "num_portfolio_organizations,rank_org",
            })
            entities = data.get("entities", [])
            if not entities:
                return None
            return entities[0].get("properties", {})
        except Exception as e:
            logger.error("Crunchbase search failed for %s: %s", name, e)
            raise CrunchbaseError(str(e)) from e


async def fetch_portfolio(org_permalink: str) -> list[dict]:
    """Fetch portfolio companies for an investor."""
    settings = get_settings()
    if not settings.crunchbase_api_key:
        return []

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            data = await _get(
                client,
                f"/entities/organizations/{org_permalink}/cards/investments",
            )
            investments = data.get("cards", {}).get("investments", [])
            results = []
            for inv in investments:
                org = inv.get("org_identifier", {})
                results.append({
                    "name": org.get("value", inv.get("identifier", {}).get("value", "Unknown")),
                    "permalink": org.get("permalink", ""),
                    "category": inv.get("org_category_groups_list", ""),
                    "stage": inv.get("funding_round_money_raised_currency_code", ""),
                    "announced_on": inv.get("announced_on", ""),
                    "description": inv.get("org_short_description", ""),
                })
            return results
        except Exception as e:
            logger.error("Crunchbase portfolio fetch failed for %s: %s", org_permalink, e)
            raise CrunchbaseError(str(e)) from e


async def fetch_people(org_permalink: str) -> list[dict]:
    """Fetch key people (partners) for an investor."""
    settings = get_settings()
    if not settings.crunchbase_api_key:
        return []

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            data = await _get(
                client,
                f"/entities/organizations/{org_permalink}/cards/current_team",
            )
            people = data.get("cards", {}).get("current_team", [])
            return [
                {
                    "name": p.get("identifier", {}).get("value", ""),
                    "title": p.get("title", ""),
                    "linkedin": p.get("linkedin", ""),
                    "permalink": p.get("identifier", {}).get("permalink", ""),
                }
                for p in people
            ]
        except Exception as e:
            logger.error("Crunchbase people fetch failed for %s: %s", org_permalink, e)
            raise CrunchbaseError(str(e)) from e


async def enrich_investor(name: str) -> dict:
    """Run full Crunchbase enrichment for an investor.

    Returns a dict with org info, portfolio companies, and partners,
    or partial data if some calls fail.
    """
    result = {"source": "crunchbase", "org": None, "portfolio": [], "people": []}

    org = await search_organization(name)
    if not org:
        return result

    result["org"] = org
    permalink = org.get("identifier", {}).get("permalink", name.lower().replace(" ", "-"))

    # Fetch portfolio and people, allowing partial failure
    try:
        result["portfolio"] = await fetch_portfolio(permalink)
    except CrunchbaseError:
        logger.warning("Portfolio fetch failed for %s, continuing", name)

    try:
        result["people"] = await fetch_people(permalink)
    except CrunchbaseError:
        logger.warning("People fetch failed for %s, continuing", name)

    return result

from __future__ import annotations

"""LinkedIn enrichment via Proxycurl API.

Fetches partner profiles: current title, past investments,
shared connections with Itamar.
"""
import logging
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = logging.getLogger(__name__)
PROXYCURL_BASE = "https://nubela.co/proxycurl/api/v2"


class LinkedInError(Exception):
    pass


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
async def fetch_profile(linkedin_url: str) -> dict | None:
    """Fetch a LinkedIn profile via Proxycurl."""
    settings = get_settings()
    if not settings.proxycurl_api_key:
        logger.warning("No Proxycurl API key — skipping LinkedIn enrichment")
        return None

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                f"{PROXYCURL_BASE}/linkedin",
                headers={"Authorization": f"Bearer {settings.proxycurl_api_key}"},
                params={
                    "url": linkedin_url,
                    "skills": "include",
                    "inferred_salary": "skip",
                    "personal_email": "skip",
                    "personal_contact_number": "skip",
                },
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error("Proxycurl fetch failed for %s: %s", linkedin_url, e)
            raise LinkedInError(str(e)) from e


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
async def search_person(name: str, company: str) -> dict | None:
    """Search for a person on LinkedIn by name and company."""
    settings = get_settings()
    if not settings.proxycurl_api_key:
        return None

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                f"{PROXYCURL_BASE}/search/person",
                headers={"Authorization": f"Bearer {settings.proxycurl_api_key}"},
                params={
                    "first_name": name.split()[0] if name else "",
                    "last_name": " ".join(name.split()[1:]) if name else "",
                    "current_company_name": company,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            return results[0] if results else None
        except Exception as e:
            logger.error("Proxycurl search failed for %s at %s: %s", name, company, e)
            raise LinkedInError(str(e)) from e


async def enrich_partners(partners: list[dict], firm_name: str) -> list[dict]:
    """Enrich a list of partners with LinkedIn data.

    Each partner dict should have 'name' and optionally 'linkedin_url'.
    Returns enriched partner dicts.
    """
    enriched = []
    for partner in partners:
        profile = None
        linkedin_url = partner.get("linkedin") or partner.get("linkedin_url")

        try:
            if linkedin_url:
                profile = await fetch_profile(linkedin_url)
            else:
                search_result = await search_person(partner["name"], firm_name)
                if search_result:
                    linkedin_url = search_result.get("linkedin_profile_url")
                    if linkedin_url:
                        profile = await fetch_profile(linkedin_url)
        except LinkedInError:
            logger.warning("LinkedIn enrichment failed for %s", partner["name"])

        enriched.append({
            **partner,
            "linkedin_url": linkedin_url,
            "linkedin_raw": profile,
            "network_degree": profile.get("connections") if profile else None,
        })

    return enriched

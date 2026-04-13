"""News and web signal enrichment.

Primary source: Google News RSS (free, no API key required).
Optional overlays: Exa AI, Tavily (if API keys are configured).

All three providers share a common result shape so downstream AI enrichment
doesn't care which one produced a signal.
"""
from __future__ import annotations
import asyncio
import logging

import feedparser
import httpx
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.config import get_settings

logger = logging.getLogger(__name__)


class NewsError(Exception):
    pass


SEARCH_QUERIES = [
    "{name} cybersecurity investment",
    "{name} vulnerability management",
    "{name} exposure management",
    "{name} security portfolio",
]


# ---------------------------------------------------------------------------
# Google News RSS (primary, free)
# ---------------------------------------------------------------------------

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
BING_NEWS_RSS = "https://www.bing.com/news/search"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=20),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout)),
    reraise=True,
)
async def _google_news_search(client: httpx.AsyncClient, query: str) -> list[dict]:
    """Search Google News RSS. Free, keyless, rate-friendly."""
    resp = await client.get(
        GOOGLE_NEWS_RSS,
        params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
        headers={"User-Agent": "HakunaIntelligence/1.0"},
        timeout=20,
    )
    resp.raise_for_status()
    parsed = feedparser.parse(resp.text)
    results = []
    for entry in parsed.entries[:10]:
        snippet = entry.get("summary", "") or entry.get("description", "")
        if "<" in snippet:
            snippet = BeautifulSoup(snippet, "html.parser").get_text(separator=" ", strip=True)
        results.append({
            "title": entry.get("title", ""),
            "url": entry.get("link", ""),
            "snippet": snippet[:500],
            "published_date": entry.get("published", ""),
            "score": 0,
            "provider": "google_news",
        })
    return results


@retry(
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout)),
    reraise=True,
)
async def _bing_news_search(client: httpx.AsyncClient, query: str) -> list[dict]:
    """Search Bing News RSS. Free, keyless, used as additional coverage."""
    resp = await client.get(
        BING_NEWS_RSS,
        params={"q": query, "format": "rss"},
        headers={"User-Agent": "HakunaIntelligence/1.0"},
        timeout=20,
    )
    resp.raise_for_status()
    parsed = feedparser.parse(resp.text)
    results = []
    for entry in parsed.entries[:10]:
        snippet = entry.get("summary", "") or entry.get("description", "")
        if "<" in snippet:
            snippet = BeautifulSoup(snippet, "html.parser").get_text(separator=" ", strip=True)
        results.append({
            "title": entry.get("title", ""),
            "url": entry.get("link", ""),
            "snippet": snippet[:500],
            "published_date": entry.get("published", ""),
            "score": 0,
            "provider": "bing_news",
        })
    return results


# ---------------------------------------------------------------------------
# Paid overlays (optional)
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
async def _exa_search(client: httpx.AsyncClient, query: str, api_key: str) -> list[dict]:
    resp = await client.post(
        "https://api.exa.ai/search",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json={
            "query": query,
            "numResults": 5,
            "useAutoprompt": True,
            "type": "neural",
            "contents": {"text": {"maxCharacters": 500}},
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("text", "")[:500],
            "published_date": r.get("publishedDate", ""),
            "score": r.get("score", 0),
            "provider": "exa",
        }
        for r in data.get("results", [])
    ]


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError)),
    reraise=True,
)
async def _tavily_search(client: httpx.AsyncClient, query: str, api_key: str) -> list[dict]:
    resp = await client.post(
        "https://api.tavily.com/search",
        json={
            "api_key": api_key,
            "query": query,
            "max_results": 5,
            "search_depth": "advanced",
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("content", "")[:500],
            "published_date": "",
            "score": r.get("score", 0),
            "provider": "tavily",
        }
        for r in data.get("results", [])
    ]


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

async def _run_one_query(
    client: httpx.AsyncClient, query: str, settings,
) -> list[dict]:
    """Run a single query against all enabled providers in parallel."""
    tasks = []
    tasks.append(_safe(_google_news_search(client, query)))
    tasks.append(_safe(_bing_news_search(client, query)))
    if settings.exa_api_key:
        tasks.append(_safe(_exa_search(client, query, settings.exa_api_key)))
    if settings.tavily_api_key:
        tasks.append(_safe(_tavily_search(client, query, settings.tavily_api_key)))

    results_per_provider = await asyncio.gather(*tasks)
    flat: list[dict] = []
    for r in results_per_provider:
        flat.extend(r)
    return flat


async def _safe(coro) -> list[dict]:
    """Swallow exceptions so one provider failure doesn't kill the batch."""
    try:
        return await coro
    except Exception as e:
        logger.warning("News provider failed: %s", e)
        return []


async def enrich_investor(name: str, partner_names: list[str] | None = None) -> dict:
    """Search for news and web signals about an investor.

    Always runs Google News + Bing News (free). Layers Exa/Tavily if configured.
    """
    settings = get_settings()
    queries = [q.format(name=name) for q in SEARCH_QUERIES]
    if partner_names:
        for pname in partner_names[:3]:
            queries.append(f"{pname} security portfolio")

    all_results: list[dict] = []
    async with httpx.AsyncClient(follow_redirects=True) as client:
        batches = await asyncio.gather(
            *(_run_one_query(client, q, settings) for q in queries)
        )
        for b in batches:
            all_results.extend(b)

    # Deduplicate by URL (prefer first occurrence, which means earlier query wins)
    seen_urls: set[str] = set()
    unique_results: list[dict] = []
    for r in all_results:
        url = r.get("url", "")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        unique_results.append(r)

    return {
        "source": "news",
        "signals": unique_results[:30],
        "queries_run": queries,
        "providers_used": sorted({r["provider"] for r in unique_results}),
    }

from __future__ import annotations

"""Investor website scraping enrichment.

Fetches the investor's website and extracts portfolio companies,
investment thesis, team members, and focus areas from HTML content.
"""
import logging
import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Common paths where VCs list portfolio companies
PORTFOLIO_PATHS = [
    "/portfolio", "/companies", "/investments", "/our-portfolio",
    "/portfolio-companies", "/our-companies",
]

# Common paths for team/partner pages
TEAM_PATHS = ["/team", "/people", "/about", "/partners", "/our-team"]

# Common paths for thesis/about pages
THESIS_PATHS = ["/", "/about", "/thesis", "/approach", "/what-we-do"]

# User agent to avoid blocks
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
}


class WebsiteError(Exception):
    pass


async def _fetch_page(client: httpx.AsyncClient, url: str) -> str | None:
    """Fetch a page and return HTML text, or None on failure."""
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=15)
        if resp.status_code == 200 and "text/html" in resp.headers.get("content-type", ""):
            return resp.text
    except Exception as e:
        logger.debug("Failed to fetch %s: %s", url, e)
    return None


def _extract_text_blocks(soup: BeautifulSoup) -> str:
    """Extract meaningful text from a page, stripping nav/footer noise."""
    for tag in soup.find_all(["nav", "footer", "header", "script", "style", "noscript"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)


def _extract_links_with_text(soup: BeautifulSoup, base_url: str) -> list[dict]:
    """Extract all links with their anchor text."""
    links = []
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True)
        href = urljoin(base_url, a["href"])
        if text and len(text) > 1:
            links.append({"text": text, "url": href})
    return links


def _find_portfolio_from_page(soup: BeautifulSoup, base_url: str) -> list[dict]:
    """Try to extract portfolio company names from a page."""
    companies = []
    seen_names = set()

    # Strategy 1: Look for grid/list items that look like company cards
    for selector in [
        "div.portfolio-item", "div.company-card", "article.portfolio",
        "[class*='portfolio']", "[class*='company']",
        "div.grid > div", "ul.portfolio li",
    ]:
        for el in soup.select(selector):
            name_el = el.find(["h2", "h3", "h4", "a", "p", "span"])
            if name_el:
                name = name_el.get_text(strip=True)
                if 2 < len(name) < 80 and name.lower() not in seen_names:
                    seen_names.add(name.lower())
                    desc_el = el.find("p")
                    desc = desc_el.get_text(strip=True) if desc_el and desc_el != name_el else ""
                    link_el = el.find("a", href=True)
                    url = urljoin(base_url, link_el["href"]) if link_el else ""
                    companies.append({
                        "name": name,
                        "description": desc[:500],
                        "url": url,
                        "source": "website",
                    })

    # Strategy 2: If no structured items found, look for logo grids
    if not companies:
        for img in soup.find_all("img", alt=True):
            alt = img["alt"].strip()
            if 2 < len(alt) < 60 and alt.lower() not in seen_names:
                parent = img.find_parent(["a", "div", "li"])
                if parent:
                    seen_names.add(alt.lower())
                    companies.append({
                        "name": alt,
                        "description": "",
                        "url": "",
                        "source": "website",
                    })

    return companies


def _find_team_from_page(soup: BeautifulSoup) -> list[dict]:
    """Try to extract team member names and titles from a page."""
    people = []
    seen = set()

    for selector in [
        "[class*='team']", "[class*='person']", "[class*='member']",
        "[class*='partner']", "div.bio",
    ]:
        for el in soup.select(selector):
            name_el = el.find(["h2", "h3", "h4"])
            if name_el:
                name = name_el.get_text(strip=True)
                if 3 < len(name) < 60 and name.lower() not in seen:
                    seen.add(name.lower())
                    title_el = el.find(["p", "span", "div"], class_=re.compile(r"title|role|position", re.I))
                    if not title_el:
                        # Try the next sibling p tag
                        title_el = name_el.find_next_sibling("p")
                    title = title_el.get_text(strip=True) if title_el else ""
                    linkedin = ""
                    li_link = el.find("a", href=re.compile(r"linkedin\.com"))
                    if li_link:
                        linkedin = li_link["href"]
                    people.append({
                        "name": name,
                        "title": title[:200],
                        "linkedin": linkedin,
                        "source": "website",
                    })

    return people


def _extract_thesis(text: str) -> str:
    """Extract investment thesis keywords from page text."""
    # Take first 3000 chars of meaningful text
    return text[:3000]


async def scrape_investor_website(website_url: str) -> dict:
    """Scrape an investor's website for portfolio, team, and thesis data.

    Returns a dict with:
        - portfolio: list of company dicts
        - team: list of people dicts
        - thesis_text: raw text from about/thesis pages
        - pages_scraped: list of URLs successfully fetched
    """
    if not website_url:
        return {"portfolio": [], "team": [], "thesis_text": "", "pages_scraped": []}

    # Normalize URL
    if not website_url.startswith("http"):
        website_url = "https://" + website_url
    parsed = urlparse(website_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    result = {
        "portfolio": [],
        "team": [],
        "thesis_text": "",
        "pages_scraped": [],
    }

    async with httpx.AsyncClient(timeout=20) as client:
        # 1. Scrape portfolio pages
        for path in PORTFOLIO_PATHS:
            url = base + path
            html = await _fetch_page(client, url)
            if html:
                result["pages_scraped"].append(url)
                soup = BeautifulSoup(html, "html.parser")
                companies = _find_portfolio_from_page(soup, url)
                if companies:
                    result["portfolio"].extend(companies)
                    break  # Found portfolio, stop trying other paths

        # 2. Scrape team pages
        for path in TEAM_PATHS:
            url = base + path
            html = await _fetch_page(client, url)
            if html:
                result["pages_scraped"].append(url)
                soup = BeautifulSoup(html, "html.parser")
                people = _find_team_from_page(soup)
                if people:
                    result["team"].extend(people)
                    break

        # 3. Scrape thesis/about for investment focus text
        for path in THESIS_PATHS:
            url = base + path
            html = await _fetch_page(client, url)
            if html:
                result["pages_scraped"].append(url)
                soup = BeautifulSoup(html, "html.parser")
                text = _extract_text_blocks(soup)
                if len(text) > 100:
                    result["thesis_text"] = _extract_thesis(text)
                    break

    # Deduplicate portfolio
    seen = set()
    unique_portfolio = []
    for c in result["portfolio"]:
        key = c["name"].lower()
        if key not in seen:
            seen.add(key)
            unique_portfolio.append(c)
    result["portfolio"] = unique_portfolio[:100]  # Cap at 100
    result["pages_scraped"] = list(set(result["pages_scraped"]))

    logger.info(
        "Website scrape complete: %d companies, %d team members, %d pages",
        len(result["portfolio"]), len(result["team"]), len(result["pages_scraped"]),
    )
    return result

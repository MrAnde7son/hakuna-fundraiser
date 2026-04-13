"""Press release scraping and investment event extraction.

Scrapes the investor's website for press releases / blog posts announcing
investments, then extracts structured InvestmentEvent data from them.

Supports two discovery methods:
  1. RSS/Atom feed auto-discovery + PR newswire feeds
  2. HTML scraping of news/press pages (original approach)
"""
from __future__ import annotations
import logging
import re
from datetime import date
from urllib.parse import urljoin, urlparse

import feedparser
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
}

# Common paths where VCs publish press releases / news
NEWS_PATHS = [
    "/news", "/blog", "/press", "/announcements", "/press-releases",
    "/insights", "/media", "/news-and-insights", "/updates",
]

# Common RSS/Atom feed paths to probe
FEED_PATHS = [
    "/feed", "/feed/", "/rss", "/rss.xml", "/atom.xml", "/feed.xml",
    "/blog/feed", "/blog/rss", "/news/feed", "/news/rss",
    "/press/feed", "/feed/atom",
]

# PR newswire + cybersecurity trade-press RSS feeds (all free, no keys)
PR_NEWSWIRE_FEEDS = [
    # --- General newswires ---
    "https://www.prnewswire.com/rss/news-releases-list.rss?k=cybersecurity+investment",
    "https://www.prnewswire.com/rss/news-releases-list.rss?k=cybersecurity+funding",
    "https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeEFtRXQ==&_gl=technology",
    "https://www.globenewswire.com/RssFeed/subjectcode/25-Cybersecurity/feedTitle/GlobeNewswire+-+Cybersecurity",

    # --- Cybersecurity trade press ---
    "https://www.darkreading.com/rss.xml",
    "https://www.securityweek.com/feed/",
    "https://cyberscoop.com/feed/",
    "https://therecord.media/feed/",
    "https://www.helpnetsecurity.com/feed/",
    "https://www.bleepingcomputer.com/feed/",
    "https://www.infosecurity-magazine.com/rss/news/",

    # --- Startup / funding press ---
    "https://techcrunch.com/category/security/feed/",
    "https://techcrunch.com/category/venture/feed/",
    "https://news.crunchbase.com/feed/",
    "https://www.axios.com/pro/rss",
]

# Regex patterns for investment announcements
INVESTMENT_PATTERNS = [
    re.compile(r"(?:leads?|invests?|backs?|announces?|closes?)\s+.*(?:round|funding|investment|series|seed)", re.I),
    re.compile(r"(?:series\s+[a-f]|seed\s+round|pre-seed|series\s+\w+)\s+(?:funding|round|investment)", re.I),
    re.compile(r"\$[\d,.]+\s*(?:m(?:illion)?|b(?:illion)?|k)", re.I),
    re.compile(r"(?:portfolio|investment)\s+(?:company|in)\b", re.I),
]

# Patterns to extract round details from text
AMOUNT_PATTERN = re.compile(r"\$\s*([\d,.]+)\s*(m(?:illion)?|b(?:illion)?|k)?", re.I)
ROUND_PATTERN = re.compile(
    r"(pre-seed|seed|series\s+[a-f]|growth|late[\s-]stage|early[\s-]stage|bridge)",
    re.I,
)
DATE_PATTERNS = [
    re.compile(r"(\w+\s+\d{1,2},?\s+\d{4})"),   # January 15, 2024
    re.compile(r"(\d{4}-\d{2}-\d{2})"),            # 2024-01-15
    re.compile(r"(\d{1,2}/\d{1,2}/\d{4})"),        # 01/15/2024
]

# Cybersecurity domain keywords for classification
DOMAIN_KEYWORDS = {
    "vulnerability management": ["vulnerability", "vuln", "scanning", "scanner", "cve"],
    "exposure management": ["exposure", "attack surface", "asm", "easm"],
    "endpoint security": ["endpoint", "edr", "xdr", "epp"],
    "cloud security": ["cloud security", "cspm", "cwpp", "cnapp", "cloud-native"],
    "identity security": ["identity", "iam", "access management", "zero trust", "authentication"],
    "application security": ["appsec", "application security", "sast", "dast", "api security"],
    "network security": ["network security", "firewall", "ndr", "sdn"],
    "data security": ["data security", "dlp", "data protection", "encryption"],
    "security operations": ["soc", "siem", "soar", "incident response", "threat detection"],
    "GRC": ["compliance", "governance", "risk management", "grc", "audit"],
}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _fetch_page(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=15)
        if resp.status_code == 200 and "text/html" in resp.headers.get("content-type", ""):
            return resp.text
    except Exception as e:
        logger.debug("Failed to fetch %s: %s", url, e)
    return None


async def _fetch_raw(client: httpx.AsyncClient, url: str) -> str | None:
    """Fetch any URL and return raw text regardless of content-type."""
    try:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=15)
        if resp.status_code == 200:
            return resp.text
    except Exception as e:
        logger.debug("Failed to fetch %s: %s", url, e)
    return None


def _is_investment_announcement(title: str, snippet: str) -> bool:
    """Check if a link/article looks like an investment announcement."""
    text = f"{title} {snippet}".lower()
    return any(p.search(text) for p in INVESTMENT_PATTERNS)


def _extract_amount(text: str) -> int | None:
    """Extract dollar amount from text, return as USD integer."""
    m = AMOUNT_PATTERN.search(text)
    if not m:
        return None
    num = float(m.group(1).replace(",", ""))
    suffix = (m.group(2) or "").lower()
    if suffix.startswith("b"):
        return int(num * 1_000_000_000)
    if suffix.startswith("m"):
        return int(num * 1_000_000)
    if suffix.startswith("k"):
        return int(num * 1_000)
    if num > 1000:
        return int(num)
    return int(num * 1_000_000)  # Assume millions if no suffix


def _extract_round(text: str) -> str | None:
    m = ROUND_PATTERN.search(text)
    return m.group(1).strip().title() if m else None


def _extract_date(text: str) -> date | None:
    """Try to parse a date from text."""
    from dateutil import parser as dateparser
    for pattern in DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            try:
                return dateparser.parse(m.group(1)).date()
            except (ValueError, TypeError):
                continue
    return None


def _classify_domain(text: str) -> str | None:
    """Classify the cybersecurity domain based on text content."""
    text_lower = text.lower()
    best_domain = None
    best_score = 0
    for domain, keywords in DOMAIN_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            best_domain = domain
    return best_domain if best_score > 0 else None


def _extract_company_name(title: str, body: str, investor_name: str) -> str | None:
    """Extract the investee company name from a press release."""
    patterns = [
        re.compile(
            rf"(?:{re.escape(investor_name)}|we)\s+(?:leads?|invests?\s+in|backs?|announces?\s+investment\s+in)\s+([A-Z][\w.]+(?:\s+[\w.]+)?)",
            re.I,
        ),
        re.compile(
            rf"([A-Z][\w.]+(?:\s+[\w.]+)?)\s+(?:raises?|secures?|closes?)\s+\$[\d,.]+\s*\w*.*{re.escape(investor_name)}",
            re.I,
        ),
        re.compile(
            r"(?:announcing|proud to announce|excited to announce)\s+(?:our\s+)?(?:investment|partnership)\s+(?:in|with)\s+([A-Z][\w.]+(?:\s+[\w.]+)?)",
            re.I,
        ),
    ]

    for p in patterns:
        m = p.search(title)
        if m:
            return m.group(1).strip()
        m = p.search(body[:1000])
        if m:
            return m.group(1).strip()

    return None


# ---------------------------------------------------------------------------
# RSS / Atom feed support
# ---------------------------------------------------------------------------

async def _discover_feeds(client: httpx.AsyncClient, website_url: str) -> list[str]:
    """Auto-discover RSS/Atom feeds on an investor website.

    1. Parse <link rel="alternate"> tags from the homepage.
    2. Probe common feed paths.
    """
    parsed = urlparse(website_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    discovered: list[str] = []
    seen: set[str] = set()

    # Strategy 1: HTML <link> tag discovery from homepage
    html = await _fetch_page(client, base)
    if html:
        soup = BeautifulSoup(html, "html.parser")
        for link in soup.find_all("link", attrs={"rel": "alternate"}):
            feed_type = (link.get("type") or "").lower()
            if "rss" in feed_type or "atom" in feed_type or "xml" in feed_type:
                href = link.get("href", "")
                if href:
                    url = urljoin(base, href)
                    if url not in seen:
                        seen.add(url)
                        discovered.append(url)

    # Strategy 2: Probe common feed paths
    for path in FEED_PATHS:
        url = base + path
        if url in seen:
            continue
        try:
            resp = await client.head(url, headers=HEADERS, follow_redirects=True, timeout=10)
            ct = resp.headers.get("content-type", "").lower()
            if resp.status_code == 200 and (
                "xml" in ct or "rss" in ct or "atom" in ct or "text/plain" in ct
            ):
                seen.add(url)
                discovered.append(url)
        except Exception:
            continue

    logger.info("Discovered %d RSS/Atom feeds on %s", len(discovered), base)
    return discovered


def _parse_feed_entries(
    feed_text: str, investor_name: str, feed_url: str,
) -> list[dict]:
    """Parse an RSS/Atom feed and extract investment events."""
    parsed = feedparser.parse(feed_text)
    events: list[dict] = []

    for entry in parsed.entries:
        title = entry.get("title", "")
        summary = entry.get("summary", entry.get("description", ""))
        # Strip HTML from summary
        if "<" in summary:
            summary = BeautifulSoup(summary, "html.parser").get_text(separator=" ", strip=True)
        content = ""
        if entry.get("content"):
            raw = entry["content"][0].get("value", "")
            content = BeautifulSoup(raw, "html.parser").get_text(separator=" ", strip=True) if "<" in raw else raw

        full_text = f"{title} {summary} {content}"

        if not _is_investment_announcement(title, f"{summary} {content}"[:1000]):
            continue

        company_name = _extract_company_name(title, f"{summary} {content}", investor_name)
        if not company_name:
            continue

        # Parse published date
        event_date = None
        if entry.get("published"):
            event_date = _extract_date(entry["published"])
        if not event_date and entry.get("updated"):
            event_date = _extract_date(entry["updated"])

        events.append({
            "company_name": company_name,
            "domain": _classify_domain(full_text),
            "event_date": event_date,
            "round_stage": _extract_round(full_text),
            "round_size_usd": _extract_amount(full_text),
            "source_url": entry.get("link", feed_url),
            "headline": title[:500],
            "snippet": summary[:500],
            "source_type": "rss",
        })

    return events


async def _fetch_rss_events(
    client: httpx.AsyncClient, feed_urls: list[str], investor_name: str,
) -> list[dict]:
    """Fetch and parse multiple RSS feeds, returning investment events."""
    events: list[dict] = []
    for url in feed_urls:
        feed_text = await _fetch_raw(client, url)
        if not feed_text:
            continue
        found = _parse_feed_entries(feed_text, investor_name, url)
        events.extend(found)
        if found:
            logger.info("Found %d investment events in feed %s", len(found), url)
    return events


async def _fetch_newswire_events(
    client: httpx.AsyncClient, investor_name: str,
) -> list[dict]:
    """Fetch PR newswire RSS feeds and filter entries mentioning this investor."""
    events: list[dict] = []
    name_lower = investor_name.lower()

    for url in PR_NEWSWIRE_FEEDS:
        feed_text = await _fetch_raw(client, url)
        if not feed_text:
            continue

        parsed = feedparser.parse(feed_text)
        for entry in parsed.entries:
            title = entry.get("title", "")
            summary = entry.get("summary", entry.get("description", ""))
            if "<" in summary:
                summary = BeautifulSoup(summary, "html.parser").get_text(separator=" ", strip=True)

            combined = f"{title} {summary}".lower()

            # Only keep entries that mention this investor by name
            if name_lower not in combined:
                continue

            if not _is_investment_announcement(title, summary):
                continue

            full_text = f"{title} {summary}"
            company_name = _extract_company_name(title, summary, investor_name)
            if not company_name:
                continue

            event_date = None
            if entry.get("published"):
                event_date = _extract_date(entry["published"])

            events.append({
                "company_name": company_name,
                "domain": _classify_domain(full_text),
                "event_date": event_date,
                "round_stage": _extract_round(full_text),
                "round_size_usd": _extract_amount(full_text),
                "source_url": entry.get("link", url),
                "headline": title[:500],
                "snippet": summary[:500],
                "source_type": "newswire",
            })

    if events:
        logger.info("Found %d newswire events for %s", len(events), investor_name)
    return events


# ---------------------------------------------------------------------------
# HTML scraping (original approach)
# ---------------------------------------------------------------------------

def _find_press_links(soup: BeautifulSoup, base_url: str) -> list[dict]:
    """Find links on a news/blog page that look like investment announcements."""
    links = []
    seen_urls = set()

    for a in soup.find_all("a", href=True):
        href = urljoin(base_url, a["href"])
        if href in seen_urls:
            continue

        title = a.get_text(strip=True)
        if not title or len(title) < 10:
            continue

        # Get surrounding snippet text
        parent = a.find_parent(["article", "div", "li"])
        snippet = ""
        if parent:
            snippet = parent.get_text(separator=" ", strip=True)[:500]

        if _is_investment_announcement(title, snippet):
            seen_urls.add(href)
            links.append({"title": title, "url": href, "snippet": snippet})

    return links


def _extract_event_from_article(html: str, url: str, investor_name: str) -> dict | None:
    """Parse an article page to extract investment event details."""
    soup = BeautifulSoup(html, "html.parser")

    # Remove noise
    for tag in soup.find_all(["nav", "footer", "header", "script", "style"]):
        tag.decompose()

    # Get article title
    title_el = soup.find(["h1", "h2"])
    title = title_el.get_text(strip=True) if title_el else ""

    # Get article body text
    article = soup.find(["article", "main", "div.post-content", "div.entry-content"])
    if not article:
        article = soup.find("body")
    text = article.get_text(separator=" ", strip=True) if article else ""

    full_text = f"{title} {text}"
    if not _is_investment_announcement(title, text[:1000]):
        return None

    company_name = _extract_company_name(title, text, investor_name)
    if not company_name:
        return None

    return {
        "company_name": company_name,
        "domain": _classify_domain(full_text),
        "event_date": _extract_date(full_text),
        "round_stage": _extract_round(full_text),
        "round_size_usd": _extract_amount(full_text),
        "source_url": url,
        "headline": title[:500],
        "snippet": text[:500],
        "source_type": "html",
    }


async def _scrape_html_events(
    client: httpx.AsyncClient, website_url: str, investor_name: str,
) -> list[dict]:
    """Original HTML scraping approach — crawl news pages for press links."""
    parsed = urlparse(website_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    events: list[dict] = []
    seen_urls: set[str] = set()

    press_links: list[dict] = []
    for path in NEWS_PATHS:
        url = base + path
        html = await _fetch_page(client, url)
        if html:
            soup = BeautifulSoup(html, "html.parser")
            found = _find_press_links(soup, url)
            press_links.extend(found)
            if found:
                logger.info("Found %d press links on %s", len(found), url)

    for link in press_links[:20]:
        if link["url"] in seen_urls:
            continue
        seen_urls.add(link["url"])

        html = await _fetch_page(client, link["url"])
        if not html:
            continue

        event = _extract_event_from_article(html, link["url"], investor_name)
        if event:
            events.append(event)

    return events


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def scrape_press_releases(website_url: str, investor_name: str) -> list[dict]:
    """Scrape an investor's website for press releases about investments.

    Combines three discovery methods:
      1. Auto-discovered RSS/Atom feeds on the investor's site
      2. PR newswire feeds (PRNewswire, BusinessWire, GlobeNewsWire)
      3. HTML scraping of news/press pages

    Returns a list of investment event dicts with:
        - company_name, domain, event_date, round_stage, round_size_usd
        - source_url, headline, snippet, source_type
    """
    if not website_url:
        return []

    if not website_url.startswith("http"):
        website_url = "https://" + website_url

    all_events: list[dict] = []

    async with httpx.AsyncClient(timeout=20) as client:
        # 1. Discover and parse RSS/Atom feeds on the investor's site
        feed_urls = await _discover_feeds(client, website_url)
        if feed_urls:
            rss_events = await _fetch_rss_events(client, feed_urls, investor_name)
            all_events.extend(rss_events)

        # 2. Check PR newswire feeds for mentions of this investor
        newswire_events = await _fetch_newswire_events(client, investor_name)
        all_events.extend(newswire_events)

        # 3. Fall back to / supplement with HTML scraping
        html_events = await _scrape_html_events(client, website_url, investor_name)
        all_events.extend(html_events)

    # Deduplicate by company_name + round_stage (prefer RSS/newswire over HTML)
    seen: set[str] = set()
    unique_events: list[dict] = []
    for event in all_events:
        key = f"{event['company_name'].lower()}|{(event.get('round_stage') or '').lower()}"
        if key not in seen:
            seen.add(key)
            unique_events.append(event)

    logger.info(
        "Press release enrichment for %s: %d unique events "
        "(rss=%d, newswire=%d, html=%d)",
        investor_name,
        len(unique_events),
        sum(1 for e in unique_events if e.get("source_type") == "rss"),
        sum(1 for e in unique_events if e.get("source_type") == "newswire"),
        sum(1 for e in unique_events if e.get("source_type") == "html"),
    )
    return unique_events

"""SEC EDGAR enrichment for US funds.

Pulls Form D filings to get actual fund size (totalOfferingAmount), vintage
year, related persons (GPs), and industry group. Also probes the IAPD
adviser-info service for Form ADV AUM when the fund is a registered adviser.

All sources are free. Respects SEC's fair-use policy (descriptive User-Agent,
10 req/s max — enforced via tenacity backoff on 429s).
"""
from __future__ import annotations
import logging
from xml.etree import ElementTree as ET

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)
EDGAR_SEARCH = "https://efts.sec.gov/LATEST/search-index"
EDGAR_ARCHIVE = "https://www.sec.gov/Archives/edgar/data"
IAPD_SEARCH = "https://efts.sec.gov/LATEST/search-index"  # same endpoint, ADV form filter
ADVISERINFO_SEARCH = "https://adviserinfo.sec.gov/api/Search/FirmSearch"

EDGAR_HEADERS = {
    "User-Agent": "HakunaIntelligence/1.0 research@hakuna.security",
    "Accept-Encoding": "gzip, deflate",
}


class SECError(Exception):
    pass


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.ConnectError, httpx.ReadTimeout)),
    reraise=True,
)
async def _edgar_get(client: httpx.AsyncClient, url: str, params: dict | None = None) -> httpx.Response:
    resp = await client.get(url, headers=EDGAR_HEADERS, params=params or {}, timeout=30)
    resp.raise_for_status()
    return resp


async def search_form_d(client: httpx.AsyncClient, entity_name: str) -> list[dict]:
    """Search EDGAR EFTS for Form D filings matching an entity name."""
    try:
        resp = await _edgar_get(client, EDGAR_SEARCH, {
            "q": f'"{entity_name}"',
            "forms": "D,D/A",
            "dateRange": "custom",
            "startdt": "2015-01-01",
        })
        return resp.json().get("hits", {}).get("hits", [])
    except Exception as e:
        logger.error("EDGAR Form D search failed for %s: %s", entity_name, e)
        raise SECError(str(e)) from e


def _strip_ns(tag: str) -> str:
    """Strip XML namespace from a tag name."""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _find_text(root: ET.Element, path_parts: list[str]) -> str | None:
    """Walk the tree by local tag names (namespace-agnostic) and return text."""
    node = root
    for part in path_parts:
        found = None
        for child in node:
            if _strip_ns(child.tag) == part:
                found = child
                break
        if found is None:
            return None
        node = found
    text = (node.text or "").strip()
    return text or None


def _iter_local(node: ET.Element, tag: str):
    for child in node.iter():
        if _strip_ns(child.tag) == tag:
            yield child


def parse_form_d_xml(xml_text: str) -> dict:
    """Parse a Form D primary_doc.xml and extract fund-relevant fields."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning("Form D XML parse failed: %s", e)
        return {}

    data: dict = {}

    # Primary issuer
    for issuer in _iter_local(root, "primaryIssuer"):
        name = _find_text(issuer, ["entityName"])
        if name:
            data["issuer_name"] = name
        year = _find_text(issuer, ["yearOfIncorporation", "value"])
        if year and year.isdigit():
            data["year_of_incorporation"] = int(year)
        break

    # Industry group (e.g., "Pooled Investment Fund", "Venture Capital Fund")
    industry = _find_text(root, ["offeringData", "industryGroup", "industryGroupType"])
    if industry:
        data["industry_group"] = industry
    pooled_type = _find_text(root, ["offeringData", "industryGroup", "investmentFundInfo", "investmentFundType"])
    if pooled_type:
        data["fund_type"] = pooled_type

    # Offering amounts — the prize
    amt = _find_text(root, ["offeringData", "offeringSalesAmounts", "totalOfferingAmount"])
    if amt and amt.isdigit():
        data["total_offering_amount_usd"] = int(amt)
    sold = _find_text(root, ["offeringData", "offeringSalesAmounts", "totalAmountSold"])
    if sold and sold.isdigit():
        data["total_amount_sold_usd"] = int(sold)
    remaining = _find_text(root, ["offeringData", "offeringSalesAmounts", "totalRemaining"])
    if remaining and remaining.isdigit():
        data["total_remaining_usd"] = int(remaining)

    # Related persons (GPs, directors, officers)
    persons = []
    for rp in _iter_local(root, "relatedPersonInfo"):
        first = _find_text(rp, ["relatedPersonName", "firstName"]) or ""
        last = _find_text(rp, ["relatedPersonName", "lastName"]) or ""
        name = f"{first} {last}".strip()
        if not name:
            continue
        rels = []
        for r in _iter_local(rp, "relationship"):
            if r.text:
                rels.append(r.text.strip())
        persons.append({"name": name, "relationships": rels})
    if persons:
        data["related_persons"] = persons

    # Date of first sale → vintage signal
    first_sale = _find_text(root, ["offeringData", "dateOfFirstSale", "value"])
    if first_sale:
        data["date_of_first_sale"] = first_sale

    return data


def _build_primary_doc_url(cik: str, accession: str) -> str:
    """Build the URL to a Form D primary_doc.xml from CIK + accession."""
    accession_clean = accession.replace("-", "")
    return f"{EDGAR_ARCHIVE}/{int(cik)}/{accession_clean}/primary_doc.xml"


async def fetch_and_parse_filing(client: httpx.AsyncClient, hit: dict) -> dict:
    """Given an EFTS hit, fetch and parse the primary Form D document."""
    source = hit.get("_source", {}) or {}
    ciks = source.get("ciks") or []
    adsh = hit.get("_id", "")  # e.g. "0001234567-24-000123:primary_doc.xml"
    accession = adsh.split(":", 1)[0] if adsh else ""
    if not ciks or not accession:
        return {}
    cik = ciks[0]
    url = _build_primary_doc_url(cik, accession)

    try:
        resp = await _edgar_get(client, url)
        parsed = parse_form_d_xml(resp.text)
        parsed["accession"] = accession
        parsed["cik"] = cik
        parsed["file_date"] = source.get("file_date", "")
        parsed["form_type"] = source.get("form_type", "")
        parsed["filing_url"] = url
        return parsed
    except Exception as e:
        logger.debug("Form D doc fetch failed %s: %s", url, e)
        return {
            "accession": accession,
            "cik": cik,
            "file_date": source.get("file_date", ""),
            "form_type": source.get("form_type", ""),
        }


async def fetch_adv_aum(client: httpx.AsyncClient, entity_name: str) -> int | None:
    """Look up Form ADV reported AUM via IAPD adviser search.

    Free public endpoint; best-effort. Returns total AUM in USD if found.
    """
    try:
        resp = await client.get(
            ADVISERINFO_SEARCH,
            headers={**EDGAR_HEADERS, "Accept": "application/json"},
            params={"query": entity_name, "type": "Firm"},
            timeout=20,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        hits = data.get("hits", {}).get("hits", [])
        for h in hits:
            src = h.get("_source", {})
            # Fuzzy name match
            firm_name = (src.get("firm_name") or "").lower()
            if entity_name.lower() not in firm_name and firm_name not in entity_name.lower():
                continue
            aum = src.get("total_aum") or src.get("discretionary_aum")
            if isinstance(aum, (int, float)) and aum > 0:
                return int(aum)
    except Exception as e:
        logger.debug("Form ADV lookup failed for %s: %s", entity_name, e)
    return None


async def enrich_investor(name: str) -> dict:
    """Fetch SEC EDGAR Form D + Form ADV data for a fund.

    Returns:
        {
          source, filings: [...], fund_size_usd, vintage_year,
          industry_group, fund_type, related_persons, adv_aum_usd
        }
    """
    result: dict = {
        "source": "sec_edgar",
        "filings": [],
        "fund_size_usd": None,
        "vintage_year": None,
        "industry_group": None,
        "fund_type": None,
        "related_persons": [],
        "adv_aum_usd": None,
    }

    async with httpx.AsyncClient() as client:
        try:
            hits = await search_form_d(client, name)
        except SECError:
            hits = []

        # Parse up to 10 filings in sequence (SEC rate-limits to ~10 req/s)
        parsed_filings: list[dict] = []
        for hit in hits[:10]:
            parsed = await fetch_and_parse_filing(client, hit)
            if parsed:
                parsed_filings.append(parsed)

        result["filings"] = parsed_filings

        # Fund size = largest totalOfferingAmount across filings (most recent fund)
        sized = [f for f in parsed_filings if f.get("total_offering_amount_usd")]
        if sized:
            latest = max(sized, key=lambda f: f.get("file_date") or "")
            result["fund_size_usd"] = latest.get("total_offering_amount_usd")
            result["industry_group"] = latest.get("industry_group")
            result["fund_type"] = latest.get("fund_type")
            result["related_persons"] = latest.get("related_persons", [])

        # Vintage year = earliest file_date
        dates = [f.get("file_date") for f in parsed_filings if f.get("file_date")]
        if dates:
            result["vintage_year"] = min(dates)[:4]

        # Form ADV AUM (best-effort, may be blocked — optional)
        result["adv_aum_usd"] = await fetch_adv_aum(client, name)

    return result

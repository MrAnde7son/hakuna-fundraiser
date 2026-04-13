"""Pydantic schemas for API request/response models."""
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel


class InvestorCreate(BaseModel):
    name: str
    type: str = "vc"
    website: Optional[str] = None
    contact: Optional[str] = None
    stage_focus: Optional[str] = None
    geo_focus: Optional[str] = None
    notes: Optional[str] = None


class InvestorOut(BaseModel):
    id: int
    name: str
    type: str
    website: Optional[str]
    fund_size_usd: Optional[int]
    stage_focus: Optional[str]
    geo_focus: Optional[str]
    contact: Optional[str]
    notes: Optional[str]
    enrichment_status: str
    crunchbase_status: Optional[str]
    linkedin_status: Optional[str]
    news_status: Optional[str]
    sec_status: Optional[str]
    ai_status: Optional[str]
    website_status: Optional[str]
    press_release_status: Optional[str]
    ai_enrichment: Optional[dict]
    raw_crunchbase: Optional[dict]
    raw_news: Optional[dict]
    raw_sec: Optional[dict] = None
    last_enriched_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class InvestorListItem(BaseModel):
    id: int
    name: str
    type: str
    website: Optional[str]
    stage_focus: Optional[str]
    enrichment_status: str
    last_enriched_at: Optional[datetime]
    ai_enrichment: Optional[dict]
    blocking_count: int = 0

    model_config = {"from_attributes": True}


class InvestorListResponse(BaseModel):
    items: List[InvestorListItem]
    total: int
    page: int
    page_size: int


class PartnerOut(BaseModel):
    id: int
    investor_id: int
    name: str
    title: Optional[str]
    linkedin_url: Optional[str]
    linkedin_raw: Optional[dict]
    network_degree: Optional[int]

    model_config = {"from_attributes": True}


class PortfolioCompanyOut(BaseModel):
    id: int
    investor_id: int
    name: str
    category: Optional[str]
    stage: Optional[str]
    description: Optional[str]
    conflict_type: Optional[str]

    model_config = {"from_attributes": True}


class OutreachNoteCreate(BaseModel):
    status: str = "target"
    notes: Optional[str] = None
    next_action: Optional[str] = None
    contact_date: Optional[datetime] = None


class OutreachNoteOut(BaseModel):
    id: int
    investor_id: int
    status: str
    contact_date: Optional[datetime]
    notes: Optional[str]
    next_action: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class EnrichmentJobOut(BaseModel):
    id: int
    investor_id: int
    job_type: str
    status: str
    error_msg: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class CSVImportRow(BaseModel):
    name: str
    type: str = "vc"
    website: Optional[str] = None
    contact: Optional[str] = None
    stage: Optional[str] = None
    notes: Optional[str] = None


class InvestmentEventOut(BaseModel):
    id: int
    investor_id: int
    company_name: str
    domain: Optional[str]
    event_date: Optional[date]
    round_stage: Optional[str]
    round_size_usd: Optional[int]
    source: str
    source_url: Optional[str]
    headline: Optional[str]
    snippet: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class TimelineEntry(BaseModel):
    id: int
    investor_id: int
    investor_name: str
    company_name: str
    domain: Optional[str]
    event_date: Optional[date]
    round_stage: Optional[str]
    round_size_usd: Optional[int]
    source: str
    source_url: Optional[str]
    headline: Optional[str]


class TimelineResponse(BaseModel):
    items: List[TimelineEntry]
    total: int
    page: int
    page_size: int


class DomainConflictRow(BaseModel):
    investor_id: int
    investor_name: str
    scores: dict[str, str]  # domain_id -> "blocking"|"adjacent"|"watching"|"clear"
    worst_conflict: str


class DomainCreate(BaseModel):
    name: str
    description: Optional[str] = None
    keywords: List[str] = []
    position: Optional[int] = None


class DomainUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[List[str]] = None
    position: Optional[int] = None


class DomainOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    keywords: List[str]
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}

"""Read and update runtime app settings (API keys, model config)."""
from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings, reload_settings
from app.services.app_settings import (
    EDITABLE_FIELDS,
    SECRET_FIELDS,
    load_overrides,
    mask,
    save_overrides,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsField(BaseModel):
    key: str
    label: str
    secret: bool
    is_set: bool
    preview: str
    overridden: bool


class SettingsResponse(BaseModel):
    fields: list[SettingsField]


class SettingsUpdate(BaseModel):
    values: Dict[str, Optional[str]]


_LABELS = {
    "vertex_project": "Vertex AI Project",
    "vertex_location": "Vertex AI Location",
    "vertex_model": "Vertex AI Model",
    "crunchbase_api_key": "Crunchbase API Key",
    "proxycurl_api_key": "Proxycurl API Key",
    "exa_api_key": "Exa API Key",
    "tavily_api_key": "Tavily API Key",
    "slack_webhook_url": "Slack Webhook URL",
}


@router.get("", response_model=SettingsResponse)
async def get_app_settings():
    settings = get_settings()
    overrides = load_overrides()
    fields = []
    for key in EDITABLE_FIELDS:
        value = getattr(settings, key, "") or ""
        fields.append(
            SettingsField(
                key=key,
                label=_LABELS.get(key, key),
                secret=key in SECRET_FIELDS,
                is_set=bool(value),
                preview=mask(key, value),
                overridden=key in overrides,
            )
        )
    return SettingsResponse(fields=fields)


@router.put("", response_model=SettingsResponse)
async def update_app_settings(body: SettingsUpdate):
    save_overrides(body.values)
    reload_settings()
    return await get_app_settings()

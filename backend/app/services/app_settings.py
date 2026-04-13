"""Persisted app-settings overrides (API keys etc.) stored as JSON on disk.

The file path can be overridden with APP_SETTINGS_PATH; defaults to
``/app/data/app_settings.json`` inside the container (the backend volume is
mounted, so the file persists across rebuilds).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from threading import Lock
from typing import Any, Dict

# Fields that may be overridden at runtime via the settings UI.
EDITABLE_FIELDS = (
    "vertex_project",
    "vertex_location",
    "vertex_model",
    "crunchbase_api_key",
    "proxycurl_api_key",
    "exa_api_key",
    "tavily_api_key",
    "slack_webhook_url",
)

SECRET_FIELDS = {
    "crunchbase_api_key",
    "proxycurl_api_key",
    "exa_api_key",
    "tavily_api_key",
    "slack_webhook_url",
}

_lock = Lock()


def _path() -> Path:
    return Path(os.environ.get("APP_SETTINGS_PATH", "/app/data/app_settings.json"))


def load_overrides() -> Dict[str, Any]:
    p = _path()
    if not p.exists():
        return {}
    try:
        with p.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return {k: v for k, v in data.items() if k in EDITABLE_FIELDS}
    except (OSError, json.JSONDecodeError):
        return {}


def save_overrides(updates: Dict[str, Any]) -> Dict[str, Any]:
    """Merge ``updates`` into the override file. Empty strings clear a field."""
    with _lock:
        current = load_overrides()
        for key, value in updates.items():
            if key not in EDITABLE_FIELDS:
                continue
            if value is None or value == "":
                current.pop(key, None)
            else:
                current[key] = value
        p = _path()
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
        tmp.replace(p)
        return current


def mask(field: str, value: str) -> str:
    if not value:
        return ""
    if field not in SECRET_FIELDS:
        return value
    if len(value) <= 4:
        return "•" * len(value)
    return f"{value[:4]}{'•' * 8}"

from __future__ import annotations

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://hakuna:hakuna@localhost:5432/hakuna"
    celery_database_url: str = "postgresql://hakuna:hakuna@localhost:5432/hakuna"
    redis_url: str = "redis://localhost:6379/0"

    vertex_project: str = ""
    vertex_location: str = "us-central1"
    vertex_model: str = "gemini-2.5-flash"
    crunchbase_api_key: str = ""
    proxycurl_api_key: str = ""
    exa_api_key: str = ""
    tavily_api_key: str = ""

    slack_webhook_url: str = ""
    enrichment_concurrency: int = 3

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    # Lazy import to avoid circular import at module load time.
    from app.services.app_settings import load_overrides

    base = Settings().model_dump()
    base.update(load_overrides())
    return Settings(**base)


def reload_settings() -> Settings:
    """Clear the cache so the next ``get_settings()`` re-reads overrides."""
    get_settings.cache_clear()
    return get_settings()

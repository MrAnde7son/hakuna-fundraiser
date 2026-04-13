"""FastAPI application entry point."""
from __future__ import annotations
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.investors import router as investors_router
from app.api.seed import router as seed_router, seed_investors_on_startup
from app.api.focus_areas import router as focus_areas_router
from app.api.timeline import router as timeline_router
from app.api.settings import router as settings_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Hakuna Investor Intelligence starting up")
    await seed_investors_on_startup()
    yield
    logging.info("Shutting down")


app = FastAPI(
    title="Hakuna Investor Intelligence",
    description="Investor enrichment and intelligence platform for Hakuna's fundraise",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(investors_router)
app.include_router(seed_router)
app.include_router(focus_areas_router)
app.include_router(timeline_router)
app.include_router(settings_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "hakuna-investor-intelligence"}

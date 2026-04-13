# Hakuna Investor Intelligence

Internal tool for Hakuna's fundraise. Enriches investor data from public sources, maps portfolio conflicts against the VM/EM space, and generates AI-powered investment intelligence using Claude.

## Quick start (local)

```bash
cp .env.example .env          # add your API keys
docker-compose up -d           # starts Postgres, Redis, backend, worker, scheduler, frontend
# Wait for services to start (~30s), then:
curl -X POST http://localhost:8000/api/seed   # seeds 50 investors + triggers enrichment
open http://localhost:5173                     # open the UI
```

## Architecture

| Service     | Tech                  | Port  |
|-------------|----------------------|-------|
| Backend API | FastAPI + SQLAlchemy  | 8000  |
| Worker      | Celery + Redis        | —     |
| Scheduler   | Celery Beat           | —     |
| Frontend    | React + Tailwind      | 5173  |
| Database    | PostgreSQL 16         | 5432  |
| Queue       | Redis 7               | 6379  |

## Enrichment pipeline

For each investor, the pipeline runs these sources:

1. **Crunchbase** — fund info, portfolio companies, partners
2. **LinkedIn** (Proxycurl) — partner profiles, domain expertise
3. **SEC EDGAR** — Form D filings, fund size, vintage year
4. **News** (Exa AI / Tavily) — cybersecurity investment signals
5. **Claude AI** — conflict mapping, thesis inference, outreach suggestions

Each source runs independently with 3x retry + exponential backoff. Partial results are stored even if some sources fail.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection (asyncpg) |
| `REDIS_URL` | Yes | Redis for Celery |
| `ANTHROPIC_API_KEY` | Yes | Claude API for AI enrichment |
| `CRUNCHBASE_API_KEY` | No | Crunchbase Basic API ($29/mo) |
| `PROXYCURL_API_KEY` | No | LinkedIn enrichment (~$0.01/profile) |
| `EXA_API_KEY` | No | Exa AI web search |
| `TAVILY_API_KEY` | No | Alternative to Exa |
| `SLACK_WEBHOOK_URL` | No | Failure notifications |
| `ENRICHMENT_CONCURRENCY` | No | Parallel enrichments (default: 3) |

## Manual re-enrichment

```bash
# Single investor
curl -X POST http://localhost:8000/api/investors/1/enrich

# All investors
curl -X POST http://localhost:8000/api/investors/enrich-all
```

Weekly re-enrichment runs automatically on Mondays at 2am UTC.

## Development

```bash
# Backend only
cd backend && pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend only
cd frontend && npm install && npm run dev

# Run tests
cd backend && pytest tests/ -v
```

## Deployment (Render)

- **Web Service**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Background Worker**: `cd backend && celery -A app.tasks.worker worker --loglevel=info`
- **Managed Postgres** + **Redis** from Render dashboard
- Set all env vars in Render's environment settings

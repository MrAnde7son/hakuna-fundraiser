"""Basic API tests."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.database import Base, get_db
from app.config import get_settings


@pytest.fixture
async def db_session():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_create_investor(client):
    resp = await client.post(
        "/api/investors",
        json={"name": "Test Fund", "type": "vc"},
        params={"auto_enrich": False},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Fund"
    assert data["enrichment_status"] == "pending"


@pytest.mark.asyncio
async def test_create_duplicate(client):
    await client.post(
        "/api/investors",
        json={"name": "Dup Fund"},
        params={"auto_enrich": False},
    )
    resp = await client.post(
        "/api/investors",
        json={"name": "Dup Fund"},
        params={"auto_enrich": False},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_list_investors(client):
    await client.post("/api/investors", json={"name": "Fund A"}, params={"auto_enrich": False})
    await client.post("/api/investors", json={"name": "Fund B"}, params={"auto_enrich": False})
    resp = await client.get("/api/investors")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2


@pytest.mark.asyncio
async def test_get_investor(client):
    create_resp = await client.post(
        "/api/investors", json={"name": "Detail Fund"}, params={"auto_enrich": False}
    )
    inv_id = create_resp.json()["id"]
    resp = await client.get(f"/api/investors/{inv_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Detail Fund"


@pytest.mark.asyncio
async def test_outreach_notes(client):
    create_resp = await client.post(
        "/api/investors", json={"name": "Outreach Fund"}, params={"auto_enrich": False}
    )
    inv_id = create_resp.json()["id"]

    note_resp = await client.post(
        f"/api/investors/{inv_id}/outreach",
        json={"status": "contacted", "notes": "Had intro call"},
    )
    assert note_resp.status_code == 201

    list_resp = await client.get(f"/api/investors/{inv_id}/outreach")
    assert len(list_resp.json()) == 1

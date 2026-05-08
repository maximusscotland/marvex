"""
Tests for /api/waitlist — email capture before launch.
"""

import os
import pytest
import pytest_asyncio
from dotenv import load_dotenv
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

from waitlist import make_router  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = "mindmapper_waitlist_test"


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(MONGO_URL)
    d = client[DB_NAME]
    await d.waitlist.delete_many({})
    # Reset the in-memory IP rate-limit bucket so tests don't leak across each other.
    import waitlist as _wl
    _wl._recent_hits.clear()
    yield d
    await d.waitlist.delete_many({})
    _wl._recent_hits.clear()
    client.close()


@pytest_asyncio.fixture
async def client(db):
    app = FastAPI()
    app.include_router(make_router(db))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        yield c


@pytest.mark.asyncio
async def test_join_waitlist_success(client, db):
    r = await client.post("/api/waitlist", json={"email": "alice@example.com"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["count"] == 1
    doc = await db.waitlist.find_one({"email": "alice@example.com"})
    assert doc is not None
    assert doc["source"] == "landing"  # default


@pytest.mark.asyncio
async def test_join_normalises_to_lowercase(client, db):
    await client.post("/api/waitlist", json={"email": "Bob@EXAMPLE.com"})
    doc = await db.waitlist.find_one({"email": "bob@example.com"})
    assert doc is not None


@pytest.mark.asyncio
async def test_join_dedupes_same_email(client):
    r1 = await client.post("/api/waitlist", json={"email": "carol@example.com"})
    r2 = await client.post("/api/waitlist", json={"email": "carol@example.com", "source": "twitter"})
    assert r1.json()["count"] == 1
    assert r2.json()["count"] == 1  # NOT 2


@pytest.mark.asyncio
async def test_dedupe_updates_source(client, db):
    await client.post("/api/waitlist", json={"email": "dave@example.com", "source": "landing"})
    await client.post("/api/waitlist", json={"email": "dave@example.com", "source": "twitter"})
    doc = await db.waitlist.find_one({"email": "dave@example.com"})
    assert doc["source"] == "twitter"


@pytest.mark.asyncio
async def test_join_rejects_invalid_email(client):
    for bad in ["not-an-email", "@example.com", "alice@", "alice@.com", "spaces here@x.com"]:
        r = await client.post("/api/waitlist", json={"email": bad})
        assert r.status_code == 400, f"should reject {bad!r}"


@pytest.mark.asyncio
async def test_count_endpoint_is_public(client):
    r = await client.get("/api/waitlist/count")
    assert r.status_code == 200
    assert r.json()["count"] == 0
    await client.post("/api/waitlist", json={"email": "ev@example.com"})
    await client.post("/api/waitlist", json={"email": "fran@example.com"})
    r = await client.get("/api/waitlist/count")
    assert r.json()["count"] == 2

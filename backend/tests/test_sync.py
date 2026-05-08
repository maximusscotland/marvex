"""Unit tests for the /api/sync/* router.

Uses a local MongoDB via the already-configured MONGO_URL from backend/.env.
Exercises both Pro-gated paths and LWW conflict resolution.
"""
import os
import time
import uuid
import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport

# Load backend/.env so MONGO_URL is populated when running via `pytest`.
load_dotenv("/app/backend/.env")

# Import server to trigger router creation + mounting on a throwaway app.
from sync import make_sync_router, purge_old_tombstones, TOMBSTONE_TTL_MS  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "mindmapper_test")


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(MONGO_URL)
    database = client[DB_NAME + "_sync_tests"]
    yield database
    await client.drop_database(DB_NAME + "_sync_tests")
    client.close()


async def _make_app(db, user):
    """Mount the sync router with a fake current_user dependency."""
    async def fake_current_user():
        return user
    router = make_sync_router(db, fake_current_user)
    app = FastAPI()
    app.include_router(router)
    return app


PRO_USER = {
    "user_id": "user_pro_test_" + uuid.uuid4().hex[:8],
    "email": "pro@test.com",
    "subscription": {"status": "active", "plan": "monthly"},
}
FREE_USER = {
    "user_id": "user_free_test_" + uuid.uuid4().hex[:8],
    "email": "free@test.com",
    "subscription": {"status": "free", "plan": ""},
}


@pytest.mark.asyncio
async def test_free_user_gets_402(db):
    app = await _make_app(db, FREE_USER)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/api/sync/maps")
        assert r.status_code == 402
        r = await ac.post("/api/sync/maps", json={"maps": []})
        assert r.status_code == 402


@pytest.mark.asyncio
async def test_status_disabled_for_free(db):
    app = await _make_app(db, FREE_USER)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/api/sync/status")
        assert r.status_code == 200
        body = r.json()
        assert body["enabled"] is False
        assert body["map_count"] == 0


@pytest.mark.asyncio
async def test_push_then_pull_roundtrip(db):
    app = await _make_app(db, PRO_USER)
    now = time.time() * 1000
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Push a map
        push = await ac.post("/api/sync/maps", json={
            "maps": [{
                "map_id": "m_test_1",
                "data": {"title": "Test Map", "children": []},
                "updated_at": now,
            }],
        })
        assert push.status_code == 200
        body = push.json()
        assert body["results"][0]["outcome"] == "uploaded"

        # Pull (no since filter)
        pull = await ac.get("/api/sync/maps")
        assert pull.status_code == 200
        maps = pull.json()["maps"]
        assert len(maps) == 1
        assert maps[0]["map_id"] == "m_test_1"
        assert maps[0]["data"]["title"] == "Test Map"


@pytest.mark.asyncio
async def test_lww_keeps_server_newer(db):
    """If server's updated_at > client's, server copy must be kept."""
    app = await _make_app(db, PRO_USER)
    base = time.time() * 1000
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Initial push at t=base+1000
        await ac.post("/api/sync/maps", json={"maps": [{
            "map_id": "m_lww", "data": {"v": "newer"}, "updated_at": base + 1000,
        }]})
        # Now push an OLDER version at t=base+500
        push = await ac.post("/api/sync/maps", json={"maps": [{
            "map_id": "m_lww", "data": {"v": "older"}, "updated_at": base + 500,
        }]})
        result = push.json()["results"][0]
        assert result["outcome"] == "kept-server-newer"
        assert result["server_updated_at"] == base + 1000

        pull = await ac.get("/api/sync/maps")
        maps = pull.json()["maps"]
        assert maps[0]["data"]["v"] == "newer"


@pytest.mark.asyncio
async def test_since_filter_only_returns_recent(db):
    app = await _make_app(db, PRO_USER)
    base = time.time() * 1000
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/sync/maps", json={"maps": [
            {"map_id": "m_old",  "data": {"n": 1}, "updated_at": base - 10_000},
            {"map_id": "m_new",  "data": {"n": 2}, "updated_at": base + 1_000},
        ]})
        # since = base → only m_new should come back
        pull = await ac.get("/api/sync/maps", params={"since": base})
        map_ids = [m["map_id"] for m in pull.json()["maps"]]
        assert map_ids == ["m_new"]


@pytest.mark.asyncio
async def test_delete_creates_tombstone_and_shows_in_pull(db):
    app = await _make_app(db, PRO_USER)
    now = time.time() * 1000
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/sync/maps", json={"maps": [{
            "map_id": "m_del", "data": {"k": "v"}, "updated_at": now,
        }]})
        r = await ac.delete("/api/sync/maps/m_del")
        assert r.status_code == 200
        assert r.json()["deleted"] is True

        pull = await ac.get("/api/sync/maps")
        body = pull.json()
        # Alive list should be empty
        assert [m for m in body["maps"] if m["map_id"] == "m_del"] == []
        # Tombstone list should include m_del
        assert "m_del" in body["tombstones"]


@pytest.mark.asyncio
async def test_user_isolation(db):
    """One user must never see another user's maps."""
    now = time.time() * 1000
    app_pro = await _make_app(db, PRO_USER)
    other = {**PRO_USER, "user_id": "user_other_" + uuid.uuid4().hex[:8]}
    app_other = await _make_app(db, other)

    async with AsyncClient(transport=ASGITransport(app=app_pro), base_url="http://test") as ac:
        await ac.post("/api/sync/maps", json={"maps": [{
            "map_id": "m_private", "data": {"secret": 42}, "updated_at": now,
        }]})
    async with AsyncClient(transport=ASGITransport(app=app_other), base_url="http://test") as ac:
        pull = await ac.get("/api/sync/maps")
        assert pull.json()["maps"] == []


@pytest.mark.asyncio
async def test_purge_old_tombstones(db):
    """Tombstones older than 30 days are hard-deleted."""
    ancient = time.time() * 1000 - TOMBSTONE_TTL_MS - 1_000  # > 30 days ago
    await db.user_maps.insert_one({
        "user_id": "u1", "map_id": "old_gone", "data": {}, "updated_at": ancient,
        "deleted_at": ancient, "created_at": ancient,
    })
    recent = time.time() * 1000 - 1_000
    await db.user_maps.insert_one({
        "user_id": "u1", "map_id": "recent_kept", "data": {}, "updated_at": recent,
        "deleted_at": recent, "created_at": recent,
    })
    purged = await purge_old_tombstones(db)
    assert purged == 1
    remaining = await db.user_maps.count_documents({})
    assert remaining == 1

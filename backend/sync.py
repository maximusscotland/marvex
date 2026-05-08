"""Cloud sync for maps — Pro-only, last-write-wins.

Data model (MongoDB collection `user_maps`):
    {
        _id:         ObjectId (NEVER returned to the client),
        user_id:     str,
        map_id:      str,                  # frontend-generated nanoid
        data:        dict,                 # the full map JSON (root, positions, style, …)
        updated_at:  float,                # ms-since-epoch; matches JS Date.now()
        deleted_at:  float | None,         # tombstone; ms; null when alive
        created_at:  float,
    }

Index: `(user_id, map_id)` unique.

Purge job: a tombstone is hard-deleted after 30 days. This is a background
task — if the job hasn't run in a while the tombstones just linger, which is
harmless; the `since` filter keeps pulls cheap.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body, Path
from pydantic import BaseModel, ConfigDict, Field

# 30-day tombstone retention before hard-delete (see purge_old_tombstones).
TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000


def _is_pro(user: Dict[str, Any]) -> bool:
    sub = (user or {}).get("subscription") or {}
    return sub.get("status") in ("active", "trialing")


def _require_pro(user: Dict[str, Any]) -> None:
    if not _is_pro(user):
        raise HTTPException(
            status_code=402,
            detail="Cloud sync is a Pro feature. Upgrade to sync maps across devices.",
        )


class CloudMap(BaseModel):
    """Shape returned to the client — never contains `_id`."""
    model_config = ConfigDict(extra="ignore")
    map_id: str
    data: Dict[str, Any]
    updated_at: float
    deleted_at: Optional[float] = None


class PullResponse(BaseModel):
    maps: List[CloudMap]
    tombstones: List[str]   # map_ids that are deleted; client should delete them locally too
    server_time: float


class PushMap(BaseModel):
    model_config = ConfigDict(extra="ignore")
    map_id: str = Field(..., min_length=1, max_length=200)
    data: Dict[str, Any]
    updated_at: float        # ms since epoch (JS Date.now())


class PushRequest(BaseModel):
    maps: List[PushMap] = []


class PushResult(BaseModel):
    map_id: str
    outcome: str             # "uploaded" | "kept-server-newer" | "error"
    server_updated_at: Optional[float] = None


class PushResponse(BaseModel):
    results: List[PushResult]
    server_time: float


def make_sync_router(db, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api/sync", tags=["sync"])

    # Ensure a unique index the first time the router is mounted. Motor
    # handles idempotent index creation gracefully.
    async def _ensure_indexes() -> None:
        try:
            await db.user_maps.create_index(
                [("user_id", 1), ("map_id", 1)], unique=True, name="user_map_id_idx"
            )
            await db.user_maps.create_index([("user_id", 1), ("updated_at", 1)], name="user_updated_idx")
        except Exception:
            # Index already exists or transient failure — non-fatal.
            pass

    # -------------------- GET /api/sync/maps --------------------
    @router.get("/maps", response_model=PullResponse)
    async def pull_maps(
        since: float = 0.0,
        user: Dict[str, Any] = Depends(current_user_dep),
    ):
        """Pull all maps updated (or deleted) since `since` (ms)."""
        _require_pro(user)
        await _ensure_indexes()

        # Alive maps updated since `since`.
        alive_cursor = db.user_maps.find(
            {
                "user_id": user["user_id"],
                "deleted_at": None,
                "updated_at": {"$gt": since},
            },
            {"_id": 0, "user_id": 0},
        )
        maps: List[CloudMap] = []
        async for doc in alive_cursor:
            maps.append(CloudMap(
                map_id=doc["map_id"],
                data=doc.get("data") or {},
                updated_at=float(doc.get("updated_at") or 0),
                deleted_at=None,
            ))

        # Tombstones — only need the ids so the client can nuke them locally.
        tomb_cursor = db.user_maps.find(
            {
                "user_id": user["user_id"],
                "deleted_at": {"$ne": None, "$gt": since},
            },
            {"_id": 0, "map_id": 1},
        )
        tombstones: List[str] = []
        async for doc in tomb_cursor:
            tombstones.append(doc["map_id"])

        return PullResponse(
            maps=maps,
            tombstones=tombstones,
            server_time=time.time() * 1000,
        )

    # -------------------- POST /api/sync/maps --------------------
    @router.post("/maps", response_model=PushResponse)
    async def push_maps(
        body: PushRequest = Body(...),
        user: Dict[str, Any] = Depends(current_user_dep),
    ):
        """Batch upsert. For each map the server compares `updated_at`
        and keeps the newer copy (ties go to the client for idempotency)."""
        _require_pro(user)
        await _ensure_indexes()

        now_ms = time.time() * 1000
        results: List[PushResult] = []

        for m in body.maps[:200]:  # hard cap per batch
            try:
                existing = await db.user_maps.find_one(
                    {"user_id": user["user_id"], "map_id": m.map_id},
                    {"_id": 0, "updated_at": 1},
                )
                if existing and float(existing.get("updated_at") or 0) > m.updated_at:
                    # Server copy is newer — don't overwrite.
                    results.append(PushResult(
                        map_id=m.map_id,
                        outcome="kept-server-newer",
                        server_updated_at=float(existing["updated_at"]),
                    ))
                    continue

                await db.user_maps.update_one(
                    {"user_id": user["user_id"], "map_id": m.map_id},
                    {
                        "$set": {
                            "data": m.data,
                            "updated_at": m.updated_at,
                            "deleted_at": None,
                        },
                        "$setOnInsert": {
                            "user_id": user["user_id"],
                            "map_id": m.map_id,
                            "created_at": now_ms,
                        },
                    },
                    upsert=True,
                )
                results.append(PushResult(
                    map_id=m.map_id,
                    outcome="uploaded",
                    server_updated_at=m.updated_at,
                ))
            except Exception as e:  # pragma: no cover — defensive
                results.append(PushResult(map_id=m.map_id, outcome="error"))
                # Surface the error in logs but don't abort the batch.
                import logging
                logging.getLogger(__name__).warning("sync push error %s: %s", m.map_id, e)

        return PushResponse(results=results, server_time=now_ms)

    # -------------------- DELETE /api/sync/maps/:id --------------------
    @router.delete("/maps/{map_id}")
    async def delete_map(
        map_id: str = Path(..., min_length=1, max_length=200),
        user: Dict[str, Any] = Depends(current_user_dep),
    ):
        """Soft-delete: set `deleted_at = now`. Kept for 30 days so
        un-delete is possible; purged by `purge_old_tombstones`."""
        _require_pro(user)
        now_ms = time.time() * 1000
        result = await db.user_maps.update_one(
            {"user_id": user["user_id"], "map_id": map_id},
            {"$set": {"deleted_at": now_ms, "updated_at": now_ms}},
        )
        return {"deleted": result.modified_count > 0, "server_time": now_ms}

    # -------------------- GET /api/sync/status --------------------
    @router.get("/status")
    async def status(user: Dict[str, Any] = Depends(current_user_dep)):
        """Quick health check + counts — also tells the client if sync is
        enabled for their plan. Non-Pro users get {enabled: false}."""
        enabled = _is_pro(user)
        if not enabled:
            return {"enabled": False, "map_count": 0, "server_time": time.time() * 1000}
        total = await db.user_maps.count_documents({
            "user_id": user["user_id"],
            "deleted_at": None,
        })
        return {"enabled": True, "map_count": total, "server_time": time.time() * 1000}

    return router


async def purge_old_tombstones(db) -> int:
    """Hard-delete tombstones older than 30 days. Call from a scheduled task
    or on server startup. Returns count of purged documents."""
    cutoff = time.time() * 1000 - TOMBSTONE_TTL_MS
    result = await db.user_maps.delete_many({
        "deleted_at": {"$ne": None, "$lt": cutoff},
    })
    return result.deleted_count

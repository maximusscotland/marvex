"""
Testimonials — admin-curated quotes that swap the placeholder personas on
the landing page once you have at least 3 real ones to ship.

Endpoints
---------
Public:
  GET    /api/testimonials                — list published, sorted by display_order

Admin (gated by ADMIN_EMAILS env var — comma-separated list of emails):
  GET    /api/admin/testimonials          — list ALL (incl. unpublished)
  POST   /api/admin/testimonials          — create
  PATCH  /api/admin/testimonials/{id}     — update (incl. toggle published)
  DELETE /api/admin/testimonials/{id}     — delete

Admin auth model
----------------
We deliberately don't add a roles table — overkill for a single-owner app.
Set `ADMIN_EMAILS=hello@yourdomain.com,you@gmail.com` in /app/backend/.env;
any authenticated user whose email appears in that list can curate.
Everyone else gets 403.

Schema
------
db.testimonials = {
  id: str (uuid),               # public-facing id
  quote: str,                   # the testimonial body
  name: str,                    # "Sarah Chen"
  role: str,                    # "PhD candidate"
  organization: str,            # "Stanford" (optional, may be empty)
  published: bool,              # public visibility flag
  display_order: int,           # smaller = earlier on the page
  created_at: datetime,
  updated_at: datetime,
}
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


def _admin_emails() -> set:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _is_admin(user: dict) -> bool:
    email = (user.get("email") or "").strip().lower()
    return bool(email) and email in _admin_emails()


class TestimonialCreate(BaseModel):
    quote: str = Field(..., min_length=4, max_length=600)
    name: str = Field(..., min_length=1, max_length=120)
    role: str = Field("", max_length=120)
    organization: str = Field("", max_length=120)
    published: bool = True
    display_order: int = 0


class TestimonialUpdate(BaseModel):
    quote: Optional[str] = Field(None, min_length=4, max_length=600)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    role: Optional[str] = Field(None, max_length=120)
    organization: Optional[str] = Field(None, max_length=120)
    published: Optional[bool] = None
    display_order: Optional[int] = None


def _serialize(doc: dict) -> dict:
    """Strip Mongo's _id and ISO-encode datetimes for JSON safety."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    for k in ("created_at", "updated_at"):
        v = out.get(k)
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


def make_testimonials_router(db: AsyncIOMotorDatabase, current_user_dep) -> APIRouter:
    router = APIRouter()

    # ---------- Public ----------
    @router.get("/api/testimonials")
    async def list_public():
        cursor = db.testimonials.find(
            {"published": True},
            {"_id": 0, "quote": 1, "name": 1, "role": 1, "organization": 1, "display_order": 1, "id": 1},
        ).sort([("display_order", 1), ("created_at", 1)])
        return {"testimonials": [doc async for doc in cursor]}

    # ---------- Admin ----------
    def _require_admin(user: dict = Depends(current_user_dep)) -> dict:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admins only")
        return user

    @router.get("/api/admin/testimonials")
    async def list_all(_user: dict = Depends(_require_admin)):
        cursor = db.testimonials.find({}, {"_id": 0}).sort(
            [("display_order", 1), ("created_at", 1)]
        )
        return {"testimonials": [_serialize(doc) async for doc in cursor]}

    @router.post("/api/admin/testimonials")
    async def create(payload: TestimonialCreate, _user: dict = Depends(_require_admin)):
        now = datetime.now(timezone.utc)
        doc = {
            "id": str(uuid.uuid4()),
            "quote": payload.quote.strip(),
            "name": payload.name.strip(),
            "role": payload.role.strip(),
            "organization": payload.organization.strip(),
            "published": payload.published,
            "display_order": payload.display_order,
            "created_at": now,
            "updated_at": now,
        }
        await db.testimonials.insert_one(doc)
        return _serialize(doc)

    @router.patch("/api/admin/testimonials/{tid}")
    async def update(tid: str, payload: TestimonialUpdate, _user: dict = Depends(_require_admin)):
        patch = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
        if not patch:
            raise HTTPException(status_code=400, detail="No fields to update")
        # Strip whitespace on string fields
        for k in ("quote", "name", "role", "organization"):
            if k in patch and isinstance(patch[k], str):
                patch[k] = patch[k].strip()
        patch["updated_at"] = datetime.now(timezone.utc)
        result = await db.testimonials.update_one({"id": tid}, {"$set": patch})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Testimonial not found")
        doc = await db.testimonials.find_one({"id": tid}, {"_id": 0})
        return _serialize(doc)

    @router.delete("/api/admin/testimonials/{tid}")
    async def delete(tid: str, _user: dict = Depends(_require_admin)):
        result = await db.testimonials.delete_one({"id": tid})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Testimonial not found")
        return {"ok": True}

    # Tiny self-check endpoint so the admin UI can show "you are an admin / not an admin"
    # without having to hit a guarded endpoint and parse 403s.
    @router.get("/api/admin/whoami")
    async def whoami(user: dict = Depends(current_user_dep)):
        return {
            "email": user.get("email"),
            "is_admin": _is_admin(user),
        }

    return router

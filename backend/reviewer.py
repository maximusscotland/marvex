"""
Reviewer / Early-Feedback form router.

Goal: replace the generic "email us for a free month" CTA with a structured
form that elicits the kind of actionable feedback we actually want — who
the user is, how they'd use Mind-Mapper Studio, what they'd compare it to, and
their honest first impression.

Storage: MongoDB collection `reviewer_applications`.  Owners read these
through `/api/admin/reviewer-applications`.  Approving a reviewer flips
their user record's `subscription` to a 30-day Pro grant.
"""
from __future__ import annotations
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field


def _admin_emails() -> set[str]:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin_email(email: str) -> bool:
    if not email:
        return False
    return email.strip().lower() in _admin_emails()


class ReviewerApplication(BaseModel):
    # --- Who you are ----------------------------------------------------
    name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    role: str = Field(..., min_length=1, max_length=80)            # e.g. "PhD student", "Indie writer"
    field: Optional[str] = Field(default=None, max_length=120)     # e.g. "Cognitive science"
    country: Optional[str] = Field(default=None, max_length=64)

    # --- How you'd use it ----------------------------------------------
    use_case: str = Field(..., min_length=10, max_length=600)      # 1-2 sentences
    typical_pdf_volume: str = Field(..., min_length=1, max_length=40)  # "<5/wk", "5-20/wk", etc.
    current_tools: Optional[str] = Field(default=None, max_length=300) # what you use today

    # --- Honest first impression ---------------------------------------
    first_impression: str = Field(..., min_length=10, max_length=800)
    biggest_friction: Optional[str] = Field(default=None, max_length=600)
    missing_feature: Optional[str] = Field(default=None, max_length=600)

    # --- Commitment ------------------------------------------------------
    can_share_screenshots: bool = False
    can_share_video: bool = False
    can_share_publicly: bool = False                  # OK to credit?
    weekly_hours: Optional[str] = Field(default=None, max_length=20)
    referral_source: Optional[str] = Field(default=None, max_length=120)

    # --- Optional consent freeform -------------------------------------
    notes: Optional[str] = Field(default=None, max_length=1200)


VOLUME_CHOICES = {"<5/week", "5-20/week", "20-50/week", "50+/week"}
HOURS_CHOICES = {"<1", "1-3", "3-5", "5+"}


def make_router(db, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api/reviewer", tags=["reviewer"])

    @router.post("/apply", status_code=201)
    async def apply(payload: ReviewerApplication) -> Dict[str, Any]:
        """Public endpoint — anyone can apply.  Lightly rate-limited via
        a unique-index on email so a single user can't spam."""
        if payload.typical_pdf_volume not in VOLUME_CHOICES:
            raise HTTPException(status_code=400, detail=f"typical_pdf_volume must be one of {sorted(VOLUME_CHOICES)}")
        if payload.weekly_hours and payload.weekly_hours not in HOURS_CHOICES:
            raise HTTPException(status_code=400, detail=f"weekly_hours must be one of {sorted(HOURS_CHOICES)}")
        now = datetime.now(timezone.utc)
        doc = payload.model_dump()
        doc["email"] = doc["email"].lower().strip()
        doc["status"] = "new"
        doc["created_at"] = now
        try:
            existing = await db.reviewer_applications.find_one(
                {"email": doc["email"]}, {"_id": 0, "status": 1, "created_at": 1}
            )
            if existing:
                # Allow re-application: replace the existing row but keep its
                # original created_at so the queue order doesn't shuffle.
                doc["created_at"] = existing.get("created_at") or now
                doc["status"] = existing.get("status") or "new"
                await db.reviewer_applications.replace_one(
                    {"email": doc["email"]}, doc, upsert=True
                )
            else:
                await db.reviewer_applications.insert_one(doc)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not save application: {e!s}") from e
        return {
            "ok": True,
            "message": "Thanks! We review applications weekly and will email approved reviewers their Pro access code.",
        }

    # ---- Admin -----------------------------------------------------------
    async def _require_admin(user) -> None:
        if not user or not is_admin_email(user.get("email") or ""):
            raise HTTPException(status_code=403, detail="Admin only")

    @router.get("/admin/applications")
    async def list_applications(
        status: Optional[str] = None,
        user=current_user_dep,
    ) -> List[Dict[str, Any]]:
        await _require_admin(user)
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        rows: List[Dict[str, Any]] = []
        async for r in db.reviewer_applications.find(query, {"_id": 0}).sort("created_at", -1).limit(500):
            if isinstance(r.get("created_at"), datetime):
                r["created_at"] = r["created_at"].isoformat()
            rows.append(r)
        return rows

    @router.post("/admin/applications/{email}/approve")
    async def approve(email: str, user=current_user_dep) -> Dict[str, Any]:
        """Approve = mark application 'approved' AND grant 30-day Pro.  We
        don't send the user a magic link; the email just needs to sign in
        with Google and they'll see Pro active.  An out-of-band email is
        sent by the admin manually."""
        await _require_admin(user)
        email = email.lower().strip()
        app_row = await db.reviewer_applications.find_one({"email": email}, {"_id": 0})
        if not app_row:
            raise HTTPException(status_code=404, detail="Application not found")
        end = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        await db.reviewer_applications.update_one(
            {"email": email},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc)}},
        )
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "subscription.status": "active",
                "subscription.plan": "reviewer-30d",
                "subscription.reviewer": True,
                "subscription.current_period_end": end,
            }},
            upsert=False,
        )
        return {"ok": True, "email": email, "expires": end}

    @router.post("/admin/applications/{email}/reject")
    async def reject(email: str, user=current_user_dep) -> Dict[str, Any]:
        await _require_admin(user)
        email = email.lower().strip()
        res = await db.reviewer_applications.update_one(
            {"email": email},
            {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc)}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"ok": True}

    return router

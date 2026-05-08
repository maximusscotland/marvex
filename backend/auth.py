"""
Auth + User module — Emergent-managed Google login + MongoDB session storage.
"""
import os
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, Cookie, Header, Depends
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

EMERGENT_AUTH_BASE = "https://demobackend.emergentagent.com/auth/v1/env"
SESSION_TTL_DAYS = 7
COOKIE_NAME = "session_token"

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

class SessionExchangeRequest(BaseModel):
    session_id: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    subscription_status: Optional[str] = "free"   # free | trialing | active | past_due | canceled
    subscription_plan: Optional[str] = ""         # monthly | annual
    current_period_end: Optional[str] = ""        # ISO string
    cancel_at_period_end: bool = False            # Stripe: user set "cancel at end of period"
    trial_end: Optional[str] = ""
    free_conversions_used: int = 0
    founder: bool = False                          # First 50 lifetime buyers
    founder_number: Optional[int] = None           # 1..50
    # One-off feature add-ons (e.g. premium_uk_law). Map of addon_key →
    # {active, purchased_at, session_id}. Empty dict for users who own
    # nothing extra. Frontend's useEntitlement() reads this directly.
    addons: dict = {}


def _ttl_aware(dt) -> datetime:
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _user_to_out(doc: dict) -> UserOut:
    sub = doc.get("subscription") or {}
    return UserOut(
        user_id=doc["user_id"],
        email=doc.get("email", ""),
        name=doc.get("name", ""),
        picture=doc.get("picture", ""),
        subscription_status=sub.get("status", "free"),
        subscription_plan=sub.get("plan", ""),
        current_period_end=(sub.get("current_period_end") or ""),
        cancel_at_period_end=bool(sub.get("cancel_at_period_end", False)),
        trial_end=(sub.get("trial_end") or ""),
        free_conversions_used=int(doc.get("free_conversions_used") or 0),
        founder=bool(sub.get("founder", False)),
        founder_number=sub.get("founder_number"),
        addons=(sub.get("addons") or {}),
    )


# Comma-separated allowlist of emails that should always have Pro access —
# useful for family/friends/team members the owner wants to gift unlimited
# usage to.  Bootstrap pool comes from FAMILY_EMAILS env var; runtime adds
# come from the `family_allowlist` Mongo collection (managed via the
# /admin/family UI).  We union both at lookup time.
def _family_emails_static() -> set[str]:
    raw = (os.environ.get("FAMILY_EMAILS") or "").strip()
    if not raw:
        return set()
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


async def _family_emails_dynamic(db) -> set[str]:
    out: set[str] = set()
    try:
        cur = db.family_allowlist.find({}, {"_id": 0, "email": 1})
        async for doc in cur:
            e = (doc.get("email") or "").strip().lower()
            if e:
                out.add(e)
    except Exception:
        # Collection may not exist yet — that's fine, just empty set.
        pass
    return out


async def is_family_email(db, email: str) -> bool:
    e = (email or "").strip().lower()
    if not e:
        return False
    if e in _family_emails_static():
        return True
    return e in (await _family_emails_dynamic(db))


# Sync helper kept for tests + places we don't want to await.  Reflects ONLY
# the env-var pool — admin-managed emails are loaded via the async helper.
def _is_family_email(email: str) -> bool:
    return (email or "").strip().lower() in _family_emails_static()


# Back-compat alias for tests that imported the old name.
def _family_emails() -> set[str]:
    return _family_emails_static()


def make_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/api/auth")

    async def current_user(
        request: Request,
        session_token_cookie: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
        authorization: Optional[str] = Header(default=None),
    ) -> dict:
        token = session_token_cookie
        if not token and authorization:
            if authorization.lower().startswith("bearer "):
                token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not sess:
            raise HTTPException(status_code=401, detail="Invalid session")
        if _ttl_aware(sess["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    @router.post("/process-session")
    async def process_session(payload: SessionExchangeRequest, response: Response):
        # Backend → Emergent Auth: get user identity from session_id
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{EMERGENT_AUTH_BASE}/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()
        email = (data.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Email missing from auth provider")

        # Find or create user
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        now = datetime.now(timezone.utc)
        # Family allowlist auto-promotion. We grant a 100-year "lifetime"-style
        # Pro grant on every login (idempotent — safe to apply repeatedly), so
        # the owner can add/remove family emails without manual DB surgery.
        # Permanent flag `subscription.family=True` lets us tell paying users
        # apart from gifted users in analytics.
        family_grant = None
        if await is_family_email(db, email):
            far_future = (now + timedelta(days=365 * 100)).isoformat()
            family_grant = {
                "subscription.status": "active",
                "subscription.plan": "lifetime",
                "subscription.family": True,
                "subscription.current_period_end": far_future,
            }
        if existing:
            user_id = existing["user_id"]
            updates = {
                "name": data.get("name") or existing.get("name"),
                "picture": data.get("picture") or existing.get("picture"),
                "last_login_at": now,
            }
            if family_grant:
                updates.update(family_grant)
            await db.users.update_one({"user_id": user_id}, {"$set": updates})
            user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            base_sub = {"status": "free", "plan": "", "current_period_end": "", "trial_end": ""}
            if family_grant:
                base_sub.update({
                    "status": "active",
                    "plan": "lifetime",
                    "family": True,
                    "current_period_end": (now + timedelta(days=365 * 100)).isoformat(),
                })
            user_doc = {
                "user_id": user_id,
                "email": email,
                "name": data.get("name") or email.split("@")[0],
                "picture": data.get("picture") or "",
                "subscription": base_sub,
                "stripe_customer_id": "",
                "free_conversions_used": 0,
                "created_at": now,
                "last_login_at": now,
            }
            await db.users.insert_one(user_doc.copy())

        # Persist session_token from Emergent Auth + cookie
        session_token = data.get("session_token") or uuid.uuid4().hex
        expires_at = now + timedelta(days=SESSION_TTL_DAYS)
        await db.user_sessions.update_one(
            {"session_token": session_token},
            {"$set": {
                "session_token": session_token,
                "user_id": user_id,
                "expires_at": expires_at,
                "created_at": now,
            }},
            upsert=True,
        )
        response.set_cookie(
            key=COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        )
        return _user_to_out(user_doc)

    @router.get("/me", response_model=UserOut)
    async def me(user: dict = Depends(current_user)):
        return _user_to_out(user)

    @router.post("/logout")
    async def logout(
        response: Response,
        session_token_cookie: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
    ):
        if session_token_cookie:
            await db.user_sessions.delete_one({"session_token": session_token_cookie})
        response.delete_cookie(COOKIE_NAME, path="/")
        return {"ok": True}

    # expose dependency for the rest of the app
    router.current_user = current_user  # type: ignore[attr-defined]
    return router

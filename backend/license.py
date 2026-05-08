"""
License verification — issues an HMAC-signed token the desktop binary can
cache locally and re-verify *offline* for up to 14 days.

Why a separate endpoint when /api/auth/me already exposes subscription
fields?  Three reasons:

1. Desktop offline grace.  When the user is on a plane / tube / train,
   /api/auth/me cannot be reached but the user still expects the app to
   open.  A signed License Token can be replayed from disk because the
   signature proves it came from us, and the embedded `expires_at` lets
   the client refuse stale tokens without phoning home.

2. Tamper resistance.  A hostile user could edit /api/auth/me's response
   in DevTools to flip themselves to "active".  That works for the web
   app (we don't gate hard there), but for the desktop binary we want a
   value the renderer process literally cannot forge.  HMAC-SHA256 with
   a server-only secret is the standard answer.

3. Future-proofing.  When we move to per-device entitlements (e.g. one
   lifetime licence covers up to 3 desktops), the verify endpoint is the
   natural place to track and revoke device IDs.

Token shape (Base64URL of `payload.signature`):
   payload = { user_id, tier, expires_at, founder, founder_number,
               issued_at, ttl_seconds }
   signature = HMAC_SHA256(LICENSE_SIGNING_KEY, payload_json)

The LICENSE_SIGNING_KEY env var is generated once at backend startup
into LICENSE_KEY_FILE so it survives restarts but rotates if the file is
deleted.  We deliberately don't reuse JWT_SECRET — separate concerns.
"""
import os
import json
import hmac
import hashlib
import base64
import secrets
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel


# Persisted between restarts so cached desktop tokens survive a redeploy.
# Generated once on first boot; rotate by deleting the file.
_KEY_FILE = Path(os.environ.get("LICENSE_KEY_FILE", str(Path(__file__).parent / ".license_key")))


def _get_signing_key() -> bytes:
    """Read or generate the HMAC signing secret. 32 cryptographically random
    bytes — same strength as a Stripe webhook secret. Persisted so that a
    desktop binary's cached token doesn't get invalidated by a backend
    restart."""
    if _KEY_FILE.exists():
        try:
            data = _KEY_FILE.read_bytes()
            if len(data) >= 32:
                return data
        except Exception:
            pass
    new_key = secrets.token_bytes(32)
    try:
        _KEY_FILE.write_bytes(new_key)
        os.chmod(_KEY_FILE, 0o600)
    except Exception:
        # Read-only filesystem? Fall back to ephemeral key. Tokens won't
        # survive restarts but everything else still works.
        pass
    return new_key


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _sign(payload_json: str) -> str:
    sig = hmac.new(_get_signing_key(), payload_json.encode("utf-8"), hashlib.sha256).digest()
    return _b64url(sig)


# Token TTL is 24 h (re-verify on every launch when online).  The 14-day
# offline grace is enforced client-side by comparing `issued_at + 14d`.
TOKEN_TTL_SECONDS = 24 * 3600
DESKTOP_OFFLINE_GRACE_DAYS = 14


def _is_active(sub: dict) -> bool:
    """Subscription is active if status is one of the live values AND, for
    non-lifetime plans, current_period_end is in the future."""
    if not sub:
        return False
    status = (sub.get("status") or "").lower()
    if status not in ("active", "trialing"):
        return False
    if sub.get("lifetime") or (sub.get("plan") or "").lower() == "lifetime":
        return True
    cpe = sub.get("current_period_end")
    if not cpe:
        return False
    try:
        end = datetime.fromisoformat(cpe.replace("Z", "+00:00") if isinstance(cpe, str) else cpe.isoformat())
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        return end > datetime.now(timezone.utc)
    except Exception:
        return False


class LicenseToken(BaseModel):
    token: str
    user_id: str
    tier: str            # 'lifetime' | 'annual' | 'monthly' | 'free'
    active: bool         # True if the user can use Pro features RIGHT NOW
    expires_at: str      # ISO; "" for lifetime / free
    founder: bool
    founder_number: Optional[int] = None
    issued_at: str
    ttl_seconds: int
    offline_grace_days: int


def make_router(db: AsyncIOMotorDatabase, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api/license")

    @router.get("/verify", response_model=LicenseToken)
    async def verify(user: dict = Depends(current_user_dep)):
        """Issue a signed license token for the authenticated user.

        Always returns 200 — the `active` field is the single source of
        truth.  We don't 401 expired subscribers because the desktop
        binary still wants the signed token (it tells the local UI to
        switch to read-only mode and surface the renew wall, instead of
        guessing from a network error).
        """
        u = await db.users.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0, "user_id": 1, "subscription": 1},
        )
        if not u:
            raise HTTPException(status_code=404, detail="User not found")

        sub = u.get("subscription") or {}
        tier = (sub.get("plan") or "free").lower() or "free"
        active = _is_active(sub)
        expires_at = sub.get("current_period_end") or ""
        if isinstance(expires_at, datetime):
            expires_at = expires_at.isoformat()
        if (sub.get("lifetime") or tier == "lifetime") and active:
            expires_at = ""  # lifetime never expires

        now = datetime.now(timezone.utc)
        payload = {
            "user_id": u["user_id"],
            "tier": tier,
            "active": active,
            "expires_at": expires_at,
            "founder": bool(sub.get("founder", False)),
            "founder_number": sub.get("founder_number"),
            "issued_at": now.isoformat(),
            "ttl_seconds": TOKEN_TTL_SECONDS,
            "offline_grace_days": DESKTOP_OFFLINE_GRACE_DAYS,
        }
        # Canonical JSON for stable signatures across Python builds.
        payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        token = f"{_b64url(payload_json.encode('utf-8'))}.{_sign(payload_json)}"

        return LicenseToken(token=token, **payload)

    return router

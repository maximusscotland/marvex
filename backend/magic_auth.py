"""
Magic-link sign-in (passwordless auth) — alternative to Google OAuth.

Two endpoints:
  * POST /api/auth/magic/request {email}
        Always returns 200 (no enumeration). Rate-limit: 3/hour/email.
        Sends a one-click sign-in link via the existing email_sender
        (Resend → SMTP fallback chain) when the email looks valid.

  * GET  /api/auth/magic?token=...&next=/library
        Validates the single-use token, finds-or-creates the user,
        mints a session_token in `user_sessions` (same shape Emergent
        OAuth uses), sets the SAME `session_token` httpOnly cookie,
        and 302s to `next` (default /library). Token is burned on
        first use.

Storage:
  db.magic_tokens
      { token: str (URL-safe ~64 chars),
        email: str (lowercase),
        next: str (sanitised relative URL),
        expires_at: datetime,    # TTL index, 30-min lifetime
        used_at: datetime|None,  # set when consumed; double-use => 401
        ip_hint: str,
        created_at: datetime }

Security choices:
  * `secrets.token_urlsafe(48)` → ~64 chars of entropy; far above brute-force.
  * Single-use enforced atomically via `find_one_and_update` (used_at None → now).
  * `next` redirect target is sanitised to relative paths only (open-redirect prevention).
  * Anti-enumeration: request endpoint never reveals whether the email exists.
  * Rate limit shadow-ban: 3 requests/email/hour returns 200 silently (no email sent).
  * Token never appears in JSON responses, only in the email body.

This module deliberately reuses the same `user_sessions` collection +
`session_token` cookie that the Google OAuth path uses, so a magic-link
login lands the user in exactly the same authenticated state — no
duplicate session machinery, no UX divergence.
"""
from __future__ import annotations

import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("backend.magic_auth")

MAGIC_TTL_MIN = 30
COOKIE_NAME = "session_token"        # MUST match auth.COOKIE_NAME
SESSION_TTL_DAYS = 7                 # MUST match auth.SESSION_TTL_DAYS

# Match auth.py's username/email rules: trim + lowercase.
def _norm_email(e: str) -> str:
    return (e or "").strip().lower()


def _safe_next(next_url: str) -> str:
    """Reject anything that isn't a same-origin relative path. Stops a
    crafted `next=https://evil.com` from turning the magic link into an
    open redirect."""
    if not next_url:
        return "/library"
    if not next_url.startswith("/"):
        return "/library"
    if next_url.startswith("//"):
        return "/library"
    return next_url[:200]  # cap length defensively


class MagicRequest(BaseModel):
    email: EmailStr
    next: Optional[str] = Field(default="/library", max_length=200)


def _build_email(link: str) -> tuple[str, str, str]:
    subject = "Your Marvex sign-in link"
    text = (
        f"Tap the link below to sign in to Marvex Studio:\n\n"
        f"{link}\n\n"
        f"This link is good for {MAGIC_TTL_MIN} minutes and can only be used once.\n"
        f"If you didn't request this, ignore the email — nothing was changed."
    )
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#03040a;color:#cfdaf3;padding:24px;max-width:520px;margin:0 auto;">
      <div style="border:1px solid rgba(0,240,255,0.18);border-radius:14px;padding:26px;background:linear-gradient(180deg,rgba(0,240,255,0.04),rgba(122,59,255,0.04));">
        <div style="text-transform:uppercase;letter-spacing:0.22em;font-size:11px;color:#5eead4;margin-bottom:14px;">Marvex Studio · sign-in</div>
        <h1 style="font-size:22px;color:#fff;margin:0 0 10px;line-height:1.25;">Tap to sign in</h1>
        <p style="color:#a4b4d8;font-size:14px;line-height:1.55;margin:0 0 22px;">
          One-click sign-in for your Marvex account. The link works once and expires in {MAGIC_TTL_MIN} minutes.
        </p>
        <a href="{link}" style="display:inline-block;background:linear-gradient(135deg,#00f0ff,#7a3bff);color:#03131e;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:14px;">
          Sign in to Marvex →
        </a>
        <p style="margin-top:24px;color:#566187;font-size:11px;line-height:1.6;">
          Didn&apos;t request this? You can ignore this email — nothing was changed.
          Only someone who can read this inbox can complete the sign-in.
        </p>
      </div>
    </div>
    """
    return subject, html, text


def make_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/api/auth/magic", tags=["auth-magic"])

    @router.post("/request")
    async def request_link(payload: MagicRequest, request: Request) -> dict:
        email = _norm_email(payload.email)
        next_url = _safe_next(payload.next or "/library")
        now = datetime.now(timezone.utc)

        # Anti-enumeration + abuse rate-limit: 3 magic-link requests per
        # email per hour. Past the limit, silently no-op (still 200).
        cutoff = now - timedelta(hours=1)
        recent = await db.magic_tokens.count_documents(
            {"email": email, "created_at": {"$gte": cutoff}},
        )
        if recent >= 3:
            logger.info("magic-link rate-limit hit for %s (silenced)", email)
            return {"ok": True}

        token = secrets.token_urlsafe(48)
        await db.magic_tokens.insert_one({
            "token": token,
            "email": email,
            "next": next_url,
            "expires_at": now + timedelta(minutes=MAGIC_TTL_MIN),
            "used_at": None,
            "ip_hint": (
                request.headers.get("x-forwarded-for")
                or (request.client.host if request.client else "")
            )[:60],
            "created_at": now,
        })

        # Build the absolute link. Always uses the *production* host
        # because magic-link emails should never lead users to a preview
        # URL even if a request happened to come from there.
        host = (os.environ.get("PUBLIC_SITE_URL") or "https://marvex.app").rstrip("/")
        link = f"{host}/auth/magic?token={token}"

        try:
            from email_sender import send_email
            subject, html, text = _build_email(link)
            await send_email(to=email, subject=subject, html=html, text=text)
        except Exception:
            logger.exception("magic-link email send failed")
        return {"ok": True}

    @router.get("")
    async def consume(token: str, request: Request, response: Response):
        # Burn the token atomically: only the first concurrent caller
        # gets a non-None document back; all others see used_at != None
        # and bail. Guards against link-replay and racing tabs.
        now = datetime.now(timezone.utc)
        doc = await db.magic_tokens.find_one_and_update(
            {"token": token, "used_at": None, "expires_at": {"$gt": now}},
            {"$set": {"used_at": now}},
            return_document=False,  # we don't need the post-update copy
        )
        if not doc:
            # Either invalid, expired, or already used. Don't tell the
            # caller which — same opaque error.
            raise HTTPException(status_code=401, detail="Invalid or expired sign-in link")

        email = _norm_email(doc.get("email") or "")
        next_url = _safe_next(doc.get("next") or "/library")
        if not email:
            raise HTTPException(status_code=400, detail="Token has no email")

        # Find-or-create the user. Mirrors the shape used by auth.py
        # process-session so /api/auth/me sees the same fields.
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            user = {
                "user_id": user_id,
                "email": email,
                "name": email.split("@")[0],
                "picture": "",
                "subscription": {"status": "free", "plan": "", "current_period_end": "", "trial_end": ""},
                "stripe_customer_id": "",
                "free_conversions_used": 0,
                "created_at": now,
                "last_login_at": now,
                "auth_method": "magic_link",
            }
            await db.users.insert_one(user.copy())
        else:
            await db.users.update_one(
                {"email": email},
                {"$set": {"last_login_at": now}},
            )

        # Mint a session that exactly matches the Emergent OAuth shape so
        # both auth flows interoperate (cookie name, TTL, fields).
        session_token = uuid.uuid4().hex
        await db.user_sessions.insert_one({
            "session_token": session_token,
            "user_id": user["user_id"],
            "expires_at": now + timedelta(days=SESSION_TTL_DAYS),
            "created_at": now,
            "auth_method": "magic_link",
        })

        # Set cookie + redirect. We can't return a regular RedirectResponse
        # because we need to attach the cookie — use one with `set_cookie`.
        redirect = RedirectResponse(url=next_url, status_code=302)
        redirect.set_cookie(
            key=COOKIE_NAME,
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        )
        return redirect

    return router


async def issue_magic_link_for_email(db: AsyncIOMotorDatabase, email: str, next_url: str = "/library") -> str:
    """
    Helper used by the Stripe guest-checkout webhook. Creates a magic
    token for `email` and returns the absolute sign-in URL — caller is
    responsible for putting it in an email body. Bypasses the rate
    limit because this is a system-initiated link tied to a successful
    payment, not a user-initiated request.
    """
    email = _norm_email(email)
    if not email:
        raise ValueError("email is required")
    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(48)
    await db.magic_tokens.insert_one({
        "token": token,
        "email": email,
        "next": _safe_next(next_url),
        "expires_at": now + timedelta(minutes=MAGIC_TTL_MIN),
        "used_at": None,
        "ip_hint": "system:stripe-webhook",
        "created_at": now,
    })
    host = (os.environ.get("PUBLIC_SITE_URL") or "https://marvex.app").rstrip("/")
    return f"{host}/auth/magic?token={token}"


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Idempotent — safe to call on every backend boot."""
    try:
        await db.magic_tokens.create_index("token", unique=True)
        await db.magic_tokens.create_index("email")
        # TTL index — Mongo deletes expired tokens automatically.
        await db.magic_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        logger.exception("magic_tokens index creation failed (non-fatal)")

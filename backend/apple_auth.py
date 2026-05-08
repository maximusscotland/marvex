"""
Sign in with Apple — web flow.

Adds a third sign-in method alongside Google OAuth and the magic-link.
The implementation deliberately mirrors `magic_auth.py`'s session shape
so a user authenticated via Apple lands in *exactly* the same state as
one authenticated via Google or email — same `session_token` cookie,
same `user_sessions` document, same `current_user` dependency.

Flow:
  1. /api/auth/apple/start
        Generates a CSRF state nonce, stores it in `apple_states` (TTL
        10 min), 302-redirects the browser to Apple's authorize URL with
        `response_mode=form_post` so Apple posts the code back to us
        rather than putting it in a fragment the SPA can't read.

  2. /api/auth/apple/callback (POST, form-encoded — Apple's choice, not ours)
        Validates the state, exchanges the code for tokens at
        appleid.apple.com/auth/token (using a freshly-signed ES256
        client_secret JWT), verifies the id_token signature against
        Apple's JWKS, finds-or-creates the user, mints a session, sets
        the cookie, and 302s to /library (or `next` if state carried one).

Required env vars — see /app/backend/.env:
  APPLE_TEAM_ID         10 chars from Apple Developer → Membership.
  APPLE_KEY_ID          10 chars from the .p8 key created in Apple Dev portal.
  APPLE_SERVICES_ID     reverse-domain string (e.g. app.marvex.signin.webauth)
  APPLE_PRIVATE_KEY     full PEM contents of the .p8 file. Wrap in quotes
                        if your env loader handles newlines literally; we
                        also accept `\\n`-escaped form for cloud envs that
                        munge multiline secrets.
  APPLE_REDIRECT_URI    must EXACTLY match the Return URL registered in
                        the Services ID config in the Apple portal.
                        Default: https://marvex.app/api/auth/apple/callback

If APPLE_PRIVATE_KEY (or any of the four secrets) is empty, this module
goes silent — `is_enabled()` returns False, the frontend hides the
button, and the start endpoint 503s with a clear message. Zero risk of
half-configured deploys.
"""
from __future__ import annotations

import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import APIRouter, Form, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("backend.apple_auth")

APPLE_AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize"
APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"

# Match magic_auth / auth.py: same cookie name + 7-day session TTL.
COOKIE_NAME = "session_token"
SESSION_TTL_DAYS = 7
STATE_TTL_MIN = 10
CLIENT_SECRET_TTL_SEC = 86400 * 30 * 6 - 60  # ~6 months minus 1 minute (Apple's max)


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _private_key() -> str:
    """Read the .p8 contents from env. Cloud platforms often store
    multiline secrets as one line with literal `\\n` sequences — we
    transparently un-escape that so the JWT library sees real newlines."""
    raw = os.environ.get("APPLE_PRIVATE_KEY") or ""
    raw = raw.strip()
    if "\\n" in raw and "\n" not in raw:
        raw = raw.replace("\\n", "\n")
    return raw


def is_enabled() -> bool:
    return all([
        _env("APPLE_TEAM_ID"),
        _env("APPLE_KEY_ID"),
        _env("APPLE_SERVICES_ID"),
        _private_key(),
    ])


def _redirect_uri() -> str:
    """The redirect URI we send to Apple. MUST match the value registered
    in the Services ID config exactly — protocol, host, path, no slash."""
    return _env("APPLE_REDIRECT_URI") or "https://marvex.app/api/auth/apple/callback"


def _site_origin() -> str:
    """Used to build the *final* user-facing redirect after auth."""
    return (os.environ.get("PUBLIC_SITE_URL") or "https://marvex.app").rstrip("/")


def _generate_client_secret() -> str:
    """
    Sign a fresh client_secret JWT with our .p8 key. Apple requires a
    new JWT for every token exchange; we don't cache. Validity capped
    at ~6 months to satisfy Apple's max but in practice each one lives
    only seconds (used immediately, then discarded).
    """
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "iss": _env("APPLE_TEAM_ID"),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=CLIENT_SECRET_TTL_SEC)).timestamp()),
            "aud": "https://appleid.apple.com",
            "sub": _env("APPLE_SERVICES_ID"),
        },
        _private_key(),
        algorithm="ES256",
        headers={"kid": _env("APPLE_KEY_ID")},
    )


def _safe_next(next_url: str) -> str:
    if not next_url or not next_url.startswith("/") or next_url.startswith("//"):
        return "/library"
    return next_url[:200]


# ----------------------------------------------------------------------
# JWKS cache — Apple rotates keys rarely; 24-hour cache is comfortable.
# ----------------------------------------------------------------------
_jwks_cache: Dict[str, Any] = {"keys": [], "fetched_at": None}


async def _get_apple_jwks() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    fetched = _jwks_cache.get("fetched_at")
    if fetched and (now - fetched).total_seconds() < 86400 and _jwks_cache.get("keys"):
        return _jwks_cache
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(APPLE_JWKS_URL)
        r.raise_for_status()
        data = r.json()
    _jwks_cache["keys"] = data.get("keys", [])
    _jwks_cache["fetched_at"] = now
    return _jwks_cache


def _verify_id_token(id_token: str) -> Dict[str, Any]:
    # Find the right key by `kid` and verify with audience pinned to our Services ID.
    headers = jwt.get_unverified_header(id_token)
    kid = headers.get("kid")
    matching = next((k for k in _jwks_cache.get("keys", []) if k.get("kid") == kid), None)
    if not matching:
        raise HTTPException(status_code=401, detail="Apple key not found for token")
    public_key = jwt.PyJWK(matching).key
    return jwt.decode(
        id_token,
        public_key,
        algorithms=["RS256"],
        audience=_env("APPLE_SERVICES_ID"),
        issuer="https://appleid.apple.com",
    )


def make_router(db: AsyncIOMotorDatabase) -> APIRouter:
    router = APIRouter(prefix="/api/auth/apple", tags=["auth-apple"])

    @router.get("/start")
    async def start(request: Request, next: str = "/library"):
        if not is_enabled():
            raise HTTPException(status_code=503, detail="Apple Sign In is not configured")
        state = secrets.token_urlsafe(32)
        await db.apple_states.insert_one({
            "state": state,
            "next": _safe_next(next),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=STATE_TTL_MIN),
            "created_at": datetime.now(timezone.utc),
        })
        params = {
            "client_id": _env("APPLE_SERVICES_ID"),
            "redirect_uri": _redirect_uri(),
            "response_type": "code",
            "response_mode": "form_post",   # Required for `email` + `name` scopes.
            "scope": "name email",
            "state": state,
        }
        from urllib.parse import urlencode
        return RedirectResponse(url=f"{APPLE_AUTHORIZE_URL}?{urlencode(params)}", status_code=302)

    @router.post("/callback")
    async def callback(
        request: Request,
        response: Response,
        code: Optional[str] = Form(None),
        state: Optional[str] = Form(None),
        user: Optional[str] = Form(None),  # Apple sends user JSON only on first auth
        error: Optional[str] = Form(None),
    ):
        if not is_enabled():
            raise HTTPException(status_code=503, detail="Apple Sign In is not configured")
        if error:
            # User cancelled — bounce back to /signin with a soft message.
            return RedirectResponse(url=f"{_site_origin()}/signin?apple_error={error}", status_code=302)
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state")

        # Verify + burn the state token atomically. Used == cannot be replayed.
        now = datetime.now(timezone.utc)
        state_doc = await db.apple_states.find_one_and_delete(
            {"state": state, "expires_at": {"$gt": now}},
        )
        if not state_doc:
            raise HTTPException(status_code=400, detail="Invalid or expired state")
        next_url = _safe_next(state_doc.get("next") or "/library")

        # Token exchange.
        try:
            client_secret = _generate_client_secret()
        except Exception as e:  # noqa: BLE001
            logger.exception("apple: client_secret signing failed")
            raise HTTPException(status_code=500, detail=f"Apple key error: {e!s}") from e

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                tk = await client.post(
                    APPLE_TOKEN_URL,
                    data={
                        "client_id": _env("APPLE_SERVICES_ID"),
                        "client_secret": client_secret,
                        "code": code,
                        "grant_type": "authorization_code",
                        "redirect_uri": _redirect_uri(),
                    },
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
            if tk.status_code != 200:
                logger.warning("apple: token exchange %s — %s", tk.status_code, tk.text)
                raise HTTPException(status_code=401, detail="Apple token exchange failed")
            tokens = tk.json()
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            logger.exception("apple: token exchange network error")
            raise HTTPException(status_code=502, detail=f"Apple unreachable: {e!s}") from e

        id_token = tokens.get("id_token")
        if not id_token:
            raise HTTPException(status_code=401, detail="No id_token from Apple")

        # Verify signature against fresh JWKS.
        try:
            await _get_apple_jwks()
            claims = _verify_id_token(id_token)
        except HTTPException:
            raise
        except jwt.InvalidTokenError as e:
            logger.warning("apple: invalid id_token: %s", e)
            raise HTTPException(status_code=401, detail="Invalid Apple id_token") from e

        apple_sub = claims.get("sub")
        email = (claims.get("email") or "").strip().lower()
        is_private_email = bool(claims.get("is_private_email", False))
        if not apple_sub:
            raise HTTPException(status_code=400, detail="Apple token missing sub")

        # Apple sends the user's name only on the very first sign-up. Capture it now;
        # we never get it again. JSON is form-encoded — parse defensively.
        first_name = ""
        if user:
            try:
                u = json.loads(user)
                name = u.get("name") or {}
                first_name = (name.get("firstName") or "").strip()
                last_name = (name.get("lastName") or "").strip()
                first_name = (first_name + (" " + last_name if last_name else "")).strip()
            except Exception:  # noqa: BLE001
                pass

        # Find or create user. Match priority:
        #   1. Existing user with apple_sub already linked (canonical).
        #   2. Existing user with the same email (only if NOT a private relay).
        #   3. Brand-new user.
        existing = await db.users.find_one({"apple_sub": apple_sub}, {"_id": 0})
        if not existing and email and not is_private_email:
            existing = await db.users.find_one({"email": email}, {"_id": 0})

        if existing:
            user_id = existing["user_id"]
            update = {"last_login_at": now, "apple_sub": apple_sub}
            if email and not existing.get("email"):
                update["email"] = email
            await db.users.update_one({"user_id": user_id}, {"$set": update})
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id": user_id,
                "email": email or f"{user_id}@privaterelay.local",
                "name": first_name or (email.split("@")[0] if email else "Apple user"),
                "picture": "",
                "subscription": {"status": "free", "plan": "", "current_period_end": "", "trial_end": ""},
                "stripe_customer_id": "",
                "free_conversions_used": 0,
                "apple_sub": apple_sub,
                "is_private_email": is_private_email,
                "created_at": now,
                "last_login_at": now,
                "auth_method": "apple",
            })

        # Mint a session matching the existing OAuth shape exactly.
        session_token = uuid.uuid4().hex
        await db.user_sessions.insert_one({
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": now + timedelta(days=SESSION_TTL_DAYS),
            "created_at": now,
            "auth_method": "apple",
        })

        redirect = RedirectResponse(url=f"{_site_origin()}{next_url}", status_code=302)
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

    @router.get("/status")
    async def status() -> dict:
        """Public flag the frontend uses to decide whether to render the
        Apple button. Hides the button automatically until env vars land."""
        return {"enabled": is_enabled()}

    return router


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    try:
        await db.apple_states.create_index("state", unique=True)
        await db.apple_states.create_index("expires_at", expireAfterSeconds=0)
        await db.users.create_index("apple_sub", sparse=True)
    except Exception:
        logger.exception("apple_auth index creation failed (non-fatal)")

"""
Press / reviewer auto-acceptance router.

A lighter-weight, fully-automated alternative to `reviewer.py`. Where
`reviewer.py` requires admin manual approval, this flow:

  1. Public POST /api/press/apply — anyone with a publication / blog /
     podcast / YouTube / newsletter URL can apply.
  2. Backend validates lightly (email format, link presence, anti-spam)
     and IMMEDIATELY issues a unique single-use code `PRESS-XXXXXXXX`
     stored in `db.press_codes`.
  3. The code is emailed via Resend with a one-click redeem link.
  4. The redeem flow piggybacks on /api/access/validate + /redeem so
     the user's path is identical to a friend-shared code.

The trade-off: no admin gate, so we accept that 1-2% of applications
will be opportunistic ("free pro for 14 days, why not"). The signal
quality from the link field + the email-roundtrip step filters out
most pure-spam attempts.

Why 14 days (not 30 like the reviewer flow): reviewers writing a
serious piece typically finish within a week; 14 days gives them
runway plus a buffer without converting a free trial into a freebie.

Owner controls (env-toggleable):
  PRESS_AUTO_APPROVE      — "1" / "0". Default "1". Flip to 0 to
                            require manual approval (then approve via
                            existing /admin/ops dashboard).
  PRESS_DAYS              — int days of Pro granted. Default 14.
  PRESS_RATE_LIMIT_HOURS  — Same email can re-apply after N hours.
                            Default 24 (per-day cap to stop floods).

Storage shape (db.press_codes):
  {
    code: "PRESS-XXXXXXXX",      # unique; uppercase A-Z0-9
    email: "...@...",            # lowercased; one open code per email
    name, publication, role, why, link,
    days: 14,
    status: "issued"|"redeemed"|"expired"|"revoked",
    issued_at, expires_at, redeemed_at?, redeemed_by_user?,
    auto_approved: bool,
  }
"""
from __future__ import annotations

import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger("backend.press")

CODE_PREFIX = "PRESS-"
# 8-char alphanumeric body → ~2.8 trillion combinations. Hard to brute-force.
CODE_BODY_LEN = 8
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no I/L/O/0/1 (ambiguous)
URL_RE = re.compile(r"^https?://[\w.\-]+(:\d+)?(/[^\s]*)?$", re.I)


def _days() -> int:
    try:
        return max(1, min(90, int(os.environ.get("PRESS_DAYS", "14"))))
    except ValueError:
        return 14


def _auto_approve() -> bool:
    return os.environ.get("PRESS_AUTO_APPROVE", "1").strip() in {"1", "true", "yes", "on"}


def _rate_limit_hours() -> int:
    try:
        return max(0, int(os.environ.get("PRESS_RATE_LIMIT_HOURS", "24")))
    except ValueError:
        return 24


def _generate_code() -> str:
    body = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_BODY_LEN))
    return f"{CODE_PREFIX}{body}"


def _public_base_url() -> str:
    """Used to build the redeem link in the email body. Falls back to the
    production domain if the env var isn't set."""
    raw = (os.environ.get("PUBLIC_APP_URL") or "https://marvex.app").rstrip("/")
    return raw


# ---------- Pydantic models ----------
class PressApply(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    publication: str = Field(..., min_length=1, max_length=120)
    role: str = Field(..., min_length=1, max_length=60)            # "Journalist", "YouTuber", "Podcaster"
    link: str = Field(..., min_length=4, max_length=300)            # bio / channel / publication URL
    why: str = Field(..., min_length=10, max_length=600)


class PressApplyResponse(BaseModel):
    ok: bool
    message: str
    auto_approved: bool
    # Only included when auto-approved AND the user wants to copy-paste —
    # the email is the canonical channel.
    code: Optional[str] = None


class PressLookupResponse(BaseModel):
    valid: bool
    tier: Optional[str] = None
    label: Optional[str] = None
    email_hint: Optional[str] = None  # e.g. "j***@example.com"
    expired: bool = False
    used: bool = False


# ---------- Testimonial / press-quote schema ----------
# Shape: db.press_testimonials = [
#   {
#     id: "t-<8charhex>",
#     author_name: "Jane Reviewer",
#     author_role: "Senior Editor",            # optional
#     publication: "The Verge",
#     publication_logo: "https://…/verge.svg", # optional, square ideally
#     quote: "Marvex is the first…",           # ≤320 chars, plain text
#     article_url: "https://theverge.com/…",   # required — proof link
#     featured: true,                           # bumps to top of carousel
#     verified: true,                           # admin-confirmed the link
#     status: "published" | "draft" | "hidden",
#     created_at: ISO,
#     redeemed_code: "PRESS-XXXX",             # cross-link if applicable
#   }
# ]
# Public clients ONLY see status==published, and we hand back a tight
# projection so admin metadata never leaks.
class TestimonialPublic(BaseModel):
    id: str
    author_name: str
    author_role: Optional[str] = None
    publication: str
    publication_logo: Optional[str] = None
    quote: str
    article_url: str
    featured: bool = False


class TestimonialCreate(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=80)
    author_role: Optional[str] = Field(default=None, max_length=80)
    publication: str = Field(..., min_length=1, max_length=120)
    publication_logo: Optional[str] = Field(default=None, max_length=500)
    quote: str = Field(..., min_length=10, max_length=320)
    article_url: str = Field(..., min_length=4, max_length=500)
    featured: bool = False
    verified: bool = True
    redeemed_code: Optional[str] = Field(default=None, max_length=24)


class TestimonialUpdate(BaseModel):
    # All optional — admin patches whichever fields they want.
    author_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    author_role: Optional[str] = Field(default=None, max_length=80)
    publication: Optional[str] = Field(default=None, min_length=1, max_length=120)
    publication_logo: Optional[str] = Field(default=None, max_length=500)
    quote: Optional[str] = Field(default=None, min_length=10, max_length=320)
    article_url: Optional[str] = Field(default=None, min_length=4, max_length=500)
    featured: Optional[bool] = None
    verified: Optional[bool] = None
    status: Optional[str] = Field(default=None, pattern=r"^(published|draft|hidden)$")


# ---------- Helpers ----------
def _email_hint(email: str) -> str:
    if not email or "@" not in email:
        return ""
    user, host = email.split("@", 1)
    if len(user) <= 2:
        masked = user[0] + "*"
    else:
        masked = user[0] + "*" * (len(user) - 2) + user[-1]
    return f"{masked}@{host}"


def _is_past(dt: Optional[datetime], now: datetime) -> bool:
    """MongoDB strips tzinfo from BSON datetimes, so we normalise both sides
    to naive UTC before comparing — safer than tz-aware vs naive arithmetic."""
    if not isinstance(dt, datetime):
        return False
    a = dt.replace(tzinfo=None) if dt.tzinfo else dt
    b = now.replace(tzinfo=None) if now.tzinfo else now
    return a < b


async def _build_redeem_email(code: str, name: str, days: int) -> tuple[str, str]:
    base = _public_base_url()
    redeem_url = f"{base}/redeem?code={code}"
    subject = f"Your Marvex Studio press access — {days} days of Pro"
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#03040a;color:#cfdaf3;padding:32px;max-width:560px;margin:0 auto;">
      <div style="border:1px solid rgba(0,240,255,0.18);border-radius:16px;padding:28px;background:linear-gradient(180deg,rgba(0,240,255,0.04),rgba(122,59,255,0.04));">
        <div style="text-transform:uppercase;letter-spacing:0.22em;font-size:11px;color:#00f0ff;margin-bottom:14px;">Marvex Studio · Press</div>
        <h1 style="font-size:28px;color:#fff;margin:0 0 14px;line-height:1.15;">Hi {name},<br/>welcome aboard.</h1>
        <p style="font-size:15px;line-height:1.6;color:#cfdaf3;">
          Thanks for the interest. Here's your single-use access code — it unlocks the full Marvex Studio Pro tier for <strong>{days} days</strong>, no card, no commitment.
        </p>
        <div style="margin:24px 0;padding:18px;border-radius:12px;background:#0a1428;border:1px dashed rgba(0,240,255,0.4);text-align:center;">
          <div style="font-family:'JetBrains Mono',Consolas,monospace;font-size:22px;letter-spacing:0.18em;color:#00f0ff;">{code}</div>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="{redeem_url}" style="display:inline-block;padding:12px 28px;border-radius:999px;background:linear-gradient(90deg,#00f0ff,#7a3bff);color:#03040a;font-weight:700;text-decoration:none;font-size:14px;">Redeem now</a>
        </div>
        <p style="font-size:13px;line-height:1.6;color:#7a87ad;">
          Sign in with Google when you click Redeem; we apply the upgrade to your account automatically. The code is single-use and tied to <strong>this email</strong>.
        </p>
        <p style="font-size:13px;line-height:1.6;color:#7a87ad;margin-top:18px;">
          When you publish your piece, drop us a link at <a href="mailto:press@marvex.app" style="color:#00f0ff;">press@marvex.app</a> — we'll share it with our network.
        </p>
        <hr style="border:0;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;"/>
        <p style="font-size:11px;color:#566187;line-height:1.6;">
          Marvex Studio · The Ultimate Research Lab · marvex.app<br/>
          You received this because you applied for press access at marvex.app/press.
        </p>
      </div>
    </div>
    """
    return subject, html


# ---------- Router ----------
def make_router(db: AsyncIOMotorDatabase, current_user_dep: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/press", tags=["press"])

    @router.post("/apply", response_model=PressApplyResponse, status_code=201)
    async def apply(payload: PressApply, request: Request) -> PressApplyResponse:
        # Light validation beyond pydantic
        link = payload.link.strip()
        if not URL_RE.match(link):
            raise HTTPException(status_code=400, detail="Please include a valid http(s):// link to your publication or profile.")

        email = payload.email.lower().strip()
        now = datetime.now(timezone.utc)

        # Per-email rate-limit: same email can't re-apply within window. Allows
        # genuine retry after window so a typo doesn't lock them out forever.
        if _rate_limit_hours() > 0:
            cutoff = now - timedelta(hours=_rate_limit_hours())
            recent = await db.press_codes.find_one(
                {"email": email, "issued_at": {"$gte": cutoff}},
                {"_id": 0, "issued_at": 1, "code": 1},
            )
            if recent:
                raise HTTPException(
                    status_code=429,
                    detail=f"You already applied within the last {_rate_limit_hours()}h — check your inbox (and spam folder) for the code email.",
                )

        days = _days()
        auto = _auto_approve()
        code = _generate_code()
        # Collision guard — extremely unlikely but cheap to handle.
        for _ in range(5):
            exists = await db.press_codes.find_one({"code": code}, {"_id": 0, "code": 1})
            if not exists:
                break
            code = _generate_code()

        doc = {
            "code": code,
            "email": email,
            "name": payload.name.strip(),
            "publication": payload.publication.strip(),
            "role": payload.role.strip(),
            "link": link,
            "why": payload.why.strip(),
            "days": days,
            "status": "issued" if auto else "pending",
            "auto_approved": auto,
            "issued_at": now,
            # Code itself expires 30d after issue if never redeemed — keeps
            # zombie codes out of the `db.press_codes` index forever.
            "expires_at": now + timedelta(days=30),
            "user_agent": (request.headers.get("user-agent") or "")[:200],
            "ip_hint": (request.headers.get("x-forwarded-for") or request.client.host if request.client else "")[:60],
        }

        try:
            await db.press_codes.insert_one(doc)
        except Exception as e:  # noqa: BLE001
            logger.exception("press apply insert failed")
            raise HTTPException(status_code=500, detail=f"Could not save application: {e!s}") from e

        if auto:
            # Fire-and-forget email — don't fail the API call if Resend is misbehaving;
            # the user can still copy the returned code if needed.
            try:
                from email_sender import send_email
                subject, html = await _build_redeem_email(code, payload.name.strip(), days)
                # reply_to=press@marvex.app — when reviewers hit "Reply" on the
                # confirmation email, the response lands in the press helper's
                # Zoho mailbox, not the no-reply Resend default.
                result = await send_email(
                    to=email, subject=subject, html=html,
                    reply_to="press@marvex.app",
                )
                if not result.get("ok"):
                    logger.warning("press: email send failed (%s) — user will see code in UI", result.get("error"))
            except Exception:  # noqa: BLE001
                logger.exception("press: email send raised")

            return PressApplyResponse(
                ok=True,
                auto_approved=True,
                code=code,
                message=f"Approved! Check {email} for your {days}-day Pro access code. (If not in your inbox in 2 minutes, check spam.)",
            )

        return PressApplyResponse(
            ok=True,
            auto_approved=False,
            message="Thanks — we'll review your application within 24 hours and email you on approval.",
        )

    @router.get("/lookup/{code}", response_model=PressLookupResponse)
    async def lookup(code: str) -> PressLookupResponse:
        """Public — used by the /redeem page to validate a press code BEFORE
        the user signs in, so we can show a confirmation message ("This code
        unlocks Pro for 14 days for j***@x.com — sign in to redeem")."""
        code_norm = code.strip().upper()
        if not code_norm.startswith(CODE_PREFIX):
            return PressLookupResponse(valid=False)
        row = await db.press_codes.find_one({"code": code_norm}, {"_id": 0})
        if not row:
            return PressLookupResponse(valid=False)
        now = datetime.now(timezone.utc)
        if row.get("status") == "redeemed":
            return PressLookupResponse(valid=False, used=True, email_hint=_email_hint(row.get("email", "")))
        if _is_past(row.get("expires_at"), now):
            return PressLookupResponse(valid=False, expired=True, email_hint=_email_hint(row.get("email", "")))
        if row.get("status") not in {"issued", "approved"}:
            return PressLookupResponse(valid=False)
        days = int(row.get("days") or _days())
        return PressLookupResponse(
            valid=True,
            tier="pro",
            label=f"Press · {days}-day Pro",
            email_hint=_email_hint(row.get("email", "")),
        )

    @router.post("/redeem/{code}")
    async def redeem(code: str, user: dict = Depends(current_user_dep)) -> Dict[str, Any]:
        """Auth-gated. Marks the code as redeemed and grants the user the
        `days` of Pro. Idempotent for the same user (re-redeeming is a no-op)."""
        code_norm = code.strip().upper()
        if not code_norm.startswith(CODE_PREFIX):
            raise HTTPException(status_code=400, detail="Not a press code")

        row = await db.press_codes.find_one({"code": code_norm}, {"_id": 0})
        if not row:
            raise HTTPException(status_code=404, detail="Invalid or revoked code")
        now = datetime.now(timezone.utc)
        if row.get("status") == "redeemed":
            # Idempotent if the same user re-clicks.
            if row.get("redeemed_by_user") == user.get("user_id"):
                return {"ok": True, "tier": "pro", "already_redeemed": True}
            raise HTTPException(status_code=409, detail="This code has already been redeemed")
        if _is_past(row.get("expires_at"), now):
            raise HTTPException(status_code=410, detail="This code has expired")
        if row.get("status") not in {"issued", "approved"}:
            raise HTTPException(status_code=403, detail="This code is not active")

        days = int(row.get("days") or _days())
        end = (now + timedelta(days=days)).isoformat()
        user_id = user["user_id"]

        # Apply the Pro grant. We mirror the access_codes "pro" tier shape.
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "subscription.plan": "monthly",
                "subscription.lifetime": False,
                "subscription.status": "active",
                "subscription.current_period_end": end,
                "subscription.cancel_at_period_end": False,
                "subscription.press": True,
                "subscription.press_publication": row.get("publication"),
                "subscription.last_redemption_at": now.isoformat(),
            }},
        )

        await db.press_codes.update_one(
            {"code": code_norm},
            {"$set": {
                "status": "redeemed",
                "redeemed_at": now,
                "redeemed_by_user": user_id,
                "redeemed_by_email": (user.get("email") or "").lower(),
            }},
        )
        logger.info("press code redeemed: %s → user=%s", code_norm, user_id)
        return {"ok": True, "tier": "pro", "days": days, "expires": end}

    # ---------- Admin ----------
    def _is_admin(user: Optional[dict]) -> bool:
        if not user:
            return False
        admins = {e.strip().lower() for e in (os.environ.get("ADMIN_EMAILS") or "").split(",") if e.strip()}
        return (user.get("email") or "").lower() in admins

    @router.get("/admin/list")
    async def admin_list(
        status: Optional[str] = None,
        user: dict = Depends(current_user_dep),
    ) -> List[Dict[str, Any]]:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        rows: List[Dict[str, Any]] = []
        async for r in db.press_codes.find(query, {"_id": 0}).sort("issued_at", -1).limit(500):
            for k in ("issued_at", "expires_at", "redeemed_at"):
                if isinstance(r.get(k), datetime):
                    r[k] = r[k].isoformat()
            rows.append(r)
        return rows

    @router.post("/admin/{code}/revoke")
    async def admin_revoke(code: str, user: dict = Depends(current_user_dep)) -> Dict[str, Any]:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        res = await db.press_codes.update_one(
            {"code": code.strip().upper()},
            {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc)}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}

    # ============================================================
    #                 Press testimonials (quote pulls)
    # ============================================================
    # Public list endpoint feeds the Landing-page testimonial widget.
    # Admin endpoints let the founder add/edit/hide quotes from real
    # published reviews (manual curation — we never auto-scrape).

    def _testimonial_id() -> str:
        return f"t-{secrets.token_hex(4)}"

    def _project_public(row: Dict[str, Any]) -> Dict[str, Any]:
        """Strip admin-only fields before returning to the public."""
        return {
            "id": row.get("id"),
            "author_name": row.get("author_name"),
            "author_role": row.get("author_role"),
            "publication": row.get("publication"),
            "publication_logo": row.get("publication_logo"),
            "quote": row.get("quote"),
            "article_url": row.get("article_url"),
            "featured": bool(row.get("featured", False)),
        }

    @router.get("/testimonials")
    async def list_testimonials(limit: int = 12) -> List[Dict[str, Any]]:
        """Public — returns published press testimonials, featured first.
        Sorted by (featured desc, created_at desc) so manually-promoted
        quotes always lead the carousel."""
        limit = max(1, min(50, int(limit or 12)))
        rows: List[Dict[str, Any]] = []
        cursor = (
            db.press_testimonials
            .find({"status": "published"}, {"_id": 0})
            .sort([("featured", -1), ("created_at", -1)])
            .limit(limit)
        )
        async for r in cursor:
            rows.append(_project_public(r))
        return rows

    @router.get("/admin/testimonials")
    async def admin_list_testimonials(
        status: Optional[str] = None,
        user: dict = Depends(current_user_dep),
    ) -> List[Dict[str, Any]]:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        rows: List[Dict[str, Any]] = []
        async for r in db.press_testimonials.find(query, {"_id": 0}).sort("created_at", -1).limit(200):
            if isinstance(r.get("created_at"), datetime):
                r["created_at"] = r["created_at"].isoformat()
            rows.append(r)
        return rows

    @router.post("/admin/testimonials", status_code=201)
    async def admin_create_testimonial(
        payload: TestimonialCreate,
        user: dict = Depends(current_user_dep),
    ) -> Dict[str, Any]:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        if not URL_RE.match(payload.article_url.strip()):
            raise HTTPException(status_code=400, detail="article_url must be a valid http(s):// link")
        if payload.publication_logo and not URL_RE.match(payload.publication_logo.strip()):
            raise HTTPException(status_code=400, detail="publication_logo must be a valid http(s):// link")
        now = datetime.now(timezone.utc)
        doc = payload.model_dump()
        doc["id"] = _testimonial_id()
        doc["status"] = "published"  # default — flip to draft via PATCH if needed
        doc["created_at"] = now
        doc["created_by"] = (user.get("email") or "").lower()
        await db.press_testimonials.insert_one(doc)
        # Strip _id so the response is clean (Mongo mutates the dict on insert).
        doc.pop("_id", None)
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        return doc

    @router.patch("/admin/testimonials/{tid}")
    async def admin_patch_testimonial(
        tid: str,
        payload: TestimonialUpdate,
        user: dict = Depends(current_user_dep),
    ) -> Dict[str, Any]:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        update = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="No fields to update")
        for url_field in ("article_url", "publication_logo"):
            if url_field in update and update[url_field] and not URL_RE.match(update[url_field]):
                raise HTTPException(status_code=400, detail=f"{url_field} must be a valid http(s):// link")
        update["updated_at"] = datetime.now(timezone.utc)
        res = await db.press_testimonials.update_one({"id": tid}, {"$set": update})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Testimonial not found")
        return {"ok": True, "id": tid}

    @router.delete("/admin/testimonials/{tid}")
    async def admin_delete_testimonial(
        tid: str,
        user: dict = Depends(current_user_dep),
    ) -> Dict[str, Any]:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        res = await db.press_testimonials.delete_one({"id": tid})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Testimonial not found")
        return {"ok": True, "id": tid}

    return router

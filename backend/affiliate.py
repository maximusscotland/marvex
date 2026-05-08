"""
Affiliate program — every Pro user gets a permanent referral code, three
commission tiers, and an in-app dashboard. Manual quarterly payouts via
Wise/PayPal (admin marks paid). Zero SaaS spend.

Tiers (commission rate determined by the AFFILIATE's plan, NOT the referee's):
  • Founder            → 25%   (lifetime VIPs, founder_number 1..50)
  • Pro Lifetime       → 17%   (subscription.plan == "lifetime")
  • Pro Subscriber     →  5%   (monthly or annual) + bonus month per referral
                                (capped at 4 free months in any 365-day window)
  • Anyone else        →   0%   (free users have no affiliate link)

Cadence (based on the REFEREE's plan when they pay):
  • Referee on monthly  → commission accrues on first 3 monthly invoices,
                          ONLY while the subscription stays active. If the
                          referee cancels after month 1, months 2-3 never
                          fire (each renewal is a fresh Checkout — no
                          renewal = no _mark_paid = no commission event).
  • Referee on annual   → commission accrues once
  • Referee on lifetime → commission accrues once

Customer-side incentive: 25% off the first invoice when arriving via a
referral link (handled in billing.py — see _ref_discounted_amount). For
monthly that's 25% off the first month; for annual/lifetime 25% off the
single invoice. Stripe Coupon plumbing is deferred until we hit the limits
of one-off-charge mode.

Public endpoints
  GET  /api/affiliate/me              — Pro users only; their dashboard
  POST /api/affiliate/track-click     — public; landing page beacon
Admin endpoints
  GET  /api/admin/affiliates          — admin only; all affiliates summary
  POST /api/admin/affiliates/{user_id}/mark-paid  — record a payout
"""
from __future__ import annotations

import os
import re
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# ----------- Tier resolution -----------

# (rate, label) — tier name is just a UI hint, the rate drives the math.
def resolve_tier(user: dict) -> tuple[float, str]:
    sub = (user or {}).get("subscription") or {}
    if sub.get("founder"):
        return (0.25, "founder")
    plan = (sub.get("plan") or "").lower()
    status = (sub.get("status") or "").lower()
    if status not in {"active", "trialing"}:
        return (0.0, "free")
    if plan == "lifetime":
        return (0.17, "lifetime")
    # Lite is treated as a subscriber tier — same 5% + 1 bonus month as
    # monthly/annual Pro. Per product spec: every paying user is an
    # evangelist, no reason to gate based on tier.
    if plan in {"monthly", "annual", "lite"}:
        return (0.05, "subscriber")
    return (0.0, "free")


def is_eligible_affiliate(user: dict) -> bool:
    rate, _ = resolve_tier(user)
    return rate > 0


# ----------- Code generation -----------

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(s: str, max_len: int = 16) -> str:
    s = (s or "").strip().lower()
    s = _SLUG_RE.sub("-", s).strip("-")
    return s[:max_len] or "user"


async def ensure_affiliate_code(db: AsyncIOMotorDatabase, user: dict) -> str:
    """Returns the user's referral code, generating one on first call.

    Codes look like  "<slug-of-name-or-email>-<6 hex>" so every Pro user gets
    something they can pronounce ("alice-7f2a91"), never collides, and stays
    URL-safe.  Stored on the user doc as `affiliate.code` so we never have
    to scan to find it.
    """
    aff = (user or {}).get("affiliate") or {}
    if aff.get("code"):
        return aff["code"]
    if not is_eligible_affiliate(user):
        return ""
    base = _slugify((user.get("name") or "").split(" ")[0] or user.get("email", "").split("@")[0])
    # 24 bits of entropy is ample — ~16M possibilities, collision after ~4k codes
    # is < 0.0006% so we just retry on the rare clash.
    for _ in range(5):
        code = f"{base}-{secrets.token_hex(3)}"
        clash = await db.users.find_one({"affiliate.code": code}, {"_id": 1})
        if clash:
            continue
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "affiliate.code": code,
                "affiliate.created_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return code
    raise HTTPException(status_code=500, detail="Could not generate a unique affiliate code (try again)")


async def find_affiliate_by_code(db: AsyncIOMotorDatabase, code: str) -> Optional[dict]:
    if not code:
        return None
    return await db.users.find_one({"affiliate.code": code.strip().lower()}, {"_id": 0})


# ----------- Commission accrual -----------

# Cents amounts per plan — kept in sync with billing.py PLANS but copied so
# the affiliate module doesn't need to reach into billing internals.
PLAN_AMOUNTS_CENTS = {
    "monthly":  1500,
    "annual":   15000,
    "lifetime": 20000,
}

# How many invoices a single referral pays out for, by referee's plan.
PAYABLE_INVOICES = {
    "monthly":  3,
    "annual":   1,
    "lifetime": 1,
}

# Hard cap on bonus months for subscriber-tier affiliates (rolling 365 days).
BONUS_MONTH_CAP = 4
BONUS_WINDOW_DAYS = 365


async def _count_existing_payable_invoices(db: AsyncIOMotorDatabase, referee_user_id: str, plan: str) -> int:
    """How many already-recorded referral_events does this referee have for
    this plan?  Used to enforce the 3-monthly / 1-annual / 1-lifetime cadence."""
    return await db.referral_events.count_documents({
        "referee_user_id": referee_user_id,
        "referee_plan": plan,
    })


async def _bonus_months_in_window(db: AsyncIOMotorDatabase, affiliate_user_id: str) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=BONUS_WINDOW_DAYS)
    return await db.referral_events.count_documents({
        "affiliate_user_id": affiliate_user_id,
        "bonus_month_granted": True,
        "created_at": {"$gte": cutoff},
    })


async def _extend_subscription_term(db: AsyncIOMotorDatabase, user_id: str, days: int = 30) -> Optional[str]:
    """Push the affiliate's `current_period_end` out by `days`.  Only meaningful
    for monthly/annual subscribers (lifetime/founder don't use period_end).
    Returns the new ISO date or None if not applied."""
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "subscription": 1})
    if not u:
        return None
    sub = u.get("subscription") or {}
    plan = (sub.get("plan") or "").lower()
    if plan not in {"monthly", "annual"}:
        return None
    cur = sub.get("current_period_end") or ""
    try:
        base = datetime.fromisoformat(cur) if cur else datetime.now(timezone.utc)
    except ValueError:
        base = datetime.now(timezone.utc)
    new_end = base + timedelta(days=days)
    new_iso = new_end.isoformat()
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"subscription.current_period_end": new_iso}},
    )
    return new_iso


async def accrue_commission(
    db: AsyncIOMotorDatabase,
    *,
    referee_user_id: str,
    referee_plan: str,
    paid_amount_cents: int,
    session_id: str,
) -> Optional[dict]:
    """Called from the Stripe webhook _after_ Pro is granted. Looks up the
    referee's referrer, computes commission, writes a referral_event doc, and
    extends the affiliate's subscription term if eligible.  Returns the event
    doc for logging, or None if no commission was due."""
    referee = await db.users.find_one({"user_id": referee_user_id}, {"_id": 0})
    if not referee:
        return None
    referrer_id = (referee.get("affiliate") or {}).get("referred_by") or ""
    if not referrer_id:
        return None
    if referrer_id == referee_user_id:
        # paranoid self-ref guard
        return None

    affiliate = await db.users.find_one({"user_id": referrer_id}, {"_id": 0})
    if not affiliate or not is_eligible_affiliate(affiliate):
        return None

    plan = (referee_plan or "").lower()
    if plan not in PAYABLE_INVOICES:
        return None
    cap_invoices = PAYABLE_INVOICES[plan]
    already = await _count_existing_payable_invoices(db, referee_user_id, plan)
    if already >= cap_invoices:
        # Cadence cap reached — no more commission for this referee+plan combo.
        return None

    rate, tier = resolve_tier(affiliate)
    if rate <= 0:
        return None
    commission_cents = int(round(paid_amount_cents * rate))

    # Bonus month — only for subscriber tier, capped per rolling year
    grant_bonus = False
    new_period_end = None
    if tier == "subscriber":
        used = await _bonus_months_in_window(db, affiliate["user_id"])
        if used < BONUS_MONTH_CAP:
            new_period_end = await _extend_subscription_term(db, affiliate["user_id"], days=30)
            grant_bonus = bool(new_period_end)

    now = datetime.now(timezone.utc)
    event = {
        "_id": f"refev_{secrets.token_hex(8)}",
        "affiliate_user_id": affiliate["user_id"],
        "affiliate_email": affiliate.get("email", ""),
        "affiliate_tier": tier,
        "rate": rate,
        "referee_user_id": referee_user_id,
        "referee_email": referee.get("email", ""),
        "referee_plan": plan,
        "invoice_number": already + 1,  # 1..PAYABLE_INVOICES[plan]
        "paid_amount_cents": paid_amount_cents,
        "commission_cents": commission_cents,
        "session_id": session_id,
        "bonus_month_granted": grant_bonus,
        "extended_period_end": new_period_end,
        "payout_status": "pending",        # pending | paid
        "payout_id": "",
        "paid_at": "",
        "created_at": now,
    }
    await db.referral_events.insert_one(event)
    return event


# ----------- Click tracking -----------

class TrackClickPayload(BaseModel):
    code: str
    referrer: Optional[str] = ""    # http referrer
    path: Optional[str] = ""        # the landing path on our site


# ----------- Admin gate -----------

def _admin_emails() -> set[str]:
    raw = os.environ.get("ADMIN_EMAILS", "").strip()
    if not raw:
        return set()
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _is_admin(user: dict) -> bool:
    email = (user.get("email") or "").strip().lower()
    return email in _admin_emails()


# ----------- Router factory -----------

def make_router(db: AsyncIOMotorDatabase, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.get("/affiliate/me")
    async def affiliate_dashboard(request: Request, user: dict = Depends(current_user_dep)):
        rate, tier = resolve_tier(user)
        if rate <= 0:
            raise HTTPException(
                status_code=403,
                detail="The affiliate program is open to Pro members only. Upgrade to start earning.",
            )
        code = await ensure_affiliate_code(db, user)
        # Build the share URL based on the request origin so it works in dev,
        # preview, and prod without a hardcoded domain.
        origin = (request.headers.get("origin") or str(request.base_url)).rstrip("/")
        link = f"{origin}/?ref={code}"

        # Aggregations — keep them cheap; affiliates with thousands of
        # referrals are a champagne problem we'll solve later.
        events = await db.referral_events.find(
            {"affiliate_user_id": user["user_id"]},
            {"_id": 0},
        ).sort("created_at", -1).to_list(length=200)

        pending_cents = sum(e["commission_cents"] for e in events if e.get("payout_status") == "pending")
        paid_cents    = sum(e["commission_cents"] for e in events if e.get("payout_status") == "paid")
        total_referrals = len({e["referee_user_id"] for e in events})

        bonus_used = await _bonus_months_in_window(db, user["user_id"])

        clicks = await db.affiliate_clicks.count_documents({"code": code})

        # Recent events, lightly redacted (we don't share referee emails — that
        # would be a privacy footgun. Just first letter + masked domain.)
        def _mask_email(e: str) -> str:
            if not e or "@" not in e:
                return ""
            user_part, domain = e.split("@", 1)
            return f"{user_part[0]}***@{domain}"

        recent = [{
            "created_at": e.get("created_at").isoformat() if hasattr(e.get("created_at"), "isoformat") else e.get("created_at"),
            "referee_email_masked": _mask_email(e.get("referee_email", "")),
            "referee_plan": e.get("referee_plan", ""),
            "invoice_number": e.get("invoice_number", 1),
            "commission_cents": e.get("commission_cents", 0),
            "payout_status": e.get("payout_status", "pending"),
            "bonus_month_granted": bool(e.get("bonus_month_granted", False)),
        } for e in events[:50]]

        return {
            "code": code,
            "link": link,
            "tier": tier,
            "rate": rate,
            "stats": {
                "clicks": clicks,
                "total_referrals": total_referrals,
                "pending_commission_cents": pending_cents,
                "paid_commission_cents": paid_cents,
                "bonus_months_used": bonus_used,
                "bonus_months_remaining": max(0, BONUS_MONTH_CAP - bonus_used) if tier == "subscriber" else 0,
            },
            "recent": recent,
            "rules": {
                "monthly_invoice_cap": PAYABLE_INVOICES["monthly"],
                "annual_invoice_cap": PAYABLE_INVOICES["annual"],
                "lifetime_invoice_cap": PAYABLE_INVOICES["lifetime"],
                "bonus_window_days": BONUS_WINDOW_DAYS,
                "bonus_month_cap": BONUS_MONTH_CAP,
                "customer_side_discount_pct": 25,
            },
        }

    @router.post("/affiliate/track-click")
    async def track_click(payload: TrackClickPayload):
        """Public, anon-friendly endpoint. Landing page hits this when a
        ?ref=XYZ is captured so we can show clicks-vs-conversions on the
        dashboard without depending on PostHog."""
        code = (payload.code or "").strip().lower()
        if not code or len(code) > 64:
            return {"ok": False}
        # Verify it's a real code so we don't accumulate junk
        owner = await db.users.find_one({"affiliate.code": code}, {"_id": 0, "user_id": 1})
        if not owner:
            return {"ok": False, "reason": "unknown_code"}
        await db.affiliate_clicks.insert_one({
            "code": code,
            "affiliate_user_id": owner["user_id"],
            "path": (payload.path or "")[:200],
            "referrer": (payload.referrer or "")[:300],
            "ts": datetime.now(timezone.utc),
        })
        return {"ok": True}

    # ----------- Admin -----------

    @router.get("/admin/affiliates")
    async def admin_list_affiliates(user: dict = Depends(current_user_dep)):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")

        # Aggregate per-affiliate totals — small enough for a single pass.
        pipe = [
            {"$group": {
                "_id": "$affiliate_user_id",
                "total_events": {"$sum": 1},
                "pending_cents": {
                    "$sum": {"$cond": [{"$eq": ["$payout_status", "pending"]}, "$commission_cents", 0]},
                },
                "paid_cents": {
                    "$sum": {"$cond": [{"$eq": ["$payout_status", "paid"]}, "$commission_cents", 0]},
                },
                "tier": {"$last": "$affiliate_tier"},
                "email": {"$last": "$affiliate_email"},
                "last_event_at": {"$max": "$created_at"},
            }},
            {"$sort": {"pending_cents": -1, "last_event_at": -1}},
        ]
        rows = await db.referral_events.aggregate(pipe).to_list(length=1000)
        out = [{
            "user_id": r.get("_id", ""),
            "email": r.get("email", ""),
            "tier": r.get("tier", ""),
            "total_events": r.get("total_events", 0),
            "pending_cents": r.get("pending_cents", 0),
            "paid_cents": r.get("paid_cents", 0),
            "last_event_at": r.get("last_event_at").isoformat() if hasattr(r.get("last_event_at"), "isoformat") else r.get("last_event_at"),
        } for r in rows]

        # Also surface all eligible affiliates with zero events so admins can
        # see "who has the link but hasn't earned yet" — useful early on.
        seen_ids = {r["user_id"] for r in out}
        cur = db.users.find(
            {"affiliate.code": {"$exists": True, "$ne": ""}},
            {"_id": 0, "user_id": 1, "email": 1, "subscription": 1, "affiliate.code": 1},
        )
        zeros: List[dict] = []
        async for u in cur:
            if u["user_id"] in seen_ids:
                continue
            _, tier = resolve_tier(u)
            zeros.append({
                "user_id": u["user_id"],
                "email": u.get("email", ""),
                "tier": tier,
                "total_events": 0,
                "pending_cents": 0,
                "paid_cents": 0,
                "last_event_at": None,
            })
        return {"affiliates": out + zeros}

    @router.post("/admin/affiliates/{aff_user_id}/mark-paid")
    async def admin_mark_paid(
        aff_user_id: str,
        payout_method: str = Query("manual"),
        payout_ref: str = Query(""),
        user: dict = Depends(current_user_dep),
    ):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        now = datetime.now(timezone.utc)
        # Bulk-flip every pending event for this affiliate to paid, stamping
        # the same payout_id so we can group them in the audit trail.
        payout_id = f"po_{secrets.token_hex(8)}"
        result = await db.referral_events.update_many(
            {"affiliate_user_id": aff_user_id, "payout_status": "pending"},
            {"$set": {
                "payout_status": "paid",
                "payout_id": payout_id,
                "payout_method": (payout_method or "manual")[:24],
                "payout_ref": (payout_ref or "")[:200],
                "paid_at": now.isoformat(),
            }},
        )
        return {
            "ok": True,
            "events_paid": result.modified_count,
            "payout_id": payout_id,
        }

    # ----------- Family allowlist (admin-only) -----------
    # Self-serve UI for granting unlimited access to family/friends without
    # editing /app/backend/.env or restarting the service.  Emails added here
    # are auto-promoted to lifetime Pro on next Google sign-in by auth.py's
    # is_family_email() helper.

    class FamilyEmailPayload(BaseModel):
        email: str
        note: Optional[str] = ""

    @router.get("/admin/family/emails")
    async def admin_family_list(user: dict = Depends(current_user_dep)):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        # Surface env-var bootstrap entries as read-only rows so the admin can
        # see the full picture in one place.
        env_emails = sorted({e.strip().lower() for e in (os.environ.get("FAMILY_EMAILS") or "").split(",") if e.strip()})
        cur = db.family_allowlist.find({}, {"_id": 0}).sort("created_at", -1)
        dynamic = await cur.to_list(length=500)
        return {
            "static": [{"email": e, "source": "env", "removable": False} for e in env_emails],
            "dynamic": [{
                "email": d.get("email", ""),
                "note": d.get("note", ""),
                "added_by": d.get("added_by", ""),
                "created_at": d.get("created_at").isoformat() if hasattr(d.get("created_at"), "isoformat") else d.get("created_at"),
                "source": "db",
                "removable": True,
            } for d in dynamic],
        }

    @router.post("/admin/family/emails")
    async def admin_family_add(payload: FamilyEmailPayload, user: dict = Depends(current_user_dep)):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        email = (payload.email or "").strip().lower()
        if not email or "@" not in email or len(email) > 200:
            raise HTTPException(status_code=400, detail="Invalid email")
        now = datetime.now(timezone.utc)
        # Upsert by email — idempotent so the admin can paste a list without
        # worrying about duplicates.
        await db.family_allowlist.update_one(
            {"email": email},
            {"$setOnInsert": {
                "email": email,
                "note": (payload.note or "")[:200],
                "added_by": user.get("email", ""),
                "created_at": now,
            }},
            upsert=True,
        )
        # If the user already exists, retro-grant Pro now so they don't have
        # to log out + back in.  We update the user doc directly using the
        # same payload shape auth.py uses on next login.
        existing = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1})
        if existing:
            far_future = (now + timedelta(days=365 * 100)).isoformat()
            await db.users.update_one(
                {"user_id": existing["user_id"]},
                {"$set": {
                    "subscription.status": "active",
                    "subscription.plan": "lifetime",
                    "subscription.family": True,
                    "subscription.current_period_end": far_future,
                }},
            )
        return {"ok": True, "email": email, "retro_granted": bool(existing)}

    @router.delete("/admin/family/emails/{email}")
    async def admin_family_remove(email: str, user: dict = Depends(current_user_dep)):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        clean = (email or "").strip().lower()
        if not clean:
            raise HTTPException(status_code=400, detail="Invalid email")
        result = await db.family_allowlist.delete_one({"email": clean})
        # Note: we do NOT auto-revoke Pro from the user doc on removal — the
        # admin may want to keep them as a paying user. Manual downgrade if
        # needed.
        return {"ok": True, "removed": result.deleted_count}

    # ----------- Invite codes (admin-managed, user-redeemable) -----------
    # Sharable single string the admin can DM/email to friends. The recipient
    # signs in, pastes the code at /redeem, and gets lifetime Pro on the spot.
    # Each code can have an optional max-redemptions cap and optional expiry,
    # with full audit trail of who redeemed when.

    class InviteCodeCreate(BaseModel):
        label: Optional[str] = ""        # admin's note ("Family", "Beta cohort A")
        max_redemptions: Optional[int] = None
        expires_in_days: Optional[int] = None

    def _gen_invite_code() -> str:
        # Three 4-char chunks separated by dashes — easy to read and dictate
        # over the phone.  ~52^12 = 4e20 keyspace = collision-immune.
        import string
        alphabet = string.ascii_uppercase + string.digits
        chunks = [
            "".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)
        ]
        return "-".join(chunks)

    @router.get("/admin/invites")
    async def admin_list_invites(user: dict = Depends(current_user_dep)):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        cur = db.invite_codes.find({}, {"_id": 0}).sort("created_at", -1)
        rows = await cur.to_list(length=500)
        out = []
        for r in rows:
            out.append({
                "code": r.get("code", ""),
                "label": r.get("label", ""),
                "max_redemptions": r.get("max_redemptions"),
                "redemptions": int(r.get("redemptions", 0)),
                "redeemed_by": r.get("redeemed_by", []),
                "expires_at": r.get("expires_at").isoformat() if hasattr(r.get("expires_at"), "isoformat") else r.get("expires_at"),
                "created_by": r.get("created_by", ""),
                "created_at": r.get("created_at").isoformat() if hasattr(r.get("created_at"), "isoformat") else r.get("created_at"),
                "revoked": bool(r.get("revoked", False)),
            })
        return {"invites": out}

    @router.post("/admin/invites")
    async def admin_create_invite(payload: InviteCodeCreate, user: dict = Depends(current_user_dep)):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        now = datetime.now(timezone.utc)
        expires_at = None
        if payload.expires_in_days and payload.expires_in_days > 0:
            expires_at = now + timedelta(days=int(payload.expires_in_days))
        # Generate + retry on the (cosmically rare) collision.
        for _ in range(5):
            code = _gen_invite_code()
            existing = await db.invite_codes.find_one({"code": code}, {"_id": 1})
            if existing:
                continue
            doc = {
                "code": code,
                "label": (payload.label or "")[:120],
                "max_redemptions": payload.max_redemptions if (payload.max_redemptions and payload.max_redemptions > 0) else None,
                "redemptions": 0,
                "redeemed_by": [],
                "expires_at": expires_at,
                "created_by": user.get("email", ""),
                "created_at": now,
                "revoked": False,
            }
            await db.invite_codes.insert_one(doc.copy())
            return {
                "ok": True,
                "code": code,
                "label": doc["label"],
                "max_redemptions": doc["max_redemptions"],
                "expires_at": expires_at.isoformat() if expires_at else None,
            }
        raise HTTPException(status_code=500, detail="Could not allocate invite code (try again)")

    @router.post("/admin/invites/{code}/revoke")
    async def admin_revoke_invite(code: str, user: dict = Depends(current_user_dep)):
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        clean = (code or "").strip().upper()
        result = await db.invite_codes.update_one(
            {"code": clean},
            {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc)}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Invite not found")
        return {"ok": True}

    # ---- User-side redemption ----

    class InviteRedeem(BaseModel):
        code: str

    @router.post("/invite/redeem")
    async def redeem_invite(payload: InviteRedeem, user: dict = Depends(current_user_dep)):
        clean = (payload.code or "").strip().upper().replace(" ", "")
        # Tolerate users pasting with or without dashes — normalise both ways
        # for the lookup.
        if "-" not in clean and len(clean) == 12:
            clean = f"{clean[0:4]}-{clean[4:8]}-{clean[8:12]}"
        invite = await db.invite_codes.find_one({"code": clean}, {"_id": 0})
        if not invite:
            raise HTTPException(status_code=404, detail="Invite code not found")
        if invite.get("revoked"):
            raise HTTPException(status_code=410, detail="This invite was revoked")
        exp = invite.get("expires_at")
        if exp and isinstance(exp, datetime) and exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="This invite has expired")
        cap = invite.get("max_redemptions")
        if cap and int(invite.get("redemptions", 0)) >= int(cap):
            raise HTTPException(status_code=410, detail="This invite has been fully redeemed")

        # Idempotent — if the same user redeems twice we don't double-count.
        already = any(r.get("user_id") == user["user_id"] for r in (invite.get("redeemed_by") or []))
        now = datetime.now(timezone.utc)
        if not already:
            await db.invite_codes.update_one(
                {"code": clean},
                {
                    "$inc": {"redemptions": 1},
                    "$push": {"redeemed_by": {
                        "user_id": user["user_id"],
                        "email": user.get("email", ""),
                        "redeemed_at": now,
                    }},
                },
            )

        # Grant lifetime Pro with a "via_invite" marker so we can tell these
        # apart from email-allowlist family members in analytics.
        far_future = (now + timedelta(days=365 * 100)).isoformat()
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "subscription.status": "active",
                "subscription.plan": "lifetime",
                "subscription.family": True,
                "subscription.via_invite": clean,
                "subscription.current_period_end": far_future,
            }},
        )
        return {
            "ok": True,
            "code": clean,
            "label": invite.get("label", ""),
            "already_redeemed": already,
        }

    return router

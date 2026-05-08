"""
Admin Ops dashboard — aggregates every ongoing responsibility the owner
needs to stay on top of in one payload, keyed off a single admin-gated
GET endpoint so the frontend can render a responsibilities page with
minimal round-trips.

Why a single endpoint instead of 8 separate ones?
    • Each card is cheap individually (single count_documents call,
      bounded result set). Bundling keeps request count low and gives
      the UI a consistent timestamp for "data as of …".
    • Every query is scoped to the current user via `_is_admin` from
      affiliate.py — we reuse that gate so there's one source of
      truth for admin identity.

Tasks collection (new — admin_tasks):
    {
      _id: ObjectId,           # internal only, never leaked
      id: uuid4 str,            # public identifier
      title: str,
      notes: str,
      due_date: isoformat,      # optional
      done: bool,
      created_at: isoformat,
      updated_at: isoformat,
    }

On first fetch, we seed four common founder tasks if the collection is
empty — BAILII annual donation, TM filing, domain renewal watch,
affiliate payout review cadence. After the first fetch, the collection
is user-editable and we never reseed.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

# Reuse the admin gate from affiliate.py so we don't fragment the notion
# of "who is an admin" across files.
from affiliate import _is_admin

# Affiliate payout policy mirrors affiliate.py's UI panel:
#   • $20 minimum payout threshold (below that, commissions keep accruing)
#   • 30-day hold period from commission creation to eligibility
# If affiliate.py ever externalises these as named constants, import
# them instead; for now they're duplicated here intentionally to keep
# the ops dashboard self-contained.
PAYOUT_THRESHOLD_CENTS = 2000  # $20.00
HOLD_DAYS = 30


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Seed tasks -------------------------------------------------------
# These appear in the task list the first time an admin loads the
# dashboard on a fresh database. Intentionally generic — the user can
# edit/delete any of them once seeded.
SEED_TASKS = [
    {
        "title": "Donate 1% of Law Pack revenue to BAILII",
        "notes": "Calculate net Law Pack revenue × 0.01 at financial year-end. Bank transfer to BAILII (registered charity). Commitment made on /pricing page.",
        "due_days_ahead": 365,
    },
    {
        "title": "File UK IPO + EUIPO trademark for Marvex (Class 9/42)",
        "notes": "File within 90 days of brand launch to lock priority. UK ~£170, EUIPO ~€850. Consider £200-500 TM solicitor clearance opinion first.",
        "due_days_ahead": 90,
    },
    {
        "title": "Review affiliate payouts",
        "notes": "Monthly cadence on the 28th. Check /admin/ops for pending payouts above $20 threshold + 30-day hold.",
        "due_days_ahead": 30,
    },
    {
        "title": "Marvex.app domain renewal",
        "notes": "Check Spaceship renewal date. Enable auto-renew to avoid losing the domain.",
        "due_days_ahead": 335,  # ~11 months to give a buffer before expiry
    },
]


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    notes: str = Field("", max_length=2000)
    due_date: Optional[str] = None  # ISO date string


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None
    done: Optional[bool] = None


def make_router(db: AsyncIOMotorDatabase, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api/admin")

    async def _require_admin(user: dict) -> dict:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin only")
        return user

    async def _seed_tasks_if_empty():
        """On very first admin visit, create 4 seed tasks. Idempotent:
        if anything at all exists in admin_tasks, we don't touch it."""
        existing = await db.admin_tasks.estimated_document_count()
        if existing > 0:
            return
        now = _now_iso()
        now_dt = datetime.now(timezone.utc)
        docs = []
        for seed in SEED_TASKS:
            due = (now_dt + timedelta(days=seed["due_days_ahead"])).date().isoformat()
            docs.append({
                "id": str(uuid.uuid4()),
                "title": seed["title"],
                "notes": seed["notes"],
                "due_date": due,
                "done": False,
                "created_at": now,
                "updated_at": now,
            })
        if docs:
            await db.admin_tasks.insert_many(docs)

    # ============================================================
    # GET /api/admin/ops — full responsibilities payload
    # ============================================================
    @router.get("/ops")
    async def ops_dashboard(user: dict = Depends(current_user_dep)):
        await _require_admin(user)
        await _seed_tasks_if_empty()

        # --- 1. Affiliate payouts due -----------------------------
        # Group unpaid commissions by affiliate_user_id, sum cents.
        # Hold period exclusion: only include commissions created ≥ HOLD_DAYS ago.
        hold_cutoff = (datetime.now(timezone.utc) - timedelta(days=HOLD_DAYS)).isoformat()
        pipeline = [
            {"$match": {
                "payout_status": "pending",
                "created_at": {"$lte": hold_cutoff},
            }},
            {"$group": {
                "_id": "$affiliate_user_id",
                "total_cents": {"$sum": "$commission_cents"},
                "count": {"$sum": 1},
            }},
            {"$match": {"total_cents": {"$gte": PAYOUT_THRESHOLD_CENTS}}},
            {"$sort": {"total_cents": -1}},
        ]
        affiliate_groups = await db.affiliate_commissions.aggregate(pipeline).to_list(length=200)
        # Enrich with email (handy for paying out manually)
        affiliate_list = []
        for g in affiliate_groups:
            u = await db.users.find_one({"user_id": g["_id"]}, {"_id": 0, "email": 1})
            affiliate_list.append({
                "user_id": g["_id"],
                "email": (u or {}).get("email") or "",
                "total_cents": int(g["total_cents"]),
                "count": int(g["count"]),
            })
        payouts_total_cents = sum(a["total_cents"] for a in affiliate_list)

        # --- 2. BAILII pledge tracker -----------------------------
        # 1% of net Law Pack revenue. We count payment_transactions rows
        # where add-on = premium_uk_law AND status succeeded.
        law_pack_cursor = db.payment_transactions.find(
            {"addon": "premium_uk_law", "status": {"$in": ["paid", "complete", "succeeded"]}},
            {"_id": 0, "amount": 1, "created_at": 1},
        )
        law_pack_total_cents = 0
        law_pack_count = 0
        async for row in law_pack_cursor:
            amt = row.get("amount") or 0
            law_pack_total_cents += int(amt)
            law_pack_count += 1
        pledge_owed_cents = int(round(law_pack_total_cents * 0.01))

        # Last donation record — optional, pulled from admin_donations collection
        last_donation = await db.admin_donations.find_one(
            {"kind": "bailii"},
            {"_id": 0, "amount_cents": 1, "date": 1, "note": 1},
            sort=[("date", -1)],
        )

        # --- 3. Waitlist -------------------------------------------
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        waitlist_total = await db.waitlist.estimated_document_count()
        waitlist_7d = await db.waitlist.count_documents({"created_at": {"$gte": week_ago}})
        waitlist_30d = await db.waitlist.count_documents({"created_at": {"$gte": month_ago}})
        # Source breakdown (last 30 days)
        source_cursor = db.waitlist.aggregate([
            {"$match": {"created_at": {"$gte": month_ago}}},
            {"$group": {"_id": {"$ifNull": ["$source", "unknown"]}, "n": {"$sum": 1}}},
            {"$sort": {"n": -1}},
            {"$limit": 10},
        ])
        sources = [{"source": s["_id"] or "unknown", "count": s["n"]} async for s in source_cursor]

        # --- 4. Subscription health --------------------------------
        sub_active = await db.users.count_documents({"subscription.status": "active"})
        sub_trial = await db.users.count_documents({"subscription.status": "trialing"})
        sub_past_due = await db.users.count_documents({"subscription.status": "past_due"})
        sub_canceled = await db.users.count_documents({"subscription.status": "canceled"})
        sub_cancel_at_end = await db.users.count_documents({"subscription.cancel_at_period_end": True})
        # List the past-due accounts so we can reach out
        past_due_cursor = db.users.find(
            {"subscription.status": "past_due"},
            {"_id": 0, "user_id": 1, "email": 1, "subscription.plan": 1, "subscription.current_period_end": 1},
        ).limit(50)
        past_due_list = [{
            "user_id": u.get("user_id"),
            "email": u.get("email", ""),
            "plan": (u.get("subscription") or {}).get("plan", ""),
            "period_end": (u.get("subscription") or {}).get("current_period_end", ""),
        } async for u in past_due_cursor]

        # --- 5. Founder badges -------------------------------------
        founder_limit = 50
        founder_taken = await db.users.count_documents({"subscription.founder": True})
        recent_founders_cursor = db.users.find(
            {"subscription.founder": True},
            {"_id": 0, "email": 1, "subscription.founder_number": 1, "subscription.founder_awarded_at": 1},
        ).sort([("subscription.founder_awarded_at", -1)]).limit(5)
        recent_founders = [{
            "email": u.get("email", ""),
            "number": (u.get("subscription") or {}).get("founder_number"),
            "awarded_at": (u.get("subscription") or {}).get("founder_awarded_at", ""),
        } async for u in recent_founders_cursor]

        # --- 6. Access code usage ----------------------------------
        # Codes live in env (.env `ACCESS_CODES=...` comma-separated). We report
        # how many have been redeemed (from access_code_redemptions collection)
        # rather than trying to reconstruct the master list here — the owner
        # already knows which codes they defined.
        code_redeemed_count = await db.access_code_redemptions.estimated_document_count()
        env_codes_raw = os.environ.get("ACCESS_CODES", "").strip()
        env_codes_count = (
            len([c for c in env_codes_raw.split(",") if c.strip()])
            if env_codes_raw else 0
        )

        # --- 7. Stripe webhook health ------------------------------
        last_webhook = await db.stripe_webhook_events.find_one(
            {}, {"_id": 0, "event_type": 1, "received_at": 1, "processed": 1},
            sort=[("received_at", -1)],
        )
        webhook_failures_7d = await db.stripe_webhook_events.count_documents({
            "received_at": {"$gte": week_ago},
            "processed": False,
        })

        # --- 8. Task list ------------------------------------------
        tasks_cursor = db.admin_tasks.find(
            {},
            {"_id": 0, "id": 1, "title": 1, "notes": 1, "due_date": 1, "done": 1, "created_at": 1, "updated_at": 1},
        ).sort([("done", 1), ("due_date", 1)])
        tasks = await tasks_cursor.to_list(length=200)

        # --- 9. Code-signing cert health ---------------------------
        # Driven by MAC_CERT_EXPIRES / WIN_CERT_EXPIRES in backend/.env
        # (both optional, set to an ISO date YYYY-MM-DD when you generate
        # each cert — leave unset when unsigned). This is a
        # trust-the-owner card: we don't introspect the actual .p12 /
        # .pfx files (they're in GitHub secrets, not on this server),
        # so the date you paste is the date we warn you about.
        def _cert_status(expires_iso):
            if not expires_iso:
                return {"configured": False, "expires": None, "days_remaining": None, "status": "unsigned"}
            try:
                exp_str = expires_iso if "T" in expires_iso else f"{expires_iso}T00:00:00+00:00"
                exp = datetime.fromisoformat(exp_str)
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                delta = (exp - datetime.now(timezone.utc)).days
                status = "expired" if delta < 0 else ("expiring" if delta < 45 else "ok")
                return {"configured": True, "expires": expires_iso, "days_remaining": delta, "status": status}
            except Exception:
                return {"configured": False, "expires": expires_iso, "days_remaining": None, "status": "invalid-date"}

        mac_cert = _cert_status(os.environ.get("MAC_CERT_EXPIRES", "").strip())
        win_cert = _cert_status(os.environ.get("WIN_CERT_EXPIRES", "").strip())
        # Last signed build — ISO date string we read from desktop_builds
        # collection if the CI ever writes there. Cheap fallback: null.
        last_signed = await db.desktop_builds.find_one(
            {"signed": True}, {"_id": 0, "tag": 1, "built_at": 1, "platforms": 1},
            sort=[("built_at", -1)],
        )

        return {
            "generated_at": _now_iso(),
            "affiliate_payouts": {
                "total_cents": payouts_total_cents,
                "total_formatted": f"${payouts_total_cents / 100:.2f}",
                "threshold_cents": PAYOUT_THRESHOLD_CENTS,
                "hold_days": HOLD_DAYS,
                "affiliates_due": affiliate_list,
            },
            "bailii_pledge": {
                "law_pack_net_cents": law_pack_total_cents,
                "law_pack_count": law_pack_count,
                "pledge_owed_cents": pledge_owed_cents,
                "pledge_owed_formatted": f"${pledge_owed_cents / 100:.2f}",
                "last_donation": last_donation,
            },
            "waitlist": {
                "total": waitlist_total,
                "signups_7d": waitlist_7d,
                "signups_30d": waitlist_30d,
                "sources_30d": sources,
            },
            "subscriptions": {
                "active": sub_active,
                "trialing": sub_trial,
                "past_due": sub_past_due,
                "canceled": sub_canceled,
                "cancel_at_period_end": sub_cancel_at_end,
                "past_due_accounts": past_due_list,
            },
            "founders": {
                "taken": founder_taken,
                "limit": founder_limit,
                "remaining": max(0, founder_limit - founder_taken),
                "recent": recent_founders,
            },
            "access_codes": {
                "redeemed_count": code_redeemed_count,
                "defined_count": env_codes_count,
            },
            "stripe_webhooks": {
                "last_event": last_webhook,
                "failures_7d": webhook_failures_7d,
            },
            "tasks": tasks,
        }

    # ============================================================
    # Task CRUD
    # ============================================================
    @router.post("/ops/tasks")
    async def create_task(payload: TaskCreate, user: dict = Depends(current_user_dep)):
        await _require_admin(user)
        now = _now_iso()
        doc = {
            "id": str(uuid.uuid4()),
            "title": payload.title,
            "notes": payload.notes or "",
            "due_date": payload.due_date or "",
            "done": False,
            "created_at": now,
            "updated_at": now,
        }
        await db.admin_tasks.insert_one(doc.copy())
        return doc

    @router.patch("/ops/tasks/{task_id}")
    async def update_task(task_id: str, payload: TaskUpdate, user: dict = Depends(current_user_dep)):
        await _require_admin(user)
        update = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None or k == "done"}
        if not update:
            raise HTTPException(400, "No fields to update")
        update["updated_at"] = _now_iso()
        r = await db.admin_tasks.update_one({"id": task_id}, {"$set": update})
        if r.matched_count == 0:
            raise HTTPException(404, "Task not found")
        doc = await db.admin_tasks.find_one(
            {"id": task_id},
            {"_id": 0, "id": 1, "title": 1, "notes": 1, "due_date": 1, "done": 1, "created_at": 1, "updated_at": 1},
        )
        return doc

    @router.delete("/ops/tasks/{task_id}")
    async def delete_task(task_id: str, user: dict = Depends(current_user_dep)):
        await _require_admin(user)
        r = await db.admin_tasks.delete_one({"id": task_id})
        if r.deleted_count == 0:
            raise HTTPException(404, "Task not found")
        return {"ok": True}

    # ============================================================
    # Record a BAILII donation — small form so the "pledge owed"
    # figure can be reduced as donations happen.
    # ============================================================
    class DonationCreate(BaseModel):
        amount_cents: int = Field(..., gt=0)
        note: str = Field("", max_length=500)

    @router.post("/ops/donations/bailii")
    async def record_bailii_donation(payload: DonationCreate, user: dict = Depends(current_user_dep)):
        await _require_admin(user)
        doc = {
            "id": str(uuid.uuid4()),
            "kind": "bailii",
            "amount_cents": payload.amount_cents,
            "note": payload.note or "",
            "date": _now_iso(),
            "recorded_by": (user.get("email") or user.get("user_id") or ""),
        }
        await db.admin_donations.insert_one(doc.copy())
        return doc

    return router

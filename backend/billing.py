"""
Billing — Stripe subscriptions routed through the Emergent StripeCheckout
wrapper so the pod's `sk_test_emergent` key Just Works against a real Stripe
sandbox. Same external contract as before (frontend unchanged):

  GET  /api/billing/plans                    — public; lists configured plans
  POST /api/billing/create-checkout          — authed; returns Stripe checkout URL
  GET  /api/billing/checkout-status/{id}     — authed; reads our local DB mirror
                                                (updated by the webhook)
  POST /api/webhook/stripe                   — unauth'd; Stripe → us; SOURCE OF TRUTH

Architecture notes
------------------
• The Emergent wrapper's `get_checkout_status` cannot look up sessions it
  creates (known scoping bug), so we DELIBERATELY avoid calling it. Instead:
    1. create-checkout writes a row to `payment_transactions` with status=pending
    2. Stripe → webhook updates that row + flips the user to Pro on 'paid'
    3. /checkout-status reads our row — no Stripe API call, no wrapper bug
• Plan prices (USD) are SERVER-OWNED. The frontend sends only { plan, origin_url }.
• Idempotent: same session_id never activates Pro twice (`pro_granted` guard).
• Trial periods and real subscriptions require live Stripe keys; in test mode
  every plan is a one-off charge and Pro simply expires based on interval_days.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import stripe as stripe_sdk
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

logger = logging.getLogger(__name__)

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "").strip()

# Server-side truth. Amounts are USD; the wrapper wants decimals.
#
# `stripe_price_id` is the real Stripe Price ID for each tier (configured in
# Dashboard → Products). We use it for full-price purchases so receipts/
# invoices link to the named Product (better Stripe reporting + cleaner
# customer emails). For referral-discounted checkouts we fall back to the
# dynamic-amount path because Stripe Prices are immutable — Stripe doesn't
# let you charge a different value than the Price says.
#
# To switch to a new Price (e.g. price increase), change the ID below;
# `amount` should stay in sync with the Dashboard for discount fallback.
PLANS = {
    "lite": {
        "label": "Pro Lite",
        "amount": 9.00,
        "interval_days": 30,
        "lifetime": False,
        # Stripe Product + Price live as of Feb 2026 — receipts now read
        # "Mind-Mapper Pro Lite" (will be renamed to "Marvex Pro Lite" in
        # the Stripe Dashboard once the legal entity name flip is filed).
        "stripe_price_id": "price_1TU4aFFMFVPFiUPV1DaOKldX",
    },
    "monthly": {
        "label": "Pro Monthly",
        "amount": 15.00,
        "interval_days": 30,
        "lifetime": False,
        "stripe_price_id": "price_1TPKM2FMFVPFiUPVmPktXtLS",
    },
    "annual": {
        "label": "Pro Annual",
        "amount": 150.00,
        "interval_days": 365,
        "lifetime": False,
        "stripe_price_id": "price_1TQ7XDFMFVPFiUPVs3gc0sHA",
    },
    "lifetime": {
        "label": "Pro Lifetime",
        "amount": 200.00,
        "interval_days": 0,
        "lifetime": True,
        "stripe_price_id": "price_1TQ7XDFMFVPFiUPVG8YEHLF2",
    },
}

# One-off ADDONS — separate from PLANS because they don't grant Pro, they
# unlock extra features ON TOP of any tier (including Free). The backend
# stores them on subscription.addons.<key> = {active, purchased_at, ...}.
# We keep the schema flat-ish so a user can stack multiple add-ons without
# us redesigning the doc each time.
#
# NB: the INTERNAL key stays `premium_uk_law` for back-compat with already-
# purchased user docs, but the USER-FACING label is "Law Pack Add-on".
# Rename the key only via a migration script, never in-place.
#
# `stripe_price_id` is the real Stripe Price ID configured in the Dashboard
# under Products → Law Pack Add-on → Pricing. Not used today (we pass
# `amount` to the Emergent wrapper), but wired in so the live-key migration
# can switch to `line_items=[{price: stripe_price_id, quantity: 1}]` with
# zero code changes here.
ADDONS = {
    "premium_uk_law": {
        "label": "Law Pack Add-on",
        "amount": 10.00,
        "stripe_price_id": "price_1TSZlfFMFVPFiUPVoFZQbWMS",
        "description": "Full BAILII case-law search, statute cross-references, and LexisNexis BYOK proxy",
    },
}


class AddonCheckoutRequest(BaseModel):
    addon: str          # e.g. 'premium_uk_law'
    origin_url: str


class CheckoutRequest(BaseModel):
    plan: str           # 'monthly' | 'annual' | 'lifetime'
    origin_url: str     # window.location.origin from the client
    ref_code: Optional[str] = ""   # affiliate referral code captured from ?ref=


def _plan_amount_cents(plan_key: str) -> int:
    return int(PLANS[plan_key]["amount"] * 100)


# 25% off the first invoice for new customers arriving via a referral link.
# Applied directly to the Stripe Checkout amount because the Emergent wrapper
# doesn't expose the `discounts` array. Trade-off: customer sees the
# discounted price as the "real" price (no strike-through). When we migrate
# to raw Stripe SDK we'll switch to a proper Coupon for the strike-through UX.
REFERRAL_DISCOUNT_PCT = 0.25


def _ref_discounted_amount(plan_key: str, has_referral: bool) -> float:
    base = PLANS[plan_key]["amount"]
    if has_referral:
        return round(base * (1 - REFERRAL_DISCOUNT_PCT), 2)
    return base


def _build_stripe(webhook_url: Optional[str] = None) -> StripeCheckout:
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured (STRIPE_API_KEY missing)")
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url or "")


FOUNDER_LIMIT = 50  # First N lifetime purchases are flagged as VIP Founders.


async def _activate_pro(db: AsyncIOMotorDatabase, user_id: str, plan: str) -> dict:
    """Idempotent — granted only on first successful completion per session.

    For the 'lifetime' plan: if the current founder count is under FOUNDER_LIMIT,
    the buyer is flagged as a VIP Founder and given a permanent badge on their
    subscription doc. Returns the update dict actually applied (useful for logs).
    """
    if plan not in PLANS:
        return {}
    meta = PLANS[plan]
    now = datetime.now(timezone.utc)
    end = "" if meta["lifetime"] else (now + timedelta(days=meta["interval_days"])).isoformat()

    is_founder = False
    founder_number = None
    if meta["lifetime"]:
        # Count existing founders atomically-ish — not perfect under heavy
        # concurrency, but with a limit of 50 lifetime purchases the race
        # window is negligible. Don't count THIS user (they haven't been
        # flagged yet) — if they've already got it, _maybe_activate above
        # short-circuits before we get here.
        existing_founders = await db.users.count_documents({"subscription.founder": True})
        if existing_founders < FOUNDER_LIMIT:
            is_founder = True
            founder_number = existing_founders + 1

    update = {
        "subscription.status": "active",
        "subscription.plan": plan,
        "subscription.lifetime": meta["lifetime"],
        "subscription.current_period_end": end,
        "subscription.trial_end": "",
        "subscription.activated_at": now.isoformat(),
    }
    if is_founder:
        update["subscription.founder"] = True
        update["subscription.founder_number"] = founder_number

    await db.users.update_one({"user_id": user_id}, {"$set": update})
    return update


async def _activate_addon(db: AsyncIOMotorDatabase, user_id: str, addon: str, session_id: str) -> dict:
    """Idempotent — flips `subscription.addons.<addon>` to active. Add-ons
    are stand-alone, one-off purchases that DON'T touch plan/lifetime
    state, so a Free or Pro user can both own a Law Pack add-on
    without conflict.

    We keep `purchased_at`, `session_id`, and `purchased_tier` so refunds/
    disputes can be traced from the user doc back to the original Stripe
    payment without cross-referencing payment_transactions every time.

    `purchased_tier` drives expiry policy in `addon_is_active()`:
      - lifetime at time of purchase → addon is PERMANENT (covers all future
        subscription state changes)
      - monthly/annual at time of purchase → addon is valid only while the
        parent subscription is active (lapses when sub expires/cancels)
      - free at time of purchase → addon is valid for 365 days from purchase
        (free users still get the feature but re-verify yearly)
    """
    if addon not in ADDONS:
        return {}
    now = datetime.now(timezone.utc)

    # Snapshot the tier at the moment of purchase so downstream expiry
    # checks are deterministic.  Free users who buy an add-on get a
    # 365-day grace before the check returns False; Pro users get it
    # as long as their subscription is live; Lifetime = forever.
    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "subscription": 1},
    )
    sub = (u or {}).get("subscription") or {}
    plan_at_purchase = (sub.get("plan") or "free").lower() or "free"
    lifetime_at_purchase = bool(sub.get("lifetime") or plan_at_purchase == "lifetime")

    update = {
        f"subscription.addons.{addon}": {
            "active": True,
            "purchased_at": now.isoformat(),
            "session_id": session_id,
            "purchased_tier": "lifetime" if lifetime_at_purchase else plan_at_purchase,
        },
    }
    await db.users.update_one({"user_id": user_id}, {"$set": update})
    return update


def addon_is_active(user_doc: dict, addon_key: str) -> bool:
    """Single source of truth for whether an add-on is CURRENTLY valid.

    Rules (see _activate_addon for the tier-at-purchase logic):
      - addon record missing or active=False → False
      - purchased_tier = lifetime → True forever (they paid the lifetime $200,
        they keep the add-on even if they somehow get downgraded).
      - purchased_tier = monthly/annual/trialing → True iff the user's
        current subscription status is active/trialing AND (for non-lifetime)
        their current_period_end is still in the future.
      - purchased_tier = free → True for 365 days after purchase, then False.
        Free users can re-buy the add-on to extend for another year.

    Back-compat: older add-on records (before purchased_tier was written)
    fall through to the current subscription check — same as a Pro
    purchase — which matches the pre-expiry behaviour.
    """
    sub = (user_doc or {}).get("subscription") or {}
    addons = sub.get("addons") or {}
    meta = addons.get(addon_key) or {}
    if not meta.get("active"):
        return False

    purchased_tier = (meta.get("purchased_tier") or "").lower()

    # Lifetime purchase = permanent.
    if purchased_tier == "lifetime":
        return True

    # Free purchase = 365-day grace.
    if purchased_tier == "free":
        purchased_at = meta.get("purchased_at") or ""
        try:
            pa = datetime.fromisoformat(purchased_at.replace("Z", "+00:00"))
            if pa.tzinfo is None:
                pa = pa.replace(tzinfo=timezone.utc)
            return (datetime.now(timezone.utc) - pa).days < 365
        except Exception:
            return False

    # Pro purchase (monthly/annual) OR legacy record without purchased_tier:
    # the add-on is tied to the parent subscription being live. If the
    # user holds a lifetime plan NOW (upgraded after the add-on purchase),
    # the add-on becomes permanent — we honour the upgrade.
    status = (sub.get("status") or "").lower()
    if sub.get("lifetime") or (sub.get("plan") or "").lower() == "lifetime":
        return status in ("active", "trialing")
    if status not in ("active", "trialing"):
        return False
    cpe = sub.get("current_period_end")
    if not cpe:
        return False
    try:
        if isinstance(cpe, datetime):
            end = cpe if cpe.tzinfo else cpe.replace(tzinfo=timezone.utc)
        else:
            end = datetime.fromisoformat(str(cpe).replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
        return end > datetime.now(timezone.utc)
    except Exception:
        return False


async def _mark_paid(db: AsyncIOMotorDatabase, session_id: str) -> None:
    """
    Mark a session paid and grant Pro exactly once. Safe to call multiple times
    (webhook + manual poll may race). Also accrues affiliate commission if
    the tx record carries a `referrer_user_id`.
    """
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx.get("pro_granted"):
        if tx:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "completed", "payment_status": "paid"}},
            )
        return
    # Branch on transaction kind. Plans grant Pro; add-ons just flip a
    # feature flag on the user doc. Default kind is "plan" for backwards
    # compatibility with rows written before add-ons existed.
    kind = tx.get("kind") or "plan"
    if kind == "addon":
        await _activate_addon(db, tx["user_id"], tx.get("addon", ""), session_id)
    else:
        await _activate_pro(db, tx["user_id"], tx["plan"])
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "payment_status": "paid", "pro_granted": True}},
    )
    # Affiliate commission — fire-and-forget. We use the BASE amount (pre-
    # discount) for commission so the affiliate isn't punished for the
    # 25%-off-first-invoice promo we gave their referee.
    try:
        if tx.get("referrer_user_id"):
            from affiliate import accrue_commission
            await accrue_commission(
                db,
                referee_user_id=tx["user_id"],
                referee_plan=tx["plan"],
                paid_amount_cents=int(tx.get("amount_base") or tx.get("amount") or 0),
                session_id=session_id,
            )
    except Exception:
        logger.exception("Affiliate commission accrual failed (non-fatal)")


def make_router(db: AsyncIOMotorDatabase, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api/billing")

    @router.get("/plans")
    async def plans():
        founders_taken = await db.users.count_documents({"subscription.founder": True})
        return {
            "available": list(PLANS.keys()),
            "plans": [
                {
                    "id": k,
                    "label": v["label"],
                    "amount": _plan_amount_cents(k),
                    "interval": ("month" if k in ("monthly", "lite") else "year" if k == "annual" else None),
                }
                for k, v in PLANS.items()
            ],
            "founders": {
                "limit": FOUNDER_LIMIT,
                "taken": founders_taken,
                "remaining": max(0, FOUNDER_LIMIT - founders_taken),
            },
        }

    @router.post("/create-checkout")
    async def create_checkout(payload: CheckoutRequest, request: Request, user: dict = Depends(current_user_dep)):
        if payload.plan not in PLANS:
            raise HTTPException(status_code=400, detail="Invalid plan")

        origin = payload.origin_url.rstrip("/")
        success_url = f"{origin}/app?upgraded=true&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}/app?upgraded=false"
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"

        # Resolve the affiliate referral, if any. Three guard rails:
        #   1) Code must exist in DB
        #   2) Affiliate can't refer themselves (silently dropped, no error)
        #   3) Once a user is attributed, we don't overwrite — first ref wins
        from affiliate import find_affiliate_by_code
        ref_code = (payload.ref_code or "").strip().lower()
        referrer_user_id = ""
        apply_discount = False
        if ref_code:
            aff = await find_affiliate_by_code(db, ref_code)
            if aff and aff.get("user_id") and aff["user_id"] != user["user_id"]:
                referrer_user_id = aff["user_id"]
                # Stamp on user doc IF not already attributed. We never
                # rewrite an existing referral — first link wins.
                existing_ref = ((user.get("affiliate") or {}).get("referred_by") or "")
                if not existing_ref:
                    await db.users.update_one(
                        {"user_id": user["user_id"]},
                        {"$set": {
                            "affiliate.referred_by": referrer_user_id,
                            "affiliate.referred_via_code": ref_code,
                            "affiliate.referred_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                # Customer-side discount applies only on the FIRST invoice
                # paid by this referee. We use the count of past
                # payment_transactions (paid only) as a proxy for "is this
                # the first paid invoice".
                paid_before = await db.payment_transactions.count_documents({
                    "user_id": user["user_id"],
                    "pro_granted": True,
                })
                apply_discount = (paid_before == 0)

        amount = _ref_discounted_amount(payload.plan, apply_discount)

        checkout = _build_stripe(webhook_url=webhook_url)
        # Prefer the named Stripe Price ID when we're charging the full price
        # (so receipts link to the Product, reporting is cleaner). Stripe
        # Prices are immutable so we can't pair them with a discounted amount —
        # in that case fall back to the wrapper's dynamic-amount path.
        plan_price_id = PLANS.get(payload.plan, {}).get("stripe_price_id", "").strip()
        # The Emergent StripeCheckout wrapper enforces XOR between `amount`
        # and `stripe_price_id` (you give it ONE, not both — Stripe Prices
        # are immutable so the wrapper doesn't let you override the listed
        # amount with a custom one). Build the kwargs accordingly.
        checkout_kwargs = {
            "currency": "usd",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "metadata": {
                "user_id": user["user_id"],
                "user_email": user.get("email") or "",
                "plan": payload.plan,
                "referrer_user_id": referrer_user_id,
                "discount_applied": "1" if apply_discount else "0",
            },
        }
        if plan_price_id and not apply_discount:
            # Use the named Price (cleaner receipts, links to the Stripe
            # Product). No `amount` field — Stripe pulls it from the Price.
            checkout_kwargs["stripe_price_id"] = plan_price_id
            checkout_kwargs["quantity"] = 1
        else:
            # No Price ID configured (e.g. Lite tier hasn't had its Stripe
            # Product created yet) OR a referral discount is active. Use
            # dynamic-amount checkout — the wrapper synthesises a one-off
            # Price internally.
            checkout_kwargs["amount"] = amount
        req = CheckoutSessionRequest(**checkout_kwargs)
        try:
            session = await checkout.create_checkout_session(req)
        except Exception as e:
            logger.exception("Stripe checkout creation failed")
            raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

        await db.payment_transactions.insert_one({
            "user_id": user["user_id"],
            "session_id": session.session_id,
            "plan": payload.plan,
            "amount": int(amount * 100),
            "amount_base": _plan_amount_cents(payload.plan),
            "currency": "usd",
            "status": "initiated",
            "payment_status": "pending",
            "pro_granted": False,
            "referrer_user_id": referrer_user_id,
            "discount_applied": apply_discount,
            "created_at": datetime.now(timezone.utc),
        })

        return {"url": session.url, "session_id": session.session_id}

    @router.post("/create-addon-checkout")
    async def create_addon_checkout(payload: AddonCheckoutRequest, request: Request, user: dict = Depends(current_user_dep)):
        """One-off Stripe checkout for a feature add-on (e.g. Premium UK
        Law $10).  Distinct from create-checkout because:
          • It's a `payment` mode session, not a subscription.
          • It writes `kind: 'addon'` on the payment_transactions row so
            the webhook flips the right flag on activation.
          • It does NOT consume the affiliate referral pool — add-ons
            are too small to be worth a 25% discount, and we don't want
            referrers paid commission twice on what is effectively the
            same customer's wallet.
        """
        if payload.addon not in ADDONS:
            raise HTTPException(status_code=400, detail="Unknown add-on")
        # Already-purchased guard — if the user already owns this add-on,
        # don't let them double-pay. Stripe doesn't refund unless we
        # action the dispute manually, so prevention >> cure.
        u = await db.users.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0, "subscription": 1},
        )
        addons = ((u or {}).get("subscription") or {}).get("addons") or {}
        if (addons.get(payload.addon) or {}).get("active"):
            raise HTTPException(status_code=409, detail="Add-on already owned")

        meta = ADDONS[payload.addon]
        origin = payload.origin_url.rstrip("/")
        success_url = f"{origin}/app?addon=premium-uk-law&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}/app?addon=cancelled"
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"

        checkout = _build_stripe(webhook_url=webhook_url)
        # Prefer the real Stripe Price ID (gives us proper Product linkage,
        # receipt line-items pointing at the named Product, better reporting).
        # Fall back to amount-based dynamic pricing if no price ID is set
        # (lets us add new add-ons in code without pre-configuring Stripe).
        checkout_kwargs = {
            "currency": "usd",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "metadata": {
                "user_id": user["user_id"],
                "user_email": user.get("email") or "",
                "kind": "addon",
                "addon": payload.addon,
            },
        }
        price_id = (meta.get("stripe_price_id") or "").strip()
        if price_id:
            checkout_kwargs["stripe_price_id"] = price_id
            checkout_kwargs["quantity"] = 1
            # `amount` is still required by the wrapper's model — it's used as
            # a consistency check against the Stripe price. Keep it in sync
            # with the dashboard price.
            checkout_kwargs["amount"] = float(meta["amount"])
        else:
            checkout_kwargs["amount"] = float(meta["amount"])
        req = CheckoutSessionRequest(**checkout_kwargs)
        try:
            session = await checkout.create_checkout_session(req)
        except Exception as e:
            logger.exception("Stripe addon checkout creation failed")
            raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

        await db.payment_transactions.insert_one({
            "user_id": user["user_id"],
            "session_id": session.session_id,
            "kind": "addon",
            "addon": payload.addon,
            "amount": int(meta["amount"] * 100),
            "amount_base": int(meta["amount"] * 100),
            "currency": "usd",
            "status": "initiated",
            "payment_status": "pending",
            "pro_granted": False,
            "created_at": datetime.now(timezone.utc),
        })

        return {"url": session.url, "session_id": session.session_id}

    @router.get("/checkout-status/{session_id}")
    async def checkout_status(session_id: str, user: dict = Depends(current_user_dep)):
        """
        DB-only view — updated by the webhook. No Stripe API call (the Emergent
        wrapper's retrieve is broken for sessions it creates, see file header).
        """
        tx = await db.payment_transactions.find_one(
            {"session_id": session_id},
            {"_id": 0, "user_id": 1, "status": 1, "payment_status": 1, "plan": 1, "pro_granted": 1},
        )
        if not tx:
            raise HTTPException(status_code=404, detail="Unknown session")
        if tx.get("user_id") != user["user_id"]:
            raise HTTPException(status_code=403, detail="Not your checkout session")
        return {
            "status": tx.get("status", "initiated"),
            "payment_status": tx.get("payment_status", "pending"),
            "plan": tx.get("plan"),
            "pro_granted": bool(tx.get("pro_granted", False)),
        }

    @router.post("/resync/{session_id}")
    async def resync(session_id: str, user: dict = Depends(current_user_dep)):
        """
        User-triggered "I paid but I'm still not Pro" rescue path. Used when
        the Stripe webhook hasn't reached the preview/production env (e.g. the
        webhook URL is blocked, or the user clicked back before the webhook
        could land). Logs a support request and queues manual review.
        """
        tx = await db.payment_transactions.find_one(
            {"session_id": session_id},
            {"_id": 0, "user_id": 1, "plan": 1, "pro_granted": 1, "status": 1},
        )
        if not tx:
            raise HTTPException(status_code=404, detail="Unknown session")
        if tx.get("user_id") != user["user_id"]:
            raise HTTPException(status_code=403, detail="Not your checkout session")
        if tx.get("pro_granted"):
            return {"ok": True, "already_pro": True, "plan": tx.get("plan")}

        # Queue a support ticket for manual verification (we don't auto-grant
        # here — would create an abuse vector. A human owner reviews the
        # Stripe dashboard and flips the flag via a backend tool.)
        await db.support_tickets.insert_one({
            "user_id": user["user_id"],
            "email": user.get("email") or "",
            "type": "stripe_not_pro",
            "session_id": session_id,
            "plan": tx.get("plan"),
            "created_at": datetime.now(timezone.utc),
            "status": "open",
        })
        logger.info(f"Support ticket opened — user={user['user_id']} session={session_id}")
        return {
            "ok": True,
            "queued": True,
            "message": "We'll verify your payment and enable Pro within 24h. You'll get an email.",
        }

    @router.post("/portal")
    async def customer_portal(request: Request, user: dict = Depends(current_user_dep)):
        """
        Stripe Customer Portal — lets users self-serve cancellation, card update,
        invoice download. Requires the raw `stripe` SDK (not the Emergent
        wrapper, which doesn't expose this endpoint).

        In test mode with the Emergent-managed `sk_test_emergent` key the raw
        SDK can't authenticate, so we fall back to the support email path. In
        production you'd paste a real `sk_live_...` key in `.env` and this
        Just Works.
        """
        u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "stripe_customer_id": 1})
        customer_id = (u or {}).get("stripe_customer_id")
        if not customer_id:
            raise HTTPException(
                status_code=404,
                detail="No active subscription found. Email press@marvex.app if you believe this is wrong.",
            )

        stripe_sdk.api_key = STRIPE_API_KEY
        return_url = f"{str(request.base_url).rstrip('/')}/app"
        try:
            session = stripe_sdk.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            return {"url": session.url}
        except Exception as e:
            logger.warning(f"Stripe portal failed (likely test-key restriction): {e}")
            raise HTTPException(
                status_code=502,
                detail=(
                    "Customer portal isn't available right now. "
                    "Email press@marvex.app to manage your subscription and we'll handle it within 24h."
                ),
            )

    return router


def make_webhook_router(db: AsyncIOMotorDatabase) -> APIRouter:
    """Stripe webhook — no auth (Stripe calls it directly). Source of truth."""
    router = APIRouter()

    # Raw Stripe webhook secret — ONLY used when a user moves from the
    # pod's shared `sk_test_emergent` key to their own live `sk_live_...`
    # key. In the live flow they set `STRIPE_WEBHOOK_SECRET` in the
    # backend .env and we use the raw Stripe SDK to verify signatures
    # for lifecycle events (past_due, cancel_at_period_end, etc.) that
    # the Emergent wrapper doesn't surface. In test mode this is empty
    # and we fall back to the wrapper's paid-event handling only.
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()

    async def _handle_subscription_event(sub: dict) -> None:
        """Sync subscription lifecycle (status, cancel_at_period_end) from
        a Stripe `customer.subscription.*` event payload onto our user doc.
        Finds the user via their Stripe customer_id cached at checkout."""
        customer_id = sub.get("customer")
        if not customer_id:
            return
        user = await db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "user_id": 1},
        )
        if not user:
            return
        status = sub.get("status") or "active"
        cancel_at_period_end = bool(sub.get("cancel_at_period_end", False))
        current_period_end_ts = sub.get("current_period_end")  # unix seconds
        update = {
            "subscription.status": status,
            "subscription.cancel_at_period_end": cancel_at_period_end,
        }
        if current_period_end_ts:
            try:
                end_iso = datetime.fromtimestamp(int(current_period_end_ts), tz=timezone.utc).isoformat()
                update["subscription.current_period_end"] = end_iso
            except Exception:
                pass
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
        logger.info(
            f"[stripe-webhook] sub update user={user['user_id']} status={status} "
            f"cancel_at_period_end={cancel_at_period_end}"
        )

    @router.post("/api/webhook/stripe")
    async def stripe_webhook(request: Request):
        body = await request.body()
        sig = request.headers.get("Stripe-Signature", "")

        # Try the raw Stripe SDK path FIRST when a real webhook secret is
        # configured — this catches the full event taxonomy including
        # subscription.updated / customer.subscription.deleted /
        # invoice.payment_failed that the Emergent wrapper doesn't expose.
        if STRIPE_WEBHOOK_SECRET:
            try:
                stripe_sdk.api_key = STRIPE_API_KEY
                evt = stripe_sdk.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
                etype = evt.get("type", "")
                data = (evt.get("data") or {}).get("object") or {}
                if etype in (
                    "customer.subscription.updated",
                    "customer.subscription.deleted",
                    "customer.subscription.created",
                ):
                    await _handle_subscription_event(data)
                    return {"received": True}
                if etype == "invoice.payment_failed":
                    # Also flip the subscription to past_due so the banner fires
                    # even if Stripe hasn't sent subscription.updated yet.
                    sub_id = data.get("subscription")
                    if sub_id:
                        try:
                            sub_obj = stripe_sdk.Subscription.retrieve(sub_id)
                            await _handle_subscription_event(sub_obj)
                        except Exception as e:
                            logger.warning(f"[stripe-webhook] retrieve sub failed: {e}")
                    return {"received": True}
                # Fall through to the Emergent wrapper for checkout.session.completed
                # so we keep a single code path for initial purchases.
            except ValueError as e:
                logger.warning(f"[stripe-webhook] raw verify bad payload: {e}")
                # don't short-circuit — let the wrapper have a go
            except Exception as e:
                logger.warning(f"[stripe-webhook] raw verify failed (falling back): {e}")

        # Emergent wrapper path — handles checkout.session.completed for the
        # shared sk_test_emergent key and the initial paid upgrade flow.
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
        checkout = _build_stripe(webhook_url=webhook_url)

        try:
            event = await checkout.handle_webhook(body, sig)
        except Exception as e:
            logger.warning(f"Stripe webhook parse/verify failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")

        # WebhookEventResponse fields (per the playbook): event_type, event_id,
        # session_id, payment_status, metadata. Fall through defensively in case
        # the wrapper returns a plain dict.
        session_id = getattr(event, "session_id", None) or (event.get("session_id") if isinstance(event, dict) else None)
        payment_status = getattr(event, "payment_status", None) or (event.get("payment_status") if isinstance(event, dict) else None)

        if session_id and payment_status == "paid":
            await _mark_paid(db, session_id)

        return {"received": True}

    return router

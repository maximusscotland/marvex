"""Comp / VIP access codes — manual list maintained in `ACCESS_CODES` env.

Use case: founder hand-grants free Pro / Lifetime / Founder tiers to friends,
family, beta testers, journalists, contest winners. NOT used for paying
customers — that flow goes via Stripe Checkout.

ENV FORMAT — comma-separated `CODE:TIER[:DAYS]` triples:
    ACCESS_CODES=BRO-ALEX:pro:365,BRO-SAM:lifetime,VIP-MIKE:founder

  CODE       — uppercase letters / digits / dashes, case-insensitive on
               redemption, ≥ 4 chars. The user types this on the gate.
  TIER       — one of: pro | annual | lifetime | founder
                pro       → 365-day Pro Monthly equivalent (default DAYS=365)
                annual    → 365 days, presented as "Annual"
                lifetime  → permanent, no expiry
                founder   → permanent + Founder badge (counts towards 50 limit)
  DAYS       — optional; only meaningful for `pro` and `annual`. Sets
               `current_period_end = now + DAYS`. For `lifetime` and `founder`
               we ignore it.

REVOKE: just delete the entry from the env line and restart the backend.
The user keeps any tier already redeemed on their account (we don't claw
back) — but they can't re-redeem if a fresh signup tries the same code.

REUSABLE: yes, by design. Multiple users can redeem the same code (handy
for "VIP-LAUNCH" giveaways). Each user gets it ONCE — we de-duplicate per
user via `subscription.redeemed_codes`.

PUBLIC ENDPOINTS:
  POST /api/access/validate  {code}  → {valid, tier, label}   no auth
  POST /api/access/redeem    {code}  → {ok, tier}              auth required
"""
from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

logger = logging.getLogger("backend.access_codes")

CODE_RE = re.compile(r"^[A-Z0-9][A-Z0-9-]{2,31}$")
VALID_TIERS = {"pro", "annual", "lifetime", "founder"}
DEFAULT_DAYS_PER_TIER = {"pro": 365, "annual": 365}


def _parse_codes_env(raw: str) -> dict[str, dict]:
    """Parse `ACCESS_CODES` env into `{CODE: {tier, days}}`. Defensive — bad
    entries are skipped with a warning rather than crashing the backend."""
    out: dict[str, dict] = {}
    if not raw:
        return out
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p.strip() for p in chunk.split(":")]
        if len(parts) < 2:
            logger.warning("access-code: skipped malformed entry %r (need CODE:TIER)", chunk)
            continue
        code = parts[0].upper()
        tier = parts[1].lower()
        if not CODE_RE.match(code):
            logger.warning("access-code: skipped invalid code %r (chars/length)", code)
            continue
        if tier not in VALID_TIERS:
            logger.warning("access-code: skipped %s — unknown tier %r", code, tier)
            continue
        days: Optional[int] = None
        if len(parts) >= 3 and parts[2]:
            try:
                days = int(parts[2])
                if days <= 0:
                    raise ValueError
            except ValueError:
                logger.warning("access-code: skipped %s — bad DAYS %r", code, parts[2])
                continue
        if days is None:
            days = DEFAULT_DAYS_PER_TIER.get(tier)
        out[code] = {"tier": tier, "days": days}
    if out:
        logger.info("access-codes loaded: %d (%s)", len(out), ", ".join(sorted(out)))
    return out


def get_codes() -> dict[str, dict]:
    """Re-parsed on every call so editing the .env file + supervisor reload
    immediately reflects new codes without a code change."""
    return _parse_codes_env(os.environ.get("ACCESS_CODES", ""))


def lookup_code(code: str) -> Optional[dict]:
    if not code:
        return None
    return get_codes().get(code.strip().upper())


# ----- Pydantic models -----
class CodeValidatePayload(BaseModel):
    code: str = Field(..., min_length=2, max_length=64)


class CodeValidateResponse(BaseModel):
    valid: bool
    tier: Optional[str] = None
    label: Optional[str] = None  # human-readable "Pro · 365 days" / "Lifetime" / "Founder"


class CodeRedeemResponse(BaseModel):
    ok: bool
    tier: str
    already_redeemed: bool = False
    founder_number: Optional[int] = None


def _label_for(tier: str, days: Optional[int]) -> str:
    if tier == "lifetime":
        return "Pro Lifetime · forever"
    if tier == "founder":
        return "Founder · permanent · gold badge"
    if tier == "annual":
        return f"Pro Annual · {days} days"
    return f"Pro · {days} days"


def make_router(
    db: AsyncIOMotorDatabase,
    current_user_dep: Callable,
    founder_limit: int = 50,
) -> APIRouter:
    router = APIRouter(prefix="/api/access", tags=["access"])

    @router.post("/validate", response_model=CodeValidateResponse)
    async def validate(payload: CodeValidatePayload):
        meta = lookup_code(payload.code)
        if not meta:
            return CodeValidateResponse(valid=False)
        return CodeValidateResponse(
            valid=True,
            tier=meta["tier"],
            label=_label_for(meta["tier"], meta.get("days")),
        )

    @router.post("/redeem", response_model=CodeRedeemResponse)
    async def redeem(payload: CodeValidatePayload, user: dict = Depends(current_user_dep)):
        meta = lookup_code(payload.code)
        if not meta:
            raise HTTPException(status_code=404, detail="Invalid or revoked code")

        code_norm = payload.code.strip().upper()
        user_id = user["user_id"]
        sub = (user.get("subscription") or {}).copy()
        redeemed = list(sub.get("redeemed_codes") or [])

        # Idempotent: if this user already redeemed THIS exact code, return
        # the success response without doubling up the tier — but also don't
        # error, so a stale localStorage replay just no-ops.
        if code_norm in redeemed:
            return CodeRedeemResponse(
                ok=True,
                tier=meta["tier"],
                already_redeemed=True,
                founder_number=user.get("founder_number"),
            )

        now = datetime.now(timezone.utc)
        tier = meta["tier"]
        update: dict = {}
        founder_number = user.get("founder_number")

        if tier == "founder":
            # Founder = lifetime + badge. Honour the 50-cap because the
            # marketing pages promise it. If cap reached, fall back to
            # plain lifetime + log so I can decide policy later.
            taken = await db.users.count_documents({"founder": True})
            if taken < founder_limit:
                update.update({
                    "subscription.plan": "lifetime",
                    "subscription.lifetime": True,
                    "subscription.status": "active",
                    "subscription.cancel_at_period_end": False,
                    "founder": True,
                    "founder_number": taken + 1,
                    "founder_granted_at": now.isoformat(),
                })
                founder_number = taken + 1
            else:
                logger.warning("access-code: founder cap reached, demoting %s to lifetime", code_norm)
                update.update({
                    "subscription.plan": "lifetime",
                    "subscription.lifetime": True,
                    "subscription.status": "active",
                    "subscription.cancel_at_period_end": False,
                })
                tier = "lifetime"
        elif tier == "lifetime":
            update.update({
                "subscription.plan": "lifetime",
                "subscription.lifetime": True,
                "subscription.status": "active",
                "subscription.cancel_at_period_end": False,
            })
        else:  # pro / annual
            days = meta.get("days") or 365
            end = (now + timedelta(days=days)).isoformat()
            update.update({
                "subscription.plan": "annual" if tier == "annual" else "monthly",
                "subscription.lifetime": False,
                "subscription.status": "active",
                "subscription.current_period_end": end,
                "subscription.cancel_at_period_end": False,
            })

        # Record the redemption regardless of tier so we don't double-issue.
        update["subscription.redeemed_codes"] = redeemed + [code_norm]
        update["subscription.last_redemption_at"] = now.isoformat()

        await db.users.update_one({"user_id": user_id}, {"$set": update})
        logger.info("access-code redeemed: user=%s code=%s tier=%s", user_id, code_norm, tier)
        return CodeRedeemResponse(
            ok=True,
            tier=tier,
            already_redeemed=False,
            founder_number=founder_number,
        )

    return router

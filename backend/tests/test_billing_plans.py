"""
Unit tests for billing.PLANS, the public /plans endpoint shape, and the
BYOK-gated AI routes.

Run: cd /app/backend && python -m pytest tests/test_billing_plans.py -v
"""

import importlib


def test_plans_structure():
    """Server-owned plan pricing — prevents frontend price manipulation."""
    billing = importlib.import_module("billing")
    plans = billing.PLANS
    assert set(plans.keys()) == {"lite", "monthly", "annual", "lifetime"}

    # Amounts are USD decimals (the StripeCheckout wrapper wants decimals).
    assert plans["lite"]["amount"] == 9.00
    assert plans["lite"]["interval_days"] == 30
    assert plans["lite"]["lifetime"] is False

    assert plans["monthly"]["amount"] == 15.00
    assert plans["monthly"]["interval_days"] == 30
    assert plans["monthly"]["lifetime"] is False

    assert plans["annual"]["amount"] == 150.00
    assert plans["annual"]["interval_days"] == 365
    assert plans["annual"]["lifetime"] is False

    assert plans["lifetime"]["amount"] == 200.00
    assert plans["lifetime"]["interval_days"] == 0
    assert plans["lifetime"]["lifetime"] is True


def test_plan_amount_cents_conversion():
    """Public /plans endpoint still returns cents (unchanged wire contract)."""
    billing = importlib.import_module("billing")
    assert billing._plan_amount_cents("lite") == 900
    assert billing._plan_amount_cents("monthly") == 1500
    assert billing._plan_amount_cents("annual") == 15000
    assert billing._plan_amount_cents("lifetime") == 20000


def test_lite_plan_uses_live_stripe_price_id():
    """Lite has a live Stripe Price ID as of Feb 2026. Regression guard:
    if someone accidentally clears it back to "" without intending to,
    receipts revert to the auto-generated dynamic-amount label which
    looks unprofessional. The XOR-validator handling lives in
    `test_create_checkout_priced_plans_no_xor_pydantic_error`.
    """
    billing = importlib.import_module("billing")
    pid = billing.PLANS["lite"]["stripe_price_id"]
    assert pid.startswith("price_"), f"Expected live Stripe Price ID, got {pid!r}"


def test_affiliate_lite_subscribers_earn_subscriber_rate():
    """Lite subscribers earn the same 5% + 1 bonus month as monthly/annual
    Pro subscribers (per-product spec — every paying user is an evangelist).
    """
    affiliate = importlib.import_module("affiliate")
    def u(plan):
        return {"subscription": {"plan": plan, "status": "active"}}
    assert affiliate.resolve_tier(u("lite")) == (0.05, "subscriber")
    assert affiliate.resolve_tier(u("monthly")) == (0.05, "subscriber")
    assert affiliate.resolve_tier(u("annual")) == (0.05, "subscriber")
    # Lifetime keeps its 17% one-off rate
    assert affiliate.resolve_tier(u("lifetime")) == (0.17, "lifetime")
    # Free / unknown plans earn nothing
    assert affiliate.resolve_tier(u("free")) == (0.0, "free")
    assert affiliate.resolve_tier({}) == (0.0, "free")
    assert affiliate.resolve_tier(None) == (0.0, "free")


def test_free_ai_limit_is_one_for_byok_policy():
    server = importlib.import_module("server")
    # BYOK-first: every user gets exactly one trial run on our key.
    assert server.FREE_AI_LIMIT == 1

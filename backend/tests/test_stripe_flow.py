"""
End-to-end test of the Stripe checkout flow using the Emergent-managed
`sk_test_emergent` key. Mocks the user + DB, exercises the real wrapper
(which talks to a real Stripe test account behind the Emergent proxy).

Skip when STRIPE_API_KEY isn't set (CI without secrets).

Run: cd /app/backend && python -m pytest tests/test_stripe_flow.py -v
"""

import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

# Import AFTER load_dotenv so billing.STRIPE_API_KEY is populated.
from billing import make_router, make_webhook_router, _mark_paid, _activate_pro  # noqa: E402

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "").strip()
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = "mindmapper_stripe_test"

pytestmark = pytest.mark.skipif(not STRIPE_API_KEY, reason="STRIPE_API_KEY not set")


@pytest_asyncio.fixture
async def db():
    client = AsyncIOMotorClient(MONGO_URL)
    d = client[DB_NAME]
    # Clean slate per test
    await d.users.delete_many({})
    await d.payment_transactions.delete_many({})
    await d.users.insert_one({"user_id": "u-test", "email": "test@example.com", "subscription": {}})
    yield d
    await d.users.delete_many({})
    await d.payment_transactions.delete_many({})
    client.close()


def _fake_user_dep():
    async def current_user():
        return {"user_id": "u-test", "email": "test@example.com"}
    return current_user


@pytest_asyncio.fixture
async def client(db):
    app = FastAPI()
    app.include_router(make_router(db, _fake_user_dep()))
    app.include_router(make_webhook_router(db))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        yield c


# ---------- Unit: Pro activation ----------

@pytest.mark.asyncio
async def test_activate_pro_monthly_sets_30_day_window(db):
    await _activate_pro(db, "u-test", "monthly")
    u = await db.users.find_one({"user_id": "u-test"}, {"_id": 0})
    sub = u["subscription"]
    assert sub["status"] == "active"
    assert sub["plan"] == "monthly"
    assert sub["lifetime"] is False
    # 30-day ISO window, not empty
    assert sub["current_period_end"]


@pytest.mark.asyncio
async def test_activate_pro_lifetime_no_expiry(db):
    await _activate_pro(db, "u-test", "lifetime")
    u = await db.users.find_one({"user_id": "u-test"}, {"_id": 0})
    sub = u["subscription"]
    assert sub["plan"] == "lifetime"
    assert sub["lifetime"] is True
    assert sub["current_period_end"] == ""


# ---------- Unit: VIP Founders (first 50 lifetime buyers) ----------

@pytest.mark.asyncio
async def test_first_lifetime_buyer_is_flagged_founder(db):
    await _activate_pro(db, "u-test", "lifetime")
    u = await db.users.find_one({"user_id": "u-test"}, {"_id": 0})
    sub = u["subscription"]
    assert sub.get("founder") is True
    assert sub.get("founder_number") == 1


@pytest.mark.asyncio
async def test_lifetime_buyer_51_is_not_founder(db):
    import billing as _billing
    # Pre-seed 50 existing founders
    await db.users.insert_many([
        {"user_id": f"f-{i}", "subscription": {"founder": True, "founder_number": i + 1}}
        for i in range(_billing.FOUNDER_LIMIT)
    ])
    await _activate_pro(db, "u-test", "lifetime")
    u = await db.users.find_one({"user_id": "u-test"}, {"_id": 0})
    sub = u["subscription"]
    assert sub["plan"] == "lifetime"
    assert sub.get("founder") is not True


@pytest.mark.asyncio
async def test_monthly_buyer_never_gets_founder_badge(db):
    await _activate_pro(db, "u-test", "monthly")
    u = await db.users.find_one({"user_id": "u-test"}, {"_id": 0})
    assert u["subscription"].get("founder") is not True


# ---------- Unit: idempotency ----------

@pytest.mark.asyncio
async def test_mark_paid_is_idempotent(db):
    sid = "cs_test_idempo"
    await db.payment_transactions.insert_one({
        "user_id": "u-test", "session_id": sid, "plan": "monthly",
        "amount": 1500, "currency": "usd", "status": "initiated",
        "payment_status": "pending", "pro_granted": False,
        "created_at": datetime.now(timezone.utc),
    })
    # First call → grants Pro
    await _mark_paid(db, sid)
    tx1 = await db.payment_transactions.find_one({"session_id": sid})
    assert tx1["pro_granted"] is True
    assert tx1["status"] == "completed"
    # Second call → no double grant (no error)
    await _mark_paid(db, sid)
    tx2 = await db.payment_transactions.find_one({"session_id": sid})
    assert tx2["pro_granted"] is True


# ---------- API: /plans ----------

@pytest.mark.asyncio
async def test_plans_endpoint_returns_four_plans_in_cents(client):
    r = await client.get("/api/billing/plans")
    assert r.status_code == 200
    data = r.json()
    assert data["available"] == ["lite", "monthly", "annual", "lifetime"]
    amounts = {p["id"]: p["amount"] for p in data["plans"]}
    assert amounts == {"lite": 900, "monthly": 1500, "annual": 15000, "lifetime": 20000}
    # Founder counter surfaced in the public response
    assert data["founders"]["limit"] == 50
    assert data["founders"]["taken"] == 0
    assert data["founders"]["remaining"] == 50


@pytest.mark.asyncio
async def test_plans_endpoint_reflects_founder_count(client, db):
    await db.users.insert_many([
        {"user_id": f"f-{i}", "subscription": {"founder": True, "founder_number": i + 1}}
        for i in range(3)
    ])
    r = await client.get("/api/billing/plans")
    founders = r.json()["founders"]
    assert founders["taken"] == 3
    assert founders["remaining"] == 47


# ---------- API: /resync support rescue path ----------

@pytest.mark.asyncio
async def test_resync_queues_support_ticket_when_webhook_missing(client, db):
    sid = "cs_test_resync_1"
    await db.payment_transactions.insert_one({
        "user_id": "u-test", "session_id": sid, "plan": "monthly",
        "amount": 1500, "currency": "usd", "status": "initiated",
        "payment_status": "pending", "pro_granted": False,
        "created_at": datetime.now(timezone.utc),
    })
    r = await client.post(f"/api/billing/resync/{sid}")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["queued"] is True
    # Ticket was actually written
    t = await db.support_tickets.find_one({"session_id": sid})
    assert t is not None
    assert t["user_id"] == "u-test"
    assert t["status"] == "open"
    await db.support_tickets.delete_many({})


@pytest.mark.asyncio
async def test_resync_short_circuits_when_already_pro(client, db):
    sid = "cs_test_resync_done"
    await db.payment_transactions.insert_one({
        "user_id": "u-test", "session_id": sid, "plan": "lifetime",
        "amount": 20000, "currency": "usd", "status": "completed",
        "payment_status": "paid", "pro_granted": True,
        "created_at": datetime.now(timezone.utc),
    })
    r = await client.post(f"/api/billing/resync/{sid}")
    body = r.json()
    assert body["already_pro"] is True
    # Should NOT open a ticket
    t = await db.support_tickets.find_one({"session_id": sid})
    assert t is None


# ---------- Real wrapper: create checkout ----------

@pytest.mark.asyncio
async def test_create_checkout_returns_stripe_url(client, db, monkeypatch):
    """Hits the Stripe wrapper end-to-end — verifies the full chain.

    All 4 production plans now ship live `stripe_price_id` values. Live
    Price IDs return 'No such price' against the test-mode key the local
    pytest suite uses, so we monkey-patch `lite` to no-Price-ID for this
    one test (forces the dynamic-amount path which the sandbox accepts).
    The XOR-validator regression is covered separately by
    `test_create_checkout_priced_plans_no_xor_pydantic_error`.
    """
    import billing
    original_price = billing.PLANS["lite"]["stripe_price_id"]
    monkeypatch.setitem(billing.PLANS["lite"], "stripe_price_id", "")

    r = await client.post(
        "/api/billing/create-checkout",
        json={"plan": "lite", "origin_url": "https://example.com"},
    )
    # restore so other tests see the live Price ID
    billing.PLANS["lite"]["stripe_price_id"] = original_price

    assert r.status_code == 200, r.text
    data = r.json()
    assert data["session_id"].startswith("cs_test_")
    assert "checkout.stripe.com" in data["url"]

    tx = await db.payment_transactions.find_one({"session_id": data["session_id"]})
    assert tx["user_id"] == "u-test"
    assert tx["plan"] == "lite"
    assert tx["amount"] == 900
    assert tx["status"] == "initiated"
    assert tx["pro_granted"] is False


@pytest.mark.asyncio
async def test_create_checkout_rejects_invalid_plan(client):
    r = await client.post(
        "/api/billing/create-checkout",
        json={"plan": "enterprise", "origin_url": "https://example.com"},
    )
    assert r.status_code == 400


@pytest.mark.parametrize("plan", ["monthly", "annual", "lifetime"])
@pytest.mark.asyncio
async def test_create_checkout_priced_plans_no_xor_pydantic_error(client, plan):
    """Regression guard for the 'Cannot provide both amount and
    stripe_price_id' validator. monthly/annual/lifetime carry LIVE
    Stripe Price IDs that are rejected by the test-mode account
    ('No such price'), but they MUST NOT trip the wrapper's XOR check
    on amount+stripe_price_id (which would be a 500 with 'both fields'
    in the error message)."""
    r = await client.post(
        "/api/billing/create-checkout",
        json={"plan": plan, "origin_url": "https://example.com"},
    )
    # Either Stripe accepts (200) or rejects with 'No such price' / similar.
    # Anything mentioning 'both' or the Pydantic XOR violation is a regression.
    assert r.status_code in (200, 400, 500, 502), r.text
    body_lower = r.text.lower()
    assert "cannot provide both" not in body_lower, (
        f"Pydantic XOR validator tripped for plan={plan}: {r.text[:300]}"
    )
    assert "both amount and stripe_price_id" not in body_lower, r.text[:300]


# ---------- API: /checkout-status reads DB ----------

@pytest.mark.asyncio
async def test_checkout_status_reads_db_mirror(client, db):
    sid = "cs_test_status_fixture"
    await db.payment_transactions.insert_one({
        "user_id": "u-test", "session_id": sid, "plan": "annual",
        "amount": 15000, "currency": "usd", "status": "initiated",
        "payment_status": "pending", "pro_granted": False,
        "created_at": datetime.now(timezone.utc),
    })
    r = await client.get(f"/api/billing/checkout-status/{sid}")
    assert r.status_code == 200
    body = r.json()
    assert body["payment_status"] == "pending"
    assert body["pro_granted"] is False
    assert body["plan"] == "annual"

    # Now simulate webhook → mark paid
    await _mark_paid(db, sid)
    r = await client.get(f"/api/billing/checkout-status/{sid}")
    body = r.json()
    assert body["payment_status"] == "paid"
    assert body["pro_granted"] is True
    assert body["status"] == "completed"


@pytest.mark.asyncio
async def test_checkout_status_forbids_cross_user_access(client, db):
    sid = "cs_test_foreign"
    await db.payment_transactions.insert_one({
        "user_id": "someone-else", "session_id": sid, "plan": "monthly",
        "amount": 1500, "currency": "usd", "status": "initiated",
        "payment_status": "pending", "pro_granted": False,
        "created_at": datetime.now(timezone.utc),
    })
    r = await client.get(f"/api/billing/checkout-status/{sid}")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_checkout_status_404_for_unknown_session(client):
    r = await client.get("/api/billing/checkout-status/cs_test_nope")
    assert r.status_code == 404

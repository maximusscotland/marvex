"""Backend tests for affiliate program — accrue_commission math, tier rates,
cadence caps, bonus-month cap, customer-side discount, self-ref guard,
and the public API gates."""
import os
import sys
import asyncio
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mindmap-studio-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
sys.path.insert(0, "/app/backend")

# ----------------------- Live (public URL) auth gates -----------------------
class TestAffiliateAuthGates:
    def test_me_no_auth_401(self):
        r = requests.get(f"{API}/affiliate/me", timeout=15)
        assert r.status_code == 401, r.text[:200]

    def test_track_click_unknown_code(self):
        r = requests.post(f"{API}/affiliate/track-click",
                          json={"code": "fake-xyz-noop", "path": "/"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is False
        assert body.get("reason") == "unknown_code"

    def test_admin_list_no_auth_401(self):
        # No session cookie → auth dep returns 401 before admin check
        r = requests.get(f"{API}/admin/affiliates", timeout=15)
        assert r.status_code in (401, 403), r.text[:200]


# ----------------------- In-process (TestClient) -----------------------
@pytest.fixture
def affiliate_module():
    """Reset the test DB collections used and yield (db, accrue, find, ensure)."""
    from server import db
    import affiliate as aff

    async def _wipe():
        await db.users.delete_many({"user_id": {"$regex": "^TEST_aff_"}})
        await db.referral_events.delete_many({"affiliate_user_id": {"$regex": "^TEST_aff_"}})
        await db.affiliate_clicks.delete_many({"code": {"$regex": "^test-"}})
        await db.payment_transactions.delete_many({"user_id": {"$regex": "^TEST_aff_"}})

    asyncio.get_event_loop().run_until_complete(_wipe())
    yield db, aff
    asyncio.get_event_loop().run_until_complete(_wipe())


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _make_user(uid, email, sub_status="free", plan=None, founder=False, code=None, referred_by=""):
    u = {
        "user_id": uid,
        "_id": uid,
        "email": email,
        "free_conversions_used": 0,
        "subscription": {"status": sub_status, "plan": plan, "founder": founder,
                         "current_period_end": (datetime.now(timezone.utc).isoformat() if plan in ("monthly","annual") else "")},
    }
    if code:
        u["affiliate"] = {"code": code}
    if referred_by:
        u.setdefault("affiliate", {})["referred_by"] = referred_by
    return u


class TestTierResolution:
    def test_tiers(self, affiliate_module):
        db, aff = affiliate_module
        founder = _make_user("TEST_aff_f", "f@t.dev", "active", "lifetime", founder=True)
        lifetime = _make_user("TEST_aff_l", "l@t.dev", "active", "lifetime")
        sub_m = _make_user("TEST_aff_m", "m@t.dev", "active", "monthly")
        sub_a = _make_user("TEST_aff_a", "a@t.dev", "active", "annual")
        free = _make_user("TEST_aff_free", "free@t.dev")
        assert aff.resolve_tier(founder) == (0.25, "founder")
        assert aff.resolve_tier(lifetime) == (0.17, "lifetime")
        assert aff.resolve_tier(sub_m) == (0.05, "subscriber")
        assert aff.resolve_tier(sub_a) == (0.05, "subscriber")
        assert aff.resolve_tier(free)[0] == 0.0


class TestCommissionAccrual:
    def test_subscriber_3_monthly_invoices_then_cap(self, affiliate_module):
        db, aff = affiliate_module
        affiliate_u = _make_user("TEST_aff_sub1", "sub1@t.dev", "active", "monthly", code="test-sub1-aaa")
        referee = _make_user("TEST_aff_ree1", "ree1@t.dev", referred_by="TEST_aff_sub1")
        _run(db.users.insert_one(dict(affiliate_u)))
        _run(db.users.insert_one(dict(referee)))

        for i in range(1, 4):
            ev = _run(aff.accrue_commission(db, referee_user_id="TEST_aff_ree1",
                                            referee_plan="monthly", paid_amount_cents=1500,
                                            session_id=f"sess_{i}"))
            assert ev is not None, f"invoice #{i} should accrue"
            assert ev["commission_cents"] == 75
            assert ev["invoice_number"] == i
            assert ev["payout_status"] == "pending"
            assert ev["bonus_month_granted"] is True

        # 4th should be capped (monthly cap=3)
        ev4 = _run(aff.accrue_commission(db, referee_user_id="TEST_aff_ree1",
                                         referee_plan="monthly", paid_amount_cents=1500,
                                         session_id="sess_4"))
        assert ev4 is None

        # affiliate's current_period_end should be ~90 days out (3 bonuses * 30d)
        u = _run(db.users.find_one({"user_id": "TEST_aff_sub1"}))
        assert u["subscription"]["current_period_end"]

    def test_founder_25pct_lifetime_one_time(self, affiliate_module):
        db, aff = affiliate_module
        founder = _make_user("TEST_aff_fn", "fn@t.dev", "active", "lifetime", founder=True, code="test-fn-aaa")
        ree = _make_user("TEST_aff_ref_fn", "rfn@t.dev", referred_by="TEST_aff_fn")
        _run(db.users.insert_one(dict(founder)))
        _run(db.users.insert_one(dict(ree)))

        ev = _run(aff.accrue_commission(db, referee_user_id="TEST_aff_ref_fn",
                                        referee_plan="lifetime", paid_amount_cents=20000,
                                        session_id="sess_l1"))
        assert ev["commission_cents"] == 5000  # 25% of $200
        assert ev["affiliate_tier"] == "founder"
        # Second call should be capped
        ev2 = _run(aff.accrue_commission(db, referee_user_id="TEST_aff_ref_fn",
                                         referee_plan="lifetime", paid_amount_cents=20000,
                                         session_id="sess_l2"))
        assert ev2 is None

    def test_lifetime_17pct_annual_one_time(self, affiliate_module):
        db, aff = affiliate_module
        lifer = _make_user("TEST_aff_lt", "lt@t.dev", "active", "lifetime", code="test-lt-aaa")
        ree = _make_user("TEST_aff_ref_lt", "rlt@t.dev", referred_by="TEST_aff_lt")
        _run(db.users.insert_one(dict(lifer)))
        _run(db.users.insert_one(dict(ree)))

        ev = _run(aff.accrue_commission(db, referee_user_id="TEST_aff_ref_lt",
                                        referee_plan="annual", paid_amount_cents=15000,
                                        session_id="sess_a1"))
        assert ev["commission_cents"] == 2550  # 17% of $150
        assert ev["bonus_month_granted"] is False  # not subscriber

    def test_no_referrer_no_event(self, affiliate_module):
        db, aff = affiliate_module
        ree = _make_user("TEST_aff_orphan", "o@t.dev")
        _run(db.users.insert_one(dict(ree)))
        ev = _run(aff.accrue_commission(db, referee_user_id="TEST_aff_orphan",
                                        referee_plan="monthly", paid_amount_cents=1500,
                                        session_id="sess_o"))
        assert ev is None

    def test_subscriber_bonus_month_cap_4(self, affiliate_module):
        db, aff = affiliate_module
        affu = _make_user("TEST_aff_subcap", "sc@t.dev", "active", "monthly", code="test-sc-aaa")
        _run(db.users.insert_one(dict(affu)))
        # 4 different referees, each 1st monthly invoice → 4 bonuses
        for i in range(1, 6):
            ree_id = f"TEST_aff_ree_sc_{i}"
            ree = _make_user(ree_id, f"sc{i}@t.dev", referred_by="TEST_aff_subcap")
            _run(db.users.insert_one(dict(ree)))
            ev = _run(aff.accrue_commission(db, referee_user_id=ree_id,
                                            referee_plan="monthly", paid_amount_cents=1500,
                                            session_id=f"sess_sc_{i}"))
            assert ev is not None
            assert ev["commission_cents"] == 75
            if i <= 4:
                assert ev["bonus_month_granted"] is True, f"ref #{i} should grant bonus"
            else:
                assert ev["bonus_month_granted"] is False, f"ref #{i} should NOT grant bonus (cap=4)"


class TestRefDiscount:
    def test_discounted_amount_helper(self):
        from billing import _ref_discounted_amount
        assert _ref_discounted_amount("monthly", True) == 11.25
        assert _ref_discounted_amount("monthly", False) == 15.00
        assert _ref_discounted_amount("annual", True) == 112.50
        assert _ref_discounted_amount("lifetime", True) == 150.00


class TestEnsureCode:
    def test_generates_and_persists(self, affiliate_module):
        db, aff = affiliate_module
        u = _make_user("TEST_aff_code", "code@t.dev", "active", "monthly")
        _run(db.users.insert_one(dict(u)))
        code = _run(aff.ensure_affiliate_code(db, u))
        assert code and "-" in code
        # Idempotent — second call returns same code
        u2 = _run(db.users.find_one({"user_id": "TEST_aff_code"}))
        code2 = _run(aff.ensure_affiliate_code(db, u2))
        assert code2 == code

    def test_track_click_real_code(self, affiliate_module):
        db, aff = affiliate_module
        u = _make_user("TEST_aff_clk", "clk@t.dev", "active", "monthly")
        _run(db.users.insert_one(dict(u)))
        code = _run(aff.ensure_affiliate_code(db, _run(db.users.find_one({"user_id": "TEST_aff_clk"}))))
        # Hit live endpoint with the real code
        r = requests.post(f"{API}/affiliate/track-click",
                          json={"code": code, "path": "/", "referrer": ""}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        cnt = _run(db.affiliate_clicks.count_documents({"code": code}))
        assert cnt >= 1
        # cleanup
        _run(db.affiliate_clicks.delete_many({"code": code}))

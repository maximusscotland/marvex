"""Regression tests for billing.addon_is_active() — the single source of
truth for whether a user CURRENTLY owns an add-on.

The logic intentionally encodes 4 different expiry rules based on the user's
tier at the moment of purchase (snapshotted in `purchased_tier`):

  - lifetime  → permanent (they paid $200 once, they keep the add-on forever)
  - monthly/annual → valid only while the parent subscription is active
  - free      → 365-day grace, then re-purchase required
  - legacy (no purchased_tier) → treated as Pro rules (backcompat)
"""
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

# Make the backend package importable when running from /app/backend/tests
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from billing import addon_is_active  # noqa: E402


NOW = datetime.now(timezone.utc)
FUTURE = (NOW + timedelta(days=10)).isoformat()
PAST = (NOW - timedelta(days=10)).isoformat()
LONG_AGO = (NOW - timedelta(days=400)).isoformat()
RECENT = (NOW - timedelta(days=30)).isoformat()


def _user(status, plan, cpe, addon_meta, lifetime=False):
    return {
        "subscription": {
            "status": status,
            "plan": plan,
            "lifetime": lifetime,
            "current_period_end": cpe,
            "addons": {"premium_uk_law": addon_meta} if addon_meta else {},
        }
    }


def test_lifetime_purchase_is_permanent():
    u = _user("active", "lifetime", "", {
        "active": True, "purchased_tier": "lifetime", "purchased_at": RECENT,
    }, lifetime=True)
    assert addon_is_active(u, "premium_uk_law") is True


def test_pro_purchase_with_active_sub_is_valid():
    u = _user("active", "monthly", FUTURE, {
        "active": True, "purchased_tier": "monthly", "purchased_at": RECENT,
    })
    assert addon_is_active(u, "premium_uk_law") is True


def test_pro_purchase_with_expired_sub_lapses():
    u = _user("canceled", "monthly", PAST, {
        "active": True, "purchased_tier": "monthly", "purchased_at": RECENT,
    })
    assert addon_is_active(u, "premium_uk_law") is False


def test_pro_purchase_with_past_due_still_valid_until_period_end():
    # `past_due` = Stripe retrying failed card. Add-on keeps working until
    # the period-end lapses; that's Stripe's own retry grace window.
    u = _user("past_due", "monthly", FUTURE, {
        "active": True, "purchased_tier": "monthly", "purchased_at": RECENT,
    })
    # past_due is not in ('active', 'trialing') so the add-on expires.
    assert addon_is_active(u, "premium_uk_law") is False


def test_free_purchase_within_365_days_is_valid():
    u = _user("free", "", "", {
        "active": True, "purchased_tier": "free", "purchased_at": RECENT,
    })
    assert addon_is_active(u, "premium_uk_law") is True


def test_free_purchase_past_365_days_lapses():
    u = _user("free", "", "", {
        "active": True, "purchased_tier": "free", "purchased_at": LONG_AGO,
    })
    assert addon_is_active(u, "premium_uk_law") is False


def test_legacy_record_no_tier_follows_pro_rules():
    # Pre-v0.2 purchases didn't store purchased_tier. They should keep
    # working as long as the user's current subscription is active.
    u = _user("active", "monthly", FUTURE, {"active": True})
    assert addon_is_active(u, "premium_uk_law") is True


def test_active_flag_false_returns_false_even_if_lifetime():
    u = _user("active", "lifetime", "", {
        "active": False, "purchased_tier": "lifetime", "purchased_at": RECENT,
    }, lifetime=True)
    assert addon_is_active(u, "premium_uk_law") is False


def test_missing_user_or_addon_returns_false():
    assert addon_is_active({}, "premium_uk_law") is False
    assert addon_is_active(None, "premium_uk_law") is False
    assert addon_is_active({"subscription": {}}, "premium_uk_law") is False


def test_pro_addon_then_lifetime_upgrade_is_permanent():
    # User bought addon while on monthly, later upgraded to lifetime —
    # they should keep the addon permanently now.
    u = _user("active", "lifetime", "", {
        "active": True, "purchased_tier": "monthly", "purchased_at": RECENT,
    }, lifetime=True)
    assert addon_is_active(u, "premium_uk_law") is True


def test_bad_purchased_at_returns_false_for_free_tier():
    # Malformed timestamp on a free-tier purchase => fail closed.
    u = _user("free", "", "", {
        "active": True, "purchased_tier": "free", "purchased_at": "not-a-date",
    })
    assert addon_is_active(u, "premium_uk_law") is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

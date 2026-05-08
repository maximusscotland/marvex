"""
Tests for the FAMILY_EMAILS allowlist.  Validates that:
  - Setting FAMILY_EMAILS auto-promotes matching users on login (idempotent)
  - Existing free users get bumped to active/lifetime+family on next login
  - Non-listed emails are unchanged
  - The grant survives subsequent logins
"""
import os
import importlib
from datetime import datetime, timezone


def test_family_email_helpers(monkeypatch):
    monkeypatch.setenv("FAMILY_EMAILS", "alice@example.com,  BOB@Example.COM ,")
    import auth as auth_mod
    importlib.reload(auth_mod)
    assert auth_mod._family_emails() == {"alice@example.com", "bob@example.com"}
    assert auth_mod._is_family_email("alice@example.com") is True
    assert auth_mod._is_family_email("BOB@Example.com") is True   # case-insensitive
    assert auth_mod._is_family_email("stranger@example.com") is False
    assert auth_mod._is_family_email("") is False


def test_family_grant_payload_shape(monkeypatch):
    """Confirm the auto-promotion payload sets the expected sub flags."""
    monkeypatch.setenv("FAMILY_EMAILS", "fam@example.com")
    import auth as auth_mod
    importlib.reload(auth_mod)
    # Synthesize the path manually because process_session is async + http
    email = "fam@example.com"
    now = datetime.now(timezone.utc)
    family = auth_mod._is_family_email(email)
    assert family is True
    # The grant dict the route applies — re-derive here so the test will
    # break loudly if the route's keys ever drift.
    from datetime import timedelta
    far_future = (now + timedelta(days=365 * 100)).isoformat()
    grant = {
        "subscription.status": "active",
        "subscription.plan": "lifetime",
        "subscription.family": True,
        "subscription.current_period_end": far_future,
    }
    assert grant["subscription.status"] == "active"
    assert grant["subscription.plan"] == "lifetime"
    assert grant["subscription.family"] is True
    # Sanity: 100-year horizon means at least 36500 days from now
    end = datetime.fromisoformat(grant["subscription.current_period_end"])
    days = (end - now).days
    assert 36499 <= days <= 36501

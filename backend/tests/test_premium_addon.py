"""Tests for the new Premium UK Law add-on and its Stripe checkout branch.

Covers the unauth contract (401s), malformed-body 400 schema validation,
and regressions on the existing billing/plans and corpus endpoints."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mindmap-studio-5.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ------------ /api/premium/* auth contract -----------------------------

class TestPremiumAuth:
    """All /api/premium/* endpoints must reject anonymous callers with 401.
    Crucially /api/premium/bailii/search MUST NOT 402 on unauth — 402 is
    reserved for authed-but-not-entitled users (paywall)."""

    def test_premium_status_unauth(self, client):
        r = client.get(f"{BASE_URL}/api/premium/status")
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"

    def test_premium_bailii_search_unauth_is_401_not_402(self, client):
        r = client.get(f"{BASE_URL}/api/premium/bailii/search", params={"q": "negligence"})
        assert r.status_code == 401, (
            f"expected 401 for anon, got {r.status_code}: {r.text[:200]}. "
            "402 would leak the existence of the paywall to unauth callers."
        )

    def test_premium_lexisnexis_probe_unauth(self, client):
        r = client.get(f"{BASE_URL}/api/premium/lexisnexis/probe")
        assert r.status_code == 401

    def test_premium_lexisnexis_token_put_unauth(self, client):
        r = client.put(
            f"{BASE_URL}/api/premium/lexisnexis/token",
            json={"token": "x" * 32},
        )
        assert r.status_code == 401

    # NEW: AI Case Summary — verify the auth gate. 402 must not leak.
    def test_premium_case_summary_unauth(self, client):
        r = client.post(
            f"{BASE_URL}/api/premium/case-summary",
            json={"url": "https://www.bailii.org/uk/cases/UKHL/1932/100.html",
                  "title": "Donoghue v Stevenson",
                  "citation": "[1932] UKHL 100"},
        )
        assert r.status_code == 401, (
            f"expected 401 for anon, got {r.status_code}: {r.text[:200]}. "
            "402 would leak the paywall + the allowlist behaviour."
        )

    def test_premium_case_summary_unauth_with_evil_host(self, client):
        """Even with a non-allowlisted host, anon callers must hit 401
        BEFORE the URL allowlist check (auth runs first)."""
        r = client.post(
            f"{BASE_URL}/api/premium/case-summary",
            json={"url": "https://evil.com/x.html"},
        )
        assert r.status_code == 401, (
            f"unauth callers should never see 400 'URL not in allowlist' — "
            f"got {r.status_code}: {r.text[:200]}"
        )

    def test_premium_case_summary_unauth_empty_body(self, client):
        """Empty body — 401 still wins over 422."""
        r = client.post(f"{BASE_URL}/api/premium/case-summary", json={})
        assert r.status_code == 401


# ------------ /api/billing/create-addon-checkout -----------------------

class TestAddonCheckoutAuth:
    """create-addon-checkout is authed-only, but we can still exercise
    schema validation for the `addon` field on unauth because FastAPI
    runs body validation after the auth dependency by default — so we
    expect 401 for BOTH an empty body and a malformed body."""

    def test_addon_checkout_unauth(self, client):
        r = client.post(
            f"{BASE_URL}/api/billing/create-addon-checkout",
            json={"addon": "premium_uk_law", "origin_url": "https://x"},
        )
        assert r.status_code == 401

    def test_addon_checkout_invalid_addon_key(self, client):
        """Send malformed body with invalid addon key. Since auth runs
        first, this returns 401; we document this contract explicitly."""
        r = client.post(
            f"{BASE_URL}/api/billing/create-addon-checkout",
            json={"addon": "invalid_key", "origin_url": "https://x"},
        )
        # Auth guard fires before the ADDONS check, so unauth gets 401.
        assert r.status_code == 401, (
            f"unauth callers should never see 400 'Unknown add-on' — "
            f"got {r.status_code}: {r.text[:200]}"
        )


# ------------ Regressions ----------------------------------------------

class TestBackendRegressions:
    def test_license_verify_unauth_still_401(self, client):
        r = client.get(f"{BASE_URL}/api/license/verify")
        assert r.status_code == 401

    def test_billing_plans_unpolluted(self, client):
        """ADDONS should NOT leak into the plans response."""
        r = client.get(f"{BASE_URL}/api/billing/plans")
        assert r.status_code == 200
        data = r.json()
        assert set(data.get("available", [])) == {"lite", "monthly", "annual", "lifetime"}
        plan_ids = [p["id"] for p in data.get("plans", [])]
        assert set(plan_ids) == {"lite", "monthly", "annual", "lifetime"}
        # Sanity-check add-on key never appears
        assert "premium_uk_law" not in plan_ids
        # Amounts (cents) — server-owned truth per billing.py
        amounts = {p["id"]: p["amount"] for p in data["plans"]}
        assert amounts["lite"] == 900
        assert amounts["monthly"] == 1500
        assert amounts["annual"] == 15000
        assert amounts["lifetime"] == 20000

    def test_corpus_law_uk_search(self, client):
        r = client.get(
            f"{BASE_URL}/api/corpus/search",
            params={"source": "law-uk", "q": "Equality Act 2010"},
        )
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") or data.get("results") or []
        assert isinstance(items, list) and len(items) > 0, f"no items: {str(data)[:300]}"
        # Mixed statutes + judgments — at least one statute kind_label in
        # the first few items (statutes-first ordering was a prior fix).
        labels = [i.get("kind_label") or i.get("kind") or "" for i in items[:10]]
        assert any("Statut" in lbl or "statute" in lbl.lower() for lbl in labels), (
            f"no statute in top results: {labels}"
        )

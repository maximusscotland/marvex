"""Tests for share referral_code field + license/premium regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback — read from frontend/.env
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass

EXISTING_SLUG = "fd6fwvpewsvj"


class TestShareReferral:
    def test_share_returns_referral_code_and_no_owner(self):
        r = requests.get(f"{BASE_URL}/api/share/{EXISTING_SLUG}", timeout=15)
        assert r.status_code == 200, f"status={r.status_code}, body={r.text[:300]}"
        data = r.json()
        # Existing fields
        assert "slug" in data and data["slug"] == EXISTING_SLUG
        assert "title" in data
        assert "map" in data and isinstance(data["map"], dict)
        assert "view_count" in data
        assert "created_at" in data
        # New referral_code field
        assert "referral_code" in data, f"referral_code missing: keys={list(data.keys())}"
        assert isinstance(data["referral_code"], str)
        # Security: owner_user_id must NOT be exposed
        assert "owner_user_id" not in data, "owner_user_id leaked in response"

    def test_share_404_for_unknown_slug(self):
        r = requests.get(f"{BASE_URL}/api/share/zzzzzzzzzzzz", timeout=15)
        assert r.status_code == 404


class TestLicensePremiumRegression:
    def test_license_verify_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/license/verify", timeout=15)
        assert r.status_code == 401, f"got {r.status_code}, body={r.text[:200]}"

    def test_premium_status_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/premium/status", timeout=15)
        assert r.status_code == 401, f"got {r.status_code}, body={r.text[:200]}"

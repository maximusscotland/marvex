"""
LAUNCH SMOKE TEST — hits the live preview URL via REACT_APP_BACKEND_URL.

Covers:
  - POST /api/waitlist happy-path (returns ok/count/new)
  - dedupe (second submit → new=False)
  - validation (400 on garbage email)
  - rate-limit (6th rapid POST from same IP → 429)
  - GET /api/waitlist/count returns int matching DB writes
"""

import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
WL = f"{BASE_URL}/api/waitlist"
COUNT = f"{BASE_URL}/api/waitlist/count"


def _unique_email(tag: str = "smoke") -> str:
    return f"launch-test+{tag}-{uuid.uuid4().hex[:8]}@marvex.app"


@pytest.fixture
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ─── 1. happy path ────────────────────────────────────────────────────────────
def test_waitlist_happy_path(session):
    email = _unique_email("happy")
    r = session.post(WL, json={"email": email, "source": "launch-smoke"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["new"] is True
    assert isinstance(body["count"], int) and body["count"] > 0


# ─── 2. dedupe ────────────────────────────────────────────────────────────────
def test_waitlist_dedupe(session):
    email = _unique_email("dedupe")
    r1 = session.post(WL, json={"email": email, "source": "launch-smoke"}, timeout=15)
    r2 = session.post(WL, json={"email": email, "source": "launch-smoke"}, timeout=15)
    assert r1.status_code == 200 and r2.status_code == 200, (r1.text, r2.text)
    assert r1.json()["new"] is True
    assert r2.json()["new"] is False
    # count should NOT increase between the two calls
    assert r2.json()["count"] == r1.json()["count"]


# ─── 3. validation ────────────────────────────────────────────────────────────
def test_waitlist_rejects_invalid_email(session):
    r = session.post(WL, json={"email": "not-an-email"}, timeout=15)
    assert r.status_code == 400, r.text


# ─── 4. rate limit (6 rapid posts) ────────────────────────────────────────────
def test_waitlist_rate_limit(session):
    # 6 rapid posts using DIFFERENT emails so rate-limit (per IP) is the only
    # thing that can stop the 6th. Cap is 5/min.
    statuses = []
    for i in range(6):
        r = session.post(
            WL,
            json={"email": _unique_email(f"rl{i}"), "source": "launch-smoke"},
            timeout=15,
        )
        statuses.append(r.status_code)
    # First five should succeed (200), 6th should be 429.
    # (Allow some leniency: at least ONE of the requests must return 429.)
    assert 429 in statuses, f"expected at least one 429, got {statuses}"
    # And the 6th specifically should be the 429
    assert statuses[5] == 429, f"6th post should be 429, got {statuses[5]} (full: {statuses})"
    body = requests.post(WL, json={"email": _unique_email("rl-msg")}, timeout=15)
    # Friendly message body
    assert "minute" in body.text.lower() or body.status_code == 429


# ─── 5. count endpoint ────────────────────────────────────────────────────────
def test_waitlist_count_endpoint(session):
    # wait out the rate-limit window from the previous test (60s)
    time.sleep(62)
    before = session.get(COUNT, timeout=15)
    assert before.status_code == 200, before.text
    n0 = before.json()["count"]
    assert isinstance(n0, int)

    email = _unique_email("count")
    r = session.post(WL, json={"email": email, "source": "launch-smoke"}, timeout=15)
    assert r.status_code == 200, r.text

    after = session.get(COUNT, timeout=15)
    assert after.status_code == 200
    n1 = after.json()["count"]
    assert n1 == n0 + 1, f"expected count to grow by 1, was {n0} → {n1}"

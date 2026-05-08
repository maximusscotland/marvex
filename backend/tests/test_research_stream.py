"""
Tests for POST /api/research/stream (Server-Sent Events).

Coverage:
- Public URL: unauthenticated → 401 plain HTTP
- Public URL: authenticated (via dependency_override locally) + missing focus_title → 400
- Local TestClient: header shape — Content-Type text/event-stream & X-Accel-Buffering:no
- Regression: GET /api/health, GET /api/billing/plans, POST /api/research (401 unauth)
"""
import json
import os
import sys
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get(
    "TEST_BASE_URL",
    os.environ.get("REACT_APP_BACKEND_URL", "https://mindmap-studio-5.preview.emergentagent.com"),
).rstrip("/")
API = f"{BASE_URL}/api"

# Make backend importable for the TestClient-based tests.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


# ---------- Public (production URL) regression / auth tests ----------

class TestPublicEndpoints:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") in {"ok", "healthy"} or "status" in data

    def test_billing_plans(self):
        r = requests.get(f"{API}/billing/plans", timeout=10)
        assert r.status_code == 200
        data = r.json()
        # Should contain both plans — structure varies, so accept list or dict.
        if isinstance(data, list):
            ids = [p.get("id") or p.get("plan_id") or p.get("name") for p in data]
            assert len(data) >= 2, f"Expected >=2 plans, got {data}"
        elif isinstance(data, dict):
            plans = data.get("plans") or data
            assert len(plans) >= 2

    def test_research_stream_unauthenticated_returns_401(self):
        # Note: no session cookie → current_user dep raises 401 BEFORE streaming begins.
        r = requests.post(
            f"{API}/research/stream",
            json={"map_context": {"title": "t", "focus_title": "x", "outline": []}},
            timeout=15,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code} body={r.text[:200]}"
        # Should be plain HTTP/JSON, not SSE
        ct = r.headers.get("content-type", "")
        assert not ct.startswith("text/event-stream"), f"Unexpected SSE response on 401: {ct}"
        detail = (r.json().get("detail") or "").lower()
        assert "not authenticated" in detail or "auth" in detail

    def test_research_non_streaming_unauthenticated_returns_401(self):
        r = requests.post(
            f"{API}/research",
            json={"map_context": {"title": "t", "focus_title": "x", "outline": []}},
            timeout=15,
        )
        assert r.status_code == 401


# ---------- Local TestClient tests (dependency_overrides) ----------

@pytest.fixture(scope="module")
def client_with_auth_override():
    """Imports the backend app and overrides the auth dep to return a fake user."""
    from fastapi.testclient import TestClient
    import server  # type: ignore

    fake_user = {
        "user_id": "TEST_fake_user",
        "email": "TEST_fake@example.com",
        "subscription": {"status": "active"},  # treat as pro so no quota 402
        "free_conversions_used": 0,
    }

    async def _fake_current_user():
        return fake_user

    server.app.dependency_overrides[server.current_user_dep] = _fake_current_user
    try:
        yield TestClient(server.app)
    finally:
        server.app.dependency_overrides.pop(server.current_user_dep, None)


class TestStreamWithAuthOverride:
    def test_missing_focus_title_returns_400(self, client_with_auth_override):
        r = client_with_auth_override.post(
            "/api/research/stream",
            json={"map_context": {"title": "t", "focus_title": "", "outline": []}},
        )
        assert r.status_code == 400
        assert "focus node title" in r.json().get("detail", "").lower()

    def test_stream_headers_are_sse(self, client_with_auth_override, monkeypatch):
        """Verify Content-Type text/event-stream + X-Accel-Buffering:no header.
        We patch LlmChat.send_message so we don't hit the real LLM (no cost, fast).
        The first yielded bytes are a 'phase' event — enough to confirm shape.
        """
        import server  # type: ignore

        async def _fake_send_message(self, *args, **kwargs):  # noqa: ARG001
            # Raise so the generator emits an `error` event quickly and returns.
            raise RuntimeError("stubbed for header test")

        monkeypatch.setattr(server.LlmChat, "send_message", _fake_send_message, raising=True)

        with client_with_auth_override.stream(
            "POST",
            "/api/research/stream",
            json={"map_context": {"title": "t", "focus_title": "test focus", "outline": []}},
        ) as r:
            assert r.status_code == 200
            ct = r.headers.get("content-type", "")
            assert ct.startswith("text/event-stream"), f"Expected SSE content-type, got {ct!r}"
            assert "X-Accel-Buffering" in r.headers or "x-accel-buffering" in r.headers
            # Pull a bit of data to be sure the stream actually starts.
            got = b""
            for chunk in r.iter_bytes():
                got += chunk
                if len(got) > 64:
                    break
            assert b"event:" in got, f"Expected SSE 'event:' token in first bytes; got {got!r}"

    # Note: 401 sanity already covered by TestPublicEndpoints against the live URL.

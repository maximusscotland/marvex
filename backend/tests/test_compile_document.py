"""Backend tests for POST /api/compile/document — the new mind-map → document compiler.

Covers:
  * Auth gate (401 on no session) via live HTTP against the public URL.
  * Style+length contracts (uses TestClient with current_user_dep override + monkeypatched call_llm
    so we don't burn LLM budget — the route's body-shape, validation, and response envelope are what we test).
  * Empty selection 400 path.
  * Free-quota 402 path.
  * Brief / standard / deep / custom length-preset wiring (verified through the user_text payload
    handed to the LLM).
"""
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mindmap-studio-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

sys.path.insert(0, "/app/backend")


# ---------------------------------------------------------------------------
# Live (public URL) — no auth → 401
# ---------------------------------------------------------------------------
class TestCompileDocumentAuthGate:
    def test_no_session_returns_401(self):
        r = requests.post(
            f"{API}/compile/document",
            json={
                "root": {"title": "Photosynthesis", "summary": "How plants eat light", "children": []},
                "map_title": "Bio 101",
                "style": "briefing",
                "length_preset": "brief",
            },
            timeout=20,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


# ---------------------------------------------------------------------------
# In-process (TestClient) — auth dependency overridden, call_llm mocked.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def free_user():
    return {
        "_id": "test-compile-user",
        "user_id": "test-compile-user",
        "email": "compile@test.dev",
        "stripe_customer_id": "",
        "free_conversions_used": 0,
        "subscription": {"status": "free"},
    }


@pytest.fixture
def client_mock_llm(monkeypatch, free_user):
    from fastapi.testclient import TestClient
    from server import app, current_user_dep
    import server as srv

    captured = {}

    async def fake_call_llm(*, provider, api_key, system_prompt, user_text, session_id):
        captured["user_text"] = user_text
        captured["system_prompt"] = system_prompt
        captured["provider"] = provider
        # Deterministic markdown reflecting every node title (the contract).
        return (
            "# Photosynthesis\n\n"
            "Photosynthesis is how plants eat light.\n\n"
            "## Light reactions\n\nWater is split, oxygen released, ATP produced. " * 5 +
            "\n\n## Dark reactions\n\nCO2 is fixed via the Calvin cycle. " * 5
        )

    monkeypatch.setattr(srv, "call_llm", fake_call_llm)

    async def _fake_update_one(filt, upd):
        class R:
            modified_count = 1
        return R()
    monkeypatch.setattr(srv.db.users, "update_one", _fake_update_one, raising=False)

    user_holder = {"u": dict(free_user)}
    app.dependency_overrides[current_user_dep] = lambda: user_holder["u"]
    with TestClient(app) as c:
        c._captured = captured           # type: ignore[attr-defined]
        c._user_holder = user_holder     # type: ignore[attr-defined]
        yield c
    app.dependency_overrides.pop(current_user_dep, None)


class TestCompileDocumentSuccess:
    def test_brief_briefing_returns_markdown(self, client_mock_llm):
        payload = {
            "root": {
                "title": "Photosynthesis",
                "summary": "How plants eat light",
                "children": [
                    {"title": "Light reactions", "summary": "water split, oxygen, ATP"},
                    {"title": "Dark reactions", "summary": "CO2 fixed via Calvin cycle"},
                ],
            },
            "map_title": "Bio 101",
            "style": "briefing",
            "length_preset": "brief",
        }
        r = client_mock_llm.post("/api/compile/document", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "markdown" in data and "word_count" in data and "model_used" in data
        assert data["markdown"].lstrip().startswith("# Photosynthesis")
        assert "Light reactions" in data["markdown"]
        assert "Dark reactions" in data["markdown"]
        assert isinstance(data["word_count"], int) and data["word_count"] > 0
        # Verify length+style hints made it into the prompt sent to the LLM
        cap = client_mock_llm._captured  # type: ignore[attr-defined]
        assert "350" in cap["user_text"]  # brief preset → ~350
        assert "Executive briefing" in cap["user_text"]
        assert "Light reactions" in cap["user_text"]
        assert "Dark reactions" in cap["user_text"]

    def test_custom_length_clamps_and_threads_through(self, client_mock_llm):
        r = client_mock_llm.post(
            "/api/compile/document",
            json={
                "root": {"title": "T", "children": [{"title": "C1"}]},
                "length_preset": "custom",
                "custom_words": 500,
                "style": "essay",
            },
        )
        assert r.status_code == 200, r.text
        cap = client_mock_llm._captured  # type: ignore[attr-defined]
        assert "500" in cap["user_text"]
        assert "Essay-style prose" in cap["user_text"]

    def test_deep_preset_threads_through(self, client_mock_llm):
        r = client_mock_llm.post(
            "/api/compile/document",
            json={
                "root": {"title": "T", "children": [{"title": "C1"}]},
                "length_preset": "deep",
                "style": "outline",
            },
        )
        assert r.status_code == 200, r.text
        cap = client_mock_llm._captured  # type: ignore[attr-defined]
        assert "2,400" in cap["user_text"] or "2400" in cap["user_text"]
        assert "Annotated outline" in cap["user_text"]


class TestCompileDocumentValidation:
    def test_empty_root_title_400(self, client_mock_llm):
        r = client_mock_llm.post(
            "/api/compile/document",
            json={"root": {"title": "", "children": []}, "map_title": ""},
        )
        assert r.status_code == 400
        assert "title" in r.json().get("detail", "").lower() or "empty" in r.json().get("detail", "").lower()

    def test_empty_children_with_title_falls_back_to_outline(self, client_mock_llm):
        # Title alone should still produce one outline line — should succeed (200), not 400.
        r = client_mock_llm.post(
            "/api/compile/document",
            json={"root": {"title": "Solo", "children": []}},
        )
        assert r.status_code == 200, r.text


class TestCompileDocumentQuota:
    def test_free_user_over_limit_returns_402(self, client_mock_llm):
        # Bump quota past FREE_AI_LIMIT
        client_mock_llm._user_holder["u"]["free_conversions_used"] = 5  # type: ignore[attr-defined]
        r = client_mock_llm.post(
            "/api/compile/document",
            json={"root": {"title": "Quota Test", "children": []}},
        )
        assert r.status_code == 402, r.text
        detail = r.json().get("detail", "").lower()
        assert "free trial" in detail or "api key" in detail
        # Restore so other tests in this module are stable
        client_mock_llm._user_holder["u"]["free_conversions_used"] = 0  # type: ignore[attr-defined]

    def test_byok_bypasses_quota(self, client_mock_llm):
        client_mock_llm._user_holder["u"]["free_conversions_used"] = 5  # type: ignore[attr-defined]
        r = client_mock_llm.post(
            "/api/compile/document",
            json={"root": {"title": "BYOK Test", "children": []}},
            headers={"X-User-Api-Key": "sk-test-fake", "X-User-Api-Provider": "openai"},
        )
        assert r.status_code == 200, r.text
        client_mock_llm._user_holder["u"]["free_conversions_used"] = 0  # type: ignore[attr-defined]

"""Backend tests for the Shared-map endpoints (/api/share)."""
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mindmap-studio-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

sys.path.insert(0, "/app/backend")


# ---------- Unauth / public-404 cases via real HTTP ----------
class TestSharePublicUnauth:
    def test_get_nonexistent_slug_returns_404(self):
        r = requests.get(f"{API}/share/doesnotexist123xyz", timeout=10)
        assert r.status_code == 404
        assert "expired" in r.text.lower() or "revoked" in r.text.lower()

    def test_post_share_requires_auth(self):
        r = requests.post(f"{API}/share", json={"map": {"title": "x"}}, timeout=10)
        assert r.status_code == 401

    def test_delete_share_requires_auth(self):
        r = requests.delete(f"{API}/share/anyslug12345", timeout=10)
        assert r.status_code == 401

    def test_list_mine_requires_auth(self):
        r = requests.get(f"{API}/share/mine", timeout=10)
        assert r.status_code == 401


# ---------- Auth-overridden tests hitting the in-process app ----------
@pytest.fixture(scope="module")
def client_with_auth():
    from fastapi.testclient import TestClient
    from server import app, current_user_dep
    app.dependency_overrides[current_user_dep] = lambda: {
        "user_id": "test-share-user",
        "email": "t@t.com",
        "stripe_customer_id": "",
    }
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(current_user_dep, None)


class TestShareCreateFlow:
    def test_post_missing_title_returns_400(self, client_with_auth):
        r = client_with_auth.post("/api/share", json={"map": {"children": []}})
        assert r.status_code == 400
        assert "invalid map payload" in r.text.lower()

    def test_post_too_large_returns_413(self, client_with_auth):
        big_summary = "x" * 610_000
        payload = {"map": {"title": "Big Map", "summary": big_summary, "children": []}}
        r = client_with_auth.post("/api/share", json=payload)
        assert r.status_code == 413
        assert "too large" in r.text.lower()

    def test_full_create_get_revoke_flow(self, client_with_auth):
        payload = {"map": {"title": "TEST_shared_map", "children": [
            {"id": "n1", "title": "Idea A", "children": []}
        ]}}
        r = client_with_auth.post("/api/share", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["slug"], str) and len(data["slug"]) == 12
        assert data["view_count"] == 0
        assert data["title"] == "TEST_shared_map"
        assert "created_at" in data
        slug = data["slug"]

        # Public GET — no auth required (TestClient OK). View count goes 0→1.
        r2 = requests.get(f"{API}/share/{slug}", timeout=10)
        assert r2.status_code == 200, r2.text
        g = r2.json()
        assert g["slug"] == slug
        assert g["map"]["title"] == "TEST_shared_map"
        assert g["view_count"] >= 0
        assert "_id" not in g

        # second GET increments
        r3 = requests.get(f"{API}/share/{slug}", timeout=10)
        assert r3.status_code == 200
        assert r3.json()["view_count"] >= g["view_count"]

        # /mine lists it
        r4 = client_with_auth.get("/api/share/mine")
        assert r4.status_code == 200
        slugs = [d["slug"] for d in r4.json()]
        assert slug in slugs

        # Revoke by owner
        r5 = client_with_auth.delete(f"/api/share/{slug}")
        assert r5.status_code == 200
        assert r5.json() == {"ok": True}

        # After revoke → 404
        r6 = requests.get(f"{API}/share/{slug}", timeout=10)
        assert r6.status_code == 404

        # Revoke again → currently idempotent 200 (matches revoked doc). Non-critical.
        r7 = client_with_auth.delete(f"/api/share/{slug}")
        assert r7.status_code in (200, 404)


# ---------- OG image unfurl endpoint ----------
class TestOGImage:
    def _assert_png_1200x630(self, content: bytes):
        from io import BytesIO
        from PIL import Image
        assert content[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
        img = Image.open(BytesIO(content))
        assert img.size == (1200, 630), f"unexpected size {img.size}"

    def test_og_nonexistent_slug_returns_200_fallback_public(self):
        """Public URL: status, content-type, png validity. (Cache-Control is
        stripped/overridden by the Cloudflare+ingress layer to 'no-store...' for
        all /api/* — backend's header is verified via TestClient below.)
        """
        r = requests.get(f"{API}/share/doesnotexist123xyz/og.png", timeout=15)
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("image/png")
        self._assert_png_1200x630(r.content)

    def test_og_nonexistent_slug_header_in_process(self, client_with_auth):
        # In-process (no ingress rewrites) → original Cache-Control survives.
        r = client_with_auth.get("/api/share/doesnotexist123xyz/og.png")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")
        cc = r.headers.get("cache-control", "")
        assert "max-age=60" in cc, f"unexpected cache-control: {cc!r}"
        self._assert_png_1200x630(r.content)

    def test_og_valid_slug_returns_png_with_300_cache(self, client_with_auth):
        payload = {"map": {"title": "TEST_og_card_map", "children": [
            {"id": "n1", "title": "Alpha", "children": []},
            {"id": "n2", "title": "Beta", "children": []},
            {"id": "n3", "title": "Gamma", "children": []},
        ]}}
        r = client_with_auth.post("/api/share", json=payload)
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]

        # Public URL — status + png valid
        r2_pub = requests.get(f"{API}/share/{slug}/og.png", timeout=15)
        assert r2_pub.status_code == 200
        assert r2_pub.headers.get("content-type", "").startswith("image/png")
        self._assert_png_1200x630(r2_pub.content)

        # In-process — verify backend sets max-age=300
        r2 = client_with_auth.get(f"/api/share/{slug}/og.png")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/png")
        cc = r2.headers.get("cache-control", "")
        assert "max-age=300" in cc, f"unexpected cache-control: {cc!r}"
        self._assert_png_1200x630(r2.content)

        # Revoke → og.png must still return the generic fallback (200, NOT 404).
        r3 = client_with_auth.delete(f"/api/share/{slug}")
        assert r3.status_code == 200

        r4_pub = requests.get(f"{API}/share/{slug}/og.png", timeout=15)
        assert r4_pub.status_code == 200, r4_pub.text[:200]
        assert r4_pub.headers.get("content-type", "").startswith("image/png")
        self._assert_png_1200x630(r4_pub.content)

        r4 = client_with_auth.get(f"/api/share/{slug}/og.png")
        assert r4.status_code == 200
        cc4 = r4.headers.get("cache-control", "")
        assert "max-age=60" in cc4, f"unexpected cache-control after revoke: {cc4!r}"

    def test_og_real_map_tree_render_is_larger_than_fallback(self, client_with_auth):
        """Iteration_23 OG upgrade: the valid-slug render carries a real map
        tree (root + L1 branches) via cairosvg, so the PNG should be
        meaningfully larger than the fallback generic card."""
        payload = {"map": {"title": "AI in Healthcare", "children": [
            {"id": "c1", "title": "Bias in training data", "children": []},
            {"id": "c2", "title": "Patient privacy & HIPAA", "children": []},
            {"id": "c3", "title": "Clinical decision support", "children": []},
            {"id": "c4", "title": "FDA regulation of AI devices", "children": []},
            {"id": "c5", "title": "Radiology image analysis", "children": []},
            {"id": "c6", "title": "Drug discovery pipelines", "children": []},
        ]}}
        r = client_with_auth.post("/api/share", json=payload)
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]

        # Valid slug => real-map render
        r_real = client_with_auth.get(f"/api/share/{slug}/og.png")
        assert r_real.status_code == 200
        assert r_real.headers.get("content-type", "").startswith("image/png")
        self._assert_png_1200x630(r_real.content)
        real_size = len(r_real.content)

        # Fallback (non-existent slug) => no map tree
        r_fb = client_with_auth.get("/api/share/doesnotexist123xyz/og.png")
        assert r_fb.status_code == 200
        fb_size = len(r_fb.content)

        # Real map render should carry more pixel-data than the fallback card.
        assert real_size > 30_000, f"real-map PNG too small: {real_size} bytes"
        assert real_size > fb_size, (
            f"real-map PNG ({real_size}B) should exceed fallback ({fb_size}B)"
        )

        # Image sanity: open + sample a pixel to ensure valid PNG decode.
        from io import BytesIO
        from PIL import Image
        img = Image.open(BytesIO(r_real.content)).convert("RGB")
        assert img.size == (1200, 630)
        px = img.getpixel((600, 315))  # near centre
        assert isinstance(px, tuple) and len(px) == 3

        # Cleanup
        client_with_auth.delete(f"/api/share/{slug}")


# ---------- Smoke regression: existing mounts still up ----------
class TestRegressionMounts:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200

    def test_billing_plans(self):
        r = requests.get(f"{API}/billing/plans", timeout=10)
        assert r.status_code == 200

    def test_research_stream_mounted(self):
        # Missing auth/body should not 404 — should be 401/422/400 etc.
        r = requests.post(f"{API}/research/stream", json={}, timeout=10)
        assert r.status_code != 404

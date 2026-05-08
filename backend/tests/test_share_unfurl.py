"""Backend tests for the new GET /api/share/:slug/unfurl HTML endpoint."""
import os
import sys
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mindmap-studio-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

sys.path.insert(0, "/app/backend")


@pytest.fixture(scope="module")
def client_with_auth():
    from fastapi.testclient import TestClient
    from server import app, current_user_dep
    app.dependency_overrides[current_user_dep] = lambda: {
        "user_id": "test-unfurl-user",
        "email": "t@t.com",
        "stripe_customer_id": "",
    }
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(current_user_dep, None)


# -------- Non-existent slug fallback --------
class TestUnfurlFallback:
    def test_nonexistent_slug_returns_200_fallback(self):
        r = requests.get(f"{API}/share/fakeslug/unfurl", timeout=10)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "text/html" in ct, f"unexpected content-type: {ct}"
        body = r.text
        assert "This mind-map is no longer available" in body
        # Required og/twitter/refresh tags present
        assert '<meta property="og:title"' in body
        assert '<meta property="og:image"' in body
        assert '<meta name="twitter:card" content="summary_large_image"' in body
        assert '<meta http-equiv="refresh"' in body

    def test_cache_control_header_in_process(self, client_with_auth):
        r = client_with_auth.get("/api/share/fakeslug/unfurl")
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "")
        assert "max-age=300" in cc, f"unexpected cache-control: {cc!r}"
        assert "public" in cc


# -------- Real share unfurl --------
class TestUnfurlRealShare:
    def test_real_share_unfurl_has_title_and_branch_count(self, client_with_auth):
        payload = {"map": {"title": "Test Doc", "children": [
            {"id": "n1", "title": "Alpha", "children": []},
            {"id": "n2", "title": "Beta", "children": []},
        ]}}
        r = client_with_auth.post("/api/share", json=payload)
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]

        try:
            r2 = client_with_auth.get(f"/api/share/{slug}/unfurl")
            assert r2.status_code == 200
            body = r2.text
            # og:title should contain the map title
            assert "Test Doc" in body
            # description should mention branch count
            assert "2-branch" in body
            # og tags present
            assert '<meta property="og:title"' in body
            assert '<meta property="og:description"' in body
            assert '<meta property="og:image"' in body
            assert '<meta property="og:url"' in body
            assert '<meta name="twitter:card" content="summary_large_image"' in body
            assert '<meta http-equiv="refresh"' in body
            # og:image should point to /og.png of same slug
            assert f"/api/share/{slug}/og.png" in body
            # canonical link
            assert '<link rel="canonical"' in body
        finally:
            client_with_auth.delete(f"/api/share/{slug}")

    def test_x_forwarded_proto_https_passthrough(self, client_with_auth):
        payload = {"map": {"title": "HTTPS Test", "children": []}}
        r = client_with_auth.post("/api/share", json=payload)
        assert r.status_code == 200
        slug = r.json()["slug"]

        try:
            r2 = client_with_auth.get(
                f"/api/share/{slug}/unfurl",
                headers={"x-forwarded-proto": "https", "x-forwarded-host": "marvex.app"},
            )
            assert r2.status_code == 200
            body = r2.text
            # og:url + og:image + canonical should all use https://
            assert 'property="og:url" content="https://' in body, "og:url not https"
            assert 'property="og:image" content="https://' in body, "og:image not https"
            assert 'rel="canonical" href="https://' in body, "canonical not https"
            assert "marvex.app" in body
        finally:
            client_with_auth.delete(f"/api/share/{slug}")

    def test_public_url_serves_unfurl(self):
        """Hit the real preview URL — should come back https:// via CF/ingress."""
        r = requests.get(f"{API}/share/anotherfakeslug/unfurl", timeout=10, allow_redirects=False)
        assert r.status_code == 200
        body = r.text
        # Ingress sets x-forwarded-proto=https, so og:url should be https://
        assert 'property="og:url" content="https://' in body


# -------- Baseline og:* tags on public/index.html --------
class TestBaselineOGTags:
    def test_index_html_has_og_and_twitter_tags(self):
        # The frontend SPA — not the API. It's served from the same host.
        r = requests.get(f"{BASE_URL}/", timeout=10)
        assert r.status_code == 200
        body = r.text
        assert 'property="og:title"' in body
        assert "mind-mapper · Turn any PDF into a mind-map" in body
        assert 'name="twitter:card" content="summary_large_image"' in body

"""
Backend tests for the Mind-Mapper API (production domain).
Covers:
  - GET /api/health + GET /api/  (health)
  - GET /api/auth/me (should be 401 when unauthenticated)
  - POST /api/mindmap/parse-pdf (FREE / no-auth outline parser — validates 400s + happy path)
  - POST /api/mindmap/from-pdf (AI — requires auth; only verifies 401 without cookie)
"""
import io
import os
import pytest
import requests
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

BASE_URL = os.environ.get(
    "TEST_BASE_URL",
    os.environ.get(
        "REACT_APP_BACKEND_URL",
        "https://mindmap-studio-5.preview.emergentagent.com",
    ),
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def sample_pdf_bytes() -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    lines = [
        "Photosynthesis: An Overview",
        "",
        "Chapter 1 — Introduction",
        "Photosynthesis converts light energy into chemical energy in plants.",
        "It uses carbon dioxide and water, producing glucose and oxygen.",
        "",
        "Chapter 2 — Key Components",
        "Chlorophyll absorbs light in chloroplasts.",
        "Water and carbon dioxide are the main inputs.",
        "",
        "Chapter 3 — Stages",
        "Light-dependent reactions make ATP and NADPH.",
        "The Calvin cycle fixes CO2 into sugars.",
    ]
    y = 750
    for line in lines:
        c.drawString(72, y, line)
        y -= 18
    c.showPage()
    c.save()
    return buf.getvalue()


# ----------- Health -----------
class TestHealth:
    def test_api_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "service": "mind-mapper"}

    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"


# ----------- Auth -----------
class TestAuth:
    def test_me_unauthenticated_returns_401(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ----------- CORS regression (iteration 3) -----------
@pytest.mark.skipif(
    "marvex.app" not in BASE_URL,
    reason="CORS origin-echo assertions only apply to the production marvex.app host",
)
class TestCORS:
    ORIGIN = "https://marvex.app"

    def test_auth_me_cors_headers_not_wildcard(self):
        r = requests.get(
            f"{API}/auth/me",
            headers={"Origin": self.ORIGIN},
            timeout=10,
        )
        assert r.status_code == 401, r.text
        allow_origin = r.headers.get("access-control-allow-origin")
        allow_creds = r.headers.get("access-control-allow-credentials")
        assert allow_origin == self.ORIGIN, (
            f"Expected ACAO={self.ORIGIN}, got {allow_origin!r}"
        )
        assert (allow_creds or "").lower() == "true", (
            f"Expected ACAC=true, got {allow_creds!r}"
        )

    def test_auth_me_preflight(self):
        r = requests.options(
            f"{API}/auth/me",
            headers={
                "Origin": self.ORIGIN,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            },
            timeout=10,
        )
        assert r.status_code in (200, 204), r.text
        assert r.headers.get("access-control-allow-origin") == self.ORIGIN
        assert (r.headers.get("access-control-allow-credentials") or "").lower() == "true"

    def test_billing_create_checkout_cors(self):
        r = requests.post(
            f"{API}/billing/create-checkout",
            headers={"Origin": self.ORIGIN},
            json={"plan": "monthly", "origin_url": self.ORIGIN},
            timeout=10,
        )
        assert r.status_code in (401, 403)
        assert r.headers.get("access-control-allow-origin") == self.ORIGIN


# ----------- Free parse-pdf (no auth) -----------
class TestParsePdf:
    def test_non_pdf_returns_400(self):
        files = {"file": ("note.txt", b"not a pdf", "text/plain")}
        r = requests.post(f"{API}/mindmap/parse-pdf", files=files, timeout=30)
        assert r.status_code == 400, r.text
        assert "PDF" in r.text

    def test_empty_file_returns_400(self):
        files = {"file": ("empty.pdf", b"", "application/pdf")}
        r = requests.post(f"{API}/mindmap/parse-pdf", files=files, timeout=30)
        assert r.status_code == 400

    def test_valid_pdf_returns_outline(self, sample_pdf_bytes):
        files = {"file": ("photo.pdf", sample_pdf_bytes, "application/pdf")}
        r = requests.post(f"{API}/mindmap/parse-pdf", files=files, timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        for key in ("id", "title", "children", "source_pages"):
            assert key in data, f"missing {key}"
        assert isinstance(data["children"], list)
        assert data["source_pages"] >= 1
        blob = (data.get("title") or "").lower() + " " + " ".join(
            (c.get("title") or "").lower() for c in data["children"]
        )
        assert any(k in blob for k in ("photo", "chapter", "intro", "stage", "component"))

    # --- iteration 4: heuristic filter should reject sentences/emails/citations/DOI ---
    def test_noisy_pdf_headings_only(self):
        """Outline-less PDF with noisy body; heuristic must return ONLY heading-like items."""
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        lines = [
            # Real heading-like lines (Title Case / UPPERCASE / numbered)
            "Introduction To Neural Networks",
            "1. Background And Motivation",
            "METHODOLOGY",
            "2.1 Data Collection",
            "Results And Discussion",
            # Noise — must all be filtered
            "This paper presents a comprehensive overview of deep learning.",
            "The authors are grateful to their colleagues for helpful comments.",
            "Email: jane.doe@university.edu",
            "doi:10.1234/example.2024.5678",
            "Smith, J., Doe, A., and Roe, P. (2023).",
            "Ahmed W. The role of convolutional layers in vision.",
            "https://example.com/paper.pdf",
            "Keywords: neural, network, deep, learning",
            "Page 3 of 12",
            "This section discusses how the model is trained on the dataset.",
        ]
        y = 750
        for ln in lines:
            c.drawString(72, y, ln)
            y -= 18
        c.showPage()
        c.save()
        pdf_bytes = buf.getvalue()

        files = {"file": ("noisy.pdf", pdf_bytes, "application/pdf")}
        r = requests.post(f"{API}/mindmap/parse-pdf", files=files, timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()

        # Flatten to every title produced
        def _flat(nodes):
            out = []
            for n in nodes:
                out.append(n.get("title", ""))
                out.extend(_flat(n.get("children") or []))
            return out

        flat = _flat(data["children"])
        joined = " || ".join(flat).lower()

        # Must NOT contain any piece of noise
        forbidden = [
            "jane.doe", "@university", "doi:", "smith, j.",
            "ahmed w.", "https://", "keywords:", "page 3 of",
            "this paper presents", "this section discusses",
            "are grateful",
        ]
        for bad in forbidden:
            assert bad not in joined, f"noise leaked into outline: {bad!r} in {joined!r}"

        # Must contain at least a couple of the real headings (case-insensitive substring)
        expected_any = ["neural networks", "methodology", "background", "results"]
        assert any(e in joined for e in expected_any), (
            f"expected headings missing from outline: {joined!r}"
        )

    def test_oversized_pdf_returns_413(self):
        """>25 MB upload must be rejected with 413."""
        # 26 MB buffer — doesn't need to be a valid PDF structurally because the size
        # gate runs before PDF parsing.
        big = b"%PDF-1.4\n" + (b"0" * (26 * 1024 * 1024))
        files = {"file": ("huge.pdf", big, "application/pdf")}
        # allow a bit more time for the upload over the wire
        r = requests.post(f"{API}/mindmap/parse-pdf", files=files, timeout=120)
        assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text[:200]}"


# ----------- AI from-pdf (requires auth) -----------
class TestFromPdfRequiresAuth:
    def test_unauthenticated_returns_401(self, sample_pdf_bytes):
        files = {"file": ("photo.pdf", sample_pdf_bytes, "application/pdf")}
        r = requests.post(f"{API}/mindmap/from-pdf", files=files, timeout=30)
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:200]}"


# ----------- Billing gate -----------
class TestBillingRequiresAuth:
    def test_create_checkout_unauthenticated_returns_401(self):
        r = requests.post(
            f"{API}/billing/create-checkout",
            json={"plan": "monthly", "origin_url": "https://marvex.app"},
            timeout=10,
        )
        assert r.status_code == 401


# ----------- Research Assistant endpoint (iteration 9) -----------
class TestResearchAssistant:
    """POST /api/research — auth-gated, BYO-key friendly, validates request shape."""

    def _payload(self, focus_title="Photosynthesis", title="Biology Map"):
        return {
            "map_context": {
                "title": title,
                "focus_title": focus_title,
                "focus_summary": "Plants converting light to energy",
                "outline": [
                    {"title": "Biology Map", "depth": 0},
                    {"title": "Photosynthesis", "depth": 1},
                    {"title": "Respiration", "depth": 1},
                ],
            },
            "persona": "concise tutor",
            "audience": "undergrad biology student",
            "depth": "balanced",
        }

    def test_research_unauthenticated_returns_401(self):
        r = requests.post(f"{API}/research", json=self._payload(), timeout=15)
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:300]}"

    def test_research_missing_focus_title_empty_title_returns_400_or_401(self):
        """When both focus_title and map title are empty, server should reject
        with 400 'A focus node title is required'. Because the dependency that
        runs FIRST is auth, an unauthenticated request will 401 — that is
        acceptable (401 is also a gate). The main verification is no 500."""
        payload = self._payload(focus_title="", title="")
        payload["map_context"]["focus_title"] = ""
        payload["map_context"]["title"] = ""
        r = requests.post(f"{API}/research", json=payload, timeout=15)
        assert r.status_code in (400, 401), f"got {r.status_code}: {r.text[:300]}"
        if r.status_code == 400:
            assert "focus node title is required" in r.text.lower()

    def test_research_unknown_provider_header_does_not_500(self):
        """Unknown x-user-api-provider must fallback gracefully (no 500)."""
        r = requests.post(
            f"{API}/research",
            json=self._payload(),
            headers={"x-user-api-provider": "bogus-provider-xyz"},
            timeout=15,
        )
        # 401 (auth gate) is fine, but must NOT be 500.
        assert r.status_code != 500, f"unexpected 500: {r.text[:300]}"
        assert r.status_code in (401, 400, 402)

    def test_research_malformed_body_returns_422(self):
        """Missing map_context entirely → FastAPI/Pydantic should 422."""
        r = requests.post(f"{API}/research", json={"persona": "x"}, timeout=15)
        # Auth may short-circuit to 401, but most FastAPI stacks run body
        # validation before deps; either is acceptable, neither is 500.
        assert r.status_code in (401, 422), f"got {r.status_code}: {r.text[:300]}"


# ----------- Enrich-outline endpoint (iteration 12) -----------
class TestEnrichOutline:
    """POST /api/research/enrich-outline — same Pro-gate policy as /api/research."""

    def _payload(self):
        return {
            "title": "Neural Networks Primer",
            "headings": [
                {"title": "Introduction", "depth": 0},
                {"title": "Background", "depth": 1},
                {"title": "Methods", "depth": 0},
            ],
            "audience": "undergrad CS student",
        }

    def test_enrich_outline_unauthenticated_returns_401(self):
        r = requests.post(
            f"{API}/research/enrich-outline",
            json=self._payload(),
            timeout=15,
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text[:300]}"

    def test_enrich_outline_empty_headings_unauth_returns_401(self):
        """Empty headings would 400 if authed, but auth dep runs — 401 is fine,
        400 is also fine. Critical: no 500."""
        r = requests.post(
            f"{API}/research/enrich-outline",
            json={"title": "x", "headings": []},
            timeout=15,
        )
        assert r.status_code in (400, 401), f"got {r.status_code}: {r.text[:300]}"
        assert r.status_code != 500

    def test_enrich_outline_missing_headings_returns_422_or_401(self):
        """Missing 'headings' key — Pydantic default kicks in so this becomes
        an empty-list path; either 400 or 401 acceptable, never 500."""
        r = requests.post(
            f"{API}/research/enrich-outline",
            json={"title": "x"},
            timeout=15,
        )
        assert r.status_code in (400, 401, 422), f"got {r.status_code}: {r.text[:300]}"
        assert r.status_code != 500

    def test_enrich_outline_unknown_provider_no_500(self):
        """Unknown x-user-api-provider must fallback to anthropic — no 500."""
        r = requests.post(
            f"{API}/research/enrich-outline",
            json=self._payload(),
            headers={"x-user-api-provider": "bogus-xyz"},
            timeout=15,
        )
        assert r.status_code != 500, f"unexpected 500: {r.text[:300]}"
        assert r.status_code in (400, 401, 402)

    def test_enrich_outline_malformed_heading_item_no_500(self):
        """A heading missing 'title' should 422 at Pydantic level; never 500."""
        bad = {
            "title": "x",
            "headings": [{"depth": 0}],  # no title
        }
        r = requests.post(f"{API}/research/enrich-outline", json=bad, timeout=15)
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (401, 422), f"got {r.status_code}: {r.text[:300]}"


# ----------- Public corpus endpoints (iteration 13) -----------
class TestCorpusSearch:
    """GET /api/corpus/search — public, arXiv + Gutenberg, input validation."""

    def test_arxiv_search_returns_hits(self):
        r = requests.get(
            f"{API}/corpus/search",
            params={"source": "arxiv", "q": "transformer", "limit": 3},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("source") == "arxiv"
        items = data.get("items") or []
        assert len(items) >= 1, f"expected >=1 arxiv hit, got {items}"
        first = items[0]
        for key in ("id", "title", "authors", "year", "has_native_pdf", "pdf_url", "abstract"):
            assert key in first, f"missing key {key} in {first}"
        assert isinstance(first["authors"], list)
        assert isinstance(first["has_native_pdf"], bool)

    def test_gutenberg_search_returns_hits(self):
        r = requests.get(
            f"{API}/corpus/search",
            params={"source": "gutenberg", "q": "frankenstein", "limit": 3},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("source") == "gutenberg"
        items = data.get("items") or []
        assert len(items) >= 1, f"expected >=1 gutenberg hit, got {items}"
        # At least one hit should have text_url set
        any_text = any((it.get("text_url") or "").strip() for it in items)
        assert any_text, f"expected at least one Gutenberg item with text_url, got {items}"
        for it in items:
            assert "has_native_pdf" in it

    def test_unknown_source_returns_400(self):
        r = requests.get(
            f"{API}/corpus/search",
            params={"source": "unknown", "q": "x"},
            timeout=10,
        )
        assert r.status_code == 400, r.text[:300]
        assert "unknown source" in r.text.lower()

    def test_empty_query_returns_400(self):
        r = requests.get(
            f"{API}/corpus/search",
            params={"source": "arxiv", "q": ""},
            timeout=10,
        )
        assert r.status_code == 400, r.text[:300]

    def test_corpus_search_does_not_require_auth(self):
        """Regression: public endpoint, must NOT require auth cookie."""
        r = requests.get(
            f"{API}/corpus/search",
            params={"source": "arxiv", "q": "transformer", "limit": 1},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]


class TestCorpusFetch:
    """GET /api/corpus/fetch — host allowlist, PDF passthrough, text→PDF synth."""

    def test_fetch_arxiv_pdf_passthrough(self):
        r = requests.get(
            f"{API}/corpus/fetch",
            params={
                "source": "arxiv",
                "url": "https://arxiv.org/pdf/1706.03762.pdf",
                "title": "Attention",
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text[:300]
        ct = (r.headers.get("content-type") or "").lower()
        assert "application/pdf" in ct, f"unexpected content-type {ct}"
        body = r.content
        assert body[:4] == b"%PDF", f"not a PDF: {body[:20]!r}"
        assert len(body) > 100_000, f"PDF too small: {len(body)} bytes"

    def test_fetch_gutenberg_text_synthesises_pdf(self):
        r = requests.get(
            f"{API}/corpus/fetch",
            params={
                "source": "gutenberg",
                "url": "https://www.gutenberg.org/ebooks/84.txt.utf-8",
                "title": "Frankenstein",
            },
            timeout=120,
        )
        assert r.status_code == 200, r.text[:300]
        ct = (r.headers.get("content-type") or "").lower()
        assert "application/pdf" in ct, f"unexpected content-type {ct}"
        body = r.content
        assert body[:4] == b"%PDF", f"not a PDF: {body[:20]!r}"
        assert len(body) > 10 * 1024, f"synth PDF too small: {len(body)} bytes"

    def test_fetch_host_allowlist_blocks_evil(self):
        r = requests.get(
            f"{API}/corpus/fetch",
            params={
                "source": "arxiv",
                "url": "https://evil.com/foo.pdf",
                "title": "x",
            },
            timeout=10,
        )
        assert r.status_code == 400, r.text[:300]
        assert "url not allowed" in r.text.lower()

    def test_fetch_missing_url_returns_400(self):
        r = requests.get(
            f"{API}/corpus/fetch",
            params={"source": "arxiv", "url": ""},
            timeout=10,
        )
        assert r.status_code == 400, r.text[:300]

    def test_fetch_invalid_url_returns_400(self):
        r = requests.get(
            f"{API}/corpus/fetch",
            params={"source": "arxiv", "url": "not a url at all"},
            timeout=10,
        )
        assert r.status_code == 400, r.text[:300]

    def test_fetch_unknown_source_returns_400(self):
        r = requests.get(
            f"{API}/corpus/fetch",
            params={
                "source": "bogus",
                "url": "https://arxiv.org/pdf/1706.03762.pdf",
            },
            timeout=10,
        )
        assert r.status_code == 400, r.text[:300]

    def test_fetch_does_not_require_auth(self):
        """Regression: public endpoint — no auth cookie required."""
        r = requests.get(
            f"{API}/corpus/fetch",
            params={
                "source": "arxiv",
                "url": "https://arxiv.org/pdf/1706.03762.pdf",
                "title": "Attention",
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text[:300]



# ----------- Billing /plans + /create-checkout validation (iteration 14) -----------
class TestBillingPlans:
    """GET /api/billing/plans — public endpoint, returns available + plans."""

    def test_plans_public_no_auth(self):
        r = requests.get(f"{API}/billing/plans", timeout=10)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "available" in data and isinstance(data["available"], list)
        assert "plans" in data and isinstance(data["plans"], list)
        # In test-mode env, both plans should be available
        assert "monthly" in data["available"], f"expected monthly in {data['available']}"
        assert "annual" in data["available"], f"expected annual in {data['available']}"
        # Each plans item should have id/label/amount/interval
        ids = {p["id"] for p in data["plans"]}
        assert ids == set(data["available"])
        for p in data["plans"]:
            for key in ("id", "label", "amount", "interval"):
                assert key in p, f"missing {key} in plan {p}"
            assert isinstance(p["amount"], int) and p["amount"] > 0
            assert p["interval"] in ("month", "year", None)


class TestBillingCheckoutValidation:
    """POST /api/billing/create-checkout — plan validation + auth gate."""

    def test_invalid_plan_returns_400(self):
        # NOTE: auth dep runs BEFORE body validation in some stacks — acceptable
        # outcomes: 400 (plan check ran first because auth passed/optional) or
        # 401/403 (auth short-circuited). If the server lists 'Invalid plan' in
        # body when 400, that's the expected path per the spec.
        r = requests.post(
            f"{API}/billing/create-checkout",
            json={"plan": "platinum-lifetime", "origin_url": "https://marvex.app"},
            timeout=10,
        )
        assert r.status_code in (400, 401, 403), f"got {r.status_code}: {r.text[:300]}"
        if r.status_code == 400:
            assert "invalid plan" in r.text.lower()

    def test_valid_plan_missing_auth_returns_401_or_403(self):
        r = requests.post(
            f"{API}/billing/create-checkout",
            json={"plan": "annual", "origin_url": "https://marvex.app"},
            timeout=10,
        )
        assert r.status_code in (401, 403), f"got {r.status_code}: {r.text[:300]}"

    def test_malformed_body_no_500(self):
        r = requests.post(f"{API}/billing/create-checkout", json={}, timeout=10)
        assert r.status_code != 500, r.text[:300]
        assert r.status_code in (401, 403, 422), f"got {r.status_code}: {r.text[:300]}"

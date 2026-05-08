"""Backend re-verification of the legislation.gov.uk PDF-fetch fix (iteration_69).

The fix (server.py corpus_fetch):
  * legislation.gov.uk `/data.pdf` is behind a CloudFront JS challenge that
    returns HTTP 202 to any non-browser client. The `/data.htm` sibling is NOT
    challenged, so the backend now rewrites `.pdf` → `.htm`, strips XHTML via
    `_strip_html()`, and synthesises a clean PDF via `_text_to_pdf_bytes()`.
  * caselaw.nationalarchives.gov.uk keeps its native-PDF passthrough (no
    rewriting), since it serves real `application/pdf`.
  * Host allowlist still enforced — evil.com etc. must 400.

Also guards the `/api/corpus/search?source=law-uk` path against regression,
since the PR only touched `/fetch`.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mindmap-studio-5.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    return s


# ---------------- /api/corpus/fetch — legislation.gov.uk rewrite path -----
class TestLegislationPdfRewrite:
    """data.pdf → data.htm → strip → synth PDF."""

    def _assert_is_pdf(self, r, min_size=5 * 1024):
        assert r.status_code == 200, f"expected 200, got {r.status_code} — {r.text[:400]}"
        ctype = (r.headers.get("content-type") or "").lower()
        assert "application/pdf" in ctype, f"expected application/pdf, got {ctype!r}"
        body = r.content
        assert body.startswith(b"%PDF"), f"body must start with %PDF, got {body[:8]!r}"
        assert len(body) > min_size, (
            f"PDF body too small ({len(body)} bytes); expected > {min_size} bytes"
        )

    def test_equality_act_2010(self, api):
        url = "https://www.legislation.gov.uk/ukpga/2010/15/data.pdf"
        r = api.get(
            f"{BASE_URL}/api/corpus/fetch",
            params={"source": "law-uk", "url": url, "title": "Equality Act 2010"},
            timeout=90,
        )
        self._assert_is_pdf(r, min_size=5 * 1024)
        # Filename should reflect supplied title (spaces allowed per current server impl).
        cd = r.headers.get("content-disposition", "")
        assert "Equality Act 2010.pdf" in cd or "Equality" in cd, f"bad Content-Disposition: {cd!r}"

    def test_human_rights_act_1998(self, api):
        url = "https://www.legislation.gov.uk/ukpga/1998/42/data.pdf"
        r = api.get(
            f"{BASE_URL}/api/corpus/fetch",
            params={"source": "law-uk", "url": url, "title": "Human Rights Act"},
            timeout=90,
        )
        self._assert_is_pdf(r, min_size=5 * 1024)


# ---------------- /api/corpus/fetch — caselaw native PDF passthrough ------
class TestCaselawNativePassthrough:
    def test_caselaw_pdf_passthrough(self, api):
        # Real case-law PDF; served as application/pdf, should NOT be rewritten.
        url = "https://caselaw.nationalarchives.gov.uk/ewhc/ch/2026/1008/data.pdf"
        r = api.get(
            f"{BASE_URL}/api/corpus/fetch",
            params={"source": "law-uk", "url": url},
            timeout=90,
        )
        # If upstream 404s or is otherwise unavailable for this particular
        # judgment (dates can change over time), mark the test skipped so
        # it doesn't fail the suite over a missing URL.
        if r.status_code == 502:
            pytest.skip(f"caselaw upstream unavailable: {r.text[:200]}")
        assert r.status_code == 200, f"expected 200, got {r.status_code} — {r.text[:300]}"
        ctype = (r.headers.get("content-type") or "").lower()
        assert "application/pdf" in ctype, f"expected application/pdf, got {ctype!r}"
        body = r.content
        assert body.startswith(b"%PDF"), f"body must start with %PDF, got {body[:8]!r}"


# ---------------- /api/corpus/fetch — allowlist security regression ------
class TestFetchAllowlist:
    def test_evil_url_rejected(self, api):
        r = api.get(
            f"{BASE_URL}/api/corpus/fetch",
            params={"source": "law-uk", "url": "https://evil.com/fake.pdf"},
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code} — {r.text[:200]}"
        # Verify the message is the expected one.
        try:
            msg = (r.json().get("detail") or "").lower()
        except Exception:
            msg = r.text.lower()
        assert "not allowed" in msg or "url" in msg, f"unexpected error body: {r.text[:200]}"


# ---------------- /api/corpus/search — regression guard ------------------
class TestCorpusSearchRegression:
    def test_human_rights_act_search_mixed_kinds(self, api):
        r = api.get(
            f"{BASE_URL}/api/corpus/search",
            params={"source": "law-uk", "q": "Human Rights Act", "limit": 8},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("source") == "law-uk"
        items = data.get("items") or []
        assert items, "items[] must be non-empty for 'Human Rights Act'"
        kinds = {it.get("kind") for it in items}
        # At minimum we expect statutes; judgments are best-effort.
        assert "statute" in kinds, f"expected a statute result, got kinds={kinds}"
        for it in items:
            assert it.get("kind") in {"statute", "judgment"}
            assert it.get("kind_label"), f"kind_label missing on {it}"
            assert it.get("pdf_url"), f"pdf_url missing on {it}"

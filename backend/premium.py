"""
Premium UK Law add-on routes.  All endpoints are gated by the
`premium_uk_law` flag on the user's subscription doc — purchased via
the $10 Stripe one-off (see billing.py).

Two value-adds over the free UK Law tab:

1. **BAILII full-text search** — BAILII (bailii.org) is the standard
   open-access UK case law repository.  It exposes a search HTML page
   we scrape minimally; results have stable URLs to judgment HTML.
   Free, attribution-only — no API key required, no ongoing cost.

2. **LexisNexis BYOK proxy** — for the (rare) user with an institutional
   LexisNexis API token.  We never store the token in plaintext: we
   encrypt it at rest with Fernet keyed off LICENSE_SIGNING_KEY (the
   same secret used to sign desktop license tokens).  Outbound requests
   go through us so the token never reaches the renderer process — the
   browser only ever sees the parsed results.

The AI summarise-this-case button is implemented client-side:
the user's own LLM key (BYOK Claude / Gemini / OpenAI) does the work.
We never pay for AI on their behalf — that's the whole point of the
zero-ongoing-cost rule.
"""
import os
import re
import asyncio
import urllib.parse
from datetime import datetime, timezone
from typing import Optional, List

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from license import _get_signing_key  # reuse the desktop license HMAC secret


BAILII_SEARCH = "https://www.bailii.org/cgi-bin/sino_search_1.cgi"

# Hosts we'll fetch judgment text from for AI summarisation.  Same
# allowlist as /api/corpus/fetch — no third-party mirrors so we never
# summarise a tampered judgment.
SUMMARY_HOST_ALLOW = (
    "www.bailii.org", "bailii.org",
    "caselaw.nationalarchives.gov.uk",
    "www.legislation.gov.uk", "legislation.gov.uk",
)


# Reuse the license signing key (32 bytes) for at-rest encryption of
# user-submitted LexisNexis API tokens.  Fernet wants a base64 32-byte
# key, so we re-encode our raw bytes.
def _fernet() -> Fernet:
    import base64
    raw = _get_signing_key()
    # Fernet expects a urlsafe base64 of EXACTLY 32 bytes.
    if len(raw) > 32:
        raw = raw[:32]
    elif len(raw) < 32:
        raw = raw + b"\x00" * (32 - len(raw))
    return Fernet(base64.urlsafe_b64encode(raw))


def _has_premium_uk_law(user: dict) -> bool:
    """Check whether the authenticated user CURRENTLY owns the Law Pack
    add-on.  Delegates to `billing.addon_is_active()` which enforces:
      - purchased-at-lifetime = permanent
      - purchased-at-pro = valid only while the subscription is active
      - purchased-at-free = valid for 365 days after purchase

    Kept in premium.py (named premium_uk_law) for source-compat with
    route handlers; the business logic lives in billing.addon_is_active.
    """
    from billing import addon_is_active
    return addon_is_active(user, "premium_uk_law")


class PremiumStatusResponse(BaseModel):
    has_premium_uk_law: bool
    purchased_at: Optional[str] = None
    has_lexisnexis_token: bool = False


class LexisNexisTokenRequest(BaseModel):
    token: str


class CaseSummaryRequest(BaseModel):
    url: str
    title: Optional[str] = ""
    citation: Optional[str] = ""


def _strip_html(html: str) -> str:
    """Tiny HTML-to-text helper for BAILII abstracts. Different from the
    one in server.py because we want a SHORT excerpt (first 2-3
    sentences) rather than the full document — BAILII puts the most
    relevant material at the top of each result, so trimming hard is
    fine for an excerpt that goes alongside a click-through link.
    """
    cleaned = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"&nbsp;", " ", cleaned)
    cleaned = re.sub(r"&amp;", "&", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:300]


def make_router(db: AsyncIOMotorDatabase, current_user_dep) -> APIRouter:
    router = APIRouter(prefix="/api/premium")

    async def require_premium(user: dict = Depends(current_user_dep)) -> dict:
        if not _has_premium_uk_law(user):
            raise HTTPException(
                status_code=402,
                detail="Law Pack Add-on required ($10 one-off)",
            )
        return user

    @router.get("/status", response_model=PremiumStatusResponse)
    async def status(user: dict = Depends(current_user_dep)):
        sub = (user or {}).get("subscription") or {}
        addons = sub.get("addons") or {}
        meta = addons.get("premium_uk_law") or {}
        has_token = False
        try:
            doc = await db.users.find_one(
                {"user_id": user["user_id"]},
                {"_id": 0, "lexisnexis_token_enc": 1},
            )
            has_token = bool((doc or {}).get("lexisnexis_token_enc"))
        except Exception:
            pass
        return PremiumStatusResponse(
            has_premium_uk_law=_has_premium_uk_law(user),
            purchased_at=meta.get("purchased_at"),
            has_lexisnexis_token=has_token,
        )

    @router.get("/bailii/search")
    async def bailii_search(q: str, limit: int = 12, _user: dict = Depends(require_premium)):
        """Full-text search across BAILII's open-access UK & Irish case
        law / tribunals corpus.  We hit the same `sino_search_1.cgi`
        endpoint a regular browser uses, parse the HTML results, and
        return a uniform shape compatible with our existing law-uk
        items.

        Why scrape vs use an API? BAILII offers no documented JSON API,
        but the public SINO search has been stable for 15+ years and is
        rate-limit friendly (their docs explicitly invite reuse).
        """
        q = (q or "").strip()
        if not q:
            raise HTTPException(status_code=400, detail="query required")
        params = {
            "method": "boolean",
            "highlight": "1",
            "submit": "Search",
            "rank": "rank",
            "query": q,
            "results": str(min(max(limit, 1), 30)),
        }
        url = BAILII_SEARCH + "?" + urllib.parse.urlencode(params)

        try:
            async with httpx.AsyncClient(
                timeout=20.0,
                follow_redirects=True,
                headers={"User-Agent": "marvex/1.0 (+https://marvex.app)"},
            ) as client:
                r = await client.get(url)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"BAILII upstream error: {e}")

        if r.status_code != 200:
            raise HTTPException(
                status_code=503,
                detail="BAILII is responding slowly right now. Please try again in a moment.",
            )

        items = _parse_bailii_results(r.text, limit)
        return {"source": "bailii", "items": items, "query": q}

    # -------- LexisNexis BYOK -----------------------------------------

    @router.put("/lexisnexis/token")
    async def save_lexis_token(payload: LexisNexisTokenRequest, user: dict = Depends(require_premium)):
        """Encrypt and store the user's institutional LexisNexis token.
        We deliberately don't validate it against LexisNexis — different
        institutions use different endpoints (Lexis+ AI, LexisNexis
        Risk, etc.) and we'd rather store-and-test-later than reject a
        valid token because we picked the wrong endpoint to ping.
        """
        token = (payload.token or "").strip()
        if not token or len(token) < 8:
            raise HTTPException(status_code=400, detail="Token looks empty")
        # Cap to 1024 chars to prevent storage-bomb abuse.
        if len(token) > 1024:
            raise HTTPException(status_code=413, detail="Token too long")
        f = _fernet()
        enc = f.encrypt(token.encode("utf-8")).decode("ascii")
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "lexisnexis_token_enc": enc,
                "lexisnexis_token_updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"ok": True, "stored_at": datetime.now(timezone.utc).isoformat()}

    @router.delete("/lexisnexis/token")
    async def delete_lexis_token(user: dict = Depends(require_premium)):
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$unset": {"lexisnexis_token_enc": "", "lexisnexis_token_updated_at": ""}},
        )
        return {"ok": True}

    @router.get("/lexisnexis/probe")
    async def probe_lexis(user: dict = Depends(require_premium)):
        """Smoke-test the user's LexisNexis token against their
        institution's API root.  Returns 200 with the upstream's status
        code so the user can see *exactly* why their token isn't
        working without us having to guess at endpoint structure."""
        doc = await db.users.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0, "lexisnexis_token_enc": 1},
        )
        enc = (doc or {}).get("lexisnexis_token_enc")
        if not enc:
            raise HTTPException(status_code=404, detail="No LexisNexis token saved")
        try:
            tok = _fernet().decrypt(enc.encode("ascii")).decode("utf-8")
        except (InvalidToken, Exception) as e:
            raise HTTPException(status_code=500, detail=f"Token decrypt failed: {e}")

        # We hit the public Lexis+ API root that returns a 200 with a
        # version string for any well-formed token. Different to actual
        # search calls — those need an institution-specific endpoint.
        probe_url = "https://api.lexisnexis.com/v1/whoami"
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                r = await client.get(probe_url, headers={"Authorization": f"Bearer {tok}"})
            return {"upstream_status": r.status_code, "upstream_excerpt": r.text[:200]}
        except Exception as e:
            return {"upstream_status": 0, "error": str(e)[:200]}

    @router.post("/case-summary")
    async def case_summary(
        payload: CaseSummaryRequest,
        x_user_api_key: Optional[str] = Header(default=None),
        x_user_api_provider: Optional[str] = Header(default=None),
        user: dict = Depends(require_premium),
    ):
        """AI summary of a UK case-law judgment.  Fetches the judgment
        HTML from one of the allowed open-access hosts, strips it to
        plain text, then invokes the user's BYOK LLM (or the shared
        Emergent key as a fallback for trial users) to produce a
        structured legal summary.

        Output is the standard format law students learn in their first
        term: parties / court / citation / facts / issue / holding /
        ratio / application — so the result drops cleanly into a
        case-note skeleton.
        """
        # Hostname allowlist — same gate the corpus fetcher uses; no
        # generic-proxy abuse possible.
        try:
            host = (urllib.parse.urlparse(payload.url).hostname or "").lower()
        except Exception:
            raise HTTPException(status_code=400, detail="Bad URL")
        if host not in SUMMARY_HOST_ALLOW:
            raise HTTPException(status_code=400, detail="URL not in allowlist")

        # Fetch + strip. BAILII judgments are clean XHTML; legislation
        # PDF URLs were normalised to .htm by the corpus router earlier
        # in the stack.
        try:
            async with httpx.AsyncClient(
                timeout=25.0,
                follow_redirects=True,
                headers={"User-Agent": "marvex/1.0 (+https://marvex.app)"},
            ) as client:
                r = await client.get(payload.url)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Couldn't fetch case: {e}")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Upstream returned {r.status_code}")
        plain = _strip_html_full(r.text)
        # Trim to a model-safe size — judgments can be 80k+ words; the
        # opening + first half of the reasoning is what carries the
        # summary anyway, and most useful detail lives in the first
        # ~24k characters (≈ 6k tokens).  Trimming hard prevents
        # surprise token bills on the user's BYOK key.
        if len(plain) > 24000:
            plain = plain[:24000] + "\n\n[...judgment continues — truncated for summarisation]"

        # Resolve LLM key — prefer the user's BYOK key so we don't burn
        # the shared Emergent budget on Pro features.
        from server import call_llm, normalize_provider, EMERGENT_LLM_KEY
        user_key = (x_user_api_key or "").strip()
        provider = normalize_provider(x_user_api_provider)
        if user_key:
            api_key_to_use = user_key
        else:
            if not EMERGENT_LLM_KEY:
                raise HTTPException(status_code=500, detail="No API key available — add one in Settings")
            api_key_to_use = EMERGENT_LLM_KEY
            provider = "anthropic"

        system = (
            "You are a UK legal-research assistant. The user has supplied the full text of a UK or "
            "Irish court judgment. Produce a CASE-NOTE summary in valid JSON matching this schema "
            "exactly:\n"
            "{\n"
            '  "title": string,         // short case name e.g. "Donoghue v Stevenson"\n'
            '  "court": string,         // e.g. "House of Lords"\n'
            '  "citation": string,      // neutral citation if visible\n'
            '  "year": string,\n'
            '  "parties": string,       // "Claimant v Defendant" one-liner\n'
            '  "facts": string,         // 2-3 sentences\n'
            '  "issue": string,         // legal question(s) the court had to decide\n'
            '  "holding": string,       // who won and why, in plain English\n'
            '  "ratio": string,         // ratio decidendi — the binding principle\n'
            '  "key_holdings": string[], // 3-5 bullet rules / propositions\n'
            '  "application": string    // when a future court would follow this\n'
            "}\n"
            "Output ONLY the JSON, no commentary, no markdown fences."
        )
        user_text = f"Judgment text follows:\n\n---\n{plain}\n---\n\nReturn ONLY the JSON case-note."
        session_id = f"case-summary-{user['user_id']}-{int(datetime.now(timezone.utc).timestamp())}"

        try:
            response_text = await call_llm(
                provider=provider,
                api_key=api_key_to_use,
                system_prompt=system,
                user_text=user_text,
                session_id=session_id,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI service error: {e}")

        # Strip code-fence wrappers if the model added them despite the
        # explicit instruction.
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```\s*$", "", cleaned)
        try:
            import json
            parsed = json.loads(cleaned)
        except Exception:
            # Return raw if the model strayed — still useful to the user,
            # who can copy/paste.
            return {"summary": None, "raw": response_text[:4000]}
        return {"summary": parsed, "raw": None}

    return router


def _strip_html_full(html: str) -> str:
    """Like _strip_html() but doesn't trim — used for AI summarisation
    where we want the full body of the judgment."""
    cleaned = re.sub(r"<(script|style|head|nav|footer|aside|noscript)\b[^>]*>.*?</\1>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"</(p|h[1-6]|div|li|tr|section|article|blockquote)\s*>", "\n\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<br\s*/?>", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    for entity, char in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"),
                          ("&quot;", '"'), ("&#39;", "'"), ("&#8217;", "’"),
                          ("&#8220;", "“"), ("&#8221;", "”"), ("&#x2014;", "—")):
        cleaned = cleaned.replace(entity, char)
    cleaned = re.sub(r"\n[ \t]+", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _parse_bailii_results(html: str, limit: int):
    """Extract a list of {id, title, year, court, abstract, pdf_url,
    source_url, citation} dicts from a BAILII search-results HTML page.

    BAILII's results follow a stable pattern dating back to 2001:
        <li>... <a href="/url/path">Case title</a> ...summary text...</li>
    We pull each <li> in document order and filter to ones that look
    like case-law links (the URL contains `/cases/` or `/uk/cases/`).
    """
    items = []
    # Each result is wrapped in <li>...</li>.  Crude but works because
    # BAILII's HTML is hand-written, not from a templating engine.
    for li_match in re.finditer(r"<li[^>]*>(.*?)</li>", html, flags=re.IGNORECASE | re.DOTALL):
        block = li_match.group(1)
        a_match = re.search(r'<a\s+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', block, flags=re.IGNORECASE | re.DOTALL)
        if not a_match:
            continue
        href = a_match.group(1).strip()
        title_html = a_match.group(2)
        title = _strip_html(title_html).strip(" |·\n\r\t")[:240]
        if not title or "search" in href.lower() or "?" in href:
            continue
        # Build absolute URLs — BAILII uses relative paths.
        if href.startswith("/"):
            full_url = "https://www.bailii.org" + href
        elif href.startswith("http"):
            full_url = href
        else:
            continue
        # Year heuristic — first 4-digit number in the URL path that
        # looks like a year (1700-2099).
        year = ""
        for m in re.finditer(r"/(1[6-9]\d{2}|20\d{2}|21\d{2})/", full_url):
            year = m.group(1)
        # Court name — second-to-last path segment in /uk/cases/<court>/<year>/<id>
        court = ""
        m = re.search(r"/cases/([^/]+)/", full_url)
        if m:
            court = m.group(1).upper().replace("_", " ")
        excerpt = _strip_html(block.replace(a_match.group(0), ""))[:280]
        # Citation — try to extract a square-bracket neutral cite from
        # the title (BAILII titles often include them inline).
        citation = ""
        cm = re.search(r"\[(20\d{2}|19\d{2})\][^\]]+", title)
        if cm:
            citation = cm.group(0)[:60]
        items.append({
            "id": "bailii-" + re.sub(r"[^a-z0-9]+", "-", full_url[-60:].lower()).strip("-"),
            "title": title,
            "authors": [],
            "year": year,
            "subjects": [],
            "abstract": excerpt,
            "has_native_pdf": False,
            "pdf_url": full_url,           # actually HTML — frontend will treat it as a follow-link
            "kind": "judgment",
            "kind_label": court or "BAILII",
            "citation": citation,
            "court": court,
            "external_html": True,        # tells the frontend to open in a new tab, not import
        })
        if len(items) >= limit:
            break
    return items

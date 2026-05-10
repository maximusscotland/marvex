from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Header, Depends, Response
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import json
import asyncio
import logging
import uuid
import re
from pathlib import Path
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Any, Dict

from pypdf import PdfReader
from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI(title="Mind-Mapper Studio API")
api_router = APIRouter(prefix="/api")

# Auth + billing routers
from auth import make_router as make_auth_router
from billing import make_router as make_billing_router, make_webhook_router
from share import make_router as make_share_router
from sync import make_sync_router, purge_old_tombstones
from waitlist import make_router as make_waitlist_router
from testimonials import make_testimonials_router
from affiliate import make_router as make_affiliate_router
from reviewer import make_router as make_reviewer_router
from license import make_router as make_license_router
from premium import make_router as make_premium_router
from access_codes import make_router as make_access_router
from admin_ops import make_router as make_admin_ops_router
from press import make_router as make_press_router
from bugreport import make_router as make_bugreport_router
from mikey_chat import mikey_router
from magic_auth import make_router as make_magic_auth_router, ensure_indexes as ensure_magic_indexes
from apple_auth import make_router as make_apple_auth_router, ensure_indexes as ensure_apple_indexes
from sentry_init import init_sentry

# Initialise Sentry as early as possible so the FastAPI integration can
# wrap the routers we mount below. No-op if SENTRY_DSN isn't configured.
init_sentry()

auth_router = make_auth_router(db)
billing_router = make_billing_router(db, auth_router.current_user)  # type: ignore[attr-defined]
webhook_router = make_webhook_router(db)
share_router = make_share_router(db, auth_router.current_user)  # type: ignore[attr-defined]
sync_router = make_sync_router(db, auth_router.current_user)  # type: ignore[attr-defined]
waitlist_router = make_waitlist_router(db)
testimonials_router = make_testimonials_router(db, auth_router.current_user)  # type: ignore[attr-defined]
affiliate_router = make_affiliate_router(db, auth_router.current_user)  # type: ignore[attr-defined]
reviewer_router = make_reviewer_router(db, auth_router.current_user)  # type: ignore[attr-defined]
license_router = make_license_router(db, auth_router.current_user)  # type: ignore[attr-defined]
premium_router = make_premium_router(db, auth_router.current_user)  # type: ignore[attr-defined]
access_router = make_access_router(db, auth_router.current_user)  # type: ignore[attr-defined]
admin_ops_router = make_admin_ops_router(db, auth_router.current_user)  # type: ignore[attr-defined]
press_router = make_press_router(db, auth_router.current_user)  # type: ignore[attr-defined]
bugreport_router = make_bugreport_router(db)
current_user_dep = auth_router.current_user  # type: ignore[attr-defined]

# A tiny "taste test" — how many free AI runs a brand-new user gets on our
# Emergent key before BYOK is required. Set to 1 so every visitor can see
# the magic once, then must bring their own key (or upgrade to Pro, which
# unlocks features but *also* requires BYOK — zero ongoing LLM cost to us).
FREE_AI_LIMIT = 1

# ----------- BYOK provider routing -----------
# All 4 AI endpoints share this logic: user picks a provider, user supplies a
# key, we fan-out to the right SDK. Three native providers — every BYOK call
# bills to the user's own account, zero ongoing LLM cost to us.
VALID_PROVIDERS = {"anthropic", "openai", "gemini"}

_NATIVE_MODELS = {
    "anthropic": ("anthropic", "claude-sonnet-4-5-20250929"),
    "openai":    ("openai",    "gpt-4o-mini"),
    "gemini":    ("gemini",    "gemini-2.5-flash"),
}


def normalize_provider(p: Optional[str]) -> str:
    p = (p or "anthropic").strip().lower()
    return p if p in VALID_PROVIDERS else "anthropic"


async def call_llm(*, provider: str, api_key: str, system_prompt: str, user_text: str, session_id: str) -> str:
    """Unified LLM call via emergentintegrations.LlmChat for all providers."""
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model(*_NATIVE_MODELS[provider])
    return await chat.send_message(UserMessage(text=user_text))


# ----------- Models -----------
class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: str
    service: str


class MindMapNode(BaseModel):
    id: str
    title: str
    summary: Optional[str] = ""
    children: List["MindMapNode"] = []


class MindMapResponse(BaseModel):
    id: str
    title: str
    summary: Optional[str] = ""
    children: List[MindMapNode] = []
    source_pages: int = 0


MindMapNode.model_rebuild()


# ----------- Helpers -----------
SYSTEM_PROMPT = """You are an expert knowledge cartographer. Your job is to take the raw text of a document and turn it into a clean, hierarchical mind map.

Rules:
1. Identify ONE central concept (the root).
2. Identify 4–8 primary branches (key themes / chapters / sections).
3. For each branch, identify 2–6 sub-branches (sub-topics / arguments / definitions).
4. For each sub-branch, optionally include 0–4 leaves (specific facts, examples, quotes).
5. Keep node titles SHORT — 2 to 6 words. No full sentences in titles.
6. Use the optional `summary` field for a one-sentence elaboration (max 140 chars).
7. Output ONLY valid JSON. No prose. No markdown fences. No commentary.

Schema:
{
  "id": "root",
  "title": "<central concept>",
  "summary": "<optional 1-line summary>",
  "children": [
    {
      "id": "n1",
      "title": "<branch>",
      "summary": "...",
      "children": [
        { "id": "n1.1", "title": "<sub-branch>", "summary": "...", "children": [] }
      ]
    }
  ]
}

Every node MUST have a unique id, a title, an optional summary, and a children array (possibly empty).
"""


def extract_pdf_text(data: bytes, max_chars: int = 60000) -> tuple[str, int]:
    reader = PdfReader(io.BytesIO(data))
    chunks: List[str] = []
    total = 0
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        if not t:
            continue
        chunks.append(t)
        total += len(t)
        if total >= max_chars:
            break
    text = "\n\n".join(chunks)
    if len(text) > max_chars:
        text = text[:max_chars]
    return text, len(reader.pages)


def parse_json_from_response(text: str) -> Dict[str, Any]:
    # Try direct parse, then strip code fences, then regex first {...}
    try:
        return json.loads(text)
    except Exception:
        pass
    cleaned = re.sub(r"^```(?:json)?", "", text.strip(), flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        return json.loads(match.group(0))
    raise ValueError("LLM did not return valid JSON")


def normalize_ids(node: Dict[str, Any], prefix: str = "n") -> Dict[str, Any]:
    if "id" not in node or not node["id"]:
        node["id"] = prefix
    node["title"] = (node.get("title") or "Untitled")[:120]
    node["summary"] = (node.get("summary") or "")[:200]
    children = node.get("children") or []
    for i, child in enumerate(children):
        normalize_ids(child, f"{prefix}-{i+1}")
    node["children"] = children
    return node


EXPAND_SYSTEM_PROMPT_UNUSED = ""  # placeholder — AI expand was removed

# ----------- Routes -----------
@api_router.get("/", response_model=HealthResponse)
async def root():
    return HealthResponse(status="ok", service="marvex")


@api_router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", service="marvex")


# ----------- Heuristic PDF parser (ZERO API cost) -----------
def outline_to_tree(items, prefix: str = "o") -> List[Dict[str, Any]]:
    """
    pypdf outline returns a nested list where children follow their parent as a sub-list.
    e.g. [Destination(A), [Destination(A.1), Destination(A.2)], Destination(B)]
    """
    out: List[Dict[str, Any]] = []
    idx = 0
    i = 0
    while i < len(items):
        item = items[i]
        if isinstance(item, list):
            # This nested list is the children of the last appended node
            if out:
                out[-1]["children"] = outline_to_tree(item, f"{prefix}-{idx}")
            i += 1
            continue
        title = getattr(item, "title", None) or str(item)
        node = {
            "id": f"{prefix}-{idx}",
            "title": str(title)[:120].strip() or "Untitled",
            "summary": "",
            "children": [],
        }
        out.append(node)
        idx += 1
        i += 1
    return out


_NOISE_TOKENS = {
    "contents", "table of contents", "index", "references", "bibliography",
    "acknowledgements", "acknowledgments", "about the author",
    "copyright", "all rights reserved", "page", "chapter", "figure",
    "table", "appendix", "preface", "foreword", "glossary", "notes",
    "keywords", "cite this as", "citation", "corresponding author",
    "affiliation", "email", "e-mail", "received", "accepted", "published",
    "doi", "issn", "volume", "issue",
}

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", re.I)
_URL_RE = re.compile(r"\b(?:https?://|www\.)\S+", re.I)
_VERB_HINTS = re.compile(
    r"\b(is|are|was|were|has|have|had|can|could|will|would|should|may|might|"
    r"employs|uses|presents|proposes|discusses|describes|shows|demonstrates|"
    r"aims|seeks|explores|provides|enables|allows|includes|consists)\b",
    re.I,
)


def _looks_like_noise(line: str) -> bool:
    low = line.strip().lower()

    # Exact boilerplate tokens
    if low in _NOISE_TOKENS:
        return True
    for tok in _NOISE_TOKENS:
        if low.startswith(tok + ":") or low.startswith(tok + " "):
            # "Keywords: …", "Email: …"
            return True

    # Numeric-only lines / page references
    if re.match(r"^(page\s+)?\d+(\s*(of|/)\s*\d+)?$", low):
        return True

    # URL or email anywhere in the line
    if _EMAIL_RE.search(line) or _URL_RE.search(line):
        return True

    # Citation-style: "Smith, J. et al.", "Ahmed W. The …"
    if re.match(r"^[A-Z][a-z]+(,\s*[A-Z]\.)+", line):
        return True
    if re.match(r"^[A-Z][a-z]+\s+[A-Z]\.\s+The\b", line):
        return True

    # Trailing hyphen (PDF line-wrap artefact — not a heading)
    if line.rstrip().endswith("-"):
        return True

    # Looks like a full sentence: contains common verb + ends open / lots of lowercase
    if _VERB_HINTS.search(line) and sum(1 for c in line if c.islower()) >= 8:
        return True

    # Too many lowercase words in a row → sentence, not heading
    words = line.split()
    lowers = sum(1 for w in words if w[:1].islower())
    if len(words) >= 6 and lowers >= 3:
        return True

    # Running header with chapter/section number alone
    if re.match(r"^(chapter|section|part)\s+\w{1,10}$", low):
        return True

    return False


def simple_heading_scan(reader: PdfReader, max_headings: int = 40) -> List[Dict[str, Any]]:
    """
    Fallback when a PDF has no outline: scan text of each page, pick lines that LOOK like
    headings. Dedupes repeated running headers, drops boilerplate/sentences/emails/citations,
    groups into sections of up to 6 children so radial layout stays readable.
    """
    raw_headings: List[Dict[str, Any]] = []
    seen: Dict[str, int] = {}

    for p_idx, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            continue
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue
            if len(line) > 70 or len(line) < 4:
                continue
            words = line.split()
            if not (1 <= len(words) <= 10):
                continue
            stripped = line.rstrip(".!?:,;")
            if stripped != line:
                continue
            # Must look like a heading: UPPERCASE, Title Case, or numbered Roman/Arabic
            is_numbered = bool(re.match(r"^(\d+\.|\d+\.\d+|[IVX]+\.)\s+", line))
            if not (line.isupper() or line.istitle() or is_numbered):
                continue
            if line.replace(" ", "").isdigit():
                continue
            if _looks_like_noise(line):
                continue

            key = line.lower()
            if key in seen:
                seen[key] += 1
                continue
            seen[key] = 1

            raw_headings.append({
                "id": f"h-{p_idx}-{len(raw_headings)}",
                "title": line[:100],
                "summary": f"p. {p_idx + 1}",
                "page": p_idx,
                "children": [],
            })

    # Drop headings that later turned out to be running headers
    raw_headings = [h for h in raw_headings if seen.get(h["title"].lower(), 0) == 1]

    raw_headings = raw_headings[:max_headings]
    if not raw_headings:
        return []

    # Group into sections of ~6 so no branch fans out with 20+ children
    GROUP = 6
    sections: List[Dict[str, Any]] = []
    for i in range(0, len(raw_headings), GROUP):
        chunk = raw_headings[i:i + GROUP]
        first_page = chunk[0]["page"] + 1
        last_page = chunk[-1]["page"] + 1
        title = (
            f"pp. {first_page}–{last_page}" if first_page != last_page else f"p. {first_page}"
        )
        sections.append({
            "id": f"sect-{i // GROUP}",
            "title": f"Section {i // GROUP + 1} · {title}",
            "summary": f"{len(chunk)} topics",
            "children": chunk,
        })

    if len(sections) == 1:
        return sections[0]["children"]
    return sections


@api_router.post("/mindmap/parse-pdf", response_model=MindMapResponse)
async def parse_pdf_heuristic(file: UploadFile = File(...)):
    """
    Local-first mind map: extract the PDF's outline / bookmarks (or heading-like lines)
    and return a structured mind map. NO AI. NO API COSTS.
    """
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "document.pdf")
    if not (content_type == "application/pdf" or filename.lower().endswith(".pdf")):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large (max 25 MB)")

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")

    # Try PDF outline (TOC/bookmarks) first
    tree: List[Dict[str, Any]] = []
    try:
        outline = reader.outline or []
        tree = outline_to_tree(outline)
    except Exception:
        tree = []

    # Fallback: scan headings heuristically
    used_fallback = False
    if not tree:
        tree = simple_heading_scan(reader)
        used_fallback = True

    # Derive root title from PDF metadata / filename
    pdf_title = ""
    try:
        meta = reader.metadata or {}
        pdf_title = (meta.get("/Title") or "").strip()
    except Exception:
        pdf_title = ""
    display_title = (pdf_title or filename.rsplit(".", 1)[0])[:120] or "Document"

    root = {
        "id": "root",
        "title": display_title,
        "summary": (
            "Outline extracted from PDF bookmarks" if not used_fallback
            else "Headings detected by text scan"
        ),
        "children": tree[:40],  # hard cap to avoid enormous mind-maps
        "source_pages": len(reader.pages),
    }

    if not root["children"]:
        raise HTTPException(
            status_code=422,
            detail="Could not find any outline or heading-like text in this PDF. Try AI mode."
        )
    return MindMapResponse(**root)


# ----------- AI-powered (paid) endpoint -----------
@api_router.post("/mindmap/from-pdf", response_model=MindMapResponse)
async def mindmap_from_pdf(
    file: UploadFile = File(...),
    x_user_api_key: Optional[str] = Header(default=None),
    x_user_api_provider: Optional[str] = Header(default=None),  # "anthropic" | "openai" | "gemini"
    user: dict = Depends(current_user_dep),
):
    # Subscription / quota gate
    sub = user.get("subscription") or {}
    is_pro = sub.get("status") in {"active", "trialing"}
    used = int(user.get("free_conversions_used") or 0)
    has_own_key = bool((x_user_api_key or "").strip())
    if not is_pro and not has_own_key and used >= FREE_AI_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"You've used your free trial run. Add your own API key in Settings to keep using AI features (your key = your bill, not ours).",
        )

    # Key resolution — user-supplied takes priority, else fall back to Emergent key
    user_key = (x_user_api_key or "").strip()
    provider = normalize_provider(x_user_api_provider)

    if user_key:
        api_key_to_use = user_key
    else:
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="No API key available — add one in Settings")
        api_key_to_use = EMERGENT_LLM_KEY
        provider = "anthropic"  # shared Emergent key only routes to native providers

    content_type = (file.content_type or "").lower()
    filename = (file.filename or "document.pdf")
    if not (content_type == "application/pdf" or filename.lower().endswith(".pdf")):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 25 * 1024 * 1024:  # 25 MB cap
        raise HTTPException(status_code=413, detail="PDF too large (max 25 MB)")

    try:
        text, page_count = extract_pdf_text(data)
    except Exception as e:
        logger.exception("PDF extraction failed")
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {e}")

    if len(text.strip()) < 100:
        raise HTTPException(status_code=400, detail="Could not extract enough text from this PDF (it may be scanned images)")

    session_id = f"pdf-{uuid.uuid4()}"

    user_text = (
        f"Document: {filename}\n"
        f"Pages: {page_count}\n\n"
        f"Build the mind map JSON for the following content. "
        f"Remember: output ONLY valid JSON matching the schema.\n\n"
        f"---\n{text}\n---"
    )

    try:
        response_text = await call_llm(
            provider=provider,
            api_key=api_key_to_use,
            system_prompt=SYSTEM_PROMPT,
            user_text=user_text,
            session_id=session_id,
        )
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    try:
        raw = parse_json_from_response(response_text)
    except Exception as e:
        logger.error(f"Bad LLM JSON: {response_text[:500]}")
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {e}")

    raw = normalize_ids(raw, prefix="root")
    raw["source_pages"] = page_count

    # Validate via Pydantic
    try:
        validated = MindMapResponse(**raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI mind-map schema invalid: {e}")
    return validated


# ----------- Research Assistant endpoint -----------
class ResearchNode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    summary: Optional[str] = ""


class ResearchMapContext(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = "Untitled Map"
    focus_title: str = ""
    focus_summary: Optional[str] = ""
    # Flattened overview: list of nearby nodes (title + depth)
    outline: List[Dict[str, Any]] = []


class ResearchMemoryBranch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = ""
    children: List[str] = []


class ResearchMemoryEntry(BaseModel):
    """A compact summary of a PRIOR research call the user has done.
    Client-side RAG: the frontend tokenises past research, keeps the top-K
    entries by keyword overlap, and forwards them here as context so the
    LLM can cross-reference earlier threads and avoid redundancy.
    """
    model_config = ConfigDict(extra="ignore")
    focus_title: str = ""
    map_title: str = ""
    branches: List[ResearchMemoryBranch] = []


class ResearchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    map_context: ResearchMapContext
    persona: Optional[str] = ""
    audience: Optional[str] = "curious generalist"
    depth: Optional[str] = "balanced"  # "concise" | "balanced" | "deep"
    memory: List[ResearchMemoryEntry] = []


def build_memory_blob(entries: List[ResearchMemoryEntry], max_entries: int = 3) -> str:
    """Serialise memory entries into a compact, LLM-friendly text block.
    Returns '' when no memory was supplied.
    """
    if not entries:
        return ""
    lines: List[str] = []
    for e in entries[:max_entries]:
        focus = (e.focus_title or "").strip()
        if not focus:
            continue
        header = f"- Prior research on \"{focus[:100]}\""
        if e.map_title:
            header += f" (from map \"{e.map_title[:80]}\")"
        lines.append(header)
        for b in (e.branches or [])[:6]:
            btitle = (b.title or "").strip()
            if not btitle:
                continue
            sub = ", ".join([c for c in (b.children or [])[:4] if c])[:160]
            if sub:
                lines.append(f"    · {btitle[:80]} — {sub}")
            else:
                lines.append(f"    · {btitle[:80]}")
    return "\n".join(lines)


RESEARCH_SYSTEM_PROMPT = """You are an AI Research Assistant attached to a user's mind map. The user has clicked a focus node and asked you to expand it into a richer, research-grade sub-tree of ideas.

Your job:
1. Treat the focus node as the new ROOT of a fresh mind map.
2. Add 4–8 first-level branches covering key sub-topics, arguments, open questions, notable examples, and practical applications.
3. For each branch, add 2–5 sub-branches with concrete detail (definitions, dates, names, figures, counter-examples, links to deeper study).
4. Where useful, add 0–3 leaves under a sub-branch for specifics.
5. Keep node titles SHORT (2–6 words). Use the optional `summary` field for ONE sentence of elaboration (≤160 chars).
6. Do NOT duplicate sibling nodes that already exist in the provided outline — push the research further.
7. Output ONLY valid JSON. No prose. No markdown fences. No commentary.

Schema:
{
  "id": "root",
  "title": "<same as focus node>",
  "summary": "<one-line context>",
  "children": [
    { "id": "n1", "title": "<branch>", "summary": "...", "children": [ ... ] }
  ]
}
"""


@api_router.post("/research", response_model=MindMapResponse)
async def research_assistant(
    req: ResearchRequest,
    x_user_api_key: Optional[str] = Header(default=None),
    x_user_api_provider: Optional[str] = Header(default=None),
    user: dict = Depends(current_user_dep),
):
    """AI Research Assistant — expands a focus node into a new, richer mind-map
    using the user's own API key (or the shared Emergent key, gated by free
    quota + Pro status, identical to /mindmap/from-pdf).
    """
    sub = user.get("subscription") or {}
    is_pro = sub.get("status") in {"active", "trialing"}
    used = int(user.get("free_conversions_used") or 0)
    has_own_key = bool((x_user_api_key or "").strip())
    if not is_pro and not has_own_key and used >= FREE_AI_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"You've used your free trial run. Add your own API key in Settings to keep using AI features (your key = your bill, not ours).",
        )

    user_key = (x_user_api_key or "").strip()
    provider = normalize_provider(x_user_api_provider)

    if user_key:
        api_key_to_use = user_key
    else:
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="No API key available — add one in Settings")
        api_key_to_use = EMERGENT_LLM_KEY
        provider = "anthropic"  # shared Emergent key only routes to native providers

    ctx = req.map_context
    focus = (ctx.focus_title or "").strip()
    if not focus:
        raise HTTPException(status_code=400, detail="A focus node title is required")

    # Build the outline blob (indented list, truncated for token safety)
    outline_lines: List[str] = []
    for entry in ctx.outline[:60]:
        depth = int(entry.get("depth", 0))
        title = str(entry.get("title", "")).strip()[:80]
        if title:
            outline_lines.append(f"{'  ' * depth}- {title}")
    outline_blob = "\n".join(outline_lines) or "(empty)"

    persona = (req.persona or "").strip()
    depth_hint = {
        "concise":  "Keep the tree tight — 4 branches, 2 sub-branches each.",
        "balanced": "Aim for 6 branches, 3–4 sub-branches each. Add leaves sparingly.",
        "deep":     "Go broad AND deep — 7–8 branches, 4–5 sub-branches, leaves wherever useful.",
    }.get((req.depth or "balanced").lower(), "Aim for 6 branches, 3–4 sub-branches each.")

    memory_blob = build_memory_blob(req.memory)
    memory_section = (
        f"\nRelevant prior research this user has done (use as background — "
        f"you may cross-reference but do NOT merely repeat these):\n{memory_blob}\n"
        if memory_blob else ""
    )

    user_text = (
        f"Focus node: {focus}\n"
        f"Current map title: {ctx.title}\n"
        f"Target audience: {req.audience or 'curious generalist'}\n"
        f"Depth: {depth_hint}\n"
        + (f"Assistant persona / style: {persona}\n" if persona else "")
        + f"\nCurrent outline around the focus (avoid duplicating these):\n{outline_blob}\n"
        + memory_section
        + f"\nFocus summary (if any): {ctx.focus_summary or '(none)'}\n\n"
        "Now generate the research sub-tree as mind-map JSON. Output ONLY the JSON."
    )

    session_id = f"research-{uuid.uuid4()}"
    try:
        response_text = await call_llm(
            provider=provider,
            api_key=api_key_to_use,
            system_prompt=RESEARCH_SYSTEM_PROMPT,
            user_text=user_text,
            session_id=session_id,
        )
    except Exception as e:
        logger.exception("Research LLM call failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    try:
        raw = parse_json_from_response(response_text)
    except Exception as e:
        logger.error(f"Bad research JSON: {response_text[:500]}")
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {e}")

    # Force focus title onto root so it matches the user's context
    raw["title"] = focus[:120]
    raw = normalize_ids(raw, prefix="root")
    raw["source_pages"] = 0

    try:
        validated = MindMapResponse(**raw)
    except Exception as e:
        logger.exception("Research response failed Pydantic validation")
        raise HTTPException(status_code=502, detail=f"Research schema invalid: {e}")
    return validated


# ----------- Streaming research endpoint -----------
#
# Progressive SSE transport: emits `phase`, `branch`, `done`, `error` events.
# emergentintegrations doesn't expose real token streaming yet, so we fan out
# the branches from the completed JSON response one at a time with a tiny delay.
# The UX feels identical to real streaming because each branch is revealed as
# it "arrives" (150ms spacing).

def _sse(event: str, payload: Dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n".encode("utf-8")


@api_router.post("/research/stream")
async def research_assistant_stream(
    req: ResearchRequest,
    x_user_api_key: Optional[str] = Header(default=None),
    x_user_api_provider: Optional[str] = Header(default=None),
    user: dict = Depends(current_user_dep),
):
    """Streaming variant of /api/research — emits Server-Sent Events so the
    Studio can reveal branches progressively on the canvas instead of
    showing a spinner for 30 seconds. Same auth / quota / BYO-key policy.
    """
    import asyncio

    sub = user.get("subscription") or {}
    is_pro = sub.get("status") in {"active", "trialing"}
    used = int(user.get("free_conversions_used") or 0)
    has_own_key = bool((x_user_api_key or "").strip())
    if not is_pro and not has_own_key and used >= FREE_AI_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"You've used your free trial run. Add your own API key in Settings to keep using AI features (your key = your bill, not ours).",
        )

    user_key = (x_user_api_key or "").strip()
    provider = normalize_provider(x_user_api_provider)

    if user_key:
        api_key_to_use = user_key
    else:
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="No API key available — add one in Settings")
        api_key_to_use = EMERGENT_LLM_KEY
        provider = "anthropic"  # shared Emergent key only routes to native providers

    ctx = req.map_context
    focus = (ctx.focus_title or "").strip()
    if not focus:
        raise HTTPException(status_code=400, detail="A focus node title is required")

    # Build outline blob (reused from non-streaming endpoint)
    outline_lines: List[str] = []
    for entry in ctx.outline[:60]:
        depth = int(entry.get("depth", 0))
        title = str(entry.get("title", "")).strip()[:80]
        if title:
            outline_lines.append(f"{'  ' * depth}- {title}")
    outline_blob = "\n".join(outline_lines) or "(empty)"

    persona = (req.persona or "").strip()
    depth_hint = {
        "concise":  "Keep the tree tight — 4 branches, 2 sub-branches each.",
        "balanced": "Aim for 6 branches, 3–4 sub-branches each. Add leaves sparingly.",
        "deep":     "Go broad AND deep — 7–8 branches, 4–5 sub-branches, leaves wherever useful.",
    }.get((req.depth or "balanced").lower(), "Aim for 6 branches, 3–4 sub-branches each.")

    memory_blob = build_memory_blob(req.memory)
    memory_section = (
        f"\nRelevant prior research this user has done (use as background — "
        f"you may cross-reference but do NOT merely repeat these):\n{memory_blob}\n"
        if memory_blob else ""
    )
    memory_count = len([m for m in (req.memory or []) if (m.focus_title or "").strip()])

    user_text = (
        f"Focus node: {focus}\n"
        f"Current map title: {ctx.title}\n"
        f"Target audience: {req.audience or 'curious generalist'}\n"
        f"Depth: {depth_hint}\n"
        + (f"Assistant persona / style: {persona}\n" if persona else "")
        + f"\nCurrent outline around the focus (avoid duplicating these):\n{outline_blob}\n"
        + memory_section
        + f"\nFocus summary (if any): {ctx.focus_summary or '(none)'}\n\n"
        "Now generate the research sub-tree as mind-map JSON. Output ONLY the JSON."
    )

    async def event_stream():
        yield _sse("phase", {"phase": "thinking", "message": f"Reading the outline around \"{focus}\"…", "memory_count": memory_count})
        await asyncio.sleep(0.1)
        yield _sse("phase", {"phase": "researching", "message": f"Drafting branches for \"{focus}\"…", "memory_count": memory_count})

        session_id = f"research-{uuid.uuid4()}"
        try:
            response_text = await call_llm(
                provider=provider,
                api_key=api_key_to_use,
                system_prompt=RESEARCH_SYSTEM_PROMPT,
                user_text=user_text,
                session_id=session_id,
            )
        except Exception as e:
            logger.exception("Stream research LLM call failed")
            yield _sse("error", {"detail": f"AI service error: {e}"})
            return

        try:
            raw = parse_json_from_response(response_text)
        except Exception as e:
            logger.error(f"Bad stream research JSON: {response_text[:500]}")
            yield _sse("error", {"detail": f"AI returned invalid JSON: {e}"})
            return

        raw["title"] = focus[:120]
        raw = normalize_ids(raw, prefix="root")
        raw["source_pages"] = 0

        try:
            MindMapResponse(**raw)
        except Exception as e:
            logger.exception("Stream research failed Pydantic validation")
            yield _sse("error", {"detail": f"Research schema invalid: {e}"})
            return

        yield _sse("phase", {"phase": "revealing", "message": "Grafting branches onto the canvas…"})
        await asyncio.sleep(0.05)

        children = raw.get("children") or []
        for i, branch in enumerate(children):
            yield _sse("branch", {"index": i, "total": len(children), "branch": branch})
            await asyncio.sleep(0.15)

        yield _sse("done", {"map": raw})

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    })



# ----------- Enrich-outline endpoint -----------
class EnrichHeading(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    depth: int = 0


class EnrichOutlineRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = "Untitled"
    headings: List[EnrichHeading] = []
    audience: Optional[str] = "curious generalist"


ENRICH_SYSTEM_PROMPT = """You are an AI Research Assistant enriching a PDF outline extracted by a heuristic parser. The user has already accepted the outline structure. Your ONLY job is to add 2–3 SHORT leaf children beneath EACH existing heading so the resulting mind-map is instantly useful.

Rules:
1. PRESERVE every original heading verbatim — same title, same depth, same order.
2. For every heading add 2–3 children, each being ONE of:
   - An explanation ("Why it matters", "Core idea")
   - A concrete example or date/figure
   - An open question ("What about…", "Edge case:")
3. Children titles must be SHORT (2–6 words). You may use the `summary` field for ONE sentence of elaboration (≤160 chars).
4. Do NOT add NEW top-level headings. Do NOT re-order, re-nest, rename, merge, or delete any existing heading.
5. Output ONLY valid JSON matching the schema. No prose. No markdown fences.

Schema (the root node's `title` is the PDF title, and its `children` are the enriched original headings in order):
{
  "id": "root",
  "title": "<PDF title>",
  "summary": "",
  "children": [
    { "id": "h1", "title": "<first heading verbatim>", "summary": "", "children": [
      { "id": "l1", "title": "<leaf 1>", "summary": "..." },
      { "id": "l2", "title": "<leaf 2>", "summary": "..." }
    ]}
  ]
}
"""


@api_router.post("/research/enrich-outline", response_model=MindMapResponse)
async def enrich_outline(
    req: EnrichOutlineRequest,
    x_user_api_key: Optional[str] = Header(default=None),
    x_user_api_provider: Optional[str] = Header(default=None),
    user: dict = Depends(current_user_dep),
):
    """Takes a flat PDF heading outline and returns the same structure with
    2–3 research leaves added under each heading. Same free-quota + BYO-key
    policy as /research and /mindmap/from-pdf.
    """
    if not req.headings:
        raise HTTPException(status_code=400, detail="At least one heading is required")

    sub = user.get("subscription") or {}
    is_pro = sub.get("status") in {"active", "trialing"}
    used = int(user.get("free_conversions_used") or 0)
    has_own_key = bool((x_user_api_key or "").strip())
    if not is_pro and not has_own_key and used >= FREE_AI_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"You've used your free trial run. Add your own API key in Settings to keep using AI features (your key = your bill, not ours).",
        )

    user_key = (x_user_api_key or "").strip()
    provider = normalize_provider(x_user_api_provider)

    if user_key:
        api_key_to_use = user_key
    else:
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="No API key available — add one in Settings")
        api_key_to_use = EMERGENT_LLM_KEY
        provider = "anthropic"  # shared Emergent key only routes to native providers

    # Build a compact heading blob: "depth|title" — cap at 120 headings for cost safety.
    capped = req.headings[:120]
    heading_blob = "\n".join(f"{int(h.depth)}|{h.title[:120]}" for h in capped if h.title.strip())
    if not heading_blob:
        raise HTTPException(status_code=400, detail="All headings were empty")

    user_text = (
        f"PDF title: {req.title}\n"
        f"Audience: {req.audience or 'curious generalist'}\n\n"
        f"Original headings (format: depth|title, in order — PRESERVE VERBATIM):\n{heading_blob}\n\n"
        "Now return the enriched mind-map JSON — original headings preserved exactly, "
        "2–3 short research leaves added under each. Output ONLY the JSON."
    )

    session_id = f"enrich-{uuid.uuid4()}"
    try:
        response_text = await call_llm(
            provider=provider,
            api_key=api_key_to_use,
            system_prompt=ENRICH_SYSTEM_PROMPT,
            user_text=user_text,
            session_id=session_id,
        )
    except Exception as e:
        logger.exception("Enrich-outline LLM call failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    try:
        raw = parse_json_from_response(response_text)
    except Exception as e:
        logger.error(f"Bad enrich JSON: {response_text[:500]}")
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {e}")

    raw["title"] = (req.title or "Enriched outline")[:120]
    raw = normalize_ids(raw, prefix="root")
    raw["source_pages"] = 0

    try:
        validated = MindMapResponse(**raw)
    except Exception as e:
        logger.exception("Enrich response failed Pydantic validation")
        raise HTTPException(status_code=502, detail=f"Enrich schema invalid: {e}")
    return validated


# ----------- Compile mind-map (or sub-tree) → document -----------
#
# Inverse of /mindmap/from-pdf: take a structured tree and ask the LLM to
# weave it into a coherent document (essay / briefing / outline). Same BYOK
# + free-tier policy as the other AI endpoints. Returns Markdown so the
# frontend can preview it in a styled modal and trigger the browser print
# dialog for "Save as PDF" — no server-side PDF lib required.

class CompileNode(BaseModel):
    """Lightweight tree node — same shape as MindMapNode but with a children
    list of plain dicts so we can recurse without full pydantic re-validation
    on huge sub-trees."""
    model_config = ConfigDict(extra="ignore")
    title: str = ""
    summary: Optional[str] = ""
    children: List[Any] = []


class CompileDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    root: CompileNode
    map_title: str = ""
    # "essay" | "briefing" | "outline"
    style: str = "essay"
    # "brief" | "standard" | "deep" | "custom"
    length_preset: str = "standard"
    # If length_preset == "custom", target word count (clamped 200..6000)
    custom_words: Optional[int] = None
    persona: str = ""
    audience: str = ""


class CompileDocumentResponse(BaseModel):
    markdown: str
    word_count: int
    model_used: str


COMPILE_SYSTEM_PROMPT = """You are an expert technical writer. The user has built a hierarchical mind-map and now wants you to weave it into a coherent, well-organised document.

GROUND RULES — non-negotiable:
1. Every node title in the input MUST be reflected in the output. The user spent time building this tree; do not silently drop branches.
2. Honour the hierarchy: depth 0 = the document, depth 1 = top sections, depth 2 = subsections, depth 3+ = paragraphs / supporting points.
3. Use the node `summary` field as the seed for prose — expand it, don't just paraphrase it.
4. Output VALID Markdown. Use # / ## / ### / #### headings. Tight paragraphs. Avoid wall-of-text.
5. If a node title is short or cryptic, infer reasonable expansion — but stay faithful to the user's intent.
6. NO meta-commentary. NO "Here is your document:". NO trailing notes about what you did. Just the document.
7. NO mermaid / no JSON / no code-fence wrapping the entire response. Plain Markdown only.

OUTPUT STRUCTURE:
- A single top-level "# Title" line at the start.
- Then prose / sections following the requested style.
- Optional "## Conclusion" or "## Summary" at the end IF it adds value (don't force one).
"""


def _compile_outline_blob(node: Dict[str, Any], depth: int = 0, max_depth: int = 6, lines: Optional[List[str]] = None) -> List[str]:
    """Flatten the tree into an indented blob the LLM can read efficiently.
    Capped at depth=6 and 200 lines for cost safety."""
    if lines is None:
        lines = []
    if len(lines) >= 200:
        return lines
    if depth > max_depth:
        return lines
    title = str(node.get("title", "")).strip()[:120]
    summary = str(node.get("summary", "") or "").strip()[:240]
    if title:
        prefix = "  " * depth
        if summary:
            lines.append(f"{prefix}- {title} — {summary}")
        else:
            lines.append(f"{prefix}- {title}")
    for child in (node.get("children") or [])[:30]:
        if isinstance(child, dict):
            _compile_outline_blob(child, depth + 1, max_depth, lines)
    return lines


def _resolve_target_words(preset: str, custom: Optional[int]) -> tuple[int, str]:
    """Map a length-preset enum to (target_words, human_hint)."""
    p = (preset or "standard").lower()
    if p == "brief":
        return 350, "Aim for ~350 words (one tight page)."
    if p == "deep":
        return 2400, "Aim for ~2,400 words (8–10 pages of substance)."
    if p == "custom":
        try:
            w = max(200, min(6000, int(custom or 0)))
        except (TypeError, ValueError):
            w = 900
        return w, f"Aim for ~{w} words (custom target)."
    # standard / fallback
    return 900, "Aim for ~900 words (3 pages)."


def _resolve_style_hint(style: str) -> str:
    s = (style or "essay").lower()
    if s == "briefing":
        return (
            "STYLE: Executive briefing. Lead with a 2-sentence TL;DR. Then bullet "
            "points under each section heading. Skim-friendly. Bold key terms. "
            "Skip flowery prose."
        )
    if s == "outline":
        return (
            "STYLE: Annotated outline. Mirror the tree structure 1:1 with nested "
            "Markdown bullets. Each bullet gets a 1-sentence elaboration. Use "
            "bold for the original node titles."
        )
    return (
        "STYLE: Essay-style prose. Each section is 2–4 paragraphs. Use natural "
        "transitions between subsections. Quote-like phrasing where the source "
        "material warrants it. No bullet points unless the content is genuinely "
        "list-like."
    )


@api_router.post("/compile/document", response_model=CompileDocumentResponse)
async def compile_document(
    req: CompileDocumentRequest,
    x_user_api_key: Optional[str] = Header(default=None),
    x_user_api_provider: Optional[str] = Header(default=None),
    user: dict = Depends(current_user_dep),
):
    """Inverse of /mindmap/from-pdf: take a (sub)tree and compile it into a
    Markdown document. BYOK gated identically to the other AI endpoints."""
    sub = user.get("subscription") or {}
    is_pro = sub.get("status") in {"active", "trialing"}
    used = int(user.get("free_conversions_used") or 0)
    has_own_key = bool((x_user_api_key or "").strip())
    if not is_pro and not has_own_key and used >= FREE_AI_LIMIT:
        raise HTTPException(
            status_code=402,
            detail="You've used your free trial run. Add your own API key in Settings to keep using AI features (your key = your bill, not ours).",
        )

    user_key = (x_user_api_key or "").strip()
    provider = normalize_provider(x_user_api_provider)

    if user_key:
        api_key_to_use = user_key
    else:
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="No API key available — add one in Settings")
        api_key_to_use = EMERGENT_LLM_KEY
        provider = "anthropic"

    root_dict = req.root.model_dump()
    title = (root_dict.get("title") or req.map_title or "Untitled").strip()[:160]
    if not title:
        raise HTTPException(status_code=400, detail="Selection has no title")

    outline_lines = _compile_outline_blob(root_dict)
    if not outline_lines:
        raise HTTPException(status_code=400, detail="Selection is empty")

    target_words, words_hint = _resolve_target_words(req.length_preset, req.custom_words)
    style_hint = _resolve_style_hint(req.style)

    persona = (req.persona or "").strip()
    audience = (req.audience or "curious generalist").strip()

    user_text = (
        f"Document title: {title}\n"
        f"Audience: {audience}\n"
        f"Length: {words_hint}\n"
        f"{style_hint}\n"
        + (f"Author persona / voice: {persona}\n" if persona else "")
        + f"\nMind-map outline (depth-indented, format: title — summary):\n"
        + "\n".join(outline_lines)
        + "\n\nNow weave this outline into the requested document. Output ONLY the Markdown."
    )

    session_id = f"compile-{uuid.uuid4()}"
    try:
        response_text = await call_llm(
            provider=provider,
            api_key=api_key_to_use,
            system_prompt=COMPILE_SYSTEM_PROMPT,
            user_text=user_text,
            session_id=session_id,
        )
    except Exception as e:
        logger.exception("Compile-document LLM call failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    md = (response_text or "").strip()
    # Strip a wrapping ```markdown fence if the model added one despite the
    # prompt — happens occasionally with smaller models.
    if md.startswith("```"):
        md = re.sub(r"^```(?:markdown|md)?\s*", "", md)
        md = re.sub(r"\s*```\s*$", "", md)
    if not md:
        raise HTTPException(status_code=502, detail="AI returned an empty document")

    # If user is on free tier without a key, count this against their quota.
    if not is_pro and not has_own_key:
        try:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$inc": {"free_conversions_used": 1}},
            )
        except Exception:
            logger.exception("Failed to increment free_conversions_used after compile")

    word_count = len(md.split())
    return CompileDocumentResponse(
        markdown=md,
        word_count=word_count,
        model_used=f"{provider}:{_NATIVE_MODELS[provider][1]}",
    )


# ----------- Public-domain corpus (arXiv + Gutenberg) -----------
#
# Legal: both sources are explicitly public-domain or open-access. No DRM is
# bypassed. All requests fan out from the backend so CORS + rate-limits are
# handled cleanly.

import xml.etree.ElementTree as ET
import httpx
from io import BytesIO

ARXIV_API = "https://export.arxiv.org/api/query"
GUTENDEX_API = "https://gutendex.com/books/"
# UK law sources — both publish Atom feeds and PDFs under open licences:
#   • legislation.gov.uk → UK statutes & statutory instruments (Open Government
#     Licence v3.0 — free reuse with attribution).
#   • Find Case Law (caselaw.nationalarchives.gov.uk) → official UK court
#     judgments published under the Open Justice Licence.
# Together they cover the same ground a UK law student needs day-to-day from
# LexisNexis (cases + statutes) — without the paywall and without breaking
# our zero-ongoing-cost model.
UK_LEGISLATION_API = "https://www.legislation.gov.uk/all/data.feed"
UK_CASELAW_API = "https://caselaw.nationalarchives.gov.uk/atom.xml"


@api_router.get("/corpus/search")
async def corpus_search(source: str, q: str, limit: int = 20):
    """Search arXiv or Project Gutenberg. Returns a compact list of hits."""
    source = (source or "").strip().lower()
    q = (q or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query is required")
    limit = max(1, min(int(limit or 20), 50))

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client_http:
        if source == "arxiv":
            try:
                resp = await client_http.get(
                    ARXIV_API,
                    params={"search_query": f"all:{q}", "start": 0, "max_results": limit, "sortBy": "relevance"},
                )
                resp.raise_for_status()
            except httpx.HTTPError as e:
                raise HTTPException(status_code=502, detail=f"arXiv upstream error: {e}")
            return {"source": "arxiv", "items": _parse_arxiv_atom(resp.text)}

        if source == "gutenberg":
            # Gutendex.com flakes intermittently from cloud-hosted IPs (503s
            # then recovers seconds later). Retry up to 3× with a short
            # backoff before giving up — keeps the picker usable when the
            # upstream is just slow rather than truly down.
            data = None
            last_status = None
            for attempt in range(3):
                try:
                    resp = await client_http.get(
                        GUTENDEX_API,
                        params={"search": q},
                        # Be polite + identifiable so they can whitelist us.
                        headers={"User-Agent": "marvex/1.0 (+https://marvex.app)"},
                    )
                    last_status = resp.status_code
                    if resp.status_code == 200:
                        data = resp.json() or {}
                        break
                    # 5xx → retry; 4xx → bubble up immediately.
                    if 400 <= resp.status_code < 500:
                        break
                except httpx.HTTPError as e:
                    last_status = type(e).__name__
                if attempt < 2:
                    await asyncio.sleep(0.6 * (attempt + 1))
            if data is None:
                raise HTTPException(
                    status_code=503,
                    detail=f"Project Gutenberg is responding slowly right now (upstream {last_status}). Please try again in a moment.",
                )
            results = (data.get("results") or [])[:limit]
            items = []
            for b in results:
                formats = b.get("formats") or {}
                # Prefer native PDF, otherwise plain-text UTF-8 (we convert server-side).
                pdf_url = formats.get("application/pdf")
                text_url = (
                    formats.get("text/plain; charset=utf-8")
                    or formats.get("text/plain")
                    or formats.get("text/plain; charset=us-ascii")
                )
                if not (pdf_url or text_url):
                    continue
                items.append({
                    "id": str(b.get("id") or ""),
                    "title": (b.get("title") or "").strip()[:180],
                    "authors": [a.get("name", "") for a in (b.get("authors") or [])][:3],
                    "year": "",
                    "subjects": (b.get("subjects") or [])[:4],
                    "downloads": b.get("download_count"),
                    "has_native_pdf": bool(pdf_url),
                    "pdf_url": pdf_url or "",
                    "text_url": text_url or "",
                })
            return {"source": "gutenberg", "items": items}

        if source == "law-uk":
            # Two upstreams in parallel — different XML dialects, so we parse
            # each one and merge.  We cap each side at half the requested
            # limit so a single dominant source can't crowd out the other,
            # then sort newest-first because law students nearly always want
            # current authority before historical context.
            #
            # IMPORTANT: legislation.gov.uk sits behind CloudFront WAF that
            # blocks httpx's TLS JA3 fingerprint with HTTP 437.  urllib's
            # stdlib SSL stack passes the WAF cleanly — so we run it in a
            # worker thread to keep the endpoint async-safe.  Find Case Law
            # is happy with httpx (no WAF), so we keep that on the existing
            # async client to share its connection pool with the other
            # corpora.
            half = max(1, limit // 2)

            def _fetch_legislation():
                import urllib.request
                from urllib.parse import urlencode
                url = f"{UK_LEGISLATION_API}?{urlencode({'text': q, 'results-count': half})}"
                req = urllib.request.Request(url, headers={
                    "User-Agent": "Mozilla/5.0 (compatible; marvex/1.0; +https://marvex.app)",
                    "Accept": "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
                })
                try:
                    with urllib.request.urlopen(req, timeout=15) as r:
                        if r.status != 200:
                            return None
                        return r.read().decode("utf-8", errors="replace")
                except Exception:
                    return None

            try:
                leg_text, case_resp = await asyncio.gather(
                    asyncio.to_thread(_fetch_legislation),
                    client_http.get(
                        UK_CASELAW_API,
                        params={"query": q, "per_page": half},
                        headers={"User-Agent": "marvex/1.0 (+https://marvex.app)"},
                    ),
                    return_exceptions=True,
                )
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"UK law upstream error: {e}")

            items = []
            if isinstance(leg_text, str) and leg_text:
                items.extend(_parse_uk_legislation_atom(leg_text))
            if not isinstance(case_resp, Exception) and case_resp.status_code == 200:
                items.extend(_parse_uk_caselaw_atom(case_resp.text))
            # If BOTH failed, surface a clear error instead of an empty list
            # — empty looks like "no matches" to the user and that's misleading.
            if not items:
                leg_failed = not (isinstance(leg_text, str) and leg_text)
                case_failed = isinstance(case_resp, Exception) or getattr(case_resp, "status_code", 0) != 200
                if leg_failed and case_failed:
                    raise HTTPException(
                        status_code=503,
                        detail="UK law sources are responding slowly right now. Please try again in a moment.",
                    )
            # Group statutes before judgments — when a student searches a
            # named Act ("Equality Act 2010", "Theft Act 1968"), they want
            # the Act itself at the top, not 13 unrelated 2026 judgments
            # that happened to mention it. Within each group we still sort
            # newest-first so current law lands above historical material.
            kind_order = {"statute": 0, "judgment": 1}
            items.sort(key=lambda it: (kind_order.get(it.get("kind"), 9), -int(it.get("year") or 0)))
            return {"source": "law-uk", "items": items[:limit]}

        raise HTTPException(status_code=400, detail="Unknown source — use 'arxiv', 'gutenberg' or 'law-uk'")


def _parse_arxiv_atom(xml_text: str):
    """Parse arXiv's Atom response into a flat item list."""
    ns = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
    out = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return out
    for entry in root.findall("a:entry", ns):
        eid = (entry.findtext("a:id", default="", namespaces=ns) or "").strip()
        # Normalise: "http://arxiv.org/abs/2401.12345v2" → "2401.12345"
        arxiv_id = eid.rsplit("/", 1)[-1].split("v", 1)[0]
        title = (entry.findtext("a:title", default="", namespaces=ns) or "").strip().replace("\n", " ")
        summary = (entry.findtext("a:summary", default="", namespaces=ns) or "").strip().replace("\n", " ")
        published = (entry.findtext("a:published", default="", namespaces=ns) or "")[:4]
        authors = [
            (a.findtext("a:name", default="", namespaces=ns) or "").strip()
            for a in entry.findall("a:author", ns)
        ][:3]
        pdf_url = ""
        for link in entry.findall("a:link", ns):
            if link.get("title") == "pdf":
                pdf_url = link.get("href", "")
                break
        if not pdf_url and arxiv_id:
            pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        out.append({
            "id": arxiv_id,
            "title": title[:240],
            "authors": authors,
            "year": published,
            "subjects": [],
            "abstract": summary[:500],
            "has_native_pdf": True,
            "pdf_url": pdf_url,
        })
    return out


def _parse_uk_legislation_atom(xml_text: str):
    """Parse legislation.gov.uk's Atom feed into our generic corpus shape.

    Each <entry> exposes ~10 alternate links — we only care about the PDF.
    Items without a PDF link are dropped (rare; a few very old SIs lack one).
    """
    ns = {
        "a": "http://www.w3.org/2005/Atom",
        "ukm": "http://www.legislation.gov.uk/namespaces/metadata",
    }
    out = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return out
    for entry in root.findall("a:entry", ns):
        title = (entry.findtext("a:title", default="", namespaces=ns) or "").strip()
        summary = (entry.findtext("a:summary", default="", namespaces=ns) or "").strip()
        # The <id> is the canonical landing page (e.g. .../id/uksi/2012/1916).
        leg_id = (entry.findtext("a:id", default="", namespaces=ns) or "").strip()
        # Year preferred from <ukm:Year>; fall back to parsing the id slug.
        year_el = entry.find("ukm:Year", ns)
        year = (year_el.get("Value") if year_el is not None else "") or ""
        # Document main type → human-readable kind label (e.g. "UK Public General Act").
        type_el = entry.find("ukm:DocumentMainType", ns)
        doc_type = (type_el.get("Value") if type_el is not None else "") or "Legislation"
        kind_label = _humanise_uk_doc_type(doc_type)

        pdf_url = ""
        for link in entry.findall("a:link", ns):
            if (link.get("type") or "").lower() == "application/pdf":
                pdf_url = link.get("href", "")
                break
        if not pdf_url:
            continue

        # Stable id derived from the canonical URI — survives across queries.
        item_id = "leg-" + (leg_id.rsplit("/id/", 1)[-1].replace("/", "-") or pdf_url[-12:])
        out.append({
            "id": item_id,
            "title": title[:240],
            "authors": [],
            "year": year,
            "subjects": [],
            "abstract": summary[:500],
            "has_native_pdf": True,
            "pdf_url": pdf_url,
            "kind": "statute",
            "kind_label": kind_label,
            "citation": "",
            "court": "",
        })
    return out


def _humanise_uk_doc_type(t: str) -> str:
    """Map legislation.gov.uk's DocumentMainType slugs to human labels."""
    return {
        "UnitedKingdomPublicGeneralAct": "UK Public General Act",
        "UnitedKingdomLocalAct": "UK Local Act",
        "UnitedKingdomChurchInstrument": "Church Instrument",
        "UnitedKingdomStatutoryInstrument": "UK Statutory Instrument",
        "ScottishStatutoryInstrument": "Scottish Statutory Instrument",
        "WalesStatutoryInstrument": "Welsh Statutory Instrument",
        "NorthernIrelandStatutoryRule": "Northern Ireland Statutory Rule",
        "UnitedKingdomMinisterialOrder": "UK Ministerial Order",
        "UnitedKingdomMinisterialDirection": "UK Ministerial Direction",
    }.get(t, t.replace("UnitedKingdom", "UK ").strip() or "Legislation")


def _parse_uk_caselaw_atom(xml_text: str):
    """Parse the National Archives Find Case Law Atom feed into our shape.

    Each entry has a court name (<author><name>), a neutral citation
    (<tna:identifier type="ukncn">) and a PDF link to the assets bucket.
    """
    ns = {
        "a": "http://www.w3.org/2005/Atom",
        "tna": "https://caselaw.nationalarchives.gov.uk",
    }
    out = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return out
    for entry in root.findall("a:entry", ns):
        title = (entry.findtext("a:title", default="", namespaces=ns) or "").strip()
        published = (entry.findtext("a:published", default="", namespaces=ns) or "")[:4]
        court = (entry.findtext("a:author/a:name", default="", namespaces=ns) or "").strip()
        # Neutral citation lives in tna:identifier[type="ukncn"]; fallback to
        # building it from the entry id slug if the feed shape changes.
        citation = ""
        for ident in entry.findall("tna:identifier", ns):
            if (ident.get("type") or "").lower() == "ukncn":
                citation = (ident.text or "").strip()
                break
        # PDF link: prefer the assets-bucket pdf attached to the entry.
        pdf_url = ""
        for link in entry.findall("a:link", ns):
            if (link.get("type") or "").lower() == "application/pdf":
                pdf_url = link.get("href", "")
                break
        if not pdf_url:
            continue
        # Stable id from the entry's <id> value.
        eid = (entry.findtext("a:id", default="", namespaces=ns) or "").strip()
        item_id = "case-" + (eid.rsplit("/", 1)[-1] or pdf_url[-12:])
        # Build a light abstract since the Atom <summary> is empty for
        # judgments — show "<court> · <citation>" so readers can see at a
        # glance which court delivered the decision.
        meta_bits = " · ".join(b for b in (court, citation) if b)
        out.append({
            "id": item_id,
            "title": title[:240],
            "authors": [],
            "year": published,
            "subjects": [],
            "abstract": meta_bits[:500],
            "has_native_pdf": True,
            "pdf_url": pdf_url,
            "kind": "judgment",
            "kind_label": court or "Court judgment",
            "citation": citation,
            "court": court,
        })
    return out


def _text_to_pdf_bytes(text: str, title: str) -> bytes:
    """Render plain text as a simple PDF with reportlab — just headings-size
    for the title, then body-size paragraphs. Keeps ~first 40k chars so the
    heuristic heading parser can work on chapter-style books without hanging.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.enums import TA_LEFT

    del Canvas  # imported for possible fallback only

    # Cap input length — enough for the parser to find chapter headings.
    clipped = text[:120_000]

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
        topMargin=0.8 * inch, bottomMargin=0.8 * inch,
    )
    styles = getSampleStyleSheet()
    h1 = styles["Title"]
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=13, alignment=TA_LEFT)
    chapter = ParagraphStyle("chapter", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=16, leading=20)

    story = [Paragraph(_xml_escape(title[:120]) or "Untitled", h1), Spacer(1, 0.2 * inch)]

    # Split on blank lines. Lines that look like chapter headings (ALL CAPS or
    # "CHAPTER X" / "PART X") get rendered larger so the downstream heuristic
    # parser recognises them.
    import re as _re
    for block in _re.split(r"\n\s*\n", clipped):
        line = block.strip()
        if not line:
            continue
        first_line = line.split("\n", 1)[0].strip()
        is_heading = (
            (first_line.isupper() and 3 <= len(first_line.split()) <= 8)
            or _re.match(r"^(CHAPTER|PART|BOOK|SECTION)\b", first_line, _re.I)
        )
        style = chapter if is_heading else body
        # reportlab's Paragraph parses a mini-XML — escape unsafe chars.
        safe = _xml_escape(line[:2000]).replace("\n", "<br/>")
        story.append(Paragraph(safe, style))
        story.append(Spacer(1, 0.08 * inch))

    doc.build(story)
    return buf.getvalue()


def _xml_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
    )


def _strip_html(html: str) -> str:
    """Strip XHTML/HTML markup down to readable plain text for PDF synthesis.

    Designed for legislation.gov.uk's data.htm output — semantic markup
    with paragraph + heading tags. We:
      1. Drop <script>/<style> blocks entirely (their bodies aren't text).
      2. Convert block-level closers (</p>, </h1..h6>, </div>, </li>) to
         double newlines so the PDF synthesiser keeps section structure.
      3. Strip all remaining tags.
      4. Decode the basic HTML entities the synthesiser would otherwise
         render literally.

    Not a general-purpose HTML cleaner — but sufficient for the well-formed
    XHTML the .gov.uk service returns.
    """
    import re as _re
    if not html:
        return ""
    # Drop <script>, <style>, <head>, <nav>, <footer> wholesale.
    cleaned = _re.sub(
        r"<(script|style|head|nav|footer|aside|noscript)\b[^>]*>.*?</\1>",
        " ",
        html,
        flags=_re.IGNORECASE | _re.DOTALL,
    )
    # Block-closers → double newline (preserve paragraphs / headings).
    cleaned = _re.sub(
        r"</(p|h[1-6]|div|li|tr|section|article|blockquote)\s*>",
        "\n\n",
        cleaned,
        flags=_re.IGNORECASE,
    )
    cleaned = _re.sub(r"<br\s*/?>", "\n", cleaned, flags=_re.IGNORECASE)
    # Strip any remaining tag.
    cleaned = _re.sub(r"<[^>]+>", "", cleaned)
    # Decode common entities — full table is overkill for legislation.gov.uk.
    for entity, char in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                          ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'"),
                          ("&#x2014;", "—"), ("&#8217;", "’"), ("&#8220;", "“"),
                          ("&#8221;", "”")):
        cleaned = cleaned.replace(entity, char)
    # Collapse runs of blank lines and trim trailing whitespace per line.
    cleaned = _re.sub(r"\n[ \t]+", "\n", cleaned)
    cleaned = _re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


@api_router.get("/corpus/fetch")
async def corpus_fetch(source: str, url: str, title: str = "", response: Response = None):
    """Proxy-download a PDF from a public-domain source so the browser sees it
    as same-origin. For Gutenberg plain-text entries we synthesise a PDF.
    """
    source = (source or "").strip().lower()
    url = (url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="A url is required")
    if source not in {"arxiv", "gutenberg", "law-uk"}:
        raise HTTPException(status_code=400, detail="Unknown source")

    # Lock the hostname down so this can't be abused as a generic proxy.
    allowed = (
        "arxiv.org", "export.arxiv.org",
        "www.gutenberg.org", "gutenberg.org", "www.gutenberg.net",
        # UK law: official government/judiciary domains only — no third-party
        # mirrors, so we never serve a tampered judgment to a student.
        "www.legislation.gov.uk", "legislation.gov.uk",
        "caselaw.nationalarchives.gov.uk",
        "assets.caselaw.nationalarchives.gov.uk",
    )
    try:
        host = httpx.URL(url).host.lower()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL")
    if not any(host == a or host.endswith("." + a) for a in allowed):
        raise HTTPException(status_code=400, detail="URL not allowed")

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client_http:
        try:
            # legislation.gov.uk's PDF endpoint sits behind a CloudFront JS
            # challenge that returns HTTP 202 to any non-browser client (we
            # tried httpx, urllib, and curl_cffi with Chrome impersonation;
            # all hit the challenge).  Their .htm / .xml endpoints are NOT
            # behind the same challenge — they return 200 with full content.
            # So we transparently rewrite data.pdf → data.htm, strip HTML,
            # and synthesise a clean PDF using the same path Gutenberg
            # plain-text books take.  Net result: students get a readable
            # PDF every time, with no fragile WAF bypass to maintain.
            if host.endswith("legislation.gov.uk"):
                fetch_url = url
                if fetch_url.lower().endswith(".pdf"):
                    fetch_url = fetch_url[:-4] + ".htm"

                def _urllib_get():
                    import urllib.request
                    req = urllib.request.Request(fetch_url, headers={
                        "User-Agent": "Mozilla/5.0 (compatible; marvex/1.0; +https://marvex.app)",
                        "Accept": "application/xhtml+xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.5",
                    })
                    with urllib.request.urlopen(req, timeout=45) as r:
                        return r.status, r.headers.get("content-type", ""), r.read()
                status, ctype, body = await asyncio.to_thread(_urllib_get)
                if status != 200:
                    raise HTTPException(status_code=502, detail=f"Upstream returned {status}")
                upstream_content = body
                upstream_content_type = ctype
            else:
                upstream = await client_http.get(url, headers={"User-Agent": "marvex/1.0 (+https://marvex.app)"})
                upstream.raise_for_status()
                upstream_content = upstream.content
                upstream_content_type = upstream.headers.get("content-type", "")
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Upstream error: {e}")

    content_type = (upstream_content_type or "").split(";")[0].strip().lower()
    safe_title = (title or "download").replace('"', "'")[:80]
    filename = f"{safe_title}.pdf".replace("/", "_")

    # legislation.gov.uk path — XHTML body. Strip tags then synthesise a PDF.
    if host.endswith("legislation.gov.uk") and content_type != "application/pdf":
        try:
            html_text = upstream_content.decode("utf-8", errors="replace") if isinstance(upstream_content, bytes) else str(upstream_content)
        except Exception:
            html_text = ""
        plain = _strip_html(html_text)
        pdf_bytes = _text_to_pdf_bytes(plain, title or safe_title)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    if content_type == "application/pdf" or url.lower().endswith(".pdf"):
        return Response(
            content=upstream_content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    # Plain-text path (Gutenberg fallback). Synthesise a PDF server-side.
    try:
        text = upstream_content.decode("utf-8", errors="replace") if isinstance(upstream_content, bytes) else str(upstream_content)
    except Exception:
        text = ""
    pdf_bytes = _text_to_pdf_bytes(text, title or safe_title)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ----------- Mount -----------
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(webhook_router)
app.include_router(share_router)
app.include_router(sync_router)
app.include_router(waitlist_router)
app.include_router(testimonials_router)
app.include_router(affiliate_router)
app.include_router(reviewer_router)
app.include_router(license_router)
app.include_router(premium_router)
app.include_router(access_router)
app.include_router(admin_ops_router)
app.include_router(press_router)
app.include_router(bugreport_router)
app.include_router(make_magic_auth_router(db))
app.include_router(make_apple_auth_router(db))
app.include_router(mikey_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=r"https://(.*\.)?marvex\.app|https://(.*\.)?mind-mapper\.com|https://.*\.preview\.emergentagent\.com|https://.*\.emergent\.host",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup_magic_indexes():
    """Create indexes for the magic-link auth flow (token unique, TTL on
    expires_at). Idempotent — safe on every boot."""
    try:
        await ensure_magic_indexes(db)
    except Exception as e:
        logger.warning("magic_tokens index creation skipped: %s", e)


@app.on_event("startup")
async def on_startup_apple_indexes():
    try:
        await ensure_apple_indexes(db)
    except Exception as e:
        logger.warning("apple indexes skipped: %s", e)


@app.on_event("startup")
async def on_startup_purge_tombstones():
    """Best-effort — hard-delete sync tombstones older than 30 days on
    every boot. Silently continues on failure (Mongo not ready yet, etc.)."""
    try:
        count = await purge_old_tombstones(db)
        if count:
            logger.info("Purged %d old sync tombstones at startup", count)
    except Exception as e:
        logger.warning("Tombstone purge skipped: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

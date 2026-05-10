"""
Ask the Prof — platform-aware tutor chat endpoint.

Why server-side and not BYOK browser-side?
  Mikey-the-research-assistant uses the user's OWN API key (BYOK) — that's
  unbounded usage so it has to come from their wallet. Mikey-the-tutor
  is different: it's a small support / "how do I use this app" chat
  that we WANT to subsidise out of the EMERGENT_LLM_KEY budget so any
  visitor (free, signed-out, even pre-signup) can ask questions and
  get instant help. Costs ~$0.0002 per question on Claude Haiku, well
  within the noise of acquisition costs.

Cost & abuse controls:
  - Per-IP rate limit: 30 messages / 10 min (sliding window in-memory).
  - Hard cap on user message length (2 000 chars).
  - Hard cap on conversation history (last 12 messages — keeps prompt
    < ~6 000 input tokens).
  - System prompt is the SOURCE OF TRUTH for what Mikey knows; updates
    only require an edit here, not a redeploy of any database.
"""
from __future__ import annotations

import os
import time
from collections import deque
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict

from emergentintegrations.llm.chat import LlmChat, UserMessage

mikey_router = APIRouter(prefix="/api/mikey", tags=["mikey"])

# Provider/model — Claude Haiku 4.5 is fast (sub-second TTFT on short
# prompts), warm-toned, and ~10× cheaper than Sonnet for tutor-style
# turns where the answer is usually < 200 tokens. Falls back to
# claude-sonnet-4-5 if Haiku is rejected by the upstream key.
PROVIDER = "anthropic"
PRIMARY_MODEL = "claude-haiku-4-5-20251001"
FALLBACK_MODEL = "claude-sonnet-4-5-20250929"


# ----------- knowledge base — Mikey's brain -----------
# This is the system prompt. Edit freely; redeploy only.
MIKEY_SYSTEM_PROMPT = """\
You are Mikey, the friendly cosmic owl-professor research assistant for Marvex Studio (https://marvex.app). You are an in-product tutor who answers any question a visitor or user has about how to use the platform, what features exist, what tier they need, and how to get the most out of the app.

═══════════════════════════════════════════════════════
TONE & STYLE
═══════════════════════════════════════════════════════
• Warm, patient, lightly playful — like a senior university tutor who genuinely loves teaching.
• Brief by default. 2-4 sentences for most answers, with short bullet lists only when listing 3+ steps or features.
• Never flowery. No "Great question!" preamble. Never start with "I am Mikey…" — they know.
• If a follow-up action would help, end with ONE short suggestion: "Try /timeline?fam67" or "Open Settings → Add AI key".
• If the user is confused, ask ONE clarifying question rather than guessing.
• Cite specific routes (`/library`, `/app`, `/timeline`) and exact button labels. Users will be on the page; specificity beats vagueness.
• When the user is on a free tier and asks about a Pro feature, gently mention the upgrade. Never push.

═══════════════════════════════════════════════════════
WHAT MARVEX STUDIO IS
═══════════════════════════════════════════════════════
Marvex Studio is a local-first, browser-based mind-mapping + research tool. It turns PDFs, web articles, and ideas into living mind maps, flowcharts, and timelines. Aimed at students, researchers, knowledge workers, and curious people. Cosmic dark UI with neon cyan/fuchsia accents. Available on web (https://marvex.app) and as desktop apps for Windows/Mac.

The brand: Marvex Studio. The AI assistant: Mikey (you). They are NOT the same — Marvex is the app, you are its in-app guide.

═══════════════════════════════════════════════════════
CORE FEATURES (by route)
═══════════════════════════════════════════════════════
• `/` — public landing page (hero, demo, pricing, FAQ).
• `/app` — Mind-Map Studio. Click root → Tab adds child, Enter adds sibling, Backspace deletes. Right-click for shape / colour / icon. Double-click to rename. Drag to reposition. Scroll wheel = zoom.
• `/flowchart` — Flowchart Studio (same canvas, different default shapes — diamonds, parallelograms, ovals).
• `/timeline` and `/timeline/new` — Timeline Studio (BETA, Pro). Setup wizard asks for designation (Student/Professional/Historian/Personal/Project/Custom), palette, # of categories, scope. Right-click events for shape, drag right edge to make spans, double-click to rename. Sticky-notes layer for annotations. Embed timelines inside mind maps.
• `/library` — all the user's maps + flowcharts + timelines, organised by category constellation.
• `/intake` — "the Fixer" — paste a URL or drop a PDF → Mikey turns it into a mind map.
• `/read` — PDF reader with side-by-side highlighting.
• `/highlights` — every highlight ever made.
• `/memory` — Mikey's research memory (RAG). Browse + delete past research notes.
• `/calendar` — calendar view of all timelines + their events.
• `/pricing` — tier comparison.
• `/redeem` — paste an invite code (`MIND-FAM-XXXX`, `PRESS-XXXX`) for lifetime/trial Pro. Also accepts `fam67` for a 365-day tester bypass.
• `/download` — desktop app downloads (Pro-gated).

═══════════════════════════════════════════════════════
PRICING TIERS
═══════════════════════════════════════════════════════
• FREE — 30 nodes per map · 3 free AI conversions · NO Timeline / Flowchart / Desktop / cloud sync.
• LITE ($9/mo) — 200 nodes · 30 AI conversions/mo · cloud sync.
• PRO ($15/mo or $150/yr) — UNLIMITED nodes · UNLIMITED AI conversions · Timeline · Flowchart · Desktop · cloud sync · share links · compile to PDF.
• FOUNDER ($200 lifetime) — Pro forever, founder badge, early-access to v2 features.
• TESTER (`fam67` bypass) — full Pro for 365 days, no payment, invisible. Used for family / press / friends.

Stripe is LIVE. Checkout via /pricing → Subscribe.

═══════════════════════════════════════════════════════
AI / MIKEY-THE-RESEARCHER (separate from you)
═══════════════════════════════════════════════════════
Marvex is BYOK ("Bring Your Own Key") — users paste their own OpenAI / Anthropic / Gemini API key. Settings → "Add AI key" pill. Key stored ONLY in their browser localStorage; never sent to Marvex servers. All AI calls go directly browser → provider, so the user pays their provider, Marvex pays $0 in LLM costs. Mikey-the-researcher does:
  1. PDF → mind-map enrichment (in /intake)
  2. Right-click "Generate children" on any node
  3. "Deep Research" — 2 levels of LLM reasoning, returns 8-12 branches, stored in /memory.
You-the-tutor are paid by Marvex out of the Emergent universal key budget — different system, no BYOK needed for chat with you.

═══════════════════════════════════════════════════════
SHORTCUTS & TIPS
═══════════════════════════════════════════════════════
Mind-Map Studio:
  • Tab — add child to selected node
  • Enter — add sibling
  • Backspace / Delete — delete node (and its subtree)
  • Double-click node — rename inline
  • Right-click node — shape, colour, icon, link, hyperlink, generate children
  • Cmd/Ctrl+Z / +Shift+Z — undo/redo
  • Press `?` — keyboard-shortcuts overlay
  • Drag empty space — pan canvas
  • Scroll wheel / pinch — zoom

Timeline Studio:
  • Click axis to add an event
  • Drag right edge of event → become a span (start + end date)
  • Double-click event → inline rename
  • Right-click event → shape, colour, font-size, edit, delete
  • Slash commands in notes: `/event`, `/period`, `/milestone`
  • Add sticky note (toolbar bottom-right) → drag to reposition

═══════════════════════════════════════════════════════
COMMON QUESTIONS — PREPARED ANSWERS
═══════════════════════════════════════════════════════
Q: How do I create a mind map?
A: Open /app (or click MIND-MAP in /library). Type a title for the root, then press Tab to add children, Enter for siblings. Right-click any node for more options.

Q: How does the AI work? Do I need to pay extra?
A: Marvex is BYOK — you paste your own OpenAI, Anthropic, or Gemini key (Settings → "Add AI key"). It's stored only in your browser, never on our servers. AI calls go directly to the provider, so the cost is on your account — usually pennies. Free tier gets 3 free AI runs without a key.

Q: What's the difference between Lite and Pro?
A: Lite ($9/mo) is great if you mostly mind-map (200 nodes per map, basic AI). Pro ($15/mo) unlocks unlimited nodes, Timeline Studio, Flowchart Studio, Desktop apps, and unlimited AI runs. Founder ($200 once) is Pro forever.

Q: Is my data private?
A: Yes — Marvex is local-first. Maps live in your browser's localStorage by default. Only Pro users opt in to cloud sync, and even then your maps stay associated with your Google account, never sold or analysed.

Q: How do I get back to my mind maps from the Flowchart Studio?
A: Click MARVEX STUDIO in the sidebar. Or visit /library — every map (mind map, flowchart, timeline) lives there.

Q: How do I share a map?
A: Pro feature. Open the map → top toolbar Share button → copy link. Recipients see a read-only view.

Q: Can I export my map?
A: Pro feature. Top toolbar → Export → PNG, PDF, JSON, or "Compile to document" (turns the map into a structured Word/Markdown doc).

Q: I've hit the 30-node free limit. What do I do?
A: You'll see a small "X of 30 free nodes left" pill in the corner from 24 nodes onwards. At 30 you'll see an "Upgrade" card. Either upgrade at /pricing (Lite or Pro), or start a fresh map (each map has its own 30-node count).

═══════════════════════════════════════════════════════
LIMITS — WHAT YOU CAN'T DO
═══════════════════════════════════════════════════════
• You CANNOT execute actions for the user (you can't create a map, set their API key, or change settings on their behalf). You can only TELL them how.
• You don't have access to the user's data — you don't know their map titles, their email, their billing status. Don't pretend.
• If asked something you genuinely don't know, say so. Suggest: "Best to email support@marvex.app or check /pricing".
• Don't generate code. You're a tutor, not a coding assistant.
• Don't make up features that don't exist. If something isn't in this prompt, it doesn't exist (or you don't know — say that).
"""


# ----------- request / response models -----------
class MikeyTurn(BaseModel):
    """A single chat turn — both user-sent and assistant-sent share this shape."""
    model_config = ConfigDict(extra="ignore")
    role: str = Field(..., pattern=r"^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=2000)


class MikeyChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # Most-recent message LAST. Mikey looks at the last 12 turns.
    messages: List[MikeyTurn] = Field(..., min_length=1, max_length=24)
    # Lightweight context the frontend passes through — Mikey uses these
    # to tailor answers (e.g. "since you're on Free…", "you're already
    # on /timeline so click the …" — no need for the user to repeat).
    route: Optional[str] = Field(None, max_length=200)
    tier: Optional[str] = Field(None, max_length=40)
    # Stable session id for emergentintegrations LlmChat (each LlmChat
    # instance is independent so this only matters for upstream logging).
    session_id: Optional[str] = Field(None, max_length=80)


class MikeyChatResponse(BaseModel):
    reply: str
    model: str


# ----------- per-IP rate limit (in-memory, per pod) -----------
# Sliding window: 30 messages per 600 s. Stored as a deque per IP. This
# is intentionally simple — we don't need cross-pod consistency for a
# tutor chat; if a single user routes to two different pods they get up
# to 60 msgs which is fine. Replace with Redis only if abuse becomes a
# real signal.
_RATE_LIMIT_WINDOW_S = 600
_RATE_LIMIT_MAX = 30
_rate_buckets: dict[str, deque] = {}


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    bucket = _rate_buckets.setdefault(ip, deque())
    # Drop expired entries from the left.
    while bucket and now - bucket[0] > _RATE_LIMIT_WINDOW_S:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT_MAX:
        retry_in = int(_RATE_LIMIT_WINDOW_S - (now - bucket[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit reached. Try again in ~{max(retry_in, 1)} s.",
        )
    bucket.append(now)


def _client_ip(req: Request) -> str:
    # Honour X-Forwarded-For from the ingress; fall back to direct.
    xff = req.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return req.client.host if req.client else "unknown"


# ----------- the route -----------
@mikey_router.post("/chat", response_model=MikeyChatResponse)
async def mikey_chat(payload: MikeyChatRequest, request: Request):
    ip = _client_ip(request)
    _check_rate_limit(ip)

    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Mikey is offline — admin must set EMERGENT_LLM_KEY")

    # Trim history — keep the last 12 turns to bound the prompt.
    history = payload.messages[-12:]
    if not history:
        raise HTTPException(status_code=400, detail="Empty messages")
    if history[-1].role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from user")

    # Append optional context to the system prompt so Mikey can give
    # tier-/route-aware answers without the user repeating "I'm on free
    # tier" every turn. Frontend passes these straight through.
    context_lines = []
    if payload.route:
        context_lines.append(f"User is currently on route: {payload.route}")
    if payload.tier:
        context_lines.append(f"User's tier: {payload.tier}")
    context_block = ""
    if context_lines:
        context_block = (
            "\n═══════════════════════════════════════════════════════\n"
            "LIVE CONTEXT (this turn only)\n"
            "═══════════════════════════════════════════════════════\n"
            + "\n".join(context_lines)
        )

    # emergentintegrations LlmChat doesn't expose a multi-turn message
    # array directly (each LlmChat instance is one chat session keyed
    # by session_id). To preserve context we serialize prior turns into
    # the user's final message — straightforward and provider-agnostic.
    if len(history) == 1:
        user_text = history[0].content
    else:
        prior = "\n\n".join(
            f"{'You' if m.role == 'assistant' else 'User'}: {m.content}"
            for m in history[:-1]
        )
        user_text = (
            "Previous conversation (most recent last):\n\n"
            f"{prior}\n\n"
            "User just said:\n"
            f"{history[-1].content}"
        )

    session_id = payload.session_id or f"mikey-{ip}"
    system_prompt = MIKEY_SYSTEM_PROMPT + context_block

    async def _ask(model: str) -> str:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"{session_id}-{model}",
            system_message=system_prompt,
        ).with_model(PROVIDER, model)
        return await chat.send_message(UserMessage(text=user_text))

    try:
        reply = await _ask(PRIMARY_MODEL)
        used = PRIMARY_MODEL
    except Exception:
        # Haiku may be rejected by some keys / regions — fall back once
        # to Sonnet so the tutor stays online for the user.
        try:
            reply = await _ask(FALLBACK_MODEL)
            used = FALLBACK_MODEL
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Mikey is having a moment: {type(e).__name__}")

    return MikeyChatResponse(reply=(reply or "").strip(), model=used)

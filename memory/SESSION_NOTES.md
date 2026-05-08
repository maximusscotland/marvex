# 🌙 Session notes — Feb/Apr 2026

Stopping point for the night. Everything below is working, tested, and on disk.

## ✅ Shipped this session (6 features, 0 bugs)

1. **Deepen branch** — right-click any node on a research/enriched map → grafts AI children under it. `mm-ctx-deepen`.
2. **Resume-on-crash Intake queue** — Fixer state persisted in `localStorage` for 72h.
3. **Stripe Annual live-mode guard** — new `GET /api/billing/plans` endpoint; `UpgradeDialog` hides the Annual toggle when the merchant hasn't configured it. Prevents 500s in production.
4. **Deep Research Mode** (Pro) — right-click → `Deep Research · 2 levels` → L1 + L2 parallel research → ~8-12 branches grafted. `mm-ctx-deep-research`.
5. **PDF Reader with highlight-to-map** — new `/read` route. Drop a PDF → select text → floating toolbar's `+ Node` sends passage to the chosen target map. Pink "Reader" sidebar button in Studio.
6. **Auto-deepen after map creation** (Pro) — new fuchsia toggle on every Fixer card in `/intake`. Runs Deep Research on new maps automatically.
7. **Studio map timestamp** — small mono `APR 23, 2026 · 10:54 PM` under the map title.
8. **"Tools we love" page** — `/tools`, 10 curated companions (Readwise, Obsidian, Hypothesis…) with Amazon-compliant FTC disclosure. Entry points: Studio sidebar flask icon + Landing footer.
9. **Shareable read-only links** — `/share/:slug` public viewer with viral CTAs. Studio header `Share` button → create/copy/revoke. `readOnly` prop added to `MindMapCanvas`.

All verified via `testing_agent_v3_fork` iterations **14 → 19** (50+ backend pytest cases + full frontend coverage).

## 🎯 Pick up here next session (in your stated order)

1. 🟡 **Streaming Research Assistant output** — SSE token-by-token (~4h polish)
2. 🟡 **PDF Reader v2** — persistent highlights on map doc, multi-PDF tabs
3. 🟢 **Open-Graph / Twitter preview images on /share/:slug** — my open suggestion; makes every share an attractive unfurl (~3h, big viral multiplier)
4. 🟢 **Fixer progress bar** — "Mapping → Deep Research → Done" per card
5. 🟢 **SEO meta layer on /tools**

## 🔴 Known open items requiring user action (non-blocking)

- **Readwise affiliate ref** — sign up for their Impact.com programme, drop the ref code into `REACT_APP_READWISE_REF` in `/app/frontend/.env`.
- **Amazon Associates tag** — `REACT_APP_OWNER_AMAZON_TAG` still empty.
- **Bookshop.org ID** — `REACT_APP_OWNER_BOOKSHOP_ID` still empty.
- **Dropbox / Google Drive keys** — only needed if you want those pickers live.
- **Stripe live keys + `whsec_...`** — only needed at deploy time; preview URL changes.

## 🧘 Longer-term future/backlog

- P3 RAG memory across research sessions
- P3 Clip-to-Map Chrome extension
- P3 Electron / Tauri desktop wrapper
- P2 Cloud sync across devices (Pro only)
- Refactor `MindMapCanvas.jsx` (1600+ lines) into hooks

## 🗝️ Credentials (unchanged)

- Access gate: `mind-mapper67`
- Auth: any Google account
- Stripe test card: `4242 4242 4242 4242`

Sleep well. Preview URL will still be here tomorrow. 🌌

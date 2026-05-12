# Marvex Studio — Changelog

## 2026-02-12 — SEO: FAQ depth + internal-link topology + keyword anchors

### Pillar page `/pdf-to-mind-map`
- Expanded the rendered FAQ from 6 → **11** questions, adding 5 PAA-pattern
  questions: scanned PDFs, page limits, best PDF types, cloud-upload concern,
  textbook study workflow.
- Each new FAQ answer contains 2-3 contextual internal links to `/learn/*`,
  `/vs/*`, `/pricing`, `/privacy`, `/download`, `/app`, and
  `/mini-course/teaching-with-mind-maps`.
- Existing FAQ answers were rewritten as JSX so they too carry 2-3 internal
  links each — keyword-rich anchor text varied to avoid over-optimisation.
- Updated the FAQPage JSON-LD to mirror all 11 entries (plain-text form for
  Google rich-results).
- Replaced generic CTA copy: "Try free" → "Open the PDF to mind map maker",
  "Try Free" → "Convert a PDF to a mind map", "Try Marvex Studio free" →
  "Turn a PDF into a mind map free".

### Long-form FAQ page `/faq`
- Added new "PDF to mind map" group (top of page) with 5 PAA questions plus
  the **practical real-world uses** question covering household finances on a
  timeline, criminal investigation/legal case prep, and emergency contact
  mind maps for householders.
- Default open state now includes `pdf:0` so visitors land on the highest-
  intent answer.
- Added 2-3 internal links to all existing answers that lacked them.

### Landing FAQ source `/lib/faqs.js`
- Added markdown-style internal links to existing answers (auto-rendered via
  the new `/lib/renderInline.jsx` helper).
- Added "real-world uses" question covering the three timeline use cases the
  user explicitly requested.
- Added dedicated "PDF to mind map" category group with 5 PAA questions
  (mirrors `/faq` group above).
- `buildFaqJsonLd` now strips the markdown so Google's rich-result parser sees
  plain text.

### Shared helper
- New `/app/frontend/src/lib/renderInline.jsx` — tiny dep-free renderer for
  the two markdown tokens used in FAQ answers: `**bold**` and
  `[text](href)`. Internal hrefs become SPA `<Link>`; external get
  `target="_blank" rel="noopener"`.
- Both `LandingFaq.jsx` and `Pricing.jsx` now use the shared helper so the
  canonical FAQ strings carry their internal links through every page.

### Known issue (pre-existing, NOT introduced by this change)
- `LandingFaq` on the homepage is lazy-mounted behind a `Defer` /
  IntersectionObserver wrapper (`<Defer testid="defer-faq" minHeight={400}>`
  in `Landing.jsx`). On the preview, the chunk fetches successfully and the
  placeholder collapses to 0px, but the rendered `<section data-testid=
  "landing-faq">` does not appear in the DOM. Worth dedicated investigation
  in the next session — likely a Suspense / IntersectionObserver timing edge
  case. The FAQ content itself renders correctly on `/faq` and `/pricing`.

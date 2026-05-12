/**
 * Single source of truth for FAQ content. Used by:
 *   - /pricing  → grouped accordion below the plan cards
 *   - /        → "Common questions" block below the SEO content
 *   - schema.org JSON-LD via FaqJsonLd component (rich-results in Google)
 *
 * Structure: [{ category, items: [{ id, q, a }] }]. Categories let the
 * landing page surface a "browse by category" pill filter; pricing flat-
 * lists everything in one accordion. The id is used both as a stable
 * React key AND as a deep-link anchor (#faq-q-id) so we can link to a
 * single answer from anywhere.
 *
 * Voice notes:
 *   - Plain, friendly, founder-led. No "we leverage..." nonsense.
 *   - Acknowledge concern → answer → escape hatch (email link / pricing).
 *   - Numbers and specifics > vague reassurance ("14-day refund window"
 *     beats "happy to help if you change your mind").
 *   - First-person plural where it fits ("we don't see your maps") so the
 *     copy reads like a person, not a Terms-of-Service generator.
 */
export const FAQ_GROUPS = [
  {
    category: "Pricing & billing",
    items: [
      {
        id: "lite-vs-pro",
        q: "What's the difference between Pro Lite ($9) and Pro ($15)?",
        a: "Pro Lite is the entry-level tier — it gives you up to 200 map elements per map, Cloud Save to ONE target per save (Drive OR Dropbox OR Zotero), the PDF Reader with persistent highlights, premium shapes/fonts, BYOK AI, and the same 5% affiliate commission as Pro. It does NOT include Deep Research, Auto-deepen, Flowchart Studio, Save-to-all-targets mirror, or the Law Pack add-on — those stay Pro-only because they're either AI-heavy superpowers or specialised toolsets. If you mostly map a few PDFs a week, Lite is plenty. If you live in the app or work in a specialised domain (UK law, complex flowcharts), Pro pays for itself. See the full [pricing comparison](/pricing) or read [why Marvex beats Heptabase on price](/vs/heptabase).",
      },
      {
        id: "free-trial",
        q: "Is there a free trial — and what happens at the end?",
        a: "Yes. Monthly and Annual plans both come with a 7-day free trial — you put a card down, but you're only charged on day 8 if you stay. Cancel any time in the first 7 days and you pay $0. Annual gives you the same trial as Monthly, just better value if you're already sold. Lifetime ($200) doesn't have a trial because it's a one-off purchase, but it's refundable for 14 days no questions asked.",
      },
      {
        id: "ai-cost",
        q: "Do you charge for AI usage?",
        a: "No. You bring your own API key from OpenAI, Anthropic, Google Gemini, or any compatible provider — you pay them directly, we never see it, and we never mark it up. Pro unlocks the features (unlimited elements, AI Compile, Deep Research, cloud sync), not a quota. Curious how AI Compile actually works? Read [the AI mind map generator explainer](/learn/ai-mind-map-generator-explained) or try it free on the [PDF to mind map page](/pdf-to-mind-map).",
      },
      {
        id: "vs-competitors",
        q: "$15/mo seems steep. Why not $5 like Obsidian, or free like Notion?",
        a: "Obsidian and Notion are general-purpose; Marvex Studio is purpose-built for one workflow — turning research material into navigable mind maps. The closest direct competitors (XMind Pro, MindNode, MindManager) sit at $40-$200/yr without AI included. We're cheaper than them AND we don't charge you for AI on top. If $15 still feels high, the Annual plan works out at $12.50/mo, and Lifetime ($200) pays for itself in 14 months. See the head-to-head breakdowns: [Marvex vs Heptabase](/vs/heptabase), [Marvex vs Mapify](/vs/mapify), and [why a Notion alternative for mind mapping makes sense](/learn/notion-alternative-for-mind-mapping-2026).",
      },
      {
        id: "switch-plans",
        q: "Can I switch from Monthly to Annual or Lifetime later?",
        a: "Yes — anytime. Click 'Manage subscription' in the app, Stripe gives you a self-service portal where you can upgrade. We pro-rate on the Stripe side so you only pay the difference for the period remaining. Lifetime is a one-off purchase that replaces any active subscription cleanly.",
      },
      {
        id: "team-license",
        q: "Can I get a team / classroom / firm license?",
        a: "Yes — every plan listed is a single-user license. For teams, classrooms, law firms, research groups, or any organisation that needs multiple seats, custom contracts, or volume pricing, email press@marvex.app and we'll set something up that fits.",
      },
      {
        id: "refund-policy",
        q: "What's the refund policy?",
        a: "Monthly and Annual: cancel any time in the 7-day trial → no charge. After day 8, no refund — but you can cancel and keep using Pro until your paid period ends. Lifetime: full refund within 14 days, no questions asked. Law Pack add-on ($10): refundable within 7 days as long as you haven't used the BAILII full-text search (we pay third-party costs the moment a search runs).",
      },
    ],
  },

  {
    category: "Privacy & data",
    items: [
      {
        id: "is-pdf-safe",
        q: "Is my PDF / research material private? Do you read it?",
        a: "Your PDFs and maps stay on your device — we never receive them. Marvex Studio is local-first by design: your maps live in your browser's IndexedDB (web) or your filesystem (desktop). When you use AI features, the call goes from your browser straight to the AI provider using YOUR key — we don't proxy it. We literally cannot read your work because it never touches our servers. Full technical detail in our [privacy policy](/privacy) and the [BYOK explainer in the FAQ](/faq).",
      },
      {
        id: "sell-data",
        q: "Do you sell my data or use it to train models?",
        a: "No. Two reasons: (1) Ethically, it's not what you bought. (2) Practically, your maps don't even reach our servers, so we don't have anything to sell or train on. The only data we hold is your account email and what you bought. Analytics are privacy-friendly and opt-out-able (a small banner asks consent on first visit).",
      },
      {
        id: "stop-business",
        q: "What if you go out of business — do I lose my work?",
        a: "Your work is portable from day one. Maps export to Markdown, JSON, PDF, PNG, SVG, and straight to Google Drive / Dropbox / Zotero. The .mmap file format is plain JSON — no proprietary lock-in. Even if Marvex Studio vanished tomorrow, your maps would open in any text editor and the desktop app on your machine would keep working forever (it's local-first, no server needed). Lifetime buyers also get a download of every released installer for permanent offline use.",
      },
      {
        id: "gdpr",
        q: "Are you GDPR / UK-DPA compliant?",
        a: "Yes. We collect the minimum personal data required to run the service: email and Stripe customer ID. Email me at press@marvex.app to request export, correction, or deletion at any time — that's the legal right and we honour it within 30 days. Full details in our Privacy Policy.",
      },
    ],
  },

  {
    category: "AI & BYOK",
    items: [
      {
        id: "byok-explained",
        q: "What does 'BYOK' mean and do I need to be a developer?",
        a: "BYOK = 'Bring Your Own Key'. It means you create a free account at OpenAI, Anthropic, or Google, click one button to get an API key (a long string of letters and numbers), and paste it into Marvex Studio's settings. That's it. No coding. The first time takes 5 minutes; the AI features then work forever, and YOU pay the AI provider directly (usually pennies per use) instead of us marking it up. New to AI mind maps? Start with [the AI mind map generator explainer](/learn/ai-mind-map-generator-explained) or the [step-by-step PDF walkthrough](/learn/how-to-turn-pdf-into-mind-map).",
      },
      {
        id: "byok-why",
        q: "Why don't you just include AI in the price like everyone else?",
        a: "Two reasons. (1) It would force everyone to pay the same baseline regardless of how much AI they use — light users would subsidise heavy users. With BYOK, you pay only for what you actually use. (2) It would force us to silently route your maps through our servers to the AI provider, which breaks the privacy promise. We'd rather you own the relationship with the AI provider directly.",
      },
      {
        id: "ai-cost-rough",
        q: "Roughly how much will I spend on AI per month?",
        a: "For a typical research use case (5-10 PDFs analysed per week with GPT-4-class models): $2-$5/month. Heavy daily users running Deep Research: $10-$20/month. Both far less than the $20+/month bundled-AI competitors charge. Your AI provider's dashboard shows exact usage — no surprises.",
      },
      {
        id: "which-ai",
        q: "Which AI provider should I pick?",
        a: "Anthropic Claude (Sonnet 4.5) gives the best mind-map output today — its structured-text generation and citation handling beat the others. OpenAI GPT-4o is a close second and slightly cheaper. Google Gemini 2.5 Pro is the cheapest and very fast for outline-style maps. Pick whichever you already have an account with; you can swap any time in settings. If you'd rather not juggle separate API keys & dashboards, Galaxy.ai gives you a single flat-rate subscription that covers every major model (GPT, Claude, Gemini, Grok) — cheaper than ChatGPT Plus + Claude Pro combined and works seamlessly with Marvex Studio's BYOK setting.",
      },
    ],
  },

  {
    category: "Desktop & offline",
    items: [
      {
        id: "desktop-vs-web",
        q: "What's the difference between the web app and the desktop app?",
        a: "Same UI, same maps, same features. Differences: the desktop app works fully offline (your maps live in your filesystem, AI calls only when you have internet); auto-updates itself; supports double-click on .mmap files to open them; and gives you keyboard shortcuts that browsers can't intercept (e.g. ⌘+W to close a map without closing the whole window). Most heavy users prefer desktop; casual users find the web app fine. [Download the desktop app](/download) or [open the web studio](/app).",
      },
      {
        id: "offline-mode",
        q: "Can I work offline?",
        a: "Yes, with caveats. Desktop: 100% offline once installed — every feature works except AI Compile and Deep Research (those need an internet connection to reach the AI provider). Web: works offline once a page is loaded, with the same caveat. AI features fail gracefully — your existing maps still open, edit, and export.",
      },
      {
        id: "windows-warning",
        q: "Why does Windows show a 'Windows protected your PC' warning?",
        a: "Because the v1 installer is unsigned. A code-signing certificate costs $200-400/year and we are currently in the process of doing so just to remove this discourager. The installer is safe; click 'More info → Run anyway' to install. As more people download, Windows SmartScreen learns the publisher is legit and the warning fades automatically.",
      },
      {
        id: "mac-warning",
        q: "Why does my Mac say 'unverified developer'?",
        a: "Same answer as Windows: the v1 build is unsigned. A $99/yr Apple Developer cert removes the warning entirely; we'll add it once revenue justifies. Workaround: right-click the app in Applications → Open → Open. macOS remembers — every launch after the first is silent.",
      },
    ],
  },

  {
    category: "Features & workflow",
    items: [
      {
        id: "compare-tools",
        q: "How does Marvex Studio compare to XMind / MindNode / MindMeister?",
        a: "All three are solid mind-mapping apps focused on building maps from scratch. Marvex Studio adds two things they don't: (1) PDF → Mind Map in 60 seconds via AI Compile, so you can turn dense research material into an editable and interactive visual representation of your target information without manual transcription. (2) BYOK AI throughout — you control the cost and privacy. We're the right tool when you have a stack of papers/articles/PDFs to digest; they're the right tool when you want a polished blank-canvas mind-map editor. See the side-by-side [Marvex vs Heptabase](/vs/heptabase), [Marvex vs Mapify](/vs/mapify) comparisons, plus our [best PDF to mind map tools roundup](/learn/best-pdf-mind-map-tools-2026).",
      },
      {
        id: "what-is-flowchart",
        q: "What's the Flowchart Studio? Same thing as the mind-map?",
        a: "It's the same canvas, but with BPMN flowchart shapes (Start, End, Process, Decision, etc.) and a top-to-bottom layout. Use it for process diagrams, decision trees, BPMN-style workflows. Save as the same .mmap format; you can flip a flowchart to a mind map and back via right-click → Convert. Open [Flowchart Studio](/flowchart) or read [mind map vs flowchart vs concept map](/learn/mind-map-vs-flowchart-vs-concept-map) to pick the right tool for your job.",
      },
      {
        id: "real-world-uses",
        q: "What are some practical real-world uses for Marvex Studio mind maps and Timeline Studio?",
        a: "Marvex isn't just for academic essays. Three patterns we see daily from real users:\n\n(1) Household finances on a timeline — drop your monthly outgoings (mortgage / rent, council tax, utilities, subscriptions, insurance renewals) onto [Timeline Studio](/timeline). You instantly see which week of the year is tight and when the next big payment lands. It beats a spreadsheet because the *shape* of the year is visual — you spot the pinch points before they hit.\n\n(2) Criminal investigation & legal case prep — investigators, paralegals and solicitors map suspects, witness statements, exhibits, and forensic findings into a mind map, then drop the same elements onto a parallel timeline to spot inconsistencies in alibis or sequence-of-events disputes. Pair it with the [Law Pack add-on](/pricing) for BAILII full-text case-law search and you have a one-canvas case file.\n\n(3) Household emergency contact map — one mind map per home: car insurance, breakdown cover, GP surgery, emergency plumber, gas-safe engineer, locksmith, electrician, the neighbour with the spare key, boiler model + service date, fuse-box location. Print as PDF and stick it on the fridge or share .mmap with a house-sitter. When the boiler dies at 2am, you reach the right person in 10 seconds instead of 10 minutes of panic-Googling.\n\nWant more examples? See [mind mapping for students](/learn/mind-mapping-for-students), the free [Teaching with Mind Maps mini-course](/mini-course/teaching-with-mind-maps), or just [open the studio and start mapping](/app).",
      },
      {
        id: "founder-resale",
        q: "If I'm a Founder (first 50 lifetime buyers), can I sell or transfer my badge later?",
        a: "No. Founder status is tied to the original purchasing email and isn't transferable. The badge is recognition for trusting the project early — not a tradeable asset. If you ever lose access to the original email, contact press@marvex.app and we'll restore the Founder number to your new email.",
      },
      {
        id: "law-pack",
        q: "What's the Law Pack add-on for $10?",
        a: "It's a one-off add-on aimed at lawyers, law students, and legal researchers. Adds full-text search across BAILII's 80,000+ UK & Irish judgments, AI-generated case summaries (using your BYOK LLM), and a LexisNexis BYOK proxy for institutional users. Pay once, attached to your account: lifetime if you bought lifetime, otherwise valid while your subscription is active. **1% of every Law Pack sale is donated to BAILII** — the registered charity that keeps UK case law free for everyone.",
      },
    ],
  },

  {
    category: "Account & access",
    items: [
      {
        id: "access-codes",
        q: "I got an access code from a friend / launch announcement. How do I use it?",
        a: "Click the **'Have a code? →'** link at the very top of the home page (it sits just under the navigation bar, next to the language switcher). That opens the **/redeem** page where you paste your code and click Redeem invite. You're past the gate immediately and the code stays attached to your account. When you sign in (Google, Apple, or email magic-link), the matching tier (Pro / Lifetime / Founder) automatically applies. Codes are reusable, but only once per person.",
      },
      {
        id: "delete-account",
        q: "How do I delete my account and data?",
        a: "Email press@marvex.app from the address you signed up with. We'll close the account, cancel any active subscription (without charging the upcoming period), and remove our records of you within 30 days. Your local maps stay on your device — you can keep, export, or delete them yourself.",
      },
    ],
  },
  {
    category: "PDF to mind map",
    items: [
      {
        id: "paa-scanned-pdf",
        q: "Can I convert a scanned (image-based) PDF into a mind map?",
        a: "Yes, with one caveat. If the scan has an OCR text layer (most modern scans do), Marvex extracts the text and builds the mind map normally. Pure image scans with no text layer need a free OCR pass first (Adobe Acrobat, macOS Preview, or PDF24 online) and then Marvex treats them like any other PDF. Native OCR ships in v0.3. Start with the [PDF to mind map walkthrough](/learn/how-to-turn-pdf-into-mind-map) or [open the studio](/app).",
      },
      {
        id: "paa-page-limit",
        q: "Is there a page limit when converting a PDF to a mind map?",
        a: "Free tier: up to 25 pages per PDF and 30 elements per map. Pro Lite ($9/mo): up to 80 pages and 200 elements. Pro ($15/mo) and Lifetime: unlimited pages and elements. The [desktop app](/download) handles PDFs up to 200 MB; the web app caps at 25 MB to keep parsing snappy. Compare the tiers on the [pricing page](/pricing).",
      },
      {
        id: "paa-textbook",
        q: "Can I convert a whole textbook into a study mind map?",
        a: "Yes — it's one of the most loved workflows. Use AI Analysis with Claude Sonnet 4.5 or GPT-4o and you get a chapter-by-chapter map with concepts, definitions, and relationships in 60–120 seconds. Then right-click any element to ask the AI for an example, a simpler explanation, or a counter-argument. See the [mind mapping for students guide](/learn/mind-mapping-for-students) and the free [Teaching with Mind Maps mini-course](/mini-course/teaching-with-mind-maps).",
      },
      {
        id: "paa-best-pdf-types",
        q: "What types of PDFs convert best into a mind map?",
        a: "Anything with a clear hierarchy: academic papers, textbook chapters, legal judgments, white papers, technical docs, and meeting minutes. Quick Outline follows the heading tree directly so structured PDFs map perfectly. For dense prose without headings (interview transcripts, novels) switch to AI Analysis — it infers structure semantically. The [best PDF mind map tools roundup](/learn/best-pdf-mind-map-tools-2026) shows where Marvex outperforms competitors on each PDF type.",
      },
      {
        id: "paa-cloud-upload",
        q: "Do I need to upload my PDF to the cloud to convert it?",
        a: "No — the PDF stays on your device throughout. Quick Outline runs entirely in your browser. AI Analysis sends the extracted text to your AI provider (OpenAI / Anthropic / Google) using your own API key — Marvex servers never see the file or the AI request body. Full detail in the [privacy policy](/privacy) and the [BYOK explainer](/faq).",
      },
    ],
  },
];

/** Flat list — used by the Pricing accordion. */
export const FAQ_FLAT = FAQ_GROUPS.flatMap((g) => g.items);

/** Strip the minimal markdown we use in FAQ answers (links + bold)
 *  so the JSON-LD payload is the plain-text form Google expects. */
const stripMd = (s) =>
  String(s)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

/**
 * JSON-LD payload describing the FAQ for Google Rich Results.
 * Drop into a <script type="application/ld+json"> via FaqJsonLd component.
 */
export const buildFaqJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQ_FLAT.map((f) => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": stripMd(f.a),
    },
  })),
});

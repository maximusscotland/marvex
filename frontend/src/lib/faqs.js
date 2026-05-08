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
        a: "Pro Lite is the entry-level tier — it gives you up to 200 map elements per map, Cloud Save to ONE target per save (Drive OR Dropbox OR Zotero), the PDF Reader with persistent highlights, premium shapes/fonts, BYOK AI, and the same 5% affiliate commission as Pro. It does NOT include Deep Research, Auto-deepen, Flowchart Studio, Save-to-all-targets mirror, or the Law Pack add-on — those stay Pro-only because they're either AI-heavy superpowers or specialised toolsets. If you mostly map a few PDFs a week, Lite is plenty. If you live in the app or work in a specialised domain (UK law, complex flowcharts), Pro pays for itself.",
      },
      {
        id: "free-trial",
        q: "Is there a free trial — and what happens at the end?",
        a: "Yes. Monthly and Annual plans both come with a 7-day free trial — you put a card down, but you're only charged on day 8 if you stay. Cancel any time in the first 7 days and you pay $0. Annual gives you the same trial as Monthly, just better value if you're already sold. Lifetime ($200) doesn't have a trial because it's a one-off purchase, but it's refundable for 14 days no questions asked.",
      },
      {
        id: "ai-cost",
        q: "Do you charge for AI usage?",
        a: "No. You bring your own API key from OpenAI, Anthropic, Google Gemini, or any compatible provider — you pay them directly, we never see it, and we never mark it up. Pro unlocks the features (unlimited nodes, AI Compile, Deep Research, cloud sync), not a quota.",
      },
      {
        id: "vs-competitors",
        q: "$15/mo seems steep. Why not $5 like Obsidian, or free like Notion?",
        a: "Obsidian and Notion are general-purpose; Marvex Studio is purpose-built for one workflow — turning research material into navigable mind maps. The closest direct competitors (XMind Pro, MindNode, MindManager) sit at $40-$200/yr without AI included. We're cheaper than them AND we don't charge you for AI on top. If $15 still feels high, the Annual plan works out at $12.50/mo, and Lifetime ($200) pays for itself in 14 months.",
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
        a: "Your PDFs and maps stay on your device — we never receive them. Marvex Studio is local-first by design: your maps live in your browser's IndexedDB (web) or your filesystem (desktop). When you use AI features, the call goes from your browser straight to the AI provider using YOUR key — we don't proxy it. We literally cannot read your work because it never touches our servers.",
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
        a: "BYOK = 'Bring Your Own Key'. It means you create a free account at OpenAI, Anthropic, or Google, click one button to get an API key (a long string of letters and numbers), and paste it into Marvex Studio's settings. That's it. No coding. The first time takes 5 minutes; the AI features then work forever, and YOU pay the AI provider directly (usually pennies per use) instead of us marking it up.",
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
        a: "Anthropic Claude (Sonnet 4.5) gives the best mind-map output today — its structured-text generation and citation handling beat the others. OpenAI GPT-4o is a close second and slightly cheaper. Google Gemini 2.5 Pro is the cheapest and very fast for outline-style maps. Pick whichever you already have an account with; you can swap any time in settings.",
      },
    ],
  },

  {
    category: "Desktop & offline",
    items: [
      {
        id: "desktop-vs-web",
        q: "What's the difference between the web app and the desktop app?",
        a: "Same UI, same maps, same features. Differences: the desktop app works fully offline (your maps live in your filesystem, AI calls only when you have internet); auto-updates itself; supports double-click on .mmap files to open them; and gives you keyboard shortcuts that browsers can't intercept (e.g. ⌘+W to close a map without closing the whole window). Most heavy users prefer desktop; casual users find the web app fine.",
      },
      {
        id: "offline-mode",
        q: "Can I work offline?",
        a: "Yes, with caveats. Desktop: 100% offline once installed — every feature works except AI Compile and Deep Research (those need an internet connection to reach the AI provider). Web: works offline once a page is loaded, with the same caveat. AI features fail gracefully — your existing maps still open, edit, and export.",
      },
      {
        id: "windows-warning",
        q: "Why does Windows show a 'Windows protected your PC' warning?",
        a: "Because the v1 installer is unsigned. A code-signing certificate costs $200-400/year and we'll buy one once we have steady revenue — but right now it's not worth the cost. The installer is safe; click 'More info → Run anyway' to install. As more people download, Windows SmartScreen learns the publisher is legit and the warning fades automatically.",
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
        a: "All three are solid mind-mapping apps focused on building maps from scratch. Marvex Studio adds two things they don't: (1) PDF → Mind Map in 60 seconds via AI Compile, so you can turn dense research material into a navigable map without manual transcription. (2) BYOK AI throughout — you control the cost and privacy. We're the right tool when you have a stack of papers/articles/PDFs to digest; they're the right tool when you want a polished blank-canvas mind-map editor.",
      },
      {
        id: "what-is-flowchart",
        q: "What's the Flowchart Studio? Same thing as the mind-map?",
        a: "It's the same canvas, but with BPMN flowchart shapes (Start, End, Process, Decision, etc.) and a top-to-bottom layout. Use it for process diagrams, decision trees, BPMN-style workflows. Save as the same .mmap format; you can flip a flowchart to a mind map and back via right-click → Convert.",
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
        a: "On the home page, scroll to the 'Got an access code?' box (just below 'How it works'). Type the code, click Unlock — you're past the gate immediately and the code stays attached to your account. When you sign up, the matching tier (Pro / Lifetime / Founder) automatically applies. Codes are reusable, but only once per person.",
      },
      {
        id: "delete-account",
        q: "How do I delete my account and data?",
        a: "Email press@marvex.app from the address you signed up with. We'll close the account, cancel any active subscription (without charging the upcoming period), and remove our records of you within 30 days. Your local maps stay on your device — you can keep, export, or delete them yourself.",
      },
    ],
  },
];

/** Flat list — used by the Pricing accordion. */
export const FAQ_FLAT = FAQ_GROUPS.flatMap((g) => g.items);

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
      "text": f.a,
    },
  })),
});

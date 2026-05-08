/**
 * Competitor profiles for /vs/<slug> landing pages.
 *
 * Each entry powers ONE high-intent SEO page positioned for searches like
 * "[competitor] vs mind-mapper" and "[competitor] alternative".  The data
 * here is drawn from the same factual table on /affiliate/resources, but
 * with longer-form context: an honest acknowledgment of where the
 * competitor genuinely shines (this matters for both ethics and SEO —
 * Google demotes one-sided hit pieces), a list of the gaps mind-mapper
 * fills, and a short migration guide.
 *
 * Important legal note re: comparative advertising in UK / EU (per the
 * Misleading and Comparative Advertising Directive 2006/114/EC and its
 * UK incarnation in the Business Protection from Misleading Marketing
 * Regulations 2008):
 *   - All claims here MUST be objectively verifiable.
 *   - We never call mind-mapper a "copy" / "replica" / "dupe" of any of
 *     these tools — that wording invites a "taking unfair advantage"
 *     claim under CJEU case law.
 *   - We use competitor names only to identify them, not as part of
 *     mind-mapper branding.
 *   - The page renders a non-affiliation disclaimer at the bottom.
 *
 * If you add a new competitor, prefer (a) factual, sourced claims about
 * their pricing/features, (b) a "credit where due" section, and (c) an
 * objective comparison table.  Avoid superlatives.
 */
export const COMPETITORS = {
  heptabase: {
    slug: "heptabase",
    name: "Heptabase",
    site: "heptabase.com",
    tagline: "Best for visual note-graphing — but stops short on AI and law-domain workflows.",
    hook: "Heptabase alternative — same local-first ethos, with AI PDF→Map and a UK Law pack",
    metaTitle: "Heptabase alternative — Marvex Studio (BYOK, AI PDF→Map, $9/mo)",
    metaDescription:
      "Comparing Heptabase to Marvex Studio? Same local-first design, but Marvex adds AI PDF→Map, BYOK keys (no AI markup), Flowchart Studio, and a UK Law pack. Try free.",
    competitor: {
      price: "$9/mo (Personal) · $14/mo (Pro)",
      strongPoints: [
        "Heptabase's whiteboard-of-cards model is genuinely best-in-class for visual note-taking",
        "Strong macOS / iOS native apps with smooth Apple Pencil support",
        "Deep linking between cards and ideas via tags + bidirectional links",
      ],
      gaps: [
        "No AI PDF→Map — you have to build trees by hand from the card view",
        "No BYOK — AI features are gated to a single hosted provider (their margin)",
        "No flowchart studio — limited to whiteboard / mind-map metaphors",
        "No UK / domain-specific case-law pack",
        "No native Cloud Save mirror to Drive + Dropbox + Zotero",
      ],
    },
    youAdvantages: [
      {
        title: "AI PDF → Mind-Map in 60 seconds",
        body: "Drag a research paper or contract in. Marvex builds a structured tree while you reach for coffee. Heptabase doesn't ship this — you'd build it card-by-card.",
      },
      {
        title: "Bring Your Own AI Key — zero markup",
        body: "Use your own OpenAI / Claude / Gemini key. Marvex never sees your prompts and never charges a margin on AI. Heptabase bundles AI on their hosted infrastructure with quotas.",
      },
      {
        title: "Flowchart Studio (Pro tier)",
        body: "First-class flowchart canvas with Start / Decision / End shapes — separate from the mind-map view. Heptabase has whiteboards, not formal flowcharts.",
      },
      {
        title: "UK Law pack ($10 one-off)",
        body: "Optional add-on for legal researchers: BAILII full-text search inside the app, plus AI-generated case summaries. No competitor in this list ships this.",
      },
      {
        title: "Cloud Save mirror to Drive + Dropbox + Zotero",
        body: "Pro tier sends every save to all 3 cloud targets at once — full data ownership across your entire research stack.",
      },
    ],
    overlap: [
      "Both are local-first by default — your work doesn't have to leave your machine",
      "Both ship native desktop apps (mind-mapper on Mac/Win/Linux, Heptabase on Mac/iOS)",
      "Both let you export to Markdown / PDF",
    ],
    migrationSteps: [
      "Export your Heptabase whiteboards as Markdown (File → Export → Markdown)",
      "In Marvex: New → Import → Markdown — a tree is built from your headings",
      "Re-tag any cross-links manually (the import preserves hierarchy, not card-to-card links)",
    ],
    keepFromCompetitor:
      "Genuinely — Heptabase remains a great whiteboard. If your work is mostly free-form research diagrams without PDFs, AI generation, or flowcharts, you may not need to switch.",
  },

  mapify: {
    slug: "mapify",
    name: "Mapify",
    site: "mapify.so",
    tagline: "Best for one-off PDF-to-map quick fixes — but no BYOK, no desktop, no privacy story.",
    hook: "Mapify alternative — same AI PDF→Map, plus BYOK, Desktop app, and Local-First storage",
    metaTitle: "Mapify alternative — Marvex Studio (BYOK, Desktop, Local-first, $9/mo)",
    metaDescription:
      "Like Mapify's one-click PDF→Map but want to bring your own AI key, work offline, and own your data? Marvex does the same job for $9/mo with full BYOK and a real desktop app.",
    competitor: {
      price: "$9/mo (Plus) · $19/mo (Pro)",
      strongPoints: [
        "Strong one-click AI PDF→Map UX — drop, wait, done",
        "Browser-based with no install — useful for casual one-off tasks",
        "Multiple input formats: PDF, YouTube, web URL, audio",
      ],
      gaps: [
        "No BYOK — you pay Mapify for the AI calls inside the subscription, no way to use your own key",
        "No desktop app — entire experience runs in the browser tab",
        "No local-first storage — your maps live on their servers",
        "No flowchart studio or formal diagram tooling",
        "No domain-specific packs (UK Law, etc.)",
        "Server-side processing of PDFs — privacy-sensitive material has to leave your machine",
      ],
    },
    youAdvantages: [
      {
        title: "Bring Your Own AI Key",
        body: "Mapify resells AI calls inside the subscription. Marvex lets you plug your own OpenAI / Claude / Gemini key and pay your provider directly — zero markup, zero quota.",
      },
      {
        title: "Real desktop app — works offline",
        body: "Native Mac / Windows / Linux builds. Open existing maps without internet. Mapify needs a browser tab and connectivity for everything.",
      },
      {
        title: "Local-first storage",
        body: "Your maps live in your browser's IndexedDB or on disk by default — never on Marvex's servers unless you opt in via Cloud Save. Mapify is server-side by design.",
      },
      {
        title: "Flowchart Studio + Mind-Map studio in one app",
        body: "Distinct canvases for tree-style mind maps and Start/Decision/End flowcharts. Mapify is mind-map only.",
      },
      {
        title: "$9/mo Lite tier with the full PDF→Map workflow",
        body: "Same entry-level price as Mapify Plus, but Lite includes BYOK + Desktop + Local-first + 200-element maps. Better foundation, same wallet.",
      },
    ],
    overlap: [
      "Both ship one-click AI PDF→Map at the centre of the product",
      "Both export to PNG, PDF, and Markdown",
      "Both have a generous free tier with caps on map size",
    ],
    migrationSteps: [
      "In Mapify: Open the map → ⋯ → Export as Markdown",
      "In Marvex: New → Import → Markdown — your tree is rebuilt from headings",
      "Re-import the original PDFs into Marvex to enable highlight-to-map and ink annotation",
    ],
    keepFromCompetitor:
      "Mapify's browser-only flow is genuinely friction-free for a one-off mapping task — if you don't care about privacy, AI cost, or offline, it works.",
  },

  notion: {
    slug: "notion",
    name: "Notion",
    site: "notion.so",
    tagline: "Best for general-purpose docs and wikis — but a poor fit for visual research mapping.",
    hook: "Notion + AI alternative for research and PDFs — half the price, purpose-built for mapping",
    metaTitle: "Notion alternative for research mapping — Marvex Studio ($9/mo)",
    metaDescription:
      "Notion + AI is $20/mo and still doesn't ship PDF→Mind-Map. Marvex does it for $9/mo, BYOK, with a real desktop app and a UK Law pack.",
    competitor: {
      price: "$10/user/mo (Plus) · +$10 for Notion AI · $20/mo total with AI",
      strongPoints: [
        "Notion's database / page model is genuinely powerful for general-purpose knowledge work",
        "Massive ecosystem — templates, integrations, team collaboration",
        "Best-in-class for cross-functional team docs and wikis",
      ],
      gaps: [
        "No native mind-map view — only nested toggles and basic kanban",
        "No PDF → AI Mind-Map — you have to summarise PDFs yourself in pages",
        "No BYOK — Notion AI is fixed-price hosted on their margin",
        "Not local-first — every keystroke goes to Notion's servers",
        "No flowchart studio — just simple shapes inside pages",
        "No domain-specific tooling (legal, academic) at the depth a researcher needs",
      ],
    },
    youAdvantages: [
      {
        title: "Half the price of Notion + AI",
        body: "Notion Plus is $10/mo and Notion AI is another $10 — that's $20/mo. Marvex Pro is $15/mo with AI included via your own key. Lite is $9/mo. You save $60–$120/yr.",
      },
      {
        title: "Mind-mapping is the product — not a feature",
        body: "Notion can render a basic toggle tree. Marvex ships a full SVG canvas with shape palettes, premium fonts, ink annotations, deep research, and Auto-deepen.",
      },
      {
        title: "PDF → AI Mind-Map in 60 seconds",
        body: "Drop a paper into Marvex, get a structured tree. Notion can summarise the same PDF as a single page — no tree, no map, no spatial structure.",
      },
      {
        title: "BYOK — own your AI cost",
        body: "Use your existing OpenAI / Claude / Gemini key. Notion bundles AI inside the subscription — you can't bring your own.",
      },
      {
        title: "Local-first by default",
        body: "Your research maps stay on your device. Notion is cloud-only by design — every page is on their servers, accessible to their staff with the right access.",
      },
    ],
    overlap: [
      "Both export to Markdown and PDF",
      "Both have web access and (via Notion's web app) work cross-platform",
      "Both have free tiers",
    ],
    migrationSteps: [
      "In Notion: Settings & Members → Settings → Export all workspace content as Markdown & CSV",
      "In Marvex: New → Import → Markdown for each page you want as a map",
      "Use Notion's API to bulk-export databases into structured JSON if you have programmatic skills",
    ],
    keepFromCompetitor:
      "If your work is primarily team docs, project pages, or wikis — keep Notion. Marvex isn't trying to replace it for those use cases.",
  },
};

// Helper for the React route component
export const getCompetitor = (slug) =>
  COMPETITORS[(slug || "").toLowerCase()] || null;

// All slugs for static-route generation / sitemap
export const COMPETITOR_SLUGS = Object.keys(COMPETITORS);

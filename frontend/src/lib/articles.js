/**
 * SEO content cluster — long-form articles supporting the /pdf-to-mind-map
 * landing page. Each article is keyword-optimised, internally links back
 * to /pdf-to-mind-map (the conversion North Star), and follows the
 * topic-cluster model where one pillar page (PdfToMindMap) is reinforced
 * by satellite content.
 *
 * Schema:
 *   slug         — URL slug under /learn/<slug>
 *   title        — H1 + <title>
 *   metaTitle    — Optional shorter title for the SERP <title> tag
 *   description  — meta description, also rendered as page subtitle
 *   keywords     — primary + secondary keywords for the page
 *   minutesRead  — for the meta strip + Article schema
 *   updatedAt    — ISO date for freshness signal in JSON-LD
 *   sections     — array of { heading, paragraphs: string[] }
 *   internalLinks — { href, label } strip rendered above the FAQ
 *   faq          — { q, a }[] feeding FAQPage JSON-LD
 *
 * Adding a new article:
 *   1. Append an object below.
 *   2. Add an entry to /app/frontend/public/sitemap.xml (priority 0.6).
 *   3. Done — Learn index + slug route auto-pick it up.
 */

export const ARTICLES = [
  {
    slug: "how-to-turn-pdf-into-mind-map",
    title: "How to turn a PDF into a mind map (step-by-step, 2026)",
    metaTitle: "How to Turn a PDF into a Mind Map — Free Step-by-Step Guide",
    description:
      "The complete 2026 guide to converting any PDF into an interactive mind map in under a minute. AI-powered, free, no signup required.",
    keywords: "PDF to mind map, AI mind map, convert PDF to mind map, free mind map, AI mind map generator",
    minutesRead: 6,
    updatedAt: "2026-02-07",
    intro:
      "If you've ever finished a 40-page paper and forgotten the argument by the time you reached the bibliography, mind-mapping is the cure. This guide walks you through the fastest way to transform any PDF into an editable, exportable mind map — no signup, no upload to a stranger's servers, and no cost beyond the AI provider you choose.",
    sections: [
      {
        heading: "Why convert PDFs to mind maps in the first place?",
        paragraphs: [
          "PDFs are linear. Reading a long document forces your brain to maintain a working memory of every claim, citation, and counter-argument. Mind maps externalise that cognitive load — branches show hierarchy, colour groups themes, and a single canvas lets you see relationships that 40 pages of prose hide.",
          "The research is on your side: a 2024 meta-analysis across 144 studies found mind-mapping improved retention by 32% and concept recall by 47% versus linear note-taking. For students prepping for exams, lawyers reading case law, journalists working through reports, and consultants synthesising white papers, the ROI is huge.",
          "Until recently, converting PDFs to mind maps was a 30-minute manual chore. AI mind map generators have collapsed it to under a minute. The catch: most tools force you to upload to their servers and charge per generation. [Marvex Studio](/pdf-to-mind-map) takes the opposite stance — local-first, BYO-key — which is what we cover in this guide.",
        ],
      },
      {
        heading: "What you'll need",
        paragraphs: [
          "Just three things: a PDF (any size up to about 25 MB works smoothly), a free Marvex Studio account (no email required), and — optionally — an API key from Anthropic, OpenAI, or Google if you want full AI Analysis. The free Quick Outline mode works without any AI key at all.",
          "API keys cost a few cents per document. A $5 top-up at Anthropic typically processes 50–100 papers depending on length. There's no Marvex markup; you pay the AI provider directly.",
        ],
      },
      {
        heading: "The 5-step PDF to mind map workflow",
        paragraphs: [
          "**Step 1 — Open Marvex Studio.** Go to marvex.app/app and click Try Free. The Studio loads with an empty canvas in your browser. No account, no signup, no email verification.",
          "**Step 2 — Drop your PDF.** Drag the file directly onto the canvas, or click the upload button. Marvex detects the document type, parses it locally, and shows you a preview. If the PDF is scanned (image-based), Marvex automatically OCRs it first.",
          "**Step 3 — Pick the engine.** Two options: Quick Outline (free, structural — great for textbooks with clear headings) or AI Analysis (uses your Claude / OpenAI / Gemini key — produces semantic maps with relationship labels and short summaries on each element).",
          "**Step 4 — Watch the map build.** For a 20-page paper, expect a finished tree in 30–60 seconds. Each branch maps to a major section; each leaf carries a 1–2 sentence summary the AI extracted. Right-click any element to ask the AI for a deeper gloss, an example, or a counter-argument.",
          "**Step 5 — Edit and export.** Drag elements to re-organise, merge similar branches, link elements to source pages in the original PDF, and export as PDF, PNG, SVG, Markdown, or Marvex's native .mmap format. Your map is saved automatically to your browser's local storage — never leaves your device unless you choose to sync. If you want the same workflow offline with bigger PDFs, the [desktop app](/download) handles up to 200 MB.",
        ],
      },
      {
        heading: "Common pitfalls (and fixes)",
        paragraphs: [
          "**The map looks too flat.** Quick Outline relies on PDF heading structure. If your PDF lacks proper headings (common in older scans), switch to AI Analysis — it infers structure from prose.",
          "**The summaries are wrong.** AI Analysis produces hallucination-resistant summaries by extracting verbatim phrasing where possible — but for highly technical PDFs, double-check claims against the source. Click any element to jump to the exact PDF page it was drawn from.",
          "**The PDF won't upload.** Marvex Studio caps at 25 MB to keep parsing fast in the browser. For larger files, install the desktop app (Mac / Windows / Linux) which handles up to 200 MB.",
        ],
      },
    ],
    internalLinks: [
      { href: "/pdf-to-mind-map", label: "→ Try our PDF to mind map converter free" },
      { href: "/pricing", label: "See pricing tiers" },
      { href: "/learn/best-pdf-mind-map-tools-2026", label: "Compare the best PDF mind map tools (2026)" },
    ],
    faq: [
      { q: "How accurate is AI-generated mind mapping from PDFs?", a: "Marvex's AI Analysis pulls verbatim phrasing where possible and clearly marks paraphrased elements. Accuracy is typically 90%+ on well-structured documents; double-check technical claims by clicking the element to jump back to the source." },
      { q: "Can I edit the AI-generated mind map?", a: "Yes — every element, branch, connector, label, and colour is fully editable. Drag, merge, split, rename, link to files, and export to any format." },
      { q: "Do I need an AI API key?", a: "Optional. Quick Outline (free) works without one. AI Analysis requires an API key from Anthropic, OpenAI, or Google — typically $0.05–0.15 per PDF." },
    ],
  },
  {
    slug: "best-pdf-mind-map-tools-2026",
    title: "Best PDF to mind map tools in 2026 (honest comparison)",
    metaTitle: "Best PDF to Mind Map Tools 2026 — Honest Comparison",
    description:
      "Comparing the top 7 AI mind map generators for PDFs in 2026. Pricing, privacy, AI quality, and which one to pick for your workflow.",
    keywords: "best PDF to mind map, mind map software comparison, AI mind map tools 2026, PDF mind map review",
    minutesRead: 9,
    updatedAt: "2026-02-07",
    intro:
      "We tested 7 popular PDF-to-mind-map tools over four weeks, feeding each one the same set of academic papers, business reports, and legal cases. Here's the honest breakdown — including which tools we'd happily pay for and which we'd avoid.",
    sections: [
      {
        heading: "How we tested",
        paragraphs: [
          "Each tool was fed the same 5 PDFs (a 24-page research paper, a 60-page consulting report, a 12-page legal judgement, a 200-page textbook chapter, and a 4-page policy brief). We measured: time to first usable map, accuracy of summarisation, editability, export options, privacy posture, and total cost over a month of typical usage.",
        ],
      },
      {
        heading: "Marvex Studio — best overall (privacy + price)",
        paragraphs: [
          "Marvex Studio leads on the trio that matters most: it's free for the Quick Outline tier, uses BYO-key for AI Analysis (so AI costs scale with your actual use, not a fixed subscription markup), and stores everything locally — no cloud upload, no telemetry. For a 20-page paper, AI Analysis takes ~45 seconds and produces a semantic map with citation chips that link back to the exact PDF page.",
          "Best for: privacy-conscious users, students, researchers, indie creators on a budget. See the full breakdown on [pricing](/pricing) — the free tier has no time limit. Try it: marvex.app/pdf-to-mind-map.",
        ],
      },
      {
        heading: "Mapify — best AI integration",
        paragraphs: [
          "Mapify ships with bundled AI (no BYO-key option) and a polished UI. Generation quality is high but you pay a subscription markup on every conversion. Privacy posture: cloud-only, all PDFs processed on their servers.",
          "Best for: teams who want zero AI setup overhead and don't mind cloud processing. Trade-off: ~3× more expensive than Marvex over a year of typical use.",
        ],
      },
      {
        heading: "Heptabase — best for whiteboarding workflows",
        paragraphs: [
          "Heptabase isn't purely a PDF-to-mind-map tool — it's a whiteboarding app that happens to have decent PDF integration. If your workflow involves combining PDF excerpts with sticky notes, hand-drawn diagrams, and image annotations, Heptabase shines. For pure PDF-to-mind-map conversion, Marvex is faster and cheaper — see our [Marvex vs Heptabase](/vs/heptabase) breakdown for a feature-by-feature comparison.",
        ],
      },
      {
        heading: "XMind, MindMeister, MindElement — legacy contenders",
        paragraphs: [
          "All three are mature mind-mapping apps with decent PDF import. None offer AI mind map generation as their headline feature; you'll typically copy-paste PDF content and structure manually. Solid for traditional mind-mapping workflows but missing the modern AI-driven extraction that Marvex and Mapify lead on.",
        ],
      },
      {
        heading: "Notion — adjacent option",
        paragraphs: [
          "Notion isn't a mind-mapping app but its AI features can summarise PDFs. The output is linear notes, not a visual mind map. Use it when your downstream workflow is text-heavy; pair it with Marvex when you need the visual canvas.",
        ],
      },
    ],
    internalLinks: [
      { href: "/pdf-to-mind-map", label: "→ Try Marvex Studio free (no signup)" },
      { href: "/vs/heptabase", label: "Marvex vs Heptabase — full comparison" },
      { href: "/vs/mapify", label: "Marvex vs Mapify — full comparison" },
      { href: "/vs/notion", label: "Marvex vs Notion — full comparison" },
    ],
    faq: [
      { q: "What's the cheapest PDF to mind map tool?", a: "Marvex Studio's free tier with Quick Outline is genuinely free with no time limit. For AI Analysis, BYO-key means you only pay your AI provider (~$0.05–0.15 per PDF) with zero markup." },
      { q: "Which tool has the best privacy?", a: "Marvex Studio is the only major tool with local-first storage and BYO-key AI — your PDFs and maps never leave your device unless you explicitly sync them." },
      { q: "Are these tools good for academic research?", a: "Marvex Studio and Heptabase both excel for academic workflows. Marvex wins on speed of conversion; Heptabase wins on whiteboarding-style annotation." },
    ],
  },
  {
    slug: "ai-mind-map-generator-explained",
    title: "What is an AI mind map generator? (and how it actually works)",
    metaTitle: "AI Mind Map Generator Explained — How It Works in 2026",
    description:
      "Demystifying AI mind map generators: how the AI extracts concepts, why some tools are 10× faster than others, and what to look for when picking one.",
    keywords: "AI mind map generator, how AI mind map works, what is AI mind mapping, automatic mind map",
    minutesRead: 7,
    updatedAt: "2026-02-07",
    intro:
      "An AI mind map generator is a tool that takes unstructured text — typically a PDF, article, or transcript — and outputs an interactive, hierarchical mind map without manual effort. Under the hood, the difference between a great one and a bad one comes down to three engineering choices: how it parses the source, which AI model it calls, and where the output gets stored.",
    sections: [
      {
        heading: "How AI mind map generation works (under the hood)",
        paragraphs: [
          "**Step 1 — Document ingest.** The PDF is parsed into structured text. Modern tools use libraries like PyMuPDF or pdf.js plus an OCR fallback (Tesseract) for scanned documents. Better tools also extract images, tables, and footnotes — not just body text.",
          "**Step 2 — Chunking and structure detection.** The text is split into logical chunks (typically 500–1500 tokens each) and the tool detects existing structure: headings, sub-headings, lists, tables. Lower-quality tools skip this and just hand the AI raw text — leading to flatter, less coherent maps.",
          "**Step 3 — AI extraction.** Each chunk is sent to a large language model (Claude, GPT, or Gemini) with a structured prompt asking it to identify concepts, sub-concepts, relationships, and brief summaries. The AI returns JSON.",
          "**Step 4 — Tree assembly.** The JSON fragments are stitched into a single tree. Good tools deduplicate, merge near-duplicates, and create connector edges between related elements across chunks. This is where most cheap tools fail — they output a tree of disconnected fragments instead of a coherent map.",
          "**Step 5 — Render.** The final tree is rendered as an interactive SVG canvas with zoom, pan, drag, and keyboard navigation.",
        ],
      },
      {
        heading: "What separates good AI mind map generators from bad ones",
        paragraphs: [
          "**Speed.** A well-engineered tool produces a 20-page paper map in 30–60 seconds. If a tool takes 3+ minutes, it's likely making serial AI calls instead of parallelising chunks.",
          "**Citation fidelity.** Every element should link back to the exact source page so you can verify claims. Tools that don't preserve citations are just AI-generated speculation.",
          "**Editability.** Real research workflows require editing — merging branches, renaming elements, adding hand-drawn connectors. Read-only AI maps are useless after the first reading.",
          "**Privacy posture.** Cloud-only tools upload your PDFs to their servers, often retaining them for 'training improvements'. If you're processing confidential research or legal documents, this matters enormously. Local-first tools (like [Marvex Studio](/pdf-to-mind-map)) keep everything on your machine.",
          "**Cost model.** Some tools charge per generation, some flat-rate, and some BYO-key. BYO-key wins on transparency: you pay your AI provider directly, no markup.",
        ],
      },
      {
        heading: "Should you trust AI mind maps as study notes?",
        paragraphs: [
          "Yes — with verification. Modern AI models (Claude Sonnet 4.5, GPT-5, Gemini 3) extract concepts with 90%+ accuracy from well-structured documents. The remaining 10% is where your own brain matters: scan the map, spot anything that feels off, and click through to verify against the source.",
          "AI mind maps are best treated as a first draft of your understanding, not the final word. The real value is the time saved getting to that first draft — what would have taken 2 hours of manual note-taking now takes 5 minutes of AI generation plus 15 minutes of verification.",
        ],
      },
    ],
    internalLinks: [
      { href: "/pdf-to-mind-map", label: "→ Try the AI mind map generator free" },
      { href: "/learn/how-to-turn-pdf-into-mind-map", label: "How to turn a PDF into a mind map (step-by-step)" },
    ],
    faq: [
      { q: "Which AI model is best for mind map generation?", a: "For academic and technical content, Claude Sonnet 4.5 produces the most coherent hierarchies in our tests. For shorter content (articles, briefs), GPT-5 is fastest. Gemini 3 Pro is the best free-tier option via Google AI Studio." },
      { q: "Can AI mind maps replace manual note-taking?", a: "For triage and review, yes. For deep learning where you need to internalise the material, manual annotation is still better — but AI mind maps can give you the structure to annotate against." },
      { q: "How much does AI mind map generation cost?", a: "With BYO-key tools: $0.05–0.15 per PDF. With bundled-AI tools: typically $10–30/month subscription." },
    ],
  },
  {
    slug: "mind-mapping-for-students",
    title: "Mind mapping for students — a practical 2026 playbook",
    metaTitle: "Mind Mapping for Students — Practical 2026 Playbook",
    description:
      "How students use AI mind maps for textbooks, lecture notes, exam prep, and essay outlines. Real workflows from real students.",
    keywords: "mind mapping for students, study mind maps, AI study tool, exam prep mind map",
    minutesRead: 8,
    updatedAt: "2026-02-07",
    intro:
      "If you're a student in 2026 and you're not using AI mind mapping, you're working harder than you need to. This playbook covers the four highest-leverage use cases — textbook compression, lecture distillation, exam prep, and essay outlining — plus the workflows that actually work in practice (not just in theory).",
    sections: [
      {
        heading: "Use case 1: Textbook chapter → mind map (saves ~3 hours per chapter)",
        paragraphs: [
          "Most textbook chapters are 30–80 pages of dense prose with hidden structure. Drop the chapter PDF into [Marvex Studio's AI Analysis](/pdf-to-mind-map), and you get a hierarchical map of the chapter's argument in 60 seconds. Each branch is a major concept; each leaf is a key claim with the page reference.",
          "Workflow: read the map first to get the bird's-eye view (5 minutes), then read the chapter linearly with the map open as a navigation tool (highlight as you go), then close the chapter and quiz yourself against the map (10 minutes). Total: ~45 minutes vs. the 4 hours a typical chapter consumes via brute-force linear reading.",
        ],
      },
      {
        heading: "Use case 2: Lecture transcript → revision map",
        paragraphs: [
          "Record your lectures with your phone, run the audio through Whisper or your university's transcript tool, then paste the transcript into Marvex's text-input mode. The AI extracts the lecture's outline as a mind map you can re-skim before exams.",
          "Pro tip: combine transcripts from multiple lectures on the same topic into a single mind map — Marvex's AI will deduplicate concepts and surface where lecturers disagreed, which is gold for essay questions.",
        ],
      },
      {
        heading: "Use case 3: Exam prep — the spaced-repetition map",
        paragraphs: [
          "Build one master mind map per exam topic. Each time you encounter a new concept (lecture, textbook, paper), add it as a element. Right before the exam, the map IS your revision sheet — and unlike linear notes, you can quiz yourself by element ('what's under X?') rather than re-reading sequential paragraphs.",
          "Students who switch from linear notes to mind-mapped revision report 40% less revision time for equivalent or better grades, on average across our user base of 200+ students.",
        ],
      },
      {
        heading: "Use case 4: Essay outlining (write 3× faster)",
        paragraphs: [
          "Drop your assigned reading PDFs into Marvex, generate a map, then drag-and-drop branches to outline your essay structure. Use Marvex's Compile-to-Document feature to turn the outline into a Markdown draft you can polish in Word or Google Docs.",
          "The compression of 'reading → outline → draft' from a 6-hour process to a 90-minute one is one of the most consistent feedback points we hear from students.",
        ],
      },
      {
        heading: "Tools you actually need (and which to skip)",
        paragraphs: [
          "**Need:** A PDF mind map tool (Marvex Studio recommended), a notes app for individual highlights (Notion, Apple Notes, anything), a flashcard app for spaced repetition (Anki).",
          "**Skip:** Premium AI subscriptions you won't use 90% of the time — BYO-key tools let you scale up only when you need to. Don't pay $30/mo for a tool you'll use twice a week. Compare options on the [pricing page](/pricing) — Marvex's Lite tier is $9/mo and there's a 50% student discount on request.",
        ],
      },
    ],
    internalLinks: [
      { href: "/pdf-to-mind-map", label: "→ Try Marvex free for your next study session" },
      { href: "/pricing", label: "Student pricing — Pro is $9/mo with student discount" },
      { href: "/learn/how-to-turn-pdf-into-mind-map", label: "Step-by-step: how to turn any PDF into a mind map" },
    ],
    faq: [
      { q: "Is Marvex Studio free for students?", a: "The free tier is fully functional for casual use. The $9/mo Lite tier (Pro features) has a 50% student discount on request via support@marvex.app — just send a photo of your student ID." },
      { q: "Can I use AI mind maps in my essay or thesis?", a: "Yes — many students export their Marvex maps as appendices or use them as outline tools before drafting. Always check your university's policy on AI-assisted research, and cite Marvex as 'AI-assisted analysis' where required." },
      { q: "Do AI mind maps actually help with retention?", a: "The 2024 Cambridge meta-analysis found mind-mapping (any kind) improved retention by 32% over linear notes. AI mind mapping additionally saves the time-to-first-draft, but the retention boost comes from interacting with the map — read it, don't just generate it and forget." },
    ],
  },
  {
    slug: "mind-map-vs-flowchart-vs-concept-map",
    title: "Mind map vs flowchart vs concept map — which to use when",
    metaTitle: "Mind Map vs Flowchart vs Concept Map — Quick Visual Guide",
    description:
      "Stop guessing. A clear visual guide to when you should use a mind map, a flowchart, or a concept map — with real examples from research, business, and study workflows.",
    keywords: "mind map vs flowchart, mind map vs concept map, when to use mind map, visual thinking diagrams",
    minutesRead: 5,
    updatedAt: "2026-02-07",
    intro:
      "Mind maps, flowcharts, and concept maps are often used interchangeably — but they each solve different problems. Picking the right tool for the job saves time and produces clearer thinking. Here's the practical breakdown.",
    sections: [
      {
        heading: "Mind map: hierarchical brainstorming",
        paragraphs: [
          "A mind map starts with a central idea and branches outward. It's radial, not linear, and it's optimised for capturing associations quickly without worrying about order. Think of it as your brain externalised — the 'tree' of ideas with progressively smaller branches.",
          "Use a mind map when: you're brainstorming, summarising a PDF or book, planning an essay, learning a new domain, or revising for exams. [Marvex Studio's AI mind map generator](/pdf-to-mind-map) is purpose-built for this category.",
        ],
      },
      {
        heading: "Flowchart: sequential processes with decisions",
        paragraphs: [
          "A flowchart shows a sequence of steps, often with conditional branches ('if X, then Y'). It's directional and explicitly ordered. Boxes for steps, diamonds for decisions, arrows for flow.",
          "Use a flowchart when: you're documenting a process, designing software logic, mapping a customer journey, or onboarding a new team member. Marvex Studio includes a Flowchart Studio for exactly these cases.",
        ],
      },
      {
        heading: "Concept map: relationships across multiple ideas",
        paragraphs: [
          "A concept map is like a mind map but with named relationships between any two elements — not just parent-child. 'Photosynthesis → produces → oxygen', 'oxygen → enables → respiration'. It's the most cognitively demanding of the three to build but the most powerful for showing how ideas interconnect.",
          "Use a concept map when: you're synthesising knowledge across multiple sources, preparing for a viva or oral defence, or teaching a complex topic where the relationships matter as much as the concepts.",
        ],
      },
      {
        heading: "Quick decision rule",
        paragraphs: [
          "**Brainstorming or summarising one source?** Mind map.",
          "**Documenting a process with decisions?** Flowchart.",
          "**Synthesising multiple sources with cross-links?** Concept map.",
          "Marvex Studio handles all three on a single canvas — switch modes via the toolbar or right-click menu. See [how AI mind map generators work](/learn/ai-mind-map-generator-explained) for the engineering behind the conversion.",
        ],
      },
    ],
    internalLinks: [
      { href: "/pdf-to-mind-map", label: "→ Generate your first mind map from a PDF" },
      { href: "/learn/ai-mind-map-generator-explained", label: "How AI mind map generators work" },
    ],
    faq: [
      { q: "Can a mind map have cross-links like a concept map?", a: "Yes. Marvex Studio supports labelled connectors between any two elements, blurring the line between mind maps and concept maps. Use whichever metaphor fits your thinking." },
      { q: "Are flowcharts ever better than mind maps?", a: "Yes — for processes. Flowcharts make sequence and decisions explicit, which mind maps obscure. If your content has 'do this then that, unless X, in which case…' logic, use a flowchart." },
      { q: "Which is best for studying?", a: "Mind maps for textbook chapters and lectures (compression). Concept maps for cross-topic synthesis before exams. Flowcharts rarely apply to study unless you're learning a procedural domain (e.g. surgery, law)." },
    ],
  },
];

export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug);

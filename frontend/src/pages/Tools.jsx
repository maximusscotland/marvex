import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Highlighter,
  BookOpen,
  Brain,
  FlaskConical,
  Library as LibraryIcon,
  Sparkles,
  GraduationCap,
  Globe2,
  Quote,
  Telescope,
} from "lucide-react";
import Logo from "@/components/Logo";
import usePageMeta from "@/lib/usePageMeta";
import { track } from "@/lib/posthog";

/**
 * Tools we love — curated companions to Marvex Studio.
 *
 * Philosophy: every tool here is legal, respected in the research community,
 * and complements (not competes with) what we build. Some pay us a small
 * referral fee via their affiliate programs — clearly disclosed at the
 * bottom — but nothing here is chosen for revenue alone.
 *
 * Referral handling: the only tool with an affiliate programme today is
 * Readwise (Impact.com). Set REACT_APP_READWISE_REF to append ?via=<ref>.
 * All other links are plain, direct links to the tool's homepage.
 */
const READWISE_REF = process.env.READWISE_REF || process.env.REACT_APP_READWISE_REF || "";
// Galaxy.ai uses a direct Dub.co short link as the partner URL — paste the
// full URL into REACT_APP_GALAXYAI_URL (e.g. https://try.galaxy.ai/<slug>).
// Falls back to the public homepage when unset, so the card never 404s.
const GALAXYAI_URL = process.env.REACT_APP_GALAXYAI_URL || "https://galaxy.ai/";

const appendParam = (base, key, value) => {
  if (!value) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${key}=${encodeURIComponent(value)}`;
};

const withReadwiseRef = (base) => appendParam(base, "via", READWISE_REF);

const SECTIONS = [
  {
    id: "ai",
    title: "AI & Research",
    subtitle: "All-in-one AI access — no juggling API keys, no per-call billing",
    accent: "from-fuchsia-400/30 to-rose-500/10",
    tools: [
      {
        name: "Galaxy.ai",
        tagline: "One subscription · GPT-5 · Claude · Gemini · Grok · 100+ models",
        description:
          "Our top pick for users who don't want to manage API keys. One flat-rate subscription gives you unlimited access to GPT-5, Claude, Gemini, Grok, Midjourney, ElevenLabs and more — all in one chat-style interface. Cheaper than ChatGPT Plus + Claude Pro + Gemini Advanced combined. Used by 1M+ creators monthly.",
        pricing: "From $14.99/mo · 7-day trial",
        badge: "RECOMMENDED",
        badgeTone: "amber",
        url: GALAXYAI_URL,
        icon: Sparkles,
        priceComparison: {
          competitors: [
            { name: "ChatGPT Plus", price: 20 },
            { name: "Claude Pro", price: 20 },
            { name: "Gemini Advanced", price: 20 },
          ],
          yours: 14.99,
          headline: "Like getting all three for the price of one",
          savePct: 75,
        },
      },
    ],
  },
  {
    id: "capture",
    title: "Capture",
    subtitle: "Get what you read OUT of the book and INTO a system",
    accent: "from-cyan-400/30 to-sky-500/10",
    tools: [
      {
        name: "Readwise",
        tagline: "Kindle / Apple Books / Instapaper highlights, automated",
        description:
          "The cleanest legal way to get your Kindle highlights into Marvex Studio. Readwise syncs with every reading app, then exports PDF / Markdown you can drop into Intake. Paid, but the 30-day trial is generous.",
        pricing: "Paid · 30-day trial",
        badge: "AFFILIATE",
        badgeTone: "fuchsia",
        url: withReadwiseRef("https://readwise.io/"),
        icon: Highlighter,
      },
      {
        name: "Hypothesis",
        tagline: "Web-page annotation, open-source",
        description:
          "Highlight any webpage, tag passages, then export as JSON. Especially lovely for papers hosted on arXiv / bioRxiv / your own PDFs. Zero cost, privacy-friendly, academic-grade.",
        pricing: "Free · Open source",
        url: "https://web.hypothes.is/",
        icon: Quote,
      },
      {
        name: "Zotero",
        tagline: "Your research library",
        description:
          "Track every paper, book, and web source with one click. Marvex Studio already talks to Zotero directly — paste your API key in the Intake Studio to pipe any PDF straight into the Fixer.",
        pricing: "Free · $20/yr cloud",
        url: "https://www.zotero.org/",
        icon: LibraryIcon,
      },
    ],
  },
  {
    id: "read",
    title: "Read",
    subtitle: "Legal sources that play nicely with Intake's public-corpus tab",
    accent: "from-emerald-400/30 to-teal-500/10",
    tools: [
      {
        name: "Standard Ebooks",
        tagline: "Handsome, free public-domain ebooks",
        description:
          "Curated public-domain classics, professionally typeset. Better than raw Gutenberg text — and every download is a legit PDF ready to map. No sign-up.",
        pricing: "Free · Public domain",
        url: "https://standardebooks.org/",
        icon: BookOpen,
      },
      {
        name: "arXiv",
        tagline: "Open-access preprints — physics, CS, stats, bio",
        description:
          "Cornell's decades-old open-access server. Marvex Studio's Public Domain tab already searches and fetches PDFs directly — but the full browse experience on arxiv.org is worth knowing.",
        pricing: "Free · Open access",
        url: "https://arxiv.org/",
        icon: FlaskConical,
      },
      {
        name: "PubMed",
        tagline: "Biomedical literature search",
        description:
          "NIH's canonical index — 35M+ papers. Open-access hits link straight to PMC PDFs that drop into Intake cleanly.",
        pricing: "Free · Taxpayer-funded",
        url: "https://pubmed.ncbi.nlm.nih.gov/",
        icon: Telescope,
      },
      {
        name: "Project Gutenberg",
        tagline: "70,000 public-domain books",
        description:
          "The granddaddy. Marvex Studio already converts Gutenberg plaintext into a mappable PDF via the Public Domain tab — but a slow browse is how you find the gems.",
        pricing: "Free · Public domain",
        url: "https://www.gutenberg.org/",
        icon: Globe2,
      },
    ],
  },
  {
    id: "think",
    title: "Think",
    subtitle: "Where maps go after Marvex Studio",
    accent: "from-violet-400/30 to-fuchsia-500/10",
    tools: [
      {
        name: "Obsidian",
        tagline: "Your second brain · local-first Markdown",
        description:
          "Export your mind-map to Markdown (Pro feature, coming soon) and let Obsidian's graph view reveal connections across maps you built weeks ago. Free for personal use; Publish and Sync are optional paid add-ons.",
        pricing: "Free · Paid add-ons",
        url: "https://obsidian.md/",
        icon: Brain,
      },
      {
        name: "Anki",
        tagline: "Spaced-repetition flashcards",
        description:
          "Turn your deepest map elements into flashcards that stick for a decade. Import JSON; export CSV. Free on desktop, open source.",
        pricing: "Free · Open source",
        url: "https://apps.ankiweb.net/",
        icon: Sparkles,
      },
      {
        name: "Roam Research",
        tagline: "Networked thought",
        description:
          "If Obsidian feels too minimal, Roam's bidirectional-linking interface may click. Paid, but beloved by a dedicated crowd.",
        pricing: "Paid · 31-day trial",
        url: "https://roamresearch.com/",
        icon: GraduationCap,
      },
    ],
  },
];

export default function Tools() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Tools we love · Marvex Studio",
    description: "A hand-picked toolkit for serious researchers — Galaxy.ai, Readwise, Zotero, Anki, arXiv, Obsidian, and more. All legal, all respected, curated by the Marvex Studio team.",
    type: "website",
  });
  return (
    <div className="min-h-screen bg-[#03040a] text-[#cfdaf3]">
      {/* Header */}
      <header className="px-6 md:px-10 h-16 flex items-center gap-4 border-b border-white/10 bg-[#04060d] sticky top-0 z-30">
        <button
          onClick={() => navigate(-1)}
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 flex items-center gap-1.5"
          data-testid="tools-back"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <div className="h-6 w-px bg-white/10" />
        <Logo size={30} />
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
            Tools we love
          </div>
          <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187]">
            Companions · Not competitors
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-16 pb-10 max-w-5xl mx-auto" data-testid="tools-hero">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/80 mb-3">
          The learning stack
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-5">
          Tools <span className="gradient-text">we love</span>
        </h1>
        <p className="text-base md:text-lg text-[#9aa7c7] max-w-2xl leading-relaxed">
          Hand-picked companions that make Marvex Studio better. Every link is legal, every tool is
          respected. A couple pay us a small referral — clearly marked, and never at your expense.
        </p>
      </section>

      {/* Category sections */}
      <main className="px-6 md:px-10 pb-20 max-w-6xl mx-auto space-y-16">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} data-testid={`tools-section-${section.id}`}>
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="text-2xl md:text-3xl font-bold text-white">{section.title}</h2>
              <div
                className={`h-px flex-1 bg-gradient-to-r ${section.accent} to-transparent`}
                aria-hidden
              />
            </div>
            <p className="text-[13px] text-[#7a87ad] mb-6">{section.subtitle}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} accent={section.accent} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* FTC disclosure */}
      <footer
        className="px-6 md:px-10 py-10 border-t border-white/5 bg-[#04060d]"
        data-testid="tools-disclosure"
      >
        <div className="max-w-4xl mx-auto text-[12px] text-[#566187] leading-relaxed space-y-3">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">
            Affiliate disclosure
          </div>
          <p>
            Some links on this page (marked <span className="text-fuchsia-300">AFFILIATE</span> or
            <span className="text-amber-300"> RECOMMENDED</span>) pay
            Marvex Studio a small referral fee if you sign up. You pay the same price either way —
            the fee comes out of the tool&apos;s marketing budget, not your wallet. We only
            recommend tools we genuinely use and trust. Every non-affiliated tool is here because
            it belongs, not because it pays.
          </p>
          <p>
            marvex.app is a participant in the Amazon Services LLC Associates Program, an
            affiliate advertising program designed to provide a means for sites to earn advertising
            fees by advertising and linking to Amazon.com. It is also an affiliate of
            Bookshop.org, and participates in referral programmes for Galaxy.ai and Readwise.
            Outbound book links inside your maps may earn us a commission on qualifying
            purchases at no extra cost to you.
          </p>
        </div>
      </footer>
    </div>
  );
}

function ToolCard({ tool, accent }) {
  const Icon = tool.icon || Globe2;
  const badgeClass =
    tool.badgeTone === "amber"
      ? "bg-amber-500/20 text-amber-200 border-amber-400/40"
      : tool.badgeTone === "fuchsia"
      ? "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40"
      : "bg-cyan-500/20 text-cyan-200 border-cyan-400/40";

  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      data-testid={`tools-card-${tool.name.toLowerCase().replace(/\s+/g, "-")}`}
      onClick={() => track("affiliate_click", {
        tool: tool.name,
        location: "tools_page",
        affiliate: !!tool.badge,
      })}
      className="group relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 transition-all duration-200 hover:border-cyan-400/40 hover:-translate-y-[2px] hover:shadow-[0_14px_36px_rgba(0,240,255,0.08)]"
    >
      {/* Affiliate badge */}
      {tool.badge && (
        <span
          className={`absolute -top-2 right-4 mono text-[9px] uppercase tracking-[0.22em] px-2 py-[3px] rounded-full border ${badgeClass}`}
          data-testid="tools-card-badge"
        >
          {tool.badge}
        </span>
      )}

      {/* Icon */}
      <div
        className={`w-11 h-11 rounded-xl grid place-items-center bg-gradient-to-br ${accent} border border-white/10 mb-4 text-white group-hover:scale-105 transition-transform`}
        aria-hidden
      >
        <Icon size={18} />
      </div>

      <div className="text-lg font-bold text-white mb-0.5">{tool.name}</div>
      <div className="text-[12px] text-cyan-300/80 mono uppercase tracking-[0.12em] mb-2">
        {tool.tagline}
      </div>
      <div className="text-[13px] text-[#9aa7c7] leading-relaxed mb-4 line-clamp-5">
        {tool.description}
      </div>

      {tool.priceComparison && <PriceComparison data={tool.priceComparison} />}

      <div className="flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
          {tool.pricing}
        </span>
        <span className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 group-hover:text-white flex items-center gap-1 transition-colors">
          Visit <ExternalLink size={10} />
        </span>
      </div>
    </a>
  );
}

/**
 * Wirecutter-style price comparison strip — surfaced under tools that include
 * a `priceComparison` object. Renders the competitor stack on the left, the
 * tool's own price on the right, and a fat "Save N%" pill anchoring the deal.
 *
 * Shape:
 *   { competitors: [{name, price}], yours: number, headline?: string, savePct: number }
 *
 * The math is rendered visibly so the savings claim is self-verifying — no
 * hidden assumptions, no bait-and-switch.
 */
function PriceComparison({ data }) {
  const total = data.competitors.reduce((sum, c) => sum + c.price, 0);
  return (
    <div
      className="rounded-lg border border-amber-400/25 bg-gradient-to-br from-amber-500/[0.06] via-amber-500/[0.03] to-transparent p-3 mb-4"
      data-testid="tools-card-price-comparison"
    >
      {data.headline && (
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-amber-300/85 mb-2">
          {data.headline}
        </div>
      )}
      <div className="flex items-stretch gap-2">
        {/* Competitor stack */}
        <div className="flex-1 min-w-0">
          {data.competitors.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between text-[11px] text-[#8595bb] leading-tight py-[2px]"
            >
              <span className="truncate pr-2">{c.name}</span>
              <span className="mono text-[#aab9da] tabular-nums">${c.price}</span>
            </div>
          ))}
          <div className="mt-1 pt-1 border-t border-white/5 flex items-center justify-between text-[11px]">
            <span className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187]">Total</span>
            <span className="mono text-[#cfdaf3] font-semibold tabular-nums">${total}/mo</span>
          </div>
        </div>

        {/* Vertical "vs" divider */}
        <div className="flex flex-col items-center justify-center px-1">
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187]">vs</div>
        </div>

        {/* Galaxy / yours */}
        <div className="flex-1 min-w-0 flex flex-col items-end justify-center text-right">
          <div className="text-[20px] font-bold text-amber-100 leading-none tabular-nums">
            ${data.yours}
          </div>
          <div className="mono text-[9px] uppercase tracking-[0.18em] text-amber-200/70 mt-0.5">
            per month
          </div>
          <span
            className="mt-2 inline-block mono text-[10px] uppercase tracking-[0.22em] px-2 py-1 rounded-full bg-amber-500/25 text-amber-100 border border-amber-300/50 font-semibold"
            data-testid="tools-card-save-pill"
          >
            Save {data.savePct}%
          </span>
        </div>
      </div>
    </div>
  );
}

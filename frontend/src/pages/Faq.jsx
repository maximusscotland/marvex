import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus, Minus, HelpCircle } from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";

/**
 * /faq — long-form FAQ page covering pre-purchase, billing, AI keys,
 * privacy, desktop and refunds.
 *
 * Renders an accordion grouped by topic. Each topic carries a JSON-LD
 * FAQPage schema entry so the whole page is one rich SERP result with
 * collapsible answers in Google's preview. Internal links are
 * SPA-aware (`<Link>` for anything starting with `/`, `<a target=_blank>`
 * for everything else) so a click never forces a full reload.
 *
 * Single render path — both visible and SR-only DOM stay in sync via
 * `aria-expanded` / `hidden`. No Disclosure-from-Headless-UI dep.
 */

const FAQ_GROUPS = [
  {
    id: "general",
    title: "Getting started",
    items: [
      {
        q: "Do I need an account to use Marvex Studio?",
        a: "No. Marvex is local-first — your maps live in your browser by default. You only need an account if you want to (a) sync across devices, (b) buy a paid plan, or (c) use the affiliate / press programs. Visit the [Studio](/library) and start creating, no sign-up required.",
      },
      {
        q: "Is Marvex Studio free?",
        a: "Yes — there's a generous free tier with the full canvas, every export format, and Quick Outline (rule-based) PDF parsing. Paid plans add AI Analysis, larger map sizes, and cloud sync. See the [pricing page](/pricing) for the full breakdown.",
      },
      {
        q: "What's the difference between Quick Outline and AI Analysis?",
        a: "**Quick Outline** uses a deterministic rule-based parser to extract the heading hierarchy from a PDF — fast, free, no AI calls. Best for well-structured documents (textbooks, reports). **AI Analysis** sends the PDF to your chosen LLM (OpenAI / Claude / Gemini) and gets back a semantic, citation-linked map. Better for unstructured prose, research papers, and meeting notes. You bring your own API key — Marvex never marks up inference costs.",
      },
      {
        q: "Web app or desktop app — which should I use?",
        a: "Most users start in the browser at [marvex.app/library](/library) — zero install, full feature set. The [desktop app](/download) (Mac/Windows) adds offline mode, larger PDF support (up to 200 MB vs 25 MB on web), system-tray quick capture, and \"set as default app for .mmap files\". If you're a heavy user, install the desktop app.",
      },
    ],
  },
  {
    id: "billing",
    title: "Billing & plans",
    items: [
      {
        q: "Can I cancel anytime?",
        a: "Yes. Click your avatar in Studio → \"Manage subscription\" → \"Cancel plan\" (this opens the Stripe Customer Portal). Your plan stays active until the end of the billing period — no early-termination fees, no clawbacks on existing maps.",
      },
      {
        q: "Do you offer refunds?",
        a: "Yes — we honour a 14-day no-questions refund on all paid plans. Email [ceo@marvex.app](mailto:ceo@marvex.app) within 14 days of your charge with your order email and we'll issue a full refund within 3 business days. No need to justify why.",
      },
      {
        q: "What happens to my maps if I downgrade?",
        a: "All your existing maps stay — they're stored in your browser/desktop, not on our servers. You'll lose access to NEW Pro features (AI Analysis on new maps, cloud sync, larger map limits) but every map you've already created stays fully editable and exportable.",
      },
      {
        q: "Is the lifetime plan really lifetime?",
        a: "Yes — pay once, use forever. \"Lifetime\" means as long as Marvex Studio exists as a product (we're committed to a minimum 5-year support window even if a corporate acquirer ever steps in). Lifetime includes all future feature updates at no extra cost.",
      },
      {
        q: "Do you have student / education discounts?",
        a: "Yes — 50% off any monthly plan with a valid .edu / .ac.uk email. Email [ceo@marvex.app](mailto:ceo@marvex.app) from your university address with the subject \"Student discount\" and we'll send a discount code within 24h.",
      },
    ],
  },
  {
    id: "ai",
    title: "AI keys & costs",
    items: [
      {
        q: "Why do I have to bring my own AI key?",
        a: "Because we refuse to be a middleman that marks up the LLM bill. Most AI mind map tools charge $30+/month and pocket a fat margin on the inference. We charge $9–15/month for the **software**, and you pay OpenAI / Anthropic / Google directly for the **AI** — typically pennies per map. The result: you get to use the latest model whenever you want, and your bill scales with your actual usage instead of a fixed subscription markup.",
      },
      {
        q: "Where do I get an OpenAI / Claude / Gemini API key?",
        a: "**OpenAI**: [platform.openai.com](https://platform.openai.com/api-keys) → Create new secret key. **Anthropic Claude**: [console.anthropic.com](https://console.anthropic.com/settings/keys) → API Keys. **Google Gemini**: [aistudio.google.com](https://aistudio.google.com/app/apikey) → Get API key. Drop the key into Marvex → Settings → AI Keys — it's stored locally in your browser and never sent to our servers.",
      },
      {
        q: "How much does AI Analysis typically cost per map?",
        a: "A 20-page research paper analysed with GPT-4o costs roughly **$0.02–$0.05** per map. Claude Sonnet 4.5 is similar. Gemini 3 Flash is cheaper (~$0.005). For comparison, you could run AI Analysis on **300 papers** for the cost of a single Heptabase month.",
      },
      {
        q: "Does Marvex see my AI key?",
        a: "No. Your API key lives in your browser's localStorage (or your desktop app's encrypted keychain) and the API call goes **directly** from your machine to OpenAI / Anthropic / Google. Marvex servers never see the key, the request body, or the response. We literally cannot bill you for AI usage we never observe.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy & data",
    items: [
      {
        q: "Where are my maps stored?",
        a: "By default, in your browser's localStorage / IndexedDB (web) or the desktop app's encrypted local file system (Mac/Windows). Maps never leave your device unless you explicitly sync to cloud (Pro feature) or export. Read the full [privacy policy](/privacy) for the technical details.",
      },
      {
        q: "Do you track me?",
        a: "We use PostHog for product analytics (page views, button clicks — no map content, ever) and Sentry for error monitoring. You can disable both in Settings → Privacy → \"Privacy mode\". Privacy mode also disables outbound telemetry from the desktop app.",
      },
      {
        q: "Is Marvex GDPR compliant?",
        a: "Yes — we're UK-based and GDPR/UK-GDPR compliant. You can request a data export or full deletion at any time via [ceo@marvex.app](mailto:ceo@marvex.app). Most users have zero personal data on our servers because the app is local-first.",
      },
    ],
  },
  {
    id: "support",
    title: "Support & contact",
    items: [
      {
        q: "Found a bug — how do I report it?",
        a: "Use the [Report a bug](/report-bug) page (or in the desktop app, Help → Report a bug…). Reports go straight to tech@marvex.app and we respond within 1 business day. Most bugs ship a fix within a few days.",
      },
      {
        q: "How do I become a press reviewer / get a free Pro code?",
        a: "If you write for a publication, run a YouTube channel, or have a substantial newsletter / blog audience, apply via the [press page](/press). Approved reviewers get a 14-day Pro access code instantly via email — no negotiations, no jumping through hoops.",
      },
      {
        q: "Do you have an affiliate program?",
        a: "Yes — 30% recurring revenue share on every paying customer you refer. Apply at [marvex.app/affiliate](/affiliate). Approved partners get a unique referral link, a real-time dashboard, and monthly payouts via Stripe Connect.",
      },
      {
        q: "How do I contact you for everything else?",
        a: "[Visit the contact page](/contact) — it routes press, sales, partnerships, and general questions to the right inbox. For founder-level decisions (refunds, partnerships, custom plans), email [ceo@marvex.app](mailto:ceo@marvex.app) directly.",
      },
    ],
  },
];

const TOKEN_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;
const renderInline = (text) => {
  const parts = text.split(TOKEN_RE).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    const m = p.match(LINK_RE);
    if (m) {
      const [, label, href] = m;
      const isInternal = href.startsWith("/");
      const isMail = href.startsWith("mailto:");
      const cls = "text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/40 underline-offset-4";
      return isInternal ? (
        <Link key={i} to={href} className={cls}>{label}</Link>
      ) : (
        <a key={i} href={href} {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })} className={cls}>{label}</a>
      );
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
};

export default function Faq() {
  const [open, setOpen] = useState(() => new Set([
    "general:0", "billing:0", "ai:0", "privacy:0", "support:0",
  ]));
  const toggle = (key) => setOpen((s) => {
    const next = new Set(s);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // Strip markdown for the schema (Google's FAQPage schema wants plain text)
  const stripMd = (s) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  const allItems = FAQ_GROUPS.flatMap((g) => g.items);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allItems.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: stripMd(it.a) },
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Marvex", item: SITE },
      { "@type": "ListItem", position: 2, name: "FAQ", item: `${SITE}/faq` },
    ],
  };

  usePageMeta({
    title: "FAQ — Marvex Studio",
    description:
      "Answers about Marvex Studio: free tier, AI keys, refunds, privacy, billing, student discounts, and more. Local-first mind mapping with bring-your-own-key AI.",
    type: "website",
    url: `${SITE}/faq`,
    jsonLd: [faqJsonLd, breadcrumbJsonLd],
  });

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid="faq-page">
      <header className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition" data-testid="faq-home">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex / faq</span>
        </Link>
        <Link to="/contact" data-testid="faq-to-contact" className="cta-ghost text-[12px]">
          Contact us <ArrowRight size={12} />
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-6 pb-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/[0.06]">
          <HelpCircle size={12} /> Frequently asked
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4">
          Everything you might want to ask <span className="gradient-text">before you commit.</span>
        </h1>
        <p className="text-[15px] text-[#a4b4d8] leading-relaxed mb-12">
          If something here doesn&apos;t answer your question, email me directly at{" "}
          <a href="mailto:ceo@marvex.app" className="text-cyan-300 underline">ceo@marvex.app</a>
          {" "}— I read every message myself.
        </p>

        <div className="space-y-12">
          {FAQ_GROUPS.map((group) => (
            <section key={group.id} data-testid={`faq-group-${group.id}`}>
              <h2 className="text-[11px] mono uppercase tracking-[0.22em] text-fuchsia-300/90 mb-4">
                {group.title}
              </h2>
              <div className="space-y-2">
                {group.items.map((it, i) => {
                  const key = `${group.id}:${i}`;
                  const isOpen = open.has(key);
                  return (
                    <div
                      key={key}
                      data-testid={`faq-item-${group.id}-${i}`}
                      className="rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.03] transition"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left"
                        data-testid={`faq-toggle-${group.id}-${i}`}
                      >
                        <span className="text-[15px] font-medium text-white leading-snug">{it.q}</span>
                        <span className="shrink-0 text-cyan-300/80 mt-0.5">
                          {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-[14px] text-[#cfdaf3] leading-relaxed">
                          {renderInline(it.a)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.04] p-6 text-center">
          <h3 className="text-xl font-semibold mb-2">Still have a question?</h3>
          <p className="text-[14px] text-[#a4b4d8] mb-4">
            We respond to every email within 1 business day.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/contact" data-testid="faq-cta-contact" className="cta-pill text-[13px]">
              Contact us <ArrowRight size={14} />
            </Link>
            <Link to="/report-bug" data-testid="faq-cta-bug" className="cta-ghost text-[13px]">
              Report a bug
            </Link>
          </div>
        </div>
      </main>

      <SiteLinksFooter />
    </div>
  );
}

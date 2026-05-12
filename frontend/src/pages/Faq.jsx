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
    id: "pdf",
    title: "PDF to mind map",
    items: [
      {
        q: "Can I convert a scanned (image-based) PDF into a mind map?",
        a: "Yes, with one caveat. If the scan has an OCR text layer (most modern scans do), Marvex extracts the text and builds the mind map normally. Pure image scans with no text layer need a free OCR pass first (Adobe Acrobat, macOS Preview, or PDF24 online) and then Marvex treats them like any other PDF. Native OCR ships in v0.3. Start with the [PDF to mind map walkthrough](/learn/how-to-turn-pdf-into-mind-map) or [open the studio](/app).",
      },
      {
        q: "Is there a page limit when converting a PDF to a mind map?",
        a: "**Free tier**: up to 25 pages per PDF and 30 elements per map. **Pro Lite ($9/mo)**: up to 80 pages and 200 elements. **Pro ($15/mo) and Lifetime**: unlimited pages and elements. The [desktop app](/download) handles PDFs up to 200 MB; the web app caps at 25 MB to keep parsing snappy. Compare tiers on the [pricing page](/pricing).",
      },
      {
        q: "Can I convert a whole textbook into a study mind map?",
        a: "Yes — it's one of the most loved workflows. Use AI Analysis with Claude Sonnet 4.5 or GPT-4o and you get a chapter-by-chapter map with concepts, definitions, and relationships in 60–120 seconds. Then right-click any element to ask the AI for an example, a simpler explanation, or a counter-argument. See the [mind mapping for students guide](/learn/mind-mapping-for-students) and the free [Teaching with Mind Maps mini-course](/mini-course/teaching-with-mind-maps).",
      },
      {
        q: "What types of PDFs convert best into a mind map?",
        a: "Anything with a clear hierarchy: academic papers, textbook chapters, legal judgments, white papers, technical docs, and meeting minutes. **Quick Outline** follows the heading tree directly so structured PDFs map perfectly. For dense prose without headings (interview transcripts, novels) switch to **AI Analysis** — it infers structure semantically. The [best PDF mind map tools roundup](/learn/best-pdf-mind-map-tools-2026) shows where Marvex outperforms competitors on each PDF type.",
      },
      {
        q: "Do I need to upload my PDF to the cloud to convert it?",
        a: "No — the PDF stays on your device throughout. Quick Outline runs entirely in your browser. AI Analysis sends the extracted text to your AI provider (OpenAI / Anthropic / Google) using **your** own API key — Marvex servers never see the file or the AI request body. Full detail in the [privacy policy](/privacy) and on the canonical [PDF to mind map page](/pdf-to-mind-map).",
      },
      {
        q: "What are some practical real-world uses for Marvex Studio mind maps and Timeline Studio?",
        a: "Marvex isn't just for academic essays — three patterns we see daily:\n\n**(1) Household finances on a timeline.** Drop your monthly outgoings (mortgage / rent, council tax, utilities, subscriptions, insurance renewals) onto [Timeline Studio](/timeline). You instantly see which week of the year is tight and when the next big payment lands. It beats a spreadsheet because the *shape* of the year is visual — you spot pinch points before they hit.\n\n**(2) Criminal investigation & legal case prep.** Investigators, paralegals and solicitors map suspects, witness statements, exhibits, and forensic findings into a mind map, then drop the same elements onto a parallel timeline to spot inconsistencies in alibis or sequence-of-events disputes. Pair with the [Law Pack add-on](/pricing) for BAILII full-text case-law search and you have a one-canvas case file.\n\n**(3) Household emergency contact map.** One mind map per home: car insurance, breakdown cover, GP surgery, emergency plumber, gas-safe engineer, locksmith, electrician, the neighbour with the spare key, boiler model + service date, fuse-box location. Print as PDF and stick it on the fridge or share a .mmap file with a house-sitter. When the boiler dies at 2am, you reach the right person in 10 seconds instead of 10 minutes of panic-Googling.\n\nMore examples in [mind mapping for students](/learn/mind-mapping-for-students), or just [open the studio and start mapping](/app).",
      },
    ],
  },
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
        a: "Yes. Click your avatar in Studio → \"Manage subscription\" → \"Cancel plan\" (this opens the Stripe Customer Portal). Your plan stays active until the end of the billing period — no early-termination fees, no clawbacks on existing maps. See the [pricing page](/pricing) or [contact us](/contact) if Stripe's portal misbehaves.",
      },
      {
        q: "Do you offer refunds?",
        a: "Yes — we honour a 14-day no-questions refund on all paid plans. Email [ceo@marvex.app](mailto:ceo@marvex.app) within 14 days of your charge with your order email and we'll issue a full refund within 3 business days. No need to justify why.",
      },
      {
        q: "What happens to my maps if I downgrade?",
        a: "All your existing maps stay — they're stored in your browser/desktop, not on our servers. You'll lose access to NEW Pro features (AI Analysis on new maps, cloud sync, larger map limits) but every map you've already created stays fully editable and exportable. Compare what each tier unlocks on the [pricing page](/pricing).",
      },
      {
        q: "Is the lifetime plan really lifetime?",
        a: "Yes — pay once, use forever. \"Lifetime\" means as long as Marvex Studio exists as a product (we're committed to a minimum 5-year support window even if a corporate acquirer ever steps in). Lifetime includes all future feature updates at no extra cost. See [Lifetime on the pricing page](/pricing) or [download the desktop apps](/download) that come with it.",
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
        a: "A 20-page research paper analysed with GPT-4o costs roughly **$0.02–$0.05** per map. Claude Sonnet 4.5 is similar. Gemini 3 Flash is cheaper (~$0.005). For comparison, you could run AI Analysis on **300 papers** for the cost of a single Heptabase month — read the [Marvex vs Heptabase breakdown](/vs/heptabase) and the deeper [AI mind map generator explainer](/learn/ai-mind-map-generator-explained).",
      },
      {
        q: "Does Marvex see my AI key?",
        a: "No. Your API key lives in your browser's localStorage (or your desktop app's encrypted keychain) and the API call goes **directly** from your machine to OpenAI / Anthropic / Google. Marvex servers never see the key, the request body, or the response. We literally cannot bill you for AI usage we never observe. Full detail in the [privacy policy](/privacy) and the canonical [PDF to mind map](/pdf-to-mind-map) workflow.",
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
        a: "Yes — we're UK-based and GDPR/UK-GDPR compliant. Marvex is registered with the UK Information Commissioner's Office (ICO) as a data controller under the Data Protection (Charges and Information) Regulations 2018. You can request a data export or full deletion at any time via [ceo@marvex.app](mailto:ceo@marvex.app), and you have the right to complain to the ICO at [ico.org.uk/concerns](https://ico.org.uk/concerns). Most users have zero personal data on our servers because the app is local-first.",
      },
    ],
  },
  {
    id: "support",
    title: "Support & contact",
    items: [
      {
        q: "Do you support Westlaw / LexisNexis / BAILII?",
        a: "Yes — and you don't need a Pro plan to access them. **Westlaw UK** is built in for everyone (free) — Marvex opens Westlaw with your search query pre-filled (you'll need your own Westlaw account for full results). **BAILII full-text search** (80,000+ UK & Irish judgments) and the **LexisNexis BYOK proxy** are part of the optional [Law Pack add-on](/pricing) ($10 one-off). Plus the always-free Find Case Law service and legislation.gov.uk for primary statutes.",
      },
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
    "pdf:0", "general:0", "billing:0", "ai:0", "privacy:0", "support:0",
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
                        {/* Each question is a proper <h3> — sits under the
                            section's <h2> ("Getting started" etc) so the
                            page outline is h1 → h2 → h3, the structure
                            search-engine SEO audits and accessibility
                            scanners both expect.  Visually identical to
                            the prior <span> (same Tailwind classes). */}
                        <h3 className="text-[15px] font-medium text-white leading-snug m-0">{it.q}</h3>
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
          {/* Demoted from <h3> → <h4> since the question-level headings
              above now own h3; keeps the page outline well-formed. */}
          <h4 className="text-xl font-semibold mb-2">Still have a question?</h4>
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

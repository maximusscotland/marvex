import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowLeft, Upload, Sparkles, FileText, Brain, Zap,
  Lock, Globe, Check, Star, ExternalLink,
} from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import RelatedReads from "@/components/RelatedReads";
import References, { MIND_MAPPING_REFERENCES } from "@/components/References";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";
const CANONICAL = `${SITE}/pdf-to-mind-map`;

/**
 * /pdf-to-mind-map — single-purpose SEO landing page targeting the
 * North Star keyword "PDF to mind map" + 4 satellites:
 *   • AI mind map generator
 *   • mind map maker
 *   • free PDF mind map
 *   • convert PDF to mind map
 *
 * Strategy: dense, keyword-rich body copy (~1,500 words) + HowTo
 * structured data + FAQ structured data + canonical URL + internal
 * link strip. Every section CTA points back at /app (Studio) so
 * conversions don't leak.
 *
 * Why a separate page rather than the homepage? The homepage has
 * to serve dozens of intents (download, pricing, learn, vs, etc.).
 * A dedicated page can be hyper-focused on ONE search intent —
 * and Google rewards intent-precision with higher rankings.
 */
export default function PdfToMindMap() {
  usePageMeta({
    title: "PDF to Mind Map — Free AI Mind Map Generator | Marvex Studio",
    description:
      "Convert any PDF into an interactive mind map in 60 seconds. Free AI mind map generator — no signup, local-first, BYO-key. Try the fastest PDF to mind map tool today.",
    type: "website",
    url: CANONICAL,
  });

  // Inject HowTo + FAQ JSON-LD schemas. HowTo unlocks the "How to
  // turn a PDF into a mind map" rich result (numbered steps in SERP);
  // FAQPage unlocks the expandable FAQ accordion in SERP.
  useEffect(() => {
    const id = "pdf-mindmap-jsonld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "How to convert a PDF into a mind map",
        description:
          "Drop a PDF into Marvex Studio's AI mind map generator and get an interactive mind map in 60 seconds.",
        image: `${SITE}/teaser/book-to-map.png`,
        estimatedCost: { "@type": "MonetaryAmount", currency: "USD", value: "0" },
        totalTime: "PT60S",
        supply: [{ "@type": "HowToSupply", name: "Any PDF document" }],
        tool: [{ "@type": "HowToTool", name: "Marvex Studio (free tier)" }],
        step: [
          { "@type": "HowToStep", position: 1, name: "Open Marvex Studio", text: "Go to marvex.app and click Try Free — no account required.", url: `${SITE}/app` },
          { "@type": "HowToStep", position: 2, name: "Drop your PDF", text: "Drag any PDF onto the canvas, or click the upload button. The file stays on your device — never uploaded to our servers." },
          { "@type": "HowToStep", position: 3, name: "Pick the AI engine", text: "Choose Quick Outline (free, structural parse) or AI Analysis (uses your own Claude/GPT/Gemini API key for semantic mapping)." },
          { "@type": "HowToStep", position: 4, name: "Watch the map appear", text: "In 30–60 seconds the AI extracts every concept, theme, and relationship into an interactive mind map you can zoom, edit, and export." },
          { "@type": "HowToStep", position: 5, name: "Edit and export", text: "Drag elements, add notes, and export as PDF, PNG, SVG, Markdown, or .mmap to share." },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Is the PDF to mind map converter free?",
            acceptedAnswer: { "@type": "Answer", text: "Yes — the free tier converts PDFs using Quick Outline (no AI cost). For semantic AI mind maps, bring your own Claude / OpenAI / Gemini API key — we never charge you for AI usage." },
          },
          {
            "@type": "Question",
            name: "Do I need to sign up to convert a PDF to a mind map?",
            acceptedAnswer: { "@type": "Answer", text: "No. Marvex Studio is local-first. You can use it directly in your browser without an account, and your maps stay on your device." },
          },
          {
            "@type": "Question",
            name: "How long does it take to convert a PDF to a mind map?",
            acceptedAnswer: { "@type": "Answer", text: "Typically 30–60 seconds for a 20-page paper. Larger documents or AI Analysis mode can take up to 2 minutes." },
          },
          {
            "@type": "Question",
            name: "What's the difference between Marvex Studio and other AI mind map generators?",
            acceptedAnswer: { "@type": "Answer", text: "Marvex Studio is local-first (your data never leaves your device by default) and uses Bring-Your-Own-Key AI — you pay your AI provider directly with no markup. Competitors typically lock you into their cloud and charge per generation." },
          },
          {
            "@type": "Question",
            name: "Can I convert a scanned (image-based) PDF into a mind map?",
            acceptedAnswer: { "@type": "Answer", text: "Yes, with one caveat. If the scanned PDF has an OCR text layer (most modern scans do), Marvex extracts text and builds the mind map normally. If it's a pure image scan with no text layer, run it through a free OCR tool first (Adobe Acrobat, Preview on macOS, or PDF24 online), then drop the OCR'd version into Marvex. Native OCR ships in v0.3." },
          },
          {
            "@type": "Question",
            name: "Is there a page or size limit for PDF mind mapping?",
            acceptedAnswer: { "@type": "Answer", text: "Free tier: up to 25 pages per PDF and 30 elements per map. Pro Lite ($9/mo): up to 80 pages and 200 elements. Pro ($15/mo) and Lifetime: unlimited pages and elements. The desktop app handles PDFs up to 200 MB; the web app caps at 25 MB to keep parsing snappy." },
          },
          {
            "@type": "Question",
            name: "What types of PDFs convert best into a mind map?",
            acceptedAnswer: { "@type": "Answer", text: "Anything with a clear hierarchical structure — academic papers, textbook chapters, legal judgments, white papers, technical documentation, and meeting minutes. Quick Outline excels at these because it follows the heading tree directly. For dense prose with no headings (interview transcripts, novels), AI Analysis works better because it infers structure semantically." },
          },
          {
            "@type": "Question",
            name: "Do I need to upload my PDF to the cloud to convert it?",
            acceptedAnswer: { "@type": "Answer", text: "No. The PDF stays on your device throughout. Quick Outline runs entirely in your browser. AI Analysis sends the extracted text to your AI provider (OpenAI / Anthropic / Google) using your own API key — Marvex servers never see the file or the AI request." },
          },
          {
            "@type": "Question",
            name: "Can I convert a textbook into a study mind map?",
            acceptedAnswer: { "@type": "Answer", text: "Yes — that's one of the most popular workflows. Drop a textbook PDF in, pick AI Analysis with Claude Sonnet 4.5 or GPT-4o, and within 60–120 seconds you get a chapter-by-chapter map with key concepts, definitions, and relationships extracted. Right-click any element to ask the AI for examples, simpler explanations, or counter-arguments." },
          },
        ],
      },
    ]);
    return () => { const e = document.getElementById(id); if (e) e.remove(); };
  }, []);

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid="pdf-to-mindmap-page">
      <header className="max-w-6xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition" data-testid="ptm-home">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex</span>
        </Link>
        <Link to="/app" data-testid="ptm-launch-nav" className="cta-ghost text-[13px]">
          Open the PDF to mind map maker <ArrowRight size={14} />
        </Link>
      </header>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-10 pb-20">
        <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 inline-flex items-center gap-2 mb-6">
          <Sparkles size={12} /> AI mind map generator · Free tier · BYO-key
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[0.98] tracking-tight mb-6">
          PDF to mind map.<br/>
          <span className="gradient-text">In 60 seconds.</span>
        </h1>
        <p className="text-[17px] sm:text-[19px] text-[#a4b4d8] leading-relaxed max-w-3xl mb-8">
          Drop any PDF, paper, ebook or report. Marvex Studio's AI mind map generator extracts every concept, theme, and relationship into an interactive mind map you can zoom, edit, branch, and export. <strong className="text-cyan-200">No signup. No upload to our servers. No AI markup — bring your own key.</strong>
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/app" data-testid="ptm-cta-primary" className="cta-pill">
            Convert PDF to mind map free <ArrowRight size={14} />
          </Link>
          <Link to="/pricing" data-testid="ptm-cta-pricing" className="cta-ghost">
            See pricing
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px] text-[#9aa7c7]">
          {[
            { icon: Zap, label: "60-second convert" },
            { icon: Lock, label: "Local-first · zero cloud" },
            { icon: Brain, label: "Bring your own AI key" },
            { icon: Globe, label: "Web · Mac · Windows · Linux" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon size={14} className="text-cyan-300/80 shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — feeds the HowTo JSON-LD above */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-3">How it works</div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-10">
          Convert a PDF to a mind map in 5 steps.
        </h2>
        <div className="space-y-5">
          {[
            { n: 1, icon: Upload, title: "Open Marvex Studio", body: <>Go to <Link to="/app" className="text-cyan-300 hover:underline">marvex.app/app</Link> and click <strong>Convert a PDF to a mind map</strong>. No account required.</> },
            { n: 2, icon: FileText, title: "Drop your PDF", body: "Drag any PDF onto the canvas, or click the upload button. The file stays on your device — Marvex Studio never uploads it to our servers." },
            { n: 3, icon: Brain, title: "Pick the AI engine", body: <>Choose <strong>Quick Outline</strong> (free, structural parse) or <strong>AI Analysis</strong> (uses your own Claude / OpenAI / Gemini API key for semantic mapping).</> },
            { n: 4, icon: Sparkles, title: "Watch the mind map appear", body: "In 30–60 seconds the AI extracts every concept, theme, and relationship into an interactive mind map you can zoom, edit, and export." },
            { n: 5, icon: ArrowRight, title: "Edit and export", body: "Drag elements, add notes, link to source, and export as PDF, PNG, SVG, Markdown, or .mmap to share." },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex gap-5">
                <div className="shrink-0 w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-400/30 grid place-items-center mono text-cyan-300 font-semibold">
                  {String(s.n).padStart(2, "0")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={16} className="text-cyan-300/80" />
                    <h3 className="text-[18px] font-semibold text-white">{s.title}</h3>
                  </div>
                  <p className="text-[14px] text-[#9aa7c7] leading-relaxed">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* WHY MARVEX — keyword-dense competitive copy */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3">Why Marvex Studio</div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-10">
          The fastest <span className="gradient-text">free AI mind map generator</span> for PDFs.
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { title: "AI mind map generator", body: "Powered by your own Claude Sonnet 4.5, GPT-5, or Gemini 3 API key. We don't markup AI usage — you pay the provider directly." },
            { title: "Free PDF mind map", body: "The free tier converts PDFs with Quick Outline at zero cost (3 maps × 30 elements each). Upgrade to Pro ($9–15/mo) for AI Analysis, unlimited maps, and the full export suite." },
            { title: "Mind map maker that respects privacy", body: "Local-first storage. No accounts. No tracking. Your maps stay in your browser and filesystem unless you explicitly sync them." },
            { title: "Cross-platform mind mapping software", body: "Use Marvex Studio on the web, or install the native desktop app for Mac (Apple Silicon + Intel), Windows (x64 + ARM64), and Linux (.AppImage / .deb / .rpm)." },
            { title: "Concept map software for researchers", body: "PDF reader, AI co-pilot, citation chips, side-by-side highlights, exportable summaries — built for people who actually read papers, not just file them." },
            { title: "Mind mapping for students", body: "60-second study guides from any textbook PDF. Right-click any element to ask the AI for a deeper gloss, an example, or a counter-argument." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center gap-2 mb-2">
                <Check size={16} className="text-emerald-400/80 shrink-0" />
                <h3 className="text-[16px] font-semibold text-white">{c.title}</h3>
              </div>
              <p className="text-[13px] text-[#9aa7c7] leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARE — internal links to /vs/ pages */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-3">Compare alternatives</div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">
          See how Marvex Studio stacks up.
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { slug: "heptabase", name: "Heptabase" },
            { slug: "mapify", name: "Mapify" },
            { slug: "notion", name: "Notion" },
          ].map((c) => (
            <Link
              key={c.slug}
              to={`/vs/${c.slug}`}
              data-testid={`ptm-vs-${c.slug}`}
              className="rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04] transition p-4 flex items-center justify-between"
            >
              <span className="text-[14px] text-white">Marvex vs {c.name}</span>
              <ExternalLink size={14} className="text-[#566187]" />
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ — feeds FAQPage JSON-LD */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3">PDF to mind map · FAQ</div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-10">Common questions.</h2>
        <div className="space-y-4">
          {[
            {
              q: "Is the PDF to mind map converter free?",
              a: (
                <>Yes — the free tier converts PDFs using Quick Outline (no AI cost). For semantic AI mind maps, bring your own Claude / OpenAI / Gemini API key — we never charge you for AI usage. See the full breakdown on the <Link to="/pricing" className="text-cyan-300 hover:underline">pricing page</Link> or read <Link to="/learn/how-to-turn-pdf-into-mind-map" className="text-cyan-300 hover:underline">the 5-step PDF-to-mind-map walkthrough</Link>.</>
              ),
            },
            {
              q: "Do I need to sign up to convert a PDF to a mind map?",
              a: (
                <>No. Marvex Studio is local-first — you can convert PDFs directly in your browser without an account, and your maps stay on your device. <Link to="/app" className="text-cyan-300 hover:underline">Open the studio</Link> or compare against <Link to="/vs/heptabase" className="text-cyan-300 hover:underline">Heptabase</Link> and <Link to="/vs/mapify" className="text-cyan-300 hover:underline">Mapify</Link> which both require accounts.</>
              ),
            },
            {
              q: "How long does PDF to mind map conversion take?",
              a: (
                <>Typically 30–60 seconds for a 20-page paper. Larger documents or AI Analysis mode can take up to 2 minutes. The <Link to="/download" className="text-cyan-300 hover:underline">desktop app</Link> is noticeably faster on 100+ page PDFs because it skips the browser sandbox.</>
              ),
            },
            {
              q: "What's the difference between Marvex and other AI mind map generators?",
              a: (
                <>Marvex Studio is local-first (data never leaves your device by default) and uses Bring-Your-Own-Key AI — you pay your AI provider directly with no markup. Most alternatives lock you into their cloud and charge per generation. See the deep-dive comparisons: <Link to="/vs/mapify" className="text-cyan-300 hover:underline">Marvex vs Mapify</Link>, <Link to="/vs/heptabase" className="text-cyan-300 hover:underline">Marvex vs Heptabase</Link>, and <Link to="/learn/best-pdf-mind-map-tools-2026" className="text-cyan-300 hover:underline">best PDF mind map tools in 2026</Link>.</>
              ),
            },
            {
              q: "Can I edit the mind map after the AI generates it?",
              a: (
                <>Absolutely. Every element, branch, and connector is fully editable. Drag, merge, split, rename, add notes, link to files, and export to PDF / PNG / SVG / Markdown / .mmap. The <Link to="/learn/ai-mind-map-generator-explained" className="text-cyan-300 hover:underline">AI mind map generator explainer</Link> covers how to refactor an auto-generated map into something publication-ready.</>
              ),
            },
            {
              q: "Does Marvex Studio work offline?",
              a: (
                <>Yes. Open a previously-loaded mind map without an internet connection. AI Analysis requires connectivity (because it calls your AI provider's API), but Quick Outline and editing are fully offline. The <Link to="/download" className="text-cyan-300 hover:underline">Mac / Windows / Linux desktop app</Link> is the better choice if you spend most of your week offline.</>
              ),
            },
            {
              q: "Can I convert a scanned (image-based) PDF into a mind map?",
              a: (
                <>Yes, with one caveat. If your scanned PDF has an OCR text layer (most modern scans do), Marvex extracts text and builds the mind map normally. If it's a pure image scan with no text layer, run it through a free OCR tool first — Adobe Acrobat, Preview on macOS, or PDF24 online — then drop the OCR'd version into <Link to="/app" className="text-cyan-300 hover:underline">the studio</Link>. Native OCR ships in v0.3.</>
              ),
            },
            {
              q: "Is there a page or size limit for PDF mind mapping?",
              a: (
                <>Free tier: up to 25 pages per PDF and 30 elements per map. <Link to="/pricing" className="text-cyan-300 hover:underline">Pro Lite ($9/mo)</Link>: up to 80 pages and 200 elements. <Link to="/pricing" className="text-cyan-300 hover:underline">Pro ($15/mo) and Lifetime</Link>: unlimited pages and elements. The <Link to="/download" className="text-cyan-300 hover:underline">desktop app</Link> handles PDFs up to 200 MB; the web app caps at 25 MB to keep parsing snappy.</>
              ),
            },
            {
              q: "What types of PDFs convert best into a mind map?",
              a: (
                <>Anything with a clear hierarchical structure — academic papers, textbook chapters, legal judgments, white papers, technical documentation, and meeting minutes. Quick Outline excels at these because it follows the heading tree directly. For dense prose with no headings (interview transcripts, novels), AI Analysis works better because it infers structure semantically. The <Link to="/learn/mind-mapping-for-students" className="text-cyan-300 hover:underline">mind mapping for students guide</Link> walks through the exact settings to use on academic papers.</>
              ),
            },
            {
              q: "Do I need to upload my PDF to the cloud to convert it?",
              a: (
                <>No. The PDF stays on your device throughout. Quick Outline runs entirely in your browser. AI Analysis sends the extracted text to your AI provider (OpenAI / Anthropic / Google) using <em>your</em> own API key — Marvex servers never see the file or the AI request. Read the <Link to="/privacy" className="text-cyan-300 hover:underline">full privacy policy</Link> and the <Link to="/faq" className="text-cyan-300 hover:underline">BYOK explainer in the FAQ</Link>.</>
              ),
            },
            {
              q: "Can I convert a textbook into a study mind map?",
              a: (
                <>Yes — that's one of the most popular workflows. Drop a textbook PDF in, pick AI Analysis with Claude Sonnet 4.5 or GPT-4o, and within 60–120 seconds you get a chapter-by-chapter map with key concepts, definitions, and relationships extracted. Right-click any element to ask the AI for examples, simpler explanations, or counter-arguments. Teachers should also see the free <Link to="/mini-course/teaching-with-mind-maps" className="text-cyan-300 hover:underline">"Teaching with Mind Maps" mini-course</Link>.</>
              ),
            },
          ].map((f, i) => (
            <details key={i} className="group rounded-xl border border-white/10 bg-white/[0.02] p-5" data-testid={`ptm-faq-${i}`}>
              <summary className="cursor-pointer text-[15px] font-semibold text-white list-none flex items-center justify-between">
                {f.q}
                <span className="text-cyan-300 mono text-lg group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="text-[13px] text-[#9aa7c7] leading-relaxed mt-3">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* RELATED READS — internal-link equity ladder. Order matters for SEO:
          fresh "Notion alternative" piece first because it has the strongest
          search volume tail and benefits most from sitewide internal-link
          juice from this pillar. Anchor text is varied to dodge over-
          optimisation penalties. */}
      <section
        data-testid="ptm-related-reads"
        className="max-w-5xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5"
      >
        <div className="flex items-baseline justify-between mb-6 gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Related <span className="gradient-text">reads</span>
          </h2>
          <Link
            to="/learn"
            className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 hover:text-cyan-200"
          >
            See all →
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              slug: "notion-alternative-for-mind-mapping-2026",
              kicker: "Comparison",
              title: "Notion alternative for mind mapping (2026)",
              blurb: "Honest take on Notion's native mind-map options vs purpose-built tools — and why the smartest setup uses both.",
              mins: 8,
            },
            {
              slug: "best-pdf-mind-map-tools-2026",
              kicker: "Roundup",
              title: "Best PDF to mind map tools in 2026",
              blurb: "7 tools tested over 4 weeks across papers, reports, and legal cases. Picks, pricing, and what to avoid.",
              mins: 9,
            },
            {
              slug: "how-to-turn-pdf-into-mind-map",
              kicker: "Tutorial",
              title: "How to turn a PDF into a mind map",
              blurb: "Step-by-step in under a minute. The exact 5-step workflow we use for academic papers and reports.",
              mins: 6,
            },
          ].map((a) => (
            <Link
              key={a.slug}
              to={`/learn/${a.slug}`}
              data-testid={`ptm-related-${a.slug}`}
              className="group rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-400/40 transition p-5 flex flex-col"
            >
              <span className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
                {a.kicker} · {a.mins} min
              </span>
              <h3 className="text-[15px] font-semibold text-white leading-snug mb-2 group-hover:text-cyan-200 transition">
                {a.title}
              </h3>
              <p className="text-[12.5px] text-[#9aa7c7] leading-relaxed flex-1">
                {a.blurb}
              </p>
              <span className="mt-3 mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] group-hover:text-cyan-300 inline-flex items-center gap-1">
                Read article <ArrowRight size={10} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-20 border-t border-white/5 text-center">
        <Star className="text-cyan-300 mx-auto mb-4" size={32} />
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          Ready to <span className="gradient-text">convert your first PDF?</span>
        </h2>
        <p className="text-[15px] text-[#a4b4d8] leading-relaxed max-w-xl mx-auto mb-8">
          Free tier. No signup. Your data stays on your device. The fastest mind map maker for PDFs.
        </p>
        <Link to="/app" data-testid="ptm-cta-bottom" className="cta-pill">
          Turn a PDF into a mind map free <ArrowRight size={14} />
        </Link>
        <div className="mt-8 flex items-center justify-center gap-5 text-[12px] text-[#7a87ad]">
          <Link to="/learn" className="hover:text-cyan-300 transition">Learn</Link>
          <span>·</span>
          <Link to="/pricing" className="hover:text-cyan-300 transition">Pricing</Link>
          <span>·</span>
          <Link to="/download" className="hover:text-cyan-300 transition">Download</Link>
        </div>
      </section>

      <References items={MIND_MAPPING_REFERENCES} />
      {/* "Compare alternatives" strip — surfaces the three /vs/*
          comparison pages so pillar-page visitors who are still
          shopping can see how Marvex stacks up. Three competitors
          isn't pressure tactics; it's transparent shopping help and
          good for SEO (descriptive anchor text inbound to /vs/*). */}
      <RelatedReads kind="competitor" currentSlug="" limit={3} title="How does Marvex compare?" />
      <SiteLinksFooter />
    </div>
  );
}

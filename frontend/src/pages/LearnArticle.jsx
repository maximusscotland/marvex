import React, { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Calendar, ExternalLink } from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import RelatedReads from "@/components/RelatedReads";
import References, { MIND_MAPPING_REFERENCES } from "@/components/References";
import { getArticle, ARTICLES } from "@/lib/articles";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";

/**
 * /learn/<slug> — long-form SEO article renderer.
 *
 * Falls through to this component when /learn/:slug doesn't match a
 * tutorial in lib/tutorials.js. Renders an Article + FAQPage +
 * BreadcrumbList JSON-LD bundle so each article is a single self-
 * contained SERP unit.
 *
 * Render strategy: dense, keyword-targeted prose grouped by section
 * with markdown-style **bold** + [label](url) link support inline
 * (we use a simple regex-driven splitter — no markdown parser
 * dependency). Internal links (starting with "/") render as
 * <Link> for SPA navigation; external links open in a new tab.
 */

// Single tokenizer that splits on **bold** AND [label](url) so the
// renderer can interleave text, bold, and links without nesting.
const TOKEN_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

const renderInline = (text) => {
  const parts = text.split(TOKEN_RE).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    }
    const m = p.match(LINK_RE);
    if (m) {
      const [, label, href] = m;
      const isInternal = href.startsWith("/");
      const cls = "text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/40 hover:decoration-cyan-300 underline-offset-4";
      return isInternal
        ? <Link key={i} to={href} className={cls} data-testid={`article-inline-link-${href.replace(/[^a-z0-9]+/gi, "-")}`}>{label}</Link>
        : <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={cls} data-testid="article-inline-link-ext">{label}</a>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
};

export default function LearnArticle() {
  const { slug } = useParams();
  const article = getArticle(slug);

  // Hooks must run unconditionally — call with safe defaults if no article.
  const url = article ? `${SITE}/learn/${article.slug}` : `${SITE}/learn`;
  usePageMeta({
    title: article ? (article.metaTitle || `${article.title} — Marvex Studio`) : "Article not found",
    description: article?.description || "Marvex Studio learning article.",
    type: "article",
    url,
  });

  useEffect(() => {
    if (!article) return undefined;
    const id = "learn-article-jsonld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    // Bundle 3 schemas:
    //  • Article — for the article rich result + author/publisher signals
    //  • FAQPage — unlocks the expandable FAQ accordion in SERP
    //  • BreadcrumbList — gives Google the "Home > Learn > Title" trail
    el.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        // TL;DR (when present) is the answer-first sentence AI search
        // engines extract; falling back to description preserves SEO for
        // articles that don't yet have one.
        description: article.tldr || article.description,
        abstract: article.tldr || article.description,
        datePublished: article.updatedAt,
        dateModified: article.updatedAt,
        author: { "@type": "Organization", name: "Marvex Studio", url: SITE },
        publisher: {
          "@type": "Organization",
          name: "Marvex Studio",
          url: SITE,
          logo: { "@type": "ImageObject", url: `${SITE}/logo-64.png` },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        keywords: article.keywords,
        wordCount: (article.sections || []).reduce(
          (n, s) => n + (s.paragraphs || []).reduce((m, p) => m + p.split(/\s+/).length, 0),
          0,
        ),
        inLanguage: "en",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: (article.faq || []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE },
          { "@type": "ListItem", position: 2, name: "Learn", item: `${SITE}/learn` },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
    ]);
    return () => { const e = document.getElementById(id); if (e) e.remove(); };
  }, [article, url]);

  if (!article) {
    return <Navigate to="/learn" replace />;
  }

  // Sibling navigation — link to other articles for content-cluster effect.
  const idx = ARTICLES.findIndex((a) => a.slug === slug);
  const prev = ARTICLES[idx - 1];
  const next = ARTICLES[idx + 1];

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid={`learn-article-${article.slug}`}>
      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/learn" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition" data-testid="article-home">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex / learn</span>
        </Link>
        <Link to="/app" className="cta-ghost text-[12px]">
          Try free <ArrowRight size={12} />
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-6 pb-20">
        {/* Visible breadcrumb */}
        <nav className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-6 flex items-center gap-2" data-testid="article-breadcrumb">
          <Link to="/" className="hover:text-cyan-300">Home</Link>
          <span className="opacity-50">/</span>
          <Link to="/learn" className="hover:text-cyan-300">Learn</Link>
          <span className="opacity-50">/</span>
          <span className="text-[#cfdaf3]">{article.metaTitle || article.title}</span>
        </nav>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] mb-5">
          {article.title}
        </h1>
        <p className="text-[15px] sm:text-[17px] text-[#a4b4d8] leading-relaxed mb-7">
          {article.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#7a87ad] mb-10 pb-7 border-b border-white/8">
          <span className="flex items-center gap-1.5"><Clock size={12} /> {article.minutesRead} min read</span>
          <span className="flex items-center gap-1.5"><Calendar size={12} /> Updated {article.updatedAt}</span>
        </div>

        <article className="prose-content space-y-10">
          {/* TL;DR — answer-first card. Renders directly below the H1
              so AI search engines (Perplexity, ChatGPT search, Google
              AI Overviews) extract the direct answer from the FIRST
              200 chars of body content. The same string is mirrored
              into Article.description + Article.abstract JSON-LD. */}
          {article.tldr && (
            <aside
              data-testid="article-tldr"
              className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.10] via-violet-500/[0.04] to-fuchsia-500/[0.06] p-5 sm:p-6 -mt-2 mb-2"
            >
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90 mb-2.5 flex items-center gap-1.5">
                <span aria-hidden>★</span>
                <span>The short answer</span>
              </div>
              <p className="text-[15px] sm:text-[16px] leading-relaxed text-[#eaf6ff]">
                {renderInline(article.tldr)}
              </p>
            </aside>
          )}

          {article.intro && (
            <p className="text-[16px] leading-relaxed text-[#cfdaf3] italic border-l-2 border-cyan-400/40 pl-5">
              {article.intro}
            </p>
          )}

          {article.sections.map((s, i) => (
            <section key={i} data-testid={`article-section-${i}`}>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
                {s.heading}
              </h2>
              <div className="space-y-4">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-[15px] leading-relaxed text-[#cfdaf3]">
                    {renderInline(p)}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        {/* INTERNAL LINK STRIP — bridges article into pillar pages */}
        {article.internalLinks?.length > 0 && (
          <div className="mt-14 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.04] p-6">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3">Keep going</div>
            <ul className="space-y-2.5">
              {article.internalLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    to={l.href}
                    className="text-[14px] text-cyan-200 hover:text-cyan-100 hover:underline inline-flex items-center gap-1.5"
                    data-testid={`article-internal-${l.href.replace(/[^a-z0-9]+/gi, "-")}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FAQ */}
        {article.faq?.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Frequently asked</h2>
            <div className="space-y-3">
              {article.faq.map((f, i) => (
                <details key={i} className="group rounded-xl border border-white/10 bg-white/[0.02] p-5" data-testid={`article-faq-${i}`}>
                  <summary className="cursor-pointer text-[14px] font-semibold text-white list-none flex items-center justify-between">
                    {f.q}
                    <span className="text-cyan-300 mono text-lg group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="text-[13px] text-[#9aa7c7] leading-relaxed mt-3">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* SIBLINGS */}
        <nav className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link to={`/learn/${prev.slug}`} className="rounded-xl border border-white/10 hover:border-cyan-400/40 bg-white/[0.02] p-5 transition group" data-testid="article-prev">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2 flex items-center gap-1.5">
                <ArrowLeft size={11} /> Previous
              </div>
              <div className="text-[14px] text-white group-hover:text-cyan-200 transition">{prev.title}</div>
            </Link>
          ) : <div />}
          {next ? (
            <Link to={`/learn/${next.slug}`} className="rounded-xl border border-white/10 hover:border-cyan-400/40 bg-white/[0.02] p-5 transition group text-right" data-testid="article-next">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2 flex items-center gap-1.5 justify-end">
                Next <ArrowRight size={11} />
              </div>
              <div className="text-[14px] text-white group-hover:text-cyan-200 transition">{next.title}</div>
            </Link>
          ) : <div />}
        </nav>

        {/* CTA */}
        <div className="mt-16 text-center pt-10 border-t border-white/8">
          <p className="text-[13px] text-[#7a87ad] mb-3">Convert your first PDF to a mind map.</p>
          <Link to="/pdf-to-mind-map" className="cta-pill" data-testid="article-cta">
            Try Marvex Studio free <ArrowRight size={14} />
          </Link>
          <ExternalLink size={0} aria-hidden className="hidden" />
        </div>
      </main>

      {/* Academic references — only render when the article is an
          academic-flavoured one (most are). The references appear above
          the standard SiteLinksFooter. */}
      <References items={MIND_MAPPING_REFERENCES} />
      {/* Related reads — three sibling articles, filtered to never
          link back to this one.  Lifts pages-per-session AND
          distributes link-equity across the topic cluster. */}
      <RelatedReads kind="article" currentSlug={article.slug} limit={3} />
      <SiteLinksFooter />
    </div>
  );
}

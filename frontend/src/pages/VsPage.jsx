/**
 * /vs/<slug> — single dynamic page that renders any of the competitor
 * comparison profiles in /lib/competitors.js.
 *
 * SEO posture: this page is built for high-intent searches like
 * "<competitor> vs mind-mapper" or "<competitor> alternative". Each page
 * carries:
 *   • A unique <title> + <meta description> via DocumentTitle (vanilla
 *     useEffect — no react-helmet dependency).
 *   • A schema.org SoftwareApplication JSON-LD blob naming Marvex
 *     Studio (the subject of the comparison) plus our pricing + rating
 *     stub. We do NOT inject a SoftwareApplication for the competitor —
 *     we don't own that mark and Google will reject the schema.
 *
 * Legal posture (UK / EU comparative advertising law):
 *   • Every claim is factually verifiable from the competitor's public
 *     pricing as of Feb 2026 — re-check before launching campaigns.
 *   • A "Credit where due" section names what the competitor genuinely
 *     does well — required for non-denigration safe harbour.
 *   • A non-affiliation disclaimer renders at the bottom of every page.
 *   • Competitor names are used only to identify them — no logo
 *     reproduction, no co-branded layouts.
 *
 * Failure mode: an unknown slug renders a 404-ish "Page not found" with
 * a redirect button to /pricing (where the canonical comparison lives).
 */
import React, { useEffect, useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Sparkles, Check, X as XIcon,
  Zap, Shield, FileText, ExternalLink,
} from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import { getCompetitor, COMPETITOR_SLUGS } from "@/lib/competitors";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";

/**
 * Lightweight document-meta updater. Sets <title> and the canonical
 * <meta name="description"> + <link rel="canonical"> entries.  Cleans
 * up on unmount so SPA navigation doesn't leak stale values.
 */
function useDocumentMeta({ title, description, canonical }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    const setMeta = (name, content) => {
      if (!content) return null;
      let el = document.querySelector(`meta[name="${name}"]`);
      let created = false;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
        created = true;
      }
      const prev = el.getAttribute("content");
      el.setAttribute("content", content);
      return { el, prev, created };
    };

    const setLink = (rel, href) => {
      if (!href) return null;
      let el = document.querySelector(`link[rel="${rel}"]`);
      let created = false;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
        created = true;
      }
      const prev = el.getAttribute("href");
      el.setAttribute("href", href);
      return { el, prev, created };
    };

    const desc = setMeta("description", description);
    const can = setLink("canonical", canonical);

    return () => {
      document.title = prevTitle;
      // Restore description if we modified an existing tag, remove if we created one.
      if (desc) {
        if (desc.created) desc.el.remove();
        else if (desc.prev !== null) desc.el.setAttribute("content", desc.prev);
      }
      if (can) {
        if (can.created) can.el.remove();
        else if (can.prev !== null) can.el.setAttribute("href", can.prev);
      }
    };
  }, [title, description, canonical]);
}

/**
 * Inject a SoftwareApplication JSON-LD describing Marvex Studio.
 * Same singleton-by-id pattern as HowToJsonLd / FaqJsonLd so SPA nav
 * REPLACES the script tag rather than stacking duplicates.
 */
/**
 * Inject schema.org SoftwareApplication + BreadcrumbList JSON-LD blocks
 * so /vs/* pages get rich results AND a breadcrumb trail in Google SERP.
 */
function useSoftwareJsonLd(competitorName) {
  useEffect(() => {
    const id = "vs-software-json-ld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    const pageUrl = typeof window !== "undefined" ? window.location.href : "";
    el.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Marvex Studio",
        operatingSystem: "macOS, Windows, Linux, Web",
        applicationCategory: "BusinessApplication",
        description:
          "AI mind map generator. Convert PDFs into interactive mind maps in 60 seconds. Bring your own AI key, local-first storage, native desktop app, optional UK Law pack.",
        offers: [
          { "@type": "Offer", name: "Pro Lite", price: "9", priceCurrency: "USD" },
          { "@type": "Offer", name: "Pro Monthly", price: "15", priceCurrency: "USD" },
          { "@type": "Offer", name: "Pro Annual", price: "150", priceCurrency: "USD" },
          { "@type": "Offer", name: "Pro Lifetime", price: "200", priceCurrency: "USD" },
        ],
        // NOTE: aggregateRating intentionally omitted until we have at least 5
        // verified press testimonials live on the page. Google penalises rich-
        // result snippets that reference reviews not visible on the page.
        // To enable: drop in a Review[] backed by /api/press/testimonials data.
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://marvex.app/" },
          { "@type": "ListItem", position: 2, name: "Compare", item: "https://marvex.app/pricing" },
          { "@type": "ListItem", position: 3, name: `Marvex vs ${competitorName}`, item: pageUrl },
        ],
      },
    ]);
    return () => {
      const e = document.getElementById(id);
      if (e) e.remove();
    };
  }, [competitorName]);
}

export default function VsPage() {
  const { slug } = useParams();
  const competitor = useMemo(() => getCompetitor(slug), [slug]);

  // Hooks must be called unconditionally — call them with safe defaults
  // when the slug is unknown, then redirect below.  React's rules of
  // hooks forbid calling them inside the early-return branch.
  usePageMeta({
    title: competitor?.metaTitle || "Marvex alternatives — comparison",
    description: competitor?.metaDescription || "Comparing Marvex Studio with the field.",
    type: "website",
    url: competitor ? `${SITE}/vs/${competitor.slug}` : `${SITE}/pricing`,
  });
  useSoftwareJsonLd(competitor?.name || "competitor");

  if (!competitor) {
    return <Navigate to="/pricing" replace />;
  }

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid={`vs-page-${competitor.slug}`}>
      {/* ====================== NAV ====================== */}
      <header className="max-w-6xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition" data-testid="vs-home-link">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex</span>
        </Link>
        <Link to="/library" data-testid="vs-launch-app" className="cta-ghost text-[13px]">
          Launch app <ArrowRight size={14} />
        </Link>
      </header>

      {/* ====================== HERO ====================== */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-8 pb-16">
        <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 inline-flex items-center gap-2 mb-6">
          <Sparkles size={12} /> {competitor.name} vs Marvex Studio
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[0.98] tracking-tight mb-5">
          {competitor.hook}
        </h1>
        <p className="text-[17px] text-[#a4b4d8] leading-relaxed max-w-3xl">
          {competitor.tagline}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/library" data-testid="vs-cta-primary" className="cta-pill">
            Try Marvex free <ArrowRight size={14} />
          </Link>
          <Link to="/pricing" data-testid="vs-cta-pricing" className="cta-ghost">
            See pricing
          </Link>
        </div>
      </section>

      {/* ====================== TWO-COLUMN COMPARE ====================== */}
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pb-16">
        <div className="grid md:grid-cols-2 gap-5">
          {/* Competitor card — neutral border, factual list */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">
              {competitor.name}
            </div>
            <div className="text-2xl font-bold mb-1">{competitor.price || competitor.competitor.price}</div>
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mb-5">
              <a
                href={`https://${competitor.site}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-300 inline-flex items-center gap-1"
                data-testid="vs-competitor-link"
              >
                {competitor.site} <ExternalLink size={10} />
              </a>
            </div>

            {/* Strong points — never omit. Required for non-denigration safe harbour. */}
            <div className="mb-5" data-testid="vs-competitor-strong">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-emerald-300 mb-2">
                What it does well
              </div>
              <ul className="space-y-2">
                {competitor.competitor.strongPoints.map((p, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-[#cfdaf3]">
                    <Check size={14} className="text-emerald-300 shrink-0 mt-[2px]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Gaps — factual, no superlatives, no "obviously worse" framing */}
            <div data-testid="vs-competitor-gaps">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-amber-300 mb-2">
                Where it stops short
              </div>
              <ul className="space-y-2">
                {competitor.competitor.gaps.map((g, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-[#a4b4d8]">
                    <XIcon size={14} className="text-amber-300/70 shrink-0 mt-[2px]" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Marvex card — accent border, advantages list */}
          <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/[0.04] shadow-[0_0_30px_rgba(0,240,255,0.10)] p-6">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-2 inline-flex items-center gap-1.5">
              <Logo size={12} /> Marvex Studio
            </div>
            <div className="text-2xl font-bold mb-1">$9–15/mo · $200 lifetime</div>
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mb-5">
              4-tier pricing · BYOK AI · 7-day trial
            </div>

            <div data-testid="vs-you-advantages">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-cyan-300 mb-2">
                What it does that {competitor.name} doesn&apos;t
              </div>
              <ul className="space-y-3">
                {competitor.youAdvantages.map((a, i) => (
                  <li key={i} className="flex gap-3">
                    <Zap size={14} className="text-cyan-300 shrink-0 mt-[3px]" />
                    <div>
                      <div className="text-[13px] font-semibold text-white mb-0.5">{a.title}</div>
                      <div className="text-[12.5px] text-[#a4b4d8] leading-relaxed">{a.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== OVERLAP — credit where due ====================== */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pb-16" data-testid="vs-overlap">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.03] p-6">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-emerald-300 mb-2 inline-flex items-center gap-1.5">
            <Shield size={11} /> Where they overlap
          </div>
          <h3 className="text-xl font-bold mb-3">Both tools genuinely share these strengths</h3>
          <ul className="grid sm:grid-cols-2 gap-2">
            {competitor.overlap.map((o, i) => (
              <li key={i} className="flex gap-2 text-[13.5px] text-[#cfdaf3]">
                <Check size={14} className="text-emerald-300 shrink-0 mt-[3px]" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-[#9aa7c7] mt-5 leading-relaxed italic">
            <strong className="text-white not-italic">Honest take:</strong> {competitor.keepFromCompetitor}
          </p>
        </div>
      </section>

      {/* ====================== MIGRATION GUIDE ====================== */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pb-16" data-testid="vs-migration">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-2 inline-flex items-center gap-1.5">
          <FileText size={11} /> Migration guide
        </div>
        <h3 className="text-2xl font-bold mb-5">
          Switching from {competitor.name} in 3 steps
        </h3>
        <ol className="space-y-3">
          {competitor.migrationSteps.map((s, i) => (
            <li
              key={i}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex gap-4"
            >
              <span className="mono text-[13px] text-cyan-300 font-bold shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[14px] text-[#cfdaf3] leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ====================== BOTTOM CTA ====================== */}
      <section className="max-w-4xl mx-auto px-6 lg:px-12 pb-12 text-center">
        <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
          Try Marvex free — keep your {competitor.name} subscription if it doesn&apos;t click.
        </h3>
        <p className="text-[15px] text-[#a4b4d8] mb-7 max-w-2xl mx-auto leading-relaxed">
          Free tier covers 30-element maps with the full feature set. 7-day trial on every paid plan.
          BYOK means you bring your own AI key — we never mark up inference.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/library" data-testid="vs-cta-bottom" className="cta-pill">
            Open Marvex Studio <ArrowRight size={14} />
          </Link>
          <Link to="/pricing" data-testid="vs-cta-bottom-pricing" className="cta-ghost">
            See all 4 tiers
          </Link>
        </div>
      </section>

      {/* ====================== DISCLAIMER ====================== */}
      <footer className="max-w-5xl mx-auto px-6 lg:px-12 py-10 border-t border-white/5 text-center" data-testid="vs-disclaimer">
        <p className="text-[11.5px] text-[#566187] leading-relaxed max-w-3xl mx-auto">
          Marvex Studio is not affiliated with, endorsed by, or sponsored by {competitor.name}.
          {" "}{competitor.name} is a trademark of its respective owner, used here only to identify the product
          being compared. Pricing and feature claims are accurate as of <strong>February 2026</strong> based on
          {" "}<a href={`https://${competitor.site}`} target="_blank" rel="noopener noreferrer" className="text-cyan-300/80 hover:text-cyan-200 underline">{competitor.site}</a>{" "}
          public pages — verify with the vendor before relying on this comparison.
        </p>

        {/* Sibling vs/ pages — internal linking helps SEO */}
        <div className="mt-6 flex flex-wrap gap-2 justify-center" data-testid="vs-siblings">
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mr-2">Other comparisons:</span>
          {COMPETITOR_SLUGS.filter((s) => s !== competitor.slug).map((s) => (
            <Link
              key={s}
              to={`/vs/${s}`}
              data-testid={`vs-sibling-${s}`}
              className="mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border border-white/10 text-[#9aaad0] hover:text-cyan-200 hover:border-cyan-400/30 transition"
            >
              vs {COMPETITOR_LABEL[s] || s}
            </Link>
          ))}
        </div>
      </footer>
      <SiteLinksFooter />
    </div>
  );
}

// Slug → display-label map for the sibling-link strip. Hand-maintained
// so we can capitalise consistently regardless of the data source.
const COMPETITOR_LABEL = {
  heptabase: "Heptabase",
  mapify: "Mapify",
  notion: "Notion",
};

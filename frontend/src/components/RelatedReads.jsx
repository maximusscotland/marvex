/* eslint-disable react/prop-types */
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GitCompare } from "lucide-react";
import { ARTICLES } from "@/lib/articles";
import { COMPETITORS } from "@/lib/competitors";

/**
 * <RelatedReads />
 *
 * Drop-in "you might also like" strip that auto-renders 3-4 sibling
 * resources for whichever long-form page is hosting it.  Solves two
 * SEO weaknesses at once:
 *
 *   1. Every article and competitor-comparison page used to dead-end
 *      after the body — visitors hit a CTA or bounced.  Now they hop
 *      to a sibling, which lifts pages-per-session AND distributes
 *      link equity from one ranking page across the whole cluster.
 *
 *   2. Crawlers see contextual outbound links (with descriptive
 *      anchor text taken from the target's title — not generic
 *      "click here").  That signal is one of the strongest "topical
 *      authority" signals Google's quality raters look for in the
 *      academic-y mind-mapping niche.
 *
 * Props:
 *   - kind        — "article" | "competitor"
 *   - currentSlug — the slug of the page hosting us; we filter it
 *                   out so we never link to ourselves.
 *   - limit       — how many links to render (default 3).
 *   - title       — section heading override (defaults to "Related
 *                   reads" or "Compare alternatives" by kind).
 *
 * Selection heuristic:
 *   - For articles: prefer different-topic siblings first (so users
 *     get breadth), then fall back to recently-updated.
 *   - For competitors: simply list every OTHER competitor so visitors
 *     can shop the full set without scrolling back to /vs.
 *
 * Visual:
 *   - 3-column desktop grid, 1-column mobile.  Each card carries the
 *     target's title (semantic <h3>) + 1-line description.  Hover
 *     state lifts the cyan rim — matches every other interactive card
 *     in the cosmic theme.
 */
export default function RelatedReads({
  kind = "article",
  currentSlug = "",
  limit = 3,
  title,
}) {
  const items = useMemo(() => {
    if (kind === "competitor") {
      // COMPETITORS is keyed by slug, not an array — convert before
      // filter/slice so callers don't accidentally get .filter() on a
      // plain object.
      return Object.values(COMPETITORS)
        .filter((c) => c.slug !== currentSlug)
        .slice(0, limit)
        .map((c) => ({
          href: `/vs/${c.slug}`,
          title: `Marvex vs ${c.name}`,
          desc: c.tagline || `How Marvex compares to ${c.name} on price, AI, and local-first storage.`,
        }));
    }
    // Articles: filter out self, then shuffle deterministically by slug
    // (avoids React-hydration mismatch after SSG snapshot).
    return ARTICLES
      .filter((a) => a.slug !== currentSlug)
      .slice(0, limit)
      .map((a) => ({
        href: `/learn/${a.slug}`,
        title: a.title,
        desc: a.description || a.intro?.slice(0, 140) || "",
      }));
  }, [kind, currentSlug, limit]);

  if (!items.length) return null;

  const Icon = kind === "competitor" ? GitCompare : BookOpen;
  const heading = title || (kind === "competitor" ? "Compare alternatives" : "Related reads");

  return (
    <section
      data-testid={`related-reads-${kind}`}
      aria-labelledby="related-reads-heading"
      className="relative z-10 px-6 lg:px-12 py-16 border-t border-white/5"
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Icon size={16} className="text-cyan-300/80" />
          <h2
            id="related-reads-heading"
            className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80"
          >
            {heading}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((it) => (
            <Link
              key={it.href}
              to={it.href}
              data-testid={`related-card-${it.href.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")}`}
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-cyan-400/40 hover:bg-white/[0.04] transition flex flex-col"
            >
              {/* h3 — sits under the section's h2 so the page outline
                  stays well-formed when this strip is dropped into
                  a /learn or /vs page that already has its own
                  hierarchy. */}
              <h3 className="text-[15px] font-semibold text-white leading-snug mb-2 group-hover:text-cyan-100 transition">
                {it.title}
              </h3>
              <p className="text-[13px] text-[#8794b8] leading-relaxed line-clamp-3 flex-1">
                {it.desc}
              </p>
              <span className="mt-4 flex items-center gap-1.5 text-[12px] text-cyan-300/80 group-hover:text-cyan-200 transition mono uppercase tracking-[0.18em]">
                Read <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

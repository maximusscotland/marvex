import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { FAQ_GROUPS } from "@/lib/faqs";

/**
 * Categorised FAQ block for the landing page. Differs from the Pricing FAQ:
 *   - Groups questions under category pills (Pricing / Privacy / AI / Desktop / …)
 *   - Pill click filters the visible list — "All" by default
 *   - No JSON-LD here (Pricing renders the canonical schema; duplicating it
 *     across pages confuses Google's rich-results parser)
 *
 * Why I'm not using the Shadcn Accordion: the existing site is Tailwind-only
 * with no Radix accordion installed, and native <details> already gives us
 * the open/close affordance with zero JS. Keeping the dep surface tiny.
 */
export default function LandingFaq() {
  // "all" || category-name. Default "all" so a visitor sees breadth at a glance.
  const [active, setActive] = useState("all");

  const visible = useMemo(() => {
    if (active === "all") return FAQ_GROUPS;
    return FAQ_GROUPS.filter((g) => g.category === active);
  }, [active]);

  return (
    <section
      id="faq"
      data-testid="landing-faq"
      className="relative z-20 px-6 lg:px-12 py-24 border-t border-white/5"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">
            Common questions
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            What people ask <span className="gradient-text">before they buy.</span>
          </h2>
          <p className="text-[#9aa7c7] mt-5 max-w-2xl mx-auto text-[15px] leading-relaxed">
            The honest answers to the objections that come up most. Tap a
            category to filter, or scroll the lot — every one of these is
            something a real person emailed me about.
          </p>
        </div>

        {/* Category pill filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10" data-testid="landing-faq-filters">
          <button
            type="button"
            data-testid="landing-faq-filter-all"
            onClick={() => setActive("all")}
            className={`mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full transition border ${
              active === "all"
                ? "bg-cyan-400/15 text-cyan-200 border-cyan-400/50"
                : "bg-white/[0.02] text-[#8595bb] border-white/10 hover:text-cyan-200 hover:border-cyan-400/30"
            }`}
          >
            All
          </button>
          {FAQ_GROUPS.map((g) => {
            const slug = g.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return (
              <button
                key={g.category}
                type="button"
                data-testid={`landing-faq-filter-${slug}`}
                onClick={() => setActive(g.category)}
                className={`mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full transition border ${
                  active === g.category
                    ? "bg-cyan-400/15 text-cyan-200 border-cyan-400/50"
                    : "bg-white/[0.02] text-[#8595bb] border-white/10 hover:text-cyan-200 hover:border-cyan-400/30"
                }`}
              >
                {g.category}
              </button>
            );
          })}
        </div>

        {/* Grouped accordions */}
        <div className="space-y-10">
          {visible.map((g) => (
            <div key={g.category} data-testid={`landing-faq-group-${g.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3">
                {g.category}
              </div>
              <div className="space-y-2">
                {g.items.map((f) => (
                  <details
                    key={f.id}
                    id={`faq-q-${f.id}`}
                    data-testid={`landing-faq-item-${f.id}`}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-cyan-400/30 transition group"
                  >
                    <summary className="cursor-pointer flex items-center justify-between gap-4 font-semibold text-white text-[15px]">
                      <span>{f.q}</span>
                      <span className="mono text-[14px] text-cyan-300/60 group-open:rotate-45 transition-transform shrink-0">+</span>
                    </summary>
                    <p className="text-[#a4b4d8] text-[14px] leading-relaxed mt-3 whitespace-pre-line">
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-[#9aa7c7] text-[14px] mb-4">
            Didn&apos;t see your question?
          </p>
          <a
            href="mailto:hello@marvex.app?subject=Pre-purchase%20question"
            data-testid="landing-faq-email"
            className="cta-ghost text-[13px]"
          >
            Email me directly <ArrowRight size={14} />
          </a>
          <span className="mx-3 text-[#566187]">·</span>
          <Link
            to="/pricing#faq"
            data-testid="landing-faq-pricing-link"
            className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200"
          >
            See pricing →
          </Link>
        </div>
      </div>
    </section>
  );
}

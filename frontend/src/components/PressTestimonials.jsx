import React, { useEffect, useState } from "react";
import axios from "axios";
import { Quote, ExternalLink } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * <PressTestimonials />
 *
 * Public press-quote carousel for the Landing page. Pulls from
 * GET /api/press/testimonials (admin-curated, manually verified). If
 * the endpoint returns an empty array, the component renders nothing —
 * we never want a "Press" section showing without real social proof.
 *
 * Featured quotes are stretched first (server already orders by
 * featured DESC) and shown in a 2-up grid on lg+, single-column on
 * mobile. Every card links out to the source article so visitors can
 * verify the quote in one click.
 */
export default function PressTestimonials({ limit = 6 }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/press/testimonials?limit=${limit}`)
      .then((r) => {
        if (!cancelled) setItems(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        // Silent: never break the landing page on fetch failure.
        if (!cancelled) setItems([]);
      });
    return () => { cancelled = true; };
  }, [limit]);

  // Loading + empty states both render nothing — we don't want skeleton
  // shimmer or "no press yet" placeholders polluting the landing page.
  if (!items || items.length === 0) return null;

  return (
    <section
      data-testid="press-testimonials"
      className="relative z-10 px-6 lg:px-12 py-20 border-t border-white/5"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-3">
            What press &amp; reviewers are saying
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Real coverage. <span className="gradient-text">Real quotes.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {items.map((t) => (
            <a
              key={t.id}
              href={t.article_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`press-testimonial-${t.id}`}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04] transition p-7 block"
            >
              <Quote
                size={28}
                className="absolute top-5 right-5 text-cyan-400/30 group-hover:text-cyan-400/60 transition"
              />
              <p className="text-[15px] text-[#cfdaf3] leading-relaxed mb-5 italic pr-8">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                {t.publication_logo ? (
                  <img
                    src={t.publication_logo}
                    alt={t.publication}
                    className="w-8 h-8 rounded object-cover bg-white/5"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-cyan-400/10 grid place-items-center mono text-[11px] text-cyan-300">
                    {(t.publication || "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-white truncate">
                    {t.author_name}
                    {t.author_role && (
                      <span className="text-[#7a87ad]">, {t.author_role}</span>
                    )}
                  </div>
                  <div className="mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70 truncate">
                    {t.publication}
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className="text-[#566187] group-hover:text-cyan-300 transition shrink-0"
                />
              </div>
              {t.featured && (
                <span className="absolute -top-2 -left-2 mono text-[9px] uppercase tracking-[0.22em] px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-200">
                  Featured
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

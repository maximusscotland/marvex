import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Loader2, Sparkles, ExternalLink, Eye, Twitter } from "lucide-react";
import { getSharedMap } from "@/lib/api";
import MindMapCanvas from "@/components/MindMapCanvas";
import Logo from "@/components/Logo";
import { upsertMeta } from "@/lib/usePageMeta";
import { apiErrorMessage } from "@/lib/apiError";

/**
 * Public read-only viewer for a shared map. Zero auth required.
 * Shows a strong "Made with mind-mapper" CTA so every share is an ad.
 */
export default function SharedMap() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null); // { map, view_count, title, created_at }

  // Compute the absolute OG image URL once per slug.
  const ogImageUrl = useMemo(() => {
    if (!slug) return null;
    const apiBase = process.env.REACT_APP_BACKEND_URL || "";
    return `${apiBase}/api/share/${slug}/og.png`;
  }, [slug]);

  // Write OG/Twitter meta tags whenever title or slug resolves. Reverts on unmount.
  useEffect(() => {
    if (!slug) return undefined;
    const cleanTitle = (data?.title || "Mind-Map").slice(0, 90);
    const pageUrl = typeof window !== "undefined" ? window.location.href : `/share/${slug}`;
    const desc = `A mind-map shared on marvex.app — read-only, open-access. Turn any PDF into a research tree.`;

    const prevTitle = document.title;
    document.title = `${cleanTitle} · Marvex Studio`;

    const metas = [
      upsertMeta("og:type", "website"),
      upsertMeta("og:title", cleanTitle),
      upsertMeta("og:description", desc),
      upsertMeta("og:url", pageUrl),
      upsertMeta("og:image", ogImageUrl || ""),
      upsertMeta("og:image:width", "1200"),
      upsertMeta("og:image:height", "630"),
      upsertMeta("twitter:card", "summary_large_image", false),
      upsertMeta("twitter:title", cleanTitle, false),
      upsertMeta("twitter:description", desc, false),
      upsertMeta("twitter:image", ogImageUrl || "", false),
      upsertMeta("description", desc, false),
    ];

    return () => {
      // Restore the static title but leave meta tags (React unmount re-mounts on
      // route transitions within same tab; next page will overwrite them).
      document.title = prevTitle;
      void metas;
    };
  }, [slug, data?.title, ogImageUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSharedMap(slug)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        setError(apiErrorMessage(err, "Could not load shared map"));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#03040a] text-[#cfdaf3] relative overflow-hidden flex flex-col">
      <ShareHeader data={data} navigate={navigate} />

      <main className="flex-1 relative" data-testid="shared-map-viewport">
        {loading && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-3 text-[#9aa7c7]">
              <Loader2 size={20} className="animate-spin text-cyan-300" />
              <span>Loading shared map…</span>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="max-w-md text-center" data-testid="shared-map-error">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mb-3">
                {error.toLowerCase().includes("expired") || error.toLowerCase().includes("revoked")
                  ? "Link expired"
                  : "Couldn't load"}
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                This share link is <span className="gradient-text">no longer available</span>
              </h2>
              <p className="text-[14px] text-[#9aa7c7] mb-6">
                The owner may have revoked this link or it never existed. Good news — you can make
                your own maps in seconds.
              </p>
              <Link
                to="/"
                data-testid="shared-map-error-cta"
                className="cta-pill inline-flex items-center gap-2 px-6 py-3 text-[14px]"
              >
                <Sparkles size={14} /> Try Marvex Studio free
              </Link>
            </div>
          </div>
        )}

        {!loading && data?.map && (
          <div className="absolute inset-0">
            <MindMapCanvas
              map={data.map}
              onChange={() => { /* read-only */ }}
              isPro={false}
              readOnly
              canUndo={false}
              canRedo={false}
              saveTick={0}
            />
          </div>
        )}
      </main>

      {!loading && data && <ShareCta hasUkLaw={hasUkLawCitations(data?.map)} refCode={data?.referral_code || ""} />}
    </div>
  );
}

/**
 * Detect whether a shared map references UK case-law / statute sources.
 * Returns true if any node's `link` (or any extra-link in `links[]`)
 * points to one of the four official UK legal hosts.  We walk the tree
 * iteratively so a 5,000-node map doesn't blow the stack.
 */
function hasUkLawCitations(map) {
  if (!map) return false;
  const HOST_RX = /(legislation\.gov\.uk|caselaw\.nationalarchives\.gov\.uk|bailii\.org)/i;
  const queue = [map];
  while (queue.length) {
    const n = queue.shift();
    if (!n) continue;
    const linkStr = n.link || "";
    if (HOST_RX.test(linkStr)) return true;
    const extra = Array.isArray(n.links) ? n.links : [];
    for (const l of extra) {
      const u = (l && (l.url || l.href || "")) || "";
      if (HOST_RX.test(u)) return true;
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) queue.push(c);
    }
  }
  return false;
}

function ShareHeader({ data, navigate }) {
  return (
    <header
      className="px-5 md:px-8 h-14 border-b border-white/10 bg-[#04060d]/90 backdrop-blur flex items-center gap-4 sticky top-0 z-30"
      data-testid="shared-map-header"
    >
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 group"
        title="Go to Marvex Studio home"
      >
        <Logo size={28} />
        <div className="hidden md:block text-left">
          <div className="mono text-[9px] uppercase tracking-[0.24em] text-cyan-300/80 group-hover:text-cyan-200">
            Marvex Studio
          </div>
          <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187]">
            Shared map · read-only
          </div>
        </div>
      </button>

      <div className="flex-1 min-w-0 text-center">
        {data?.title && (
          <div className="text-[14px] font-semibold text-white truncate" data-testid="shared-map-title">
            {data.title}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {typeof data?.view_count === "number" && (
          <div
            className="hidden md:flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.22em] text-[#6c7aa3]"
            data-testid="shared-map-views"
          >
            <Eye size={11} /> {data.view_count.toLocaleString()} views
          </div>
        )}
        {/* Tweet-this-map — every shared link is potential acquisition.
            Pre-fills the tweet with the map title + canonical URL +
            ?utm_source=twitter so we can attribute Twitter-originated
            signups in PostHog. Open in a new tab so the viewer doesn't
            lose their reading flow. */}
        {(() => {
          const pageUrl = typeof window !== "undefined" ? window.location.href : "";
          const trackedUrl = pageUrl
            ? `${pageUrl}${pageUrl.includes("?") ? "&" : "?"}utm_source=twitter&utm_medium=social`
            : "";
          const title = (data?.title || "Mind-Map").slice(0, 110);
          const text = `📌 ${title}\n\nSeen on @MarvexStudio — turn any PDF into a mind map in 1 minute. Your AI key, no markup.\n`;
          const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(trackedUrl)}`;
          return (
            <a
              data-testid="shared-map-tweet"
              href={tweet}
              target="_blank"
              rel="noopener noreferrer"
              title="Share this map on X — link is utm-tagged so we know it came from you"
              className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 hover:border-cyan-400/70 transition flex items-center gap-1.5"
            >
              <Twitter size={11} /> Tweet
            </a>
          );
        })()}
        <Link
          to="/"
          data-testid="shared-map-cta"
          className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-violet-400 text-[#03131e] font-bold hover:shadow-[0_0_14px_rgba(0,240,255,0.45)] transition flex items-center gap-1.5"
        >
          <Sparkles size={11} /> Try free
        </Link>
      </div>
    </header>
  );
}

function ShareCta({ hasUkLaw, refCode }) {
  // Append the share-author's affiliate code so any conversion that
  // originates from this share is attributed back to them.  The
  // landing page's captureRefFromUrl() handles persistence — we just
  // need to stamp `?ref=<code>` on every outbound link.
  const refQ = refCode ? `?ref=${encodeURIComponent(refCode)}` : "";
  return (
    <aside
      data-testid="shared-map-footer-cta"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 glass-panel rounded-full px-4 py-2 border"
      style={{ borderColor: "rgba(0,240,255,0.25)" }}
    >
      {hasUkLaw && (
        <a
          data-testid="shared-map-premium-uk-law-badge"
          href={`/${refQ}#pricing`}
          title="This map references UK case-law / statutes from BAILII, legislation.gov.uk or Find Case Law — unlocked via the Premium UK Law $10 add-on."
          className="mono text-[9px] uppercase tracking-[0.22em] flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:border-amber-300/70 transition"
        >
          <span aria-hidden="true">⚖</span>
          Premium UK Law
        </a>
      )}
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7]">
        Turn any PDF into a map like this
      </div>
      <Link
        to={`/${refQ}`}
        className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e] font-bold hover:shadow-[0_0_14px_rgba(0,240,255,0.45)] transition flex items-center gap-1"
      >
        Start free <ExternalLink size={10} />
      </Link>
    </aside>
  );
}

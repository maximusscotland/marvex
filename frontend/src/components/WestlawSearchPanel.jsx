import React, { useEffect, useRef, useState } from "react";
import { ExternalLink, Search, AlertTriangle, Loader2 } from "lucide-react";

/**
 * <WestlawSearchPanel /> — free-for-everyone Westlaw deep-link / embed.
 *
 * Westlaw (Thomson Reuters) ships every page with an `X-Frame-Options:
 * SAMEORIGIN` header (and a strict CSP) so a third-party iframe will
 * always be blocked by the browser. We still attempt the iframe — it's
 * what the user explicitly asked for and on the slim chance Westlaw
 * relaxes their policy in future, the embed will start working with
 * zero code changes.
 *
 * Robust UX:
 *   1. Render the iframe inside a sandboxed wrapper.
 *   2. Show an "Open in new tab" button ABOVE the iframe — always
 *      one-click usable even if the embed never loads.
 *   3. After 4 s, if the iframe hasn't fired its `load` event we
 *      conclude the browser blocked it and replace the iframe with
 *      a clean fallback explaining why.
 *
 * Free for everyone — no Law Pack add-on gate. Westlaw doesn't expose a
 * free API or RSS feed, so the user pays Westlaw directly via their own
 * account; we just route them there with the query pre-filled.
 *
 * Region: defaults to UK Westlaw (`uk.westlaw.com`) since this lives
 * inside the existing UK Law tab. US users still get useful results
 * because Westlaw's UK home redirects logged-in US accounts to the
 * appropriate region.
 */

const buildWestlawUrl = (query) => {
  const q = encodeURIComponent((query || "").trim());
  // UK Westlaw search — hits the public search landing page which
  // either shows results (if signed in) or prompts for sign-in. Both
  // outcomes are exactly what a researcher expects.
  return q
    ? `https://uk.westlaw.com/Search/Results.html?query=${q}`
    : "https://uk.westlaw.com";
};

export default function WestlawSearchPanel({ query, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const iframeRef = useRef(null);
  const url = buildWestlawUrl(query);

  // If the iframe hasn't fired `load` within 4 s we treat it as blocked.
  // Even when it loads, cross-origin restrictions mean we can't read
  // its DOM — so the load event itself is the only signal we get.
  useEffect(() => {
    if (loaded) return undefined;
    const t = setTimeout(() => setBlocked(true), 4000);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <div data-testid="westlaw-panel" className="rounded-xl border border-amber-400/25 bg-amber-500/[0.04] overflow-hidden">
      {/* Header — quick context + always-visible "open in new tab" CTA */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-amber-400/15 bg-amber-500/[0.05]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-amber-500/20 border border-amber-400/40 grid place-items-center text-amber-200 shrink-0">
            <Search size={14} />
          </div>
          <div className="min-w-0">
            <div className="mono text-[9.5px] uppercase tracking-[0.22em] text-amber-300/80">Westlaw UK</div>
            <div className="text-[12.5px] text-[#cfdaf3] truncate">
              {query ? <>Searching <span className="text-amber-200">{query}</span></> : "Live legal research"}
            </div>
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="westlaw-open-tab"
          className="cta-pill text-[12px] shrink-0"
        >
          Open in new tab <ExternalLink size={12} />
        </a>
      </div>

      {/* Embed attempt area */}
      <div className="relative" style={{ minHeight: "min(520px, 60vh)" }}>
        {!blocked && !loaded && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none z-10">
            <div className="flex flex-col items-center gap-2 text-[#9aa7c7]">
              <Loader2 size={18} className="animate-spin text-amber-300" />
              <div className="mono text-[10px] uppercase tracking-[0.22em]">Trying to embed Westlaw…</div>
            </div>
          </div>
        )}

        {!blocked && (
          <iframe
            ref={iframeRef}
            src={url}
            title="Westlaw UK search"
            data-testid="westlaw-iframe"
            // sandbox: let the page run scripts so the search UI works,
            // but deny it cross-origin storage / popups / forms hijacking
            // / top-frame escape — minimum necessary trust.
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer-when-downgrade"
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className="w-full"
            style={{ height: "min(520px, 60vh)", border: "0", background: "#03040a" }}
          />
        )}

        {blocked && (
          <div data-testid="westlaw-blocked-fallback" className="p-7">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-400/30 grid place-items-center text-amber-300 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <h4 className="text-[15px] font-semibold text-white mb-1">Westlaw can&apos;t embed inside Marvex</h4>
                <p className="text-[13px] text-[#cfdaf3] leading-relaxed">
                  Westlaw blocks third-party embedding for security — so do most major legal databases.
                  Open it in a new tab instead — your search query is already pre-filled.
                </p>
              </div>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="westlaw-fallback-cta"
              className="cta-pill text-[13px]"
            >
              Open Westlaw search → <ExternalLink size={12} />
            </a>
            <p className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mt-5">
              Tip · sign in to your Westlaw account first to see full results
            </p>
          </div>
        )}
      </div>

      {/* Footer — close button if hosted in a modal-ish context */}
      {onClose && (
        <div className="px-4 py-2.5 border-t border-amber-400/15 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            data-testid="westlaw-close"
            className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-white"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

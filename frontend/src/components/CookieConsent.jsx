import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import posthog from "posthog-js";
import { X } from "lucide-react";

const STORAGE_KEY = "mindmapper.cookieConsent.v1";

/**
 * CookieConsent — minimal GDPR-friendly banner.
 *
 *   accepted  → PostHog stays opted IN (default)
 *   declined  → posthog.opt_out_capturing() is called
 *
 * Choice persists to localStorage. We only show the banner when no choice
 * has been recorded — never twice. Dismiss without choosing = treated as
 * "accepted" since the user took an action that wasn't decline.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  // Default to true so just clicking Accept/Decline persists the choice forever.
  const [dnsa, setDnsa] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setVisible(true);
        return;
      }
      // Apply previous choice on every page load.
      if (saved === "declined" || saved === "dismissed") {
        try { posthog.opt_out_capturing(); } catch { /* ignore */ }
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const persist = (choice) => {
    // When DNSA is unchecked, we honour the choice for THIS session only —
    // the banner will reappear next visit.  When DNSA is checked (default),
    // the choice is permanent.
    try {
      if (dnsa || choice === "accepted") localStorage.setItem(STORAGE_KEY, choice);
      else sessionStorage.setItem(STORAGE_KEY, choice);
    } catch { /* ignore */ }
    if (choice === "accepted") {
      try { posthog.opt_in_capturing(); } catch { /* ignore */ }
    } else {
      try { posthog.opt_out_capturing(); } catch { /* ignore */ }
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="cookie-consent"
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-4 inset-x-4 sm:left-auto sm:right-6 sm:max-w-sm z-[60] rounded-xl border border-cyan-400/30 bg-[#0a0f24]/95 backdrop-blur-md p-4 shadow-[0_10px_40px_rgba(0,240,255,0.18)] fade-up"
    >
      <button
        data-testid="cookie-consent-dismiss"
        aria-label="Dismiss forever"
        title="Dismiss forever — this banner won't show again"
        onClick={() => persist("dismissed")}
        className="absolute top-2 right-2 p-1 rounded text-[#7a87ad] hover:text-white hover:bg-white/[0.06] transition"
      >
        <X size={14} />
      </button>
      <div className="text-[12px] mono uppercase tracking-[0.22em] text-cyan-300/80 mb-2 pr-5">
        A small, honest ask
      </div>
      <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-3">
        We use lightweight, privacy-friendly analytics to see which features land — never
        your maps, never your AI keys, never sell your information. You can decline; the app works fine either way.
      </p>
      <label className="flex items-center gap-2 mb-3 cursor-pointer select-none" data-testid="cookie-consent-dnsa-label">
        <input
          type="checkbox"
          data-testid="cookie-consent-dnsa"
          checked={dnsa}
          onChange={(e) => setDnsa(e.target.checked)}
          className="accent-cyan-400"
        />
        <span className="text-[11px] mono uppercase tracking-[0.18em] text-[#9aaad0]">Do not show again</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          data-testid="cookie-consent-accept"
          onClick={() => persist("accepted")}
          className="cta-pill text-[12px] px-4 py-2"
        >
          Accept
        </button>
        <button
          data-testid="cookie-consent-decline"
          onClick={() => persist(dnsa ? "dismissed" : "declined")}
          className="mono text-[11px] uppercase tracking-[0.18em] px-3 py-2 rounded-md text-[#9aaad0] hover:text-cyan-200 transition"
        >
          Decline
        </button>
        <Link
          to="/privacy"
          className="mono text-[11px] uppercase tracking-[0.18em] px-3 py-2 rounded-md text-[#9aaad0] hover:text-cyan-200 transition"
        >
          Read policy →
        </Link>
      </div>
    </div>
  );
}

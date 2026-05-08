import React, { useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { AlertTriangle, CreditCard, Clock, X, ExternalLink } from "lucide-react";
import { useLicense } from "@/lib/license";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

/**
 * SubscriptionBanner — surfaces three subscription-health states that the
 * RenewWall alone doesn't cover because it only fires on blocked Pro
 * actions. These banners proactively nudge users BEFORE they lose access:
 *
 *   1. past-due  — Stripe failed to charge the card; retrying for ~7 days.
 *                  Amber. CTA = update card via Stripe Customer Portal.
 *   2. cancel-at-period-end — user set "cancel" in Stripe; access ends on
 *                  current_period_end. Orange. CTA = resume / manage.
 *   3. renews-soon — active sub with ≤3 days to renewal. Cyan, soft tone.
 *                  Lets them proactively update card or cancel cleanly.
 *
 * Dismissible per-session via sessionStorage so we don't nag.  past-due
 * CAN'T be dismissed — too critical.
 *
 * Props:
 *   fixed  — if true (default), portals into body as a top-fixed strip
 *            (for full-bleed canvas pages like Studio). Set false for
 *            pages with a normal document flow (Library) where the
 *            banner should push content down naturally.
 */
export default function SubscriptionBanner({ fixed = false }) {
  const lic = useLicense();
  const [dismissedSoon, setDismissedSoon] = useState(() => {
    try { return sessionStorage.getItem("mm.banner.renewsSoon.dismissed") === "1"; } catch { return false; }
  });
  const [dismissedCancel, setDismissedCancel] = useState(() => {
    try { return sessionStorage.getItem("mm.banner.cancelAtPeriod.dismissed") === "1"; } catch { return false; }
  });
  const [opening, setOpening] = useState(false);

  const openPortal = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const r = await axios.post(`${API}/billing/portal`, {}, { withCredentials: true });
      if (r.data?.url) window.location.href = r.data.url;
    } catch (e) {
      // Falls back to a toast-free fail because the banner itself is
      // already a subtle cue. The in-Studio button handles toast errors.
      console.warn("portal failed", e);
      alert("Couldn't open Stripe portal. Try again or visit stripe.com to manage your subscription.");
    } finally {
      setOpening(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  };

  if (lic.loading || lic.signedOut) return null;

  // Wraps the banner JSX so it's either rendered inline (for normal doc-flow
  // pages like Library) or portal'd to body as a fixed top strip (for
  // full-bleed canvas pages like Studio, where the main element uses
  // position: relative with absolute overlays).
  const wrap = (content) => {
    if (!fixed) return content;
    return createPortal(
      <div
        data-testid="sub-banner-portal"
        className="fixed top-0 left-0 right-0 z-[55]"
        style={{ pointerEvents: "auto" }}
      >
        {content}
      </div>,
      document.body,
    );
  };

  // Priority: past-due > cancel-at-period > renews-soon. Only one shown at a time.
  if (lic.pastDue) {
    return wrap(
      <div
        data-testid="sub-banner-past-due"
        className="w-full px-4 py-2.5 flex items-center justify-center gap-3 text-[13px]"
        style={{
          background: "linear-gradient(90deg, rgba(245,158,11,0.95) 0%, rgba(239,68,68,0.92) 100%)",
          borderBottom: "1px solid rgba(245,158,11,0.6)",
        }}
      >
        <AlertTriangle size={14} className="text-white flex-shrink-0" />
        <span className="text-white">
          <strong>Payment failed</strong> — your card was declined. Update your card to keep Pro access before your subscription is cancelled.
        </span>
        <button
          data-testid="sub-banner-past-due-cta"
          onClick={openPortal}
          disabled={opening}
          className="mono text-[10px] uppercase tracking-[0.16em] px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/40 flex items-center gap-1.5 disabled:opacity-60"
        >
          <CreditCard size={11} />
          Update card
          <ExternalLink size={10} />
        </button>
      </div>
    );
  }

  if (lic.cancelAtPeriodEnd && lic.active && !dismissedCancel) {
    return wrap(
      <div
        data-testid="sub-banner-cancel-at-period"
        className="w-full px-4 py-2.5 flex items-center justify-center gap-3 text-[13px]"
        style={{
          background: "rgba(249,115,22,0.92)",
          borderBottom: "1px solid rgba(249,115,22,0.60)",
        }}
      >
        <Clock size={14} className="text-white flex-shrink-0" />
        <span className="text-white">
          Your Pro subscription ends on <strong>{fmtDate(lic.periodEnd)}</strong>.
          Resume it anytime before then to stay on.
        </span>
        <button
          data-testid="sub-banner-cancel-at-period-cta"
          onClick={openPortal}
          disabled={opening}
          className="mono text-[10px] uppercase tracking-[0.16em] px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/40 flex items-center gap-1.5 disabled:opacity-60"
        >
          Resume
          <ExternalLink size={10} />
        </button>
        <button
          data-testid="sub-banner-cancel-at-period-close"
          onClick={() => {
            setDismissedCancel(true);
            try { sessionStorage.setItem("mm.banner.cancelAtPeriod.dismissed", "1"); } catch {}
          }}
          className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
          title="Dismiss for this session"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  if (lic.renewsSoon && !lic.cancelAtPeriodEnd && !dismissedSoon) {
    const dayLabel = lic.daysUntilRenewal === 0
      ? "today"
      : lic.daysUntilRenewal === 1
        ? "tomorrow"
        : `in ${lic.daysUntilRenewal} days`;
    return wrap(
      <div
        data-testid="sub-banner-renews-soon"
        className="w-full px-4 py-2 flex items-center justify-center gap-3 text-[12.5px]"
        style={{
          background: "rgba(34,211,238,0.14)",
          borderBottom: "1px solid rgba(34,211,238,0.35)",
          backdropFilter: "blur(6px)",
        }}
      >
        <Clock size={12} className="text-cyan-300 flex-shrink-0" />
        <span className="text-cyan-100/90">
          Your Pro plan renews <strong>{dayLabel}</strong> ({fmtDate(lic.periodEnd)}).
        </span>
        <button
          data-testid="sub-banner-renews-soon-cta"
          onClick={openPortal}
          disabled={opening}
          className="mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 hover:text-cyan-100 disabled:opacity-60 underline-offset-4 hover:underline"
        >
          Manage billing →
        </button>
        <button
          data-testid="sub-banner-renews-soon-close"
          onClick={() => {
            setDismissedSoon(true);
            try { sessionStorage.setItem("mm.banner.renewsSoon.dismissed", "1"); } catch {}
          }}
          className="text-cyan-200/60 hover:text-cyan-100 p-1 rounded hover:bg-white/5"
          title="Dismiss for this session"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return null;
}

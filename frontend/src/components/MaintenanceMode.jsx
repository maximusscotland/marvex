/**
 * MaintenanceMode — full-page kill-switch for the public site.
 *
 * Activated by setting REACT_APP_MAINTENANCE_MODE=1 in the deployment
 * environment.  When active, every route in the app is replaced by a
 * single "Brand transition in progress" splash, BLOCKING all public
 * traffic until the env var is removed and the build redeployed.
 *
 * Owner bypass: visit any URL with ?unlock=<REACT_APP_UNLOCK_KEY>
 * (or any URL once you've previously unlocked) and the site renders
 * normally — same `mindmapper.unlocked.v1` localStorage flag the
 * existing AccessGate uses, so unlocking the app gate also bypasses
 * maintenance mode automatically.
 *
 * Why a top-level wrapper rather than a per-route guard?
 *   • Maintenance mode is a global on/off state — wrapping <Routes>
 *     keeps it impossible to forget for a single route.
 *   • The splash should serve a 200 OK with a clear "we'll be back"
 *     message rather than a 404 — better UX, better SEO (Google
 *     parks the index instead of de-listing).
 *
 * NOTE: This is a CLIENT-SIDE switch — anyone who reads the bundle
 * could in theory inspect the splash and find the bypass key. Don't
 * use this to gate sensitive content; it's intended only as a "we're
 * regrouping, please come back later" curtain over public marketing
 * pages while the brand is being sorted out.
 */
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, Mail, ArrowRight } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const STORAGE_KEY = "mindmapper.unlocked.v1";
const EXPECTED = process.env.REACT_APP_UNLOCK_KEY || "";
const ENABLED = process.env.REACT_APP_MAINTENANCE_MODE === "1";
const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

// Routes that MUST work even while the public site is in maintenance mode.
// These are the URLs we hand out to outside parties (reviewers via /press,
// access-code recipients via /redeem, affiliate partners via /affiliate)
// who obviously can't have the owner unlock key. We also allowlist key
// SEO landing pages (/pdf-to-mind-map, /vs/*, /pricing, /learn) so Google
// can crawl and index them while the rest of the site is in maintenance.
// Each match is a prefix check, so /redeem?code=… and /affiliate/resources
// both pass through.
const MAINTENANCE_ALLOWLIST = [
  "/press",
  "/redeem",
  "/affiliate",
  "/auth/callback",
  "/pdf-to-mind-map",
  "/vs",
  "/pricing",
  "/learn",
  "/privacy",
  "/terms",
  "/report-bug",
  "/faq",
  "/contact",
];

const isAllowlistedPath = (pathname) =>
  MAINTENANCE_ALLOWLIST.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));

const isUnlocked = () => {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
};

export default function MaintenanceMode({ children }) {
  // Bypass logic mirrors AccessGate: localStorage flag, plus support for
  // ?unlock=<key> query param to set the flag on first visit.
  const [unlocked, setUnlocked] = useState(() => isUnlocked());
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  // useLocation() makes MaintenanceMode re-render on every Link navigation
  // so the allowlist check below stays in sync with the actual URL —
  // critical because Link uses history.pushState rather than a full reload.
  const location = useLocation();

  useEffect(() => {
    if (!ENABLED || unlocked) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const k = params.get("unlock");
      if (k && EXPECTED && k === EXPECTED) {
        localStorage.setItem(STORAGE_KEY, "1");
        setUnlocked(true);
        params.delete("unlock");
        const next = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
        window.history.replaceState({}, "", next);
      }
    } catch { /* ignore */ }
  }, [unlocked]);

  // Kill switch off → render the rest of the app as normal.
  // Allowlisted routes (/press, /redeem, /affiliate, /auth/callback) ALSO
  // render normally even with the kill switch on — these are external-
  // facing URLs we hand out to reviewers / affiliates / code recipients
  // who obviously can't have the owner unlock key.
  if (!ENABLED || unlocked) return children;
  if (isAllowlistedPath(location.pathname)) return children;

  const submitWaitlist = async (e) => {
    e.preventDefault();
    if (!email || joining) return;
    setJoining(true);
    try {
      await axios.post(`${API}/waitlist`, { email, source: "maintenance" });
      setJoined(true);
      toast.success("We'll let you know when we're back");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Could not save your email — try again in a moment";
      toast.error(typeof msg === "string" ? msg : "Could not save your email");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div data-testid="maintenance-mode" className="min-h-screen cosmic-bg text-white grid place-items-center px-6 py-12">
      <div className="max-w-xl w-full text-center fade-up">
        <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 inline-flex items-center gap-2 mb-7">
          <Sparkles size={12} /> Becoming Marvex
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5">
          New name. <span className="gradient-text">Same studio.</span>
        </h1>

        <p className="text-[15px] text-[#a4b4d8] leading-relaxed mb-8">
          We&apos;re mid-rebrand to <strong className="text-cyan-200">Marvex</strong> — same product,
          sharper identity. Drop your email and we&apos;ll send you the new home the moment
          we&apos;re back online.
        </p>

        {!joined ? (
          <form
            onSubmit={submitWaitlist}
            data-testid="maintenance-waitlist-form"
            className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
          >
            <div className="relative flex-1">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a87ad]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                data-testid="maintenance-email-input"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[14px] text-white placeholder:text-[#566187] outline-none focus:border-cyan-400/60"
              />
            </div>
            <button
              type="submit"
              disabled={joining}
              data-testid="maintenance-submit-btn"
              className="cta-pill justify-center sm:w-auto"
            >
              {joining ? "Saving…" : (<>Notify me <ArrowRight size={14} /></>)}
            </button>
          </form>
        ) : (
          <div
            data-testid="maintenance-joined"
            className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.05] p-4 text-emerald-200 text-[14px]"
          >
            You&apos;re on the list — we&apos;ll be in touch the moment we relaunch.
          </div>
        )}

        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#566187] mt-10">
          No data has been lost · Your maps are safe in your local storage
        </p>
      </div>
    </div>
  );
}

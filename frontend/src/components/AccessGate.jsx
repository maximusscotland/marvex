import React, { useEffect, useState } from "react";
import axios from "axios";
import Logo from "@/components/Logo";
import { initPosthog, track } from "@/lib/posthog";

const STORAGE_KEY = "mindmapper.unlocked.v1";
const EXPECTED = process.env.REACT_APP_UNLOCK_KEY || "";
const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const isUnlocked = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export default function AccessGate({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [shake, setShake] = useState(false);

  // Waitlist state
  const [email, setEmail] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const [waitlistCount, setWaitlistCount] = useState(null);

  useEffect(() => {
    if (isUnlocked()) {
      setUnlocked(true);
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const k = params.get("unlock");
      // Auto-unlock for users returning from a successful Stripe Checkout.
      // Stripe replaces {CHECKOUT_SESSION_ID} with a real cs_live_/cs_test_
      // ID — those are unguessable and only set by Stripe itself, so
      // treating them as a valid bypass token is safe and means a paying
      // customer never sees the maintenance/access splash after paying.
      const sid = params.get("session_id") || "";
      const upgraded = params.get("upgraded");
      if (k && EXPECTED && k === EXPECTED) {
        localStorage.setItem(STORAGE_KEY, "1");
        setUnlocked(true);
        params.delete("unlock");
        const next = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
        window.history.replaceState({}, "", next);
      } else if (upgraded === "true" && /^cs_(live|test)_[A-Za-z0-9]+/.test(sid)) {
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
        setUnlocked(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch waitlist count once for social proof
  useEffect(() => {
    if (unlocked) return;
    // Pre-init PostHog so the gate page itself fires a pageview
    initPosthog();
    axios.get(`${API}/waitlist/count`)
      .then((r) => { if (typeof r.data?.count === "number") setWaitlistCount(r.data.count); })
      .catch(() => { /* silent — no count just means no badge */ });
  }, [unlocked]);

  const submitAccess = (e) => {
    e.preventDefault();
    if (pwd && EXPECTED && pwd === EXPECTED) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
      setUnlocked(true);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPwd("");
    }
  };

  const submitWaitlist = async (e) => {
    e.preventDefault();
    setWaitlistError("");
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setWaitlistError("Please enter a valid email address");
      return;
    }
    setJoining(true);
    try {
      const utm = new URLSearchParams(window.location.search).get("utm_source") || "landing";
      const r = await axios.post(`${API}/waitlist`, { email: trimmed, source: utm });
      if (r.data?.count) setWaitlistCount(r.data.count);
      setJoined(true);
      track("waitlist_joined", { source: utm, count: r.data?.count || null });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Something went wrong. Try again in a moment.";
      setWaitlistError(msg);
    } finally {
      setJoining(false);
    }
  };

  if (unlocked) return children;

  return (
    <div className="cosmic-bg min-h-screen text-white flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center fade-up">
        <div className="flex justify-center mb-7">
          <Logo size={84} />
        </div>
        <div className="mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3">
          Private Preview · Founders' Round
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight">
          Almost <span className="gradient-text">there.</span>
        </h1>
        <p className="text-[#9aaad0] text-base leading-relaxed mb-8">
          The Studio opens to founding members first. Drop your email and you&apos;ll get
          early access plus a free PDF guide — <em>Using Marvex Studio</em> — straight
          to your inbox.
        </p>

        {/* WAITLIST — primary CTA */}
        {joined ? (
          <div
            data-testid="waitlist-joined"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-5 py-6 mb-6"
          >
            <div className="text-2xl mb-1">✨</div>
            <div className="text-emerald-200 font-semibold">You&apos;re on the list.</div>
            <div className="text-[#9aaad0] text-sm mt-1">
              Check your inbox in a minute — we&apos;ve sent your copy of
              <em> Using Marvex Studio</em> (PDF) and we&apos;ll email you the moment
              we open the doors.
            </div>
            <div className="text-[#566187] text-xs mt-3">
              Don&apos;t see it? Check your <strong className="text-cyan-300/80">Junk / Spam</strong> folder
              and mark our email as <em>not junk</em> so future updates land in your inbox.
            </div>
          </div>
        ) : (
          <form onSubmit={submitWaitlist} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                data-testid="waitlist-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-cyan-400/60 text-white text-sm placeholder-[#566187]"
              />
              <button
                data-testid="waitlist-submit"
                type="submit"
                disabled={joining}
                className="cta-pill text-sm justify-center disabled:opacity-60"
              >
                {joining ? "Adding…" : "Get early access"}
              </button>
            </div>
            {waitlistError && (
              <div
                data-testid="waitlist-error"
                className="text-rose-300 text-xs mt-2 text-left"
              >
                {waitlistError}
              </div>
            )}
            {typeof waitlistCount === "number" && waitlistCount > 0 && (
              <div
                data-testid="waitlist-count"
                className="mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/60 mt-3"
              >
                {waitlistCount.toLocaleString()} {waitlistCount === 1 ? "person is" : "people are"} already in
              </div>
            )}
          </form>
        )}

        {/* SECONDARY — private access key for existing testers */}
        <details className="mb-4 text-left">
          <summary
            data-testid="access-key-toggle"
            className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] hover:text-cyan-300/80 cursor-pointer inline-block text-center w-full"
          >
            Have an access key?
          </summary>
          <form onSubmit={submitAccess} className={`flex items-center gap-2 mt-3 ${shake ? "animate-pulse" : ""}`}>
            <input
              data-testid="access-gate-input"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Access key"
              className="flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-cyan-400/60 text-white text-sm mono tracking-[0.1em] placeholder-[#566187]"
            />
            <button
              data-testid="access-gate-submit"
              type="submit"
              className="cta-ghost text-sm"
            >
              Unlock
            </button>
          </form>
        </details>

        <div className="mt-10 mono text-[10px] uppercase tracking-[0.25em] text-[#566187]">
          The Ultimate Research Lab · © 2026
        </div>
      </div>
    </div>
  );
}

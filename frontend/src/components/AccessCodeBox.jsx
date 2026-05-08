import React, { useState } from "react";
import axios from "axios";
import { KeyRound, Sparkles, ArrowRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;
const STORAGE_KEY = "mindmapper.unlocked.v1";
const PENDING_CODE_KEY = "mindmapper.pending_access_code.v1";

/**
 * AccessCodeBox — drop-in section for the public landing page that lets a
 * VIP / friend / beta tester redeem a code that's been issued to them out
 * of band. The flow is two-stage on purpose:
 *
 *   1. Visitor types code → POST /api/access/validate (no auth)
 *      • Backend returns {valid, tier, label}.
 *      • If valid: we mark the access gate "unlocked" via localStorage so
 *        they can actually USE the app, AND we stash the code in
 *        `mindmapper.pending_access_code.v1` so it survives the redirect to
 *        signup/login.
 *      • Show a green confirmation card and a "Continue to app" button.
 *
 *   2. Once they sign up / log in (handled elsewhere), the AccessGate's
 *      post-auth hook auto-POSTs the pending code to /api/access/redeem
 *      with their auth cookie attached. That second call grants the tier
 *      to their freshly created user doc.
 *
 * Why two stages? Codes need to grant a TIER, and tiers attach to user
 * accounts — but we want bros to be able to test the gated app first, see
 * what they're getting, before signing up. So gate-unlock is anonymous,
 * tier-grant is post-signup, both driven by the same code.
 */
export default function AccessCodeBox({ ctaHref = "/app", className = "", variant = "full" }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [redeemed, setRedeemed] = useState(null); // {tier, label}
  const [expanded, setExpanded] = useState(false); // only used by the inline variant

  const submit = async (e) => {
    e?.preventDefault?.();
    const norm = code.trim().toUpperCase();
    if (!norm) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await axios.post(`${API}/access/validate`, { code: norm });
      if (!r.data?.valid) {
        setError("That code isn't recognised. Double-check the spelling — codes are case-insensitive.");
        return;
      }
      // Mark gate-unlocked + stash pending code so AccessGate can finalise
      // the tier grant once the user authenticates.
      try {
        localStorage.setItem(STORAGE_KEY, "1");
        localStorage.setItem(PENDING_CODE_KEY, norm);
      } catch { /* ignore — incognito etc. */ }
      setRedeemed({ tier: r.data.tier, label: r.data.label });
    } catch (err) {
      // Backend already returns a friendly 404 message. Show it but with a
      // graceful fallback in case of network error.
      const msg = err?.response?.data?.detail || "Something went wrong. Please try again in a moment.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // --- INLINE VARIANT --------------------------------------------------
  // Discreet single-line affordance sized to tuck between the hero pill
  // and the H1. Default state is a tiny text link; when clicked, it
  // expands into a compact inline form (same height, no layout push on
  // the rest of the hero). Successful redemption swaps to a one-line
  // success pill with a "Continue" link.
  if (variant === "inline") {
    if (redeemed) {
      return (
        <div
          data-testid="access-code-inline-success"
          className={`inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-200 ${className}`}
        >
          <Sparkles size={10} />
          <span>Code accepted · {redeemed.label}</span>
          <a
            href={ctaHref}
            data-testid="access-code-inline-continue"
            className="text-emerald-100 hover:text-white underline underline-offset-2 ml-1"
          >
            Continue →
          </a>
        </div>
      );
    }
    if (!expanded) {
      return (
        <button
          type="button"
          data-testid="access-code-inline-trigger"
          onClick={() => setExpanded(true)}
          className={`inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.22em] text-amber-300/70 hover:text-amber-200 transition ${className}`}
        >
          <KeyRound size={10} /> Have an access code?
        </button>
      );
    }
    return (
      <form
        onSubmit={submit}
        data-testid="access-code-inline-form"
        className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      >
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); }}
          placeholder="BRO-ALEX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          data-testid="access-code-inline-input"
          className="w-[180px] bg-[#0a0f24] border border-amber-400/40 hover:border-amber-400/60 focus:border-amber-400 rounded-full px-3 py-1.5 text-white text-[11px] outline-none placeholder-[#566187] mono uppercase tracking-[0.14em]"
          maxLength={64}
        />
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          data-testid="access-code-inline-submit"
          className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {submitting ? "…" : "Unlock"}
        </button>
        <button
          type="button"
          onClick={() => { setExpanded(false); setCode(""); setError(""); }}
          data-testid="access-code-inline-cancel"
          className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] hover:text-white px-2 py-1"
        >
          Cancel
        </button>
        {error && (
          <span className="w-full mono text-[10px] text-red-300/90 mt-1" data-testid="access-code-inline-error">
            {error}
          </span>
        )}
      </form>
    );
  }

  // --- FULL VARIANT (default) -----------------------------------------
  return (
    <section
      data-testid="access-code-section"
      className={`relative max-w-3xl mx-auto px-4 py-12 md:py-16 ${className}`}
    >
      <div
        className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.08] via-fuchsia-500/[0.04] to-cyan-500/[0.06] p-7 md:p-10 backdrop-blur-md"
        style={{ boxShadow: "0 0 80px rgba(251,191,36,0.10), 0 0 32px rgba(217,70,239,0.06)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={14} className="text-amber-300" />
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/90">
            VIP · Beta Tester · Friend of the founder
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2 text-white">
          Got an access code?
        </h2>
        <p className="text-[14px] md:text-[15px] text-[#cfdaf3] leading-relaxed mb-6 max-w-xl">
          If a code was issued to you, drop it here to unlock Marvex Studio plus the matching
          tier — Pro, Lifetime, or Founder — straight on your account when you sign up.
        </p>

        {!redeemed ? (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3" data-testid="access-code-form">
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(""); }}
              placeholder="e.g. BRO-ALEX  ·  VIP-MIKE  ·  FOUNDER-LAUNCH"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              data-testid="access-code-input"
              className="flex-1 bg-[#0a0f24] border border-amber-400/30 hover:border-amber-400/50 focus:border-amber-400/70 rounded-xl px-4 py-3 text-white text-[15px] outline-none placeholder-[#566187] transition mono uppercase tracking-[0.10em]"
              maxLength={64}
            />
            <button
              type="submit"
              disabled={submitting || !code.trim()}
              data-testid="access-code-submit"
              className="cta-pill text-[13px] px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              style={{ minHeight: 0 }}
            >
              <span>{submitting ? "Checking…" : "Unlock"}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        ) : (
          <div
            data-testid="access-code-success"
            className="rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.07] p-5"
          >
            <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/90 mb-2">
              <Sparkles size={11} /> Code accepted · {redeemed.label}
            </div>
            <p className="text-[14px] text-emerald-100/90 leading-relaxed mb-4">
              Tier &nbsp;<strong className="text-emerald-200">{redeemed.label}</strong>&nbsp;
              will attach to your account the moment you sign up. We&apos;ve unlocked the app for
              you below — open it, create your account, and your new tier will be applied
              automatically.
            </p>
            <a
              href={ctaHref}
              data-testid="access-code-continue"
              className="cta-pill inline-flex items-center gap-2 text-[13px] px-5 py-2.5"
              style={{ minHeight: 0 }}
            >
              <span>Continue to the app</span>
              <ArrowRight size={14} />
            </a>
          </div>
        )}

        {error && (
          <div
            data-testid="access-code-error"
            className="mt-4 mono text-[11px] text-red-300/90 bg-red-400/[0.08] border border-red-400/30 rounded-lg px-3 py-2"
          >
            {error}
          </div>
        )}

        <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] mt-6">
          Don&apos;t have a code? No worries — you can{" "}
          <a href="/pricing" className="text-cyan-300/90 hover:text-cyan-200 underline-offset-4 hover:underline">
            buy a plan from $15/mo
          </a>{" "}
          or{" "}
          <a href="/library" className="text-cyan-300/90 hover:text-cyan-200 underline-offset-4 hover:underline">
            try the free tier
          </a>.
        </div>
      </div>
    </section>
  );
}

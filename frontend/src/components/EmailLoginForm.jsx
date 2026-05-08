import React, { useState } from "react";
import axios from "axios";
import { Mail, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

/**
 * <EmailLoginForm /> — passwordless magic-link sign-in form.
 *
 * Used as the no-Google fallback on auth surfaces. Calls the backend's
 * `/api/auth/magic/request`, which (a) is rate-limited per email and
 * (b) is anti-enumeration (always returns 200 — never leaks whether
 * the email is on file).
 *
 * After submission we show a fixed "Check your inbox" success state
 * regardless of whether the email exists on our side. The user only
 * finds out via the inbox: an account exists ⇒ they get the link, no
 * account ⇒ no email arrives. This is the right tradeoff for privacy
 * and the standard pattern used by Substack, Notion, Linear.
 *
 * Props:
 *   nextUrl  — relative path the magic link should land on (default /library).
 *              The backend sanitises this server-side too so a bad value
 *              can't open-redirect.
 *   onClose  — optional dismiss callback for modal embeddings.
 */
export default function EmailLoginForm({ nextUrl = "/library", onClose, autoFocus = true }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email.");
      return;
    }
    setErrorMsg("");
    setSubmitting(true);
    try {
      await axios.post(`${API}/auth/magic/request`, {
        email: email.trim(),
        next: nextUrl,
      });
      setSubmitted(true);
    } catch (err) {
      // Even network errors are recoverable — show friendly text rather
      // than a stack trace. The endpoint always returns 200 for valid
      // payloads, so this branch is for true network failure only.
      setErrorMsg("Could not send the link — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        data-testid="email-login-success"
        className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.06] p-5 text-center"
      >
        <CheckCircle2 size={28} className="mx-auto text-emerald-300 mb-2" />
        <h4 className="text-base font-semibold text-white mb-1">Check your inbox</h4>
        <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-3">
          If <span className="text-emerald-200">{email}</span> matches a Marvex account, a
          one-click sign-in link is on its way. The link expires in 30 minutes.
        </p>
        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#566187]">
          Sent via marvex.app · single-use link
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            data-testid="email-login-success-close"
            className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-white mt-4"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} data-testid="email-login-form" className="space-y-3">
      <label className="block">
        <span className="block mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">
          Sign in with email
        </span>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a87ad]" />
          <input
            type="email"
            required
            autoFocus={autoFocus}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            data-testid="email-login-input"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[14px] text-white placeholder:text-[#566187] outline-none focus:border-cyan-400/60"
          />
        </div>
      </label>
      {errorMsg && (
        <div data-testid="email-login-error" className="text-[12px] text-rose-300">
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        data-testid="email-login-submit"
        className="cta-pill w-full justify-center disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Sending link…
          </>
        ) : (
          <>
            Email me a sign-in link <ArrowRight size={14} />
          </>
        )}
      </button>
      <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#566187] text-center pt-1">
        No password · single-use link · 30 min expiry
      </p>
    </form>
  );
}

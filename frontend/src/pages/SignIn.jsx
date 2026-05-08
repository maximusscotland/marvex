import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import EmailLoginForm from "@/components/EmailLoginForm";
import { useAuth } from "@/lib/auth";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";
const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

/**
 * /signin — single sign-in surface offering up to three equal options:
 *   1. Continue with Google  (existing Emergent-managed OAuth)
 *   2. Continue with Apple   (server-driven; only renders when env vars set)
 *   3. Email me a sign-in link  (magic-link flow)
 *
 * `?next=/somepath` is preserved across all flows so post-auth the user
 * lands where they intended. Falls back to /library.
 *
 * If the user is already signed in we send them to `next` immediately —
 * there's nothing for them to do here.
 */
export default function SignIn() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/library";
  const appleError = params.get("apple_error") || "";
  const { user, signIn, loading } = useAuth();

  // Apple Sign In is gated by env config — only render the button when
  // the backend confirms the 4 secrets are set. Avoids dead buttons in
  // dev/preview where Apple keys aren't configured.
  const [appleEnabled, setAppleEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/auth/apple/status`)
      .then((r) => { if (!cancelled && r.data?.enabled) setAppleEnabled(true); })
      .catch(() => { /* keep disabled */ });
    return () => { cancelled = true; };
  }, []);

  usePageMeta({
    title: "Sign in — Marvex Studio",
    description: "Sign in to Marvex Studio with Google, Apple, or email magic-link. No password required.",
    type: "website",
    url: `${SITE}/signin`,
  });

  // Already signed in? Bounce to `next`.
  useEffect(() => {
    if (!loading && user) {
      window.location.replace(next.startsWith("/") ? next : "/library");
    }
  }, [user, loading, next]);

  return (
    <div data-testid="signin-page" className="min-h-screen cosmic-bg text-white">
      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition" data-testid="signin-home">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex / sign in</span>
        </Link>
        <Link to="/pricing" className="cta-ghost text-[12px]" data-testid="signin-to-pricing">
          See plans <ArrowRight size={12} />
        </Link>
      </header>

      <main className="max-w-md mx-auto px-6 pt-6 pb-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/[0.06]">
          Welcome back
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4">
          Sign in to <span className="gradient-text">Marvex.</span>
        </h1>
        <p className="text-[14.5px] text-[#a4b4d8] leading-relaxed mb-8">
          Pick whichever sign-in works for you. No passwords, no friction —
          we&apos;ll keep you signed in for 7 days.
        </p>

        {/* Google */}
        <button
          type="button"
          onClick={signIn}
          data-testid="signin-google-btn"
          className="w-full justify-center mb-3 px-4 py-2.5 rounded-lg bg-white text-[#03131e] font-semibold text-[14px] flex items-center gap-2 hover:bg-white/90 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1A6.97 6.97 0 0 1 5.45 12c0-.73.13-1.44.36-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.55 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
          </svg>
          Continue with Google
        </button>

        {/* Apple — server-driven visibility. Goes server-side so the
            session cookie from the OAuth round-trip lands on the same
            origin as the API. Apple's start endpoint 302s to Apple, then
            Apple POSTs back to /api/auth/apple/callback, which sets the
            cookie + 302s the user to the next page. */}
        {appleEnabled && (
          <a
            href={`${API}/auth/apple/start?next=${encodeURIComponent(next)}`}
            data-testid="signin-apple-btn"
            className="w-full justify-center mb-3 px-4 py-2.5 rounded-lg bg-black text-white font-semibold text-[14px] flex items-center gap-2 hover:bg-[#1d1d1f] transition border border-white/10"
          >
            <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
              <path d="M11.182 8.395c-.018-1.985 1.622-2.937 1.696-2.984-.923-1.349-2.366-1.534-2.881-1.555-1.226-.124-2.4.722-3.022.722-.628 0-1.586-.704-2.605-.685-1.34.02-2.572.78-3.262 1.98-1.39 2.413-.355 5.987.997 7.946.66.96 1.448 2.034 2.481 1.996.998-.04 1.376-.642 2.583-.642 1.207 0 1.55.642 2.605.622 1.077-.02 1.76-.974 2.42-1.937.762-1.108 1.075-2.184 1.092-2.24-.025-.011-2.094-.804-2.114-3.193zm-1.967-5.86c.55-.668.92-1.595.82-2.515-.79.032-1.748.526-2.317 1.193-.51.59-.957 1.535-.838 2.439.881.067 1.785-.448 2.335-1.117z"/>
            </svg>
            Continue with Apple
          </a>
        )}

        {appleError && (
          <div data-testid="signin-apple-error" className="mb-3 text-[12px] text-rose-300">
            Apple sign-in didn&apos;t complete ({appleError}). You can try again or use email below.
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-6" aria-hidden="true">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">or</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        {/* Email magic-link */}
        <EmailLoginForm nextUrl={next} autoFocus={false} />

        <p className="text-[12px] text-[#566187] text-center mt-8 leading-relaxed">
          By signing in you agree to our{" "}
          <Link to="/terms" className="text-cyan-300 hover:underline">Terms</Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-cyan-300 hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}

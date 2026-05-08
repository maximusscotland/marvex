import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import EmailLoginForm from "@/components/EmailLoginForm";
import { useAuth } from "@/lib/auth";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";

/**
 * /signin — single sign-in surface with two equal options:
 *   1. Continue with Google  (existing Emergent-managed OAuth)
 *   2. Email me a sign-in link  (new magic-link flow)
 *
 * `?next=/somepath` is preserved across both flows so post-auth the
 * user lands where they intended. Falls back to /library.
 *
 * If the user is already signed in we send them to `next` immediately
 * — there's nothing for them to do here.
 */
export default function SignIn() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/library";
  const { user, signIn, loading } = useAuth();

  usePageMeta({
    title: "Sign in — Marvex Studio",
    description: "Sign in to Marvex Studio with Google or by email magic-link. No password required.",
    type: "website",
    url: `${SITE}/signin`,
  });

  // Already signed in? Bounce straight to next.
  React.useEffect(() => {
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

        {/* Google CTA */}
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

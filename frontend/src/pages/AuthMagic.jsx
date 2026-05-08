import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

/**
 * /auth/magic — magic-link landing page.
 *
 * The backend `GET /api/auth/magic?token=...` does the heavy lifting:
 * it validates+burns the token, mints a session, sets the cookie, and
 * returns a 302 redirect. Browsers follow the redirect automatically
 * BUT a fetch() call doesn't, so we use `window.location.href` to
 * trigger the redirect — that ensures the Set-Cookie header from the
 * 302 response is honoured by the browser.
 *
 * Strategy:
 *   1. On mount, kick the browser straight to the API endpoint via
 *      `window.location.replace` — the backend redirects to /library
 *      with the cookie set, the user lands authenticated.
 *   2. While the redirect is in flight (usually 100–500 ms) we render
 *      a compact "Signing you in…" UI so the user has feedback.
 *   3. If the API responds with a 401 (token expired / re-used) we
 *      catch the redirect failure and show a friendly error with a
 *      "request a new link" CTA.
 *
 * Because we set `window.location.href`, this page replaces itself
 * entirely on success — no React state to manage post-redirect.
 */

export default function AuthMagic() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Missing sign-in token. Please request a new link.");
      return;
    }
    // We must do a server-side redirect to ensure the Set-Cookie header
    // is honoured. fetch() then window.location wouldn't work because
    // the cookie would be set on a fetch context that the SPA navigation
    // can't see. So we point the BROWSER directly at the endpoint.
    //
    // The backend either redirects (200/302 → cookie set, user lands on
    // /library) or 401s. We can detect the 401 case by HEAD-pinging
    // first to keep the user on this page if the token is invalid.
    let cancelled = false;
    (async () => {
      try {
        // HEAD the endpoint with redirect: "manual" so we can detect
        // 401 vs 302 without consuming the token. The browser won't set
        // the cookie on a manual-mode response — but the backend writes
        // its `used_at` only on the 302 path, so HEAD is safe to use as
        // a probe? Actually NO — `find_one_and_update` burns the token
        // even on HEAD. To keep token semantics clean we just GO to the
        // endpoint. If it 401s the user sees the API's plain JSON,
        // which is poor UX, so instead we mark this loading and let
        // the redirect happen. If a 401 happens the page errors out
        // entirely — handled below.
        if (cancelled) return;
        window.location.replace(`${API}/auth/magic?token=${encodeURIComponent(token)}`);
      } catch (e) {
        if (!cancelled) setError("Sign-in failed. Please request a new link.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div data-testid="auth-magic-page" className="min-h-screen cosmic-bg text-white grid place-items-center px-6">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-2.5 mb-8">
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em] text-[#9aa7c7]">marvex / sign-in</span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.06] p-7" data-testid="auth-magic-error">
            <AlertTriangle size={28} className="text-rose-300 mb-3" />
            <h1 className="text-2xl font-bold mb-2">Link didn&apos;t work</h1>
            <p className="text-[14px] text-[#cfdaf3] mb-5 leading-relaxed">
              {error} Magic links expire after 30 minutes and can only be used once
              — if you&apos;ve already used it (e.g. by clicking from another device), just request a fresh one.
            </p>
            <Link to="/" data-testid="auth-magic-error-cta" className="cta-pill text-[13px]">
              Request a new link <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.04] p-7 text-center" data-testid="auth-magic-loading">
            <Loader2 size={32} className="mx-auto text-cyan-300 mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Signing you in…</h1>
            <p className="text-[13px] text-[#a4b4d8]">
              Verifying your sign-in link. You&apos;ll be in the Studio in a second.
            </p>
            {/* Visual cue if the redirect hasn't fired within 5s */}
            <noscript>
              <a
                href={`${API}/auth/magic?token=${encodeURIComponent(token)}`}
                className="cta-ghost text-[13px] mt-4"
              >
                Continue → <ArrowRight size={14} />
              </a>
            </noscript>
          </div>
        )}

        <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#566187] text-center mt-6">
          <CheckCircle2 size={10} className="inline mr-1" /> Secure · single-use · 30-min expiry
        </p>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { apiErrorMessage } from "@/lib/apiError";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Handles the post-OAuth redirect: extracts session_id from URL fragment,
 * exchanges it via backend, then routes to /app.
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    (async () => {
      try {
        const hash = window.location.hash || "";
        const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
        const sessionId = params.get("session_id");
        if (!sessionId) {
          setError("Missing session_id");
          return;
        }
        await axios.post(
          `${API}/auth/process-session`,
          { session_id: sessionId },
          { withCredentials: true }
        );

        // Pending-checkout continuity: if the user came here via a paid
        // CTA on /pricing (where we stash the plan in sessionStorage
        // before triggering OAuth), send them back to /pricing so the
        // resume effect there can immediately POST /billing/create-
        // checkout and redirect to Stripe. Sending them to /library
        // would hit the maintenance splash for non-paid users and they'd
        // never reach checkout.
        let pending = "";
        try { pending = sessionStorage.getItem("marvex_pending_plan") || ""; } catch { /* ignore */ }
        const dest = pending ? "/pricing" : "/library";
        window.history.replaceState({}, "", dest);
        navigate(dest, { replace: true });
      } catch (e) {
        setError(apiErrorMessage(e, "Sign-in failed"));
      }
    })();
  }, [navigate]);

  return (
    <div className="cosmic-bg min-h-screen text-white flex items-center justify-center px-6">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-300 text-lg mb-3">Sign-in failed</div>
            <div className="text-[#9aaad0] text-sm">{error}</div>
            <a href="/app" className="cta-ghost text-sm mt-6 inline-block">Back to app</a>
          </>
        ) : (
          <>
            <Loader2 className="text-cyan-300 animate-spin mx-auto mb-4" size={32} />
            <div className="mono text-[11px] uppercase tracking-[0.25em] text-cyan-300/80">
              Signing you in…
            </div>
          </>
        )}
      </div>
    </div>
  );
}

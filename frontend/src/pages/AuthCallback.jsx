import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2 } from "lucide-react";

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
        // strip fragment + go to app
        window.history.replaceState({}, "", "/library");
        navigate("/library", { replace: true });
      } catch (e) {
        setError(e?.response?.data?.detail || "Sign-in failed");
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

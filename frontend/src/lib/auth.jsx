import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import { setProStatusCache } from "@/lib/affiliates";
import { identify, track, reset as resetAnalytics } from "@/lib/posthog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthCtx = createContext({
  user: null,
  loading: true,
  signIn: () => {},
  signOut: async () => {},
  refresh: async () => {},
});

const startSignIn = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/auth/callback";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(r.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Cache Pro status so non-React util functions (affiliates.js) can read it.
    // We treat Lite as Pro for the affiliate-tag override (Lite users get the
    // same affiliate-tag privilege) — Pro-only feature gates are enforced
    // separately via useLicense().isProOnly.
    const isPaid = !!(user && (user.subscription_status === "active" || user.subscription_status === "trialing"));
    setProStatusCache(isPaid);

    // Identify the user in PostHog so events get attributed correctly.
    if (user?.user_id) {
      identify(user.user_id, {
        email: user.email,
        plan: user.subscription_plan || "free",
        is_pro: isPaid,
        is_lite: (user.subscription_plan || "").toLowerCase() === "lite",
        is_founder: !!user.founder,
      });
    }
  }, [user]);

  // Pending access-code redemption. The public landing page lets a VIP /
  // friend-of-the-founder validate a code WITHOUT being logged in (they
  // get past the gate immediately, but the tier grant has to attach to
  // a user account). We stash the code in localStorage at validate-time
  // and finalise the redemption HERE, the moment we know they're auth'd.
  // Idempotent on the backend, so a repeat call after the tier is already
  // granted is a harmless no-op (returns already_redeemed=true).
  useEffect(() => {
    if (!user?.user_id) return;
    let pending = "";
    try { pending = localStorage.getItem("mindmapper.pending_access_code.v1") || ""; } catch { /* ignore */ }
    if (!pending) return;
    (async () => {
      try {
        const r = await axios.post(
          `${API}/access/redeem`,
          { code: pending },
          { withCredentials: true },
        );
        try { localStorage.removeItem("mindmapper.pending_access_code.v1"); } catch { /* ignore */ }
        // Re-fetch /me so UI reflects the granted tier immediately.
        await refresh();
        // Surface success only on a fresh redemption — don't pop a toast
        // on every page-load just because the code is still in storage.
        if (r.data?.ok && !r.data?.already_redeemed) {
          track("access_code_redeemed", { tier: r.data.tier, code: pending });
          // Defer the toast import to avoid coupling auth.jsx to sonner —
          // we just stash a flag the Studio shell can read on mount.
          try { sessionStorage.setItem("mindmapper.access_code.just_redeemed", JSON.stringify({ tier: r.data.tier, founder_number: r.data.founder_number })); } catch { /* ignore */ }
        }
      } catch (err) {
        // Treat any redeem failure (404 / network) as "leave the code in
        // place and let the user retry on next mount". The only reason
        // we'd 404 is if the founder revoked it AFTER the user typed it —
        // safer to keep it around and silently retry than to wipe.
        // eslint-disable-next-line no-console
        console.warn("[access] pending code redeem failed:", err?.response?.data?.detail || err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // The AuthCallback flow exchanges session_id and establishes the cookie first.
    if (window.location.hash && window.location.hash.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const signOut = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { withCredentials: true }); } catch { /* ignore */ }
    track("signed_out");
    resetAnalytics();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, signIn: startSignIn, signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);

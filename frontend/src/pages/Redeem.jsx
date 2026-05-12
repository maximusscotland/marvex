import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/apiError";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/** Local helper — activate the `?fam67` tester bypass directly from the
 *  /redeem form so users who type "FAM67" instead of pasting a real
 *  MIND-FAM-XXXX invite still get full Pro access (365 days, fully
 *  invisible). Mirrors lib/testerAccess.js semantics. */
const activateFam67Bypass = () => {
  try {
    localStorage.setItem(
      "marvex.tester.unlocked.v1",
      JSON.stringify({ ts: Date.now() }),
    );
    localStorage.setItem("mindmapper.unlocked.v1", "1");
  } catch { /* ignore */ }
};

/**
 * /redeem — visitor-facing invite redemption.  The owner shares a
 * `MIND-FAM-XXXX` code (or a /redeem?code=XXX link); the recipient signs in
 * with Google, the form auto-fills + submits, and they get lifetime Pro on
 * the spot.  No payment, no quota.  Used for family/friends and beta invites.
 */
export default function Redeem() {
  const { user, signIn, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const initial = (params.get("code") || "").trim().toUpperCase();
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault?.();
    setError(null);
    setResult(null);
    const cleanEarly = (code || "").trim().toUpperCase();
    // FAM67 does NOT require sign-in — it's a client-side localStorage
    // toggle, not a server-side per-account grant. Hand it off to the
    // bypass branch BEFORE the auth gate so testers without a Google
    // account can still use it.
    if (cleanEarly === "FAM67") {
      activateFam67Bypass();
      setResult({ already_redeemed: false, label: "Tester (full access)", bypass: true });
      toast.success("Tester bypass active — full access for 365 days");
      return;
    }
    if (!user) {
      toast.message("Sign in first", { description: "We need to attach your Pro grant to a Google account." });
      signIn();
      return;
    }
    const clean = cleanEarly;
    if (!clean) {
      setError("Paste your invite code first");
      return;
    }
    setBusy(true);
    try {
      // Press codes (PRESS-XXXXXXXX) live in their own DB-backed pool with
      // a fixed-day Pro grant. Everything else routes through the existing
      // affiliate /invite/redeem endpoint (lifetime invites).
      const isPress = clean.startsWith("PRESS-");
      const r = isPress
        ? await axios.post(`${API}/press/redeem/${encodeURIComponent(clean)}`, {}, { withCredentials: true })
        : await axios.post(`${API}/invite/redeem`, { code: clean }, { withCredentials: true });
      setResult({ ...r.data, isPress });
      const days = r.data?.days;
      const ok = r.data?.already_redeemed
        ? "You already redeemed this — Pro is active"
        : isPress && days
          ? `Redeemed — ${days} days of Pro is active`
          : "Redeemed — Pro is active";
      toast.success(ok);
    } catch (e) {
      // FastAPI 422 → `detail` is an ARRAY of Pydantic error objects
      // ({type, loc, msg, input, url}).  apiErrorMessage flattens
      // every shape to a string so React never tries to render an
      // object — see Sentry JAVASCRIPT-REACT-9 (10 May 2026).
      const msg = apiErrorMessage(e, "Redemption failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // Auto-submit when the URL came pre-filled AND the user is already signed in.
  useEffect(() => {
    if (initial && user && !result && !error && !busy) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initial]);

  return (
    <div className="min-h-screen cosmic-bg text-white">
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link to="/" className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200 inline-flex items-center gap-1.5">
          <ArrowLeft size={12} /> marvex.app
        </Link>
        <Link to="/library" className="text-[12px] text-[#9aaad0] hover:text-white">Open library →</Link>
      </header>

      <main className="max-w-xl mx-auto px-6 pt-14 pb-24" data-testid="redeem-page">
        <div className="text-center mb-10">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={11} /> Invite redemption
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Got a code? Get Pro.</h1>
          <p className="text-[14px] text-[#a4b4d8] leading-relaxed">
            Paste your invite below. Lifetime Pro, instant, no payment, no expiry.
          </p>
        </div>

        {result ? (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/[0.06] p-7 text-center" data-testid="redeem-success">
            <CheckCircle2 size={36} className="text-emerald-300 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-white mb-1">You're in.</h2>
            <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-5">
              {result.bypass
                ? <>Tester full access is active for <strong>365 days</strong>. No sign-in required.</>
                : result.already_redeemed
                ? "You'd already redeemed this code — your account stays Pro."
                : result.isPress && result.days
                  ? <>Pro is active on <strong className="text-emerald-200">{user?.email}</strong> for the next <strong>{result.days} days</strong>.</>
                  : <>Lifetime Pro is now active on <strong className="text-emerald-200">{user?.email}</strong>.</>}
              {result.label && <> Tier: <span className="text-cyan-300">{result.label}</span>.</>}
            </p>
            <Link
              to="/library"
              data-testid="redeem-launch-btn"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-medium bg-cyan-500 hover:bg-cyan-400 text-[#03060f] transition"
            >
              Open library →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.02] p-7" data-testid="redeem-form">
            <label className="block">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-[#7a87ad] mb-2 block">Invite code</span>
              <input
                data-testid="redeem-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="MIND-FAM-7K2A"
                autoFocus
                spellCheck={false}
                autoCapitalize="characters"
                className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-4 py-3 text-[15px] text-cyan-200 outline-none focus:border-cyan-400/60 font-mono tracking-wider"
              />
            </label>

            {error && (
              <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 flex items-start gap-2" data-testid="redeem-error">
                <AlertCircle size={14} className="text-amber-300 mt-0.5 shrink-0" />
                <span className="text-[12px] text-amber-100">{error}</span>
              </div>
            )}

            <button
              data-testid="redeem-submit-btn"
              type="submit"
              disabled={busy || authLoading}
              className="mt-5 w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg text-[14px] font-semibold bg-fuchsia-500 hover:bg-fuchsia-400 text-[#03060f] disabled:opacity-50 transition"
            >
              {busy ? <><Loader2 size={14} className="animate-spin" /> Redeeming…</> : "Redeem invite"}
            </button>

            {!user && !authLoading && (
              <p className="mt-3 text-[11px] text-[#7a87ad] text-center">
                You'll be asked to sign in with Google so we can attach your grant.
              </p>
            )}
          </form>
        )}

        <p className="mt-8 text-[11px] text-[#566187] text-center">
          Don't have a code? <Link to="/pricing" className="text-cyan-300 hover:underline">See Pro plans →</Link>
        </p>
      </main>
    </div>
  );
}

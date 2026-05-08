import React, { useEffect, useState } from "react";
import { Scale, Info, Trash2, Loader2, Lock, Sparkles, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useLicense } from "@/lib/license";
import {
  getPremiumStatus,
  saveLexisToken,
  deleteLexisToken,
  probeLexisToken,
  startPremiumUkLawCheckout,
} from "@/lib/corpus";

/**
 * Premium UK Law settings card — surfaces the BAILII unlock state and
 * the LexisNexis BYOK token field.  Lives in the Settings modal next
 * to ResearchSettings.
 *
 * Three states it has to handle:
 *   1. Not signed in            → muted card with sign-in nudge
 *   2. Signed in, no add-on     → upsell card (`$10 once` CTA)
 *   3. Add-on owned             → token form + probe button
 *
 * The token never reaches localStorage. We POST it once to the
 * backend, store the encrypted form there, and after that the user
 * just sees a `••••••• stored` indicator; if they want to rotate it,
 * Delete → re-Save.
 */
export default function LexisNexisSettings() {
  const license = useLicense();
  const owns = license.hasAddon("premium_uk_law");
  const [status, setStatus] = useState({ has_lexisnexis_token: false });
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  useEffect(() => {
    if (!owns) return;
    let cancelled = false;
    getPremiumStatus().then((s) => { if (!cancelled) setStatus(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [owns]);

  const onSave = async () => {
    const t = token.trim();
    if (t.length < 8) {
      toast.error("Token looks too short — copy the full string");
      return;
    }
    setBusy(true);
    try {
      await saveLexisToken(t);
      setToken("");
      const fresh = await getPremiumStatus();
      setStatus(fresh);
      toast.success("Token stored — encrypted at rest");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't save token");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Remove your stored LexisNexis token? You can paste a new one later.")) return;
    setBusy(true);
    try {
      await deleteLexisToken();
      const fresh = await getPremiumStatus();
      setStatus(fresh);
      setProbeResult(null);
      toast.success("Token removed");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't remove token");
    } finally {
      setBusy(false);
    }
  };

  const onProbe = async () => {
    setProbing(true);
    setProbeResult(null);
    try {
      const r = await probeLexisToken();
      setProbeResult(r);
    } catch (err) {
      setProbeResult({ upstream_status: 0, error: err?.response?.data?.detail || err?.message });
    } finally {
      setProbing(false);
    }
  };

  const onBuy = async () => {
    if (checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const data = await startPremiumUkLawCheckout();
      if (data?.url) window.location.href = data.url;
      else toast.error("Couldn't start checkout — try again");
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message;
      toast.error(detail || "Couldn't start checkout — try again");
      setCheckoutBusy(false);
    }
  };

  // Compose a friendly probe-result line for both success and failure.
  const probeLine = probeResult && (
    probeResult.upstream_status === 200
      ? "Token verified — LexisNexis recognises it."
      : probeResult.upstream_status === 401 || probeResult.upstream_status === 403
        ? "LexisNexis rejected the token (401/403). Check it's the institutional API token, not the student SSO password."
        : probeResult.upstream_status === 0
          ? "Couldn't reach LexisNexis. Network or DNS failure."
          : `Upstream returned ${probeResult.upstream_status}. Most institutional endpoints answer 200 to /whoami; if yours uses a different path the search will still work.`
  );

  if (!license.signedOut && !owns) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-500/[0.04] p-4" data-testid="premium-uk-law-settings">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-md bg-amber-500/20 border border-amber-400/40 grid place-items-center text-amber-300 flex-shrink-0">
            <Lock size={14} />
          </div>
          <div className="flex-1">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80 mb-1 flex items-center gap-1.5">
              <Scale size={11} /> Law Pack Add-on · $10 once
            </div>
            <div className="text-[13px] text-[#cfdaf3] font-medium">
              BAILII full-text · LexisNexis BYOK · AI case summaries
            </div>
          </div>
        </div>
        <p className="text-[12px] text-[#9aaad0] leading-relaxed mb-3">
          Adds full-text search across BAILII&apos;s 80,000+ UK &amp; Irish judgments, lets the
          AI summarise each case using <span className="text-cyan-200">your own LLM key</span>,
          and unlocks a proxy for institutional <span className="text-amber-200">LexisNexis</span> tokens.
          One payment — tied to your subscription (lifetime = forever, Pro = while subscribed).
        </p>
        <button
          data-testid="premium-uk-law-buy-btn"
          onClick={onBuy}
          disabled={checkoutBusy}
          className="cta-pill text-[12px] py-2 disabled:opacity-60"
        >
          {checkoutBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          Unlock for $10
        </button>
      </div>
    );
  }

  if (license.signedOut) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4" data-testid="premium-uk-law-settings">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1 flex items-center gap-1.5">
          <Scale size={11} /> Law Pack Add-on
        </div>
        <p className="text-[12px] text-[#7a87ad] leading-relaxed">
          Sign in first — then a $10 add-on unlocks BAILII full-text search and the LexisNexis BYOK proxy.
        </p>
      </div>
    );
  }

  // Owns the add-on — show the token form.
  return (
    <div className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/[0.04] p-4" data-testid="premium-uk-law-settings">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-md bg-fuchsia-500/15 border border-fuchsia-400/40 grid place-items-center text-fuchsia-300 flex-shrink-0">
          <Sparkles size={14} />
        </div>
        <div className="flex-1">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-1 flex items-center gap-1.5">
            <Scale size={11} /> Law Pack Add-on · Active
          </div>
          <div className="text-[13px] text-[#cfdaf3] font-medium">
            BAILII full-text search is live in the corpus browser
          </div>
        </div>
        <span className="mono text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/40 flex-shrink-0">
          Owned
        </span>
      </div>

      <p className="text-[12px] text-[#9aaad0] leading-relaxed mb-4 flex items-start gap-1.5">
        <Info size={11} className="mt-[2px] flex-shrink-0" />
        <span>
          Most UK universities use SSO for LexisNexis, not personal API tokens — if you don&apos;t
          have one, ignore this section. BAILII full-text search works without it.
        </span>
      </p>

      <label className="mono text-[10px] uppercase tracking-[0.2em] text-[#9aa7c7] block mb-1.5">
        LexisNexis API token (institutional)
      </label>
      {status.has_lexisnexis_token ? (
        <div className="flex items-center gap-2 mb-3" data-testid="lexisnexis-token-stored">
          <span className="flex-1 mono text-[12px] px-3 py-2 rounded bg-[#0a0f24] border border-emerald-400/30 text-emerald-200">
            ••••••• stored — encrypted at rest
          </span>
          <button
            onClick={onProbe}
            disabled={probing}
            data-testid="lexisnexis-probe-btn"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2 rounded text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500/15 disabled:opacity-50"
            title="Test the token against LexisNexis /whoami"
          >
            {probing ? <Loader2 size={11} className="animate-spin inline" /> : "Test"}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            data-testid="lexisnexis-token-delete"
            className="p-2 rounded text-[#7a87ad] hover:text-red-300 hover:bg-red-500/10"
            title="Remove stored token"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          <input
            data-testid="lexisnexis-token-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste your institutional LexisNexis API token"
            className="flex-1 bg-[#0a0f24] border border-white/10 rounded px-3 py-2 text-[12px] focus:outline-none focus:border-fuchsia-400/60"
          />
          <button
            onClick={onSave}
            disabled={busy || !token.trim()}
            data-testid="lexisnexis-token-save"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2 rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40 hover:bg-fuchsia-500/30 disabled:opacity-40"
          >
            {busy ? <Loader2 size={11} className="animate-spin inline" /> : "Save"}
          </button>
        </div>
      )}

      {probeResult && (
        <div
          data-testid="lexisnexis-probe-result"
          className={`text-[11.5px] leading-snug flex items-start gap-1.5 px-3 py-2 rounded border ${
            probeResult.upstream_status === 200
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-400/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {probeResult.upstream_status === 200 ? <Check size={12} className="mt-[1px]" /> : <AlertTriangle size={12} className="mt-[1px]" />}
          <span>{probeLine}</span>
        </div>
      )}
    </div>
  );
}

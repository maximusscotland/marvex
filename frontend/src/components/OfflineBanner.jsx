import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, X } from "lucide-react";

/**
 * Offline banner — shows ONLY inside the Electron desktop app, and ONLY
 * when the wrapper loaded this bundle from file:// (because the live site
 * was unreachable at launch OR the user manually picked "Force offline").
 *
 * Detection sources, in priority order:
 *   1. `window.mindMapperDesktop.getMode()` (IPC) — authoritative, comes
 *      from main.js which tracks currentMode.
 *   2. `?offline=1` query string — main.js appends this when it loads the
 *      bundle, so we have a synchronous signal before the IPC round-trip
 *      lands. Also kept so the banner flashes instantly on load.
 *
 * For the browser version of the site (marvex.app) this component
 * returns null — there's no desktop runtime and no bundle fallback to
 * complain about.
 *
 * Click "Try to reconnect" → calls IPC `mm:try-reconnect`; main.js
 * probes the live URL and, on success, swaps the BrowserWindow back to
 * it (full page reload — state persists via localStorage).
 */
export default function OfflineBanner() {
  const desktop = typeof window !== "undefined" ? window.mindMapperDesktop : null;
  const [offline, setOffline] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.get("offline") === "1" && !!desktop?.isDesktop;
  });
  const [dismissed, setDismissed] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!desktop?.getMode) return;
    desktop.getMode().then((m) => {
      if (m && m.mode === "offline") setOffline(true);
      else if (m && m.mode === "online") setOffline(false);
    }).catch(() => { /* ignore */ });
  }, [desktop]);

  if (!offline || dismissed) return null;

  const tryReconnect = async () => {
    if (!desktop?.tryReconnect) return;
    setReconnecting(true);
    const res = await desktop.tryReconnect().catch(() => ({ ok: false }));
    setReconnecting(false);
    // On success main.js triggers a full page reload into live mode, so
    // this component unmounts before the next render. On failure we leave
    // the banner in place — the spinning stops and the user can tap again.
  };

  return (
    <div
      data-testid="offline-banner"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-2.5 rounded-full bg-amber-500/15 backdrop-blur-xl border border-amber-400/40 shadow-[0_0_40px_rgba(245,158,11,0.25)]"
    >
      <WifiOff size={14} className="text-amber-300 shrink-0" />
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-[12px] text-amber-100 leading-tight">
          <div className="font-semibold">You&apos;re offline.</div>
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-amber-200/80">
            Local maps work · AI & cloud features disabled
          </div>
        </div>
        <button
          onClick={tryReconnect}
          disabled={reconnecting}
          data-testid="offline-reconnect"
          className="mono text-[10px] uppercase tracking-[0.22em] px-2.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-100 hover:bg-amber-400/30 hover:text-white transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={11} className={reconnecting ? "animate-spin" : ""} />
          {reconnecting ? "Probing…" : "Reconnect"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          data-testid="offline-dismiss"
          aria-label="Dismiss"
          className="text-amber-200/70 hover:text-amber-100 transition"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

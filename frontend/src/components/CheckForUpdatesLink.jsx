import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2, CheckCircle2, Download as DLIcon, AlertCircle } from "lucide-react";
import { isDesktop, checkForUpdates, onUpdateStatus, getDesktopVersion } from "@/lib/desktopBridge";

/**
 * "Check for updates…" link that ONLY renders inside the Electron wrapper.
 * In the browser it returns null so it doesn't clutter the UI.
 *
 * Behaviour:
 *   - Click → triggers ipc 'update:check' in main.js
 *   - Subscribes to status events and shows a toast for each transition
 *   - Visible state on the link itself ("Up to date · 1.0.3" / "Downloading…")
 */
const STATE_LABEL = {
  idle:        (v) => v ? `Up to date · v${v}` : "Check for updates…",
  checking:    () => "Checking…",
  available:   (v) => `v${v} available — confirm in dialog`,
  downloading: (_, p) => `Downloading… ${p ?? 0}%`,
  ready:       (v) => `v${v} ready — restart to apply`,
  "up-to-date":(v) => v ? `You're on v${v} — up to date` : "Up to date",
  deferred:    () => "Deferred — re-check anytime",
  error:       () => "Update check failed",
};

const STATE_ICON = {
  idle:        RefreshCw,
  checking:    Loader2,
  available:   DLIcon,
  downloading: Loader2,
  ready:       CheckCircle2,
  "up-to-date":CheckCircle2,
  deferred:    RefreshCw,
  error:       AlertCircle,
};

export default function CheckForUpdatesLink({ className = "" }) {
  const [version, setVersion] = useState(null);
  const [state, setState] = useState("idle");
  const [percent, setPercent] = useState(null);

  useEffect(() => {
    if (!isDesktop()) return undefined;
    getDesktopVersion().then(setVersion);
    const unsub = onUpdateStatus((p) => {
      setState(p?.state || "idle");
      if (typeof p?.percent === "number") setPercent(p.percent);
      if (p?.version && (p.state === "ready" || p.state === "up-to-date")) setVersion(p.version);
      // Friendly toasts for the transitions the user cares about.
      if (p?.state === "up-to-date")
        toast.success(`You're on the latest version (v${p.version || version || ""})`);
      if (p?.state === "ready")
        toast.success(`Update v${p.version} downloaded`, { description: "Restart anytime to apply." });
      if (p?.state === "error")
        toast.error("Update check failed", { description: p.message || "Try again later." });
    });
    return unsub;
  }, [version]);

  if (!isDesktop()) return null;

  const Icon = STATE_ICON[state] || RefreshCw;
  const spinning = state === "checking" || state === "downloading";

  return (
    <button
      type="button"
      data-testid="check-for-updates-btn"
      onClick={() => {
        setState("checking");
        checkForUpdates();
      }}
      disabled={spinning}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-white/10 bg-white/[0.02] text-[#cfdaf3] hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50 transition ${className}`}
      title="Manually check for new versions on GitHub Releases"
    >
      <Icon size={12} className={spinning ? "animate-spin" : ""} />
      <span>{(STATE_LABEL[state] || STATE_LABEL.idle)(version, percent)}</span>
    </button>
  );
}

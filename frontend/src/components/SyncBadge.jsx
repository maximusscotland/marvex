import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { syncNow, getLastSyncedAt, fetchSyncStatus, undoLastSyncPull } from "@/lib/cloudSync";

const AUTO_SYNC_EVERY_MS = 30_000;

const formatAgo = (ts) => {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 10)    return "just now";
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/**
 * Cloud-sync status chip — mounts into any header. Only renders something
 * meaningful for Pro + signed-in users; free/signed-out users see nothing
 * (the chip returns null) so the feature silently gates itself.
 *
 * Shows: Sync now button, live status (Syncing · Synced Xm ago · Error),
 * and runs an auto-sync every 30s while Pro + online.
 */
export default function SyncBadge({ compact = false }) {
  const { user } = useAuth();
  const isPro = !!(user && (user.subscription_status === "active" || user.subscription_status === "trialing"));
  const [status, setStatus] = useState("idle");   // idle | syncing | ok | error
  const [lastSync, setLastSync] = useState(getLastSyncedAt());
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  const runSync = useCallback(async () => {
    setStatus("syncing");
    setError(null);
    const res = await syncNow();
    if (res.ok) {
      setStatus("ok");
      setLastSync(getLastSyncedAt());
      setSummary(res);
    } else {
      setStatus("error");
      setError(res.error || "sync failed");
    }
  }, []);

  // Tick the "synced Xm ago" string once a minute without triggering a sync.
  useEffect(() => {
    const i = setInterval(() => setLastSync(getLastSyncedAt()), 30_000);
    return () => clearInterval(i);
  }, []);

  // Listen for pull events fired by cloudSync.syncNow. When a pull
  // actually overwrites local state, show a Sonner toast with an Undo
  // action. Each map pulled becomes its own toast so the user can Undo
  // them independently.
  useEffect(() => {
    const onPulled = (ev) => {
      const pulled = (ev?.detail?.pulled || []);
      if (!pulled.length) return;

      const first = pulled[0];
      const others = pulled.length - 1;
      const headline =
        pulled.length === 1
          ? `Pulled “${first.title}” from another device`
          : `Pulled ${pulled.length} maps (incl. “${first.title}”${others > 1 ? ` · +${others - 1} more` : ""})`;

      toast(headline, {
        id: `sync-pull-${first.mapId}`,
        description: "Their version replaced yours. You can roll back the latest one.",
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const ok = await undoLastSyncPull(first.mapId);
            if (ok) {
              toast.success(`Restored your local version of “${first.title}”`, {
                description: "It will be pushed back on the next sync.",
              });
              // Trigger a manual sync so the server gets our restored copy.
              runSync();
            } else {
              toast.error("No previous version to restore");
            }
          },
        },
      });
    };
    window.addEventListener("mindmapper:sync-pulled", onPulled);
    return () => window.removeEventListener("mindmapper:sync-pulled", onPulled);
  }, [runSync]);

  // Pro-gated auto-sync.
  useEffect(() => {
    if (!isPro || !user) return;
    let cancelled = false;
    // Fire a status check (cheap) on mount to establish enablement quickly
    // without an immediate heavy push/pull.
    (async () => {
      const s = await fetchSyncStatus();
      if (cancelled) return;
      if (!s?.enabled) return;
      // Kick an initial sync 3s after mount to let the rest of the app load.
      setTimeout(() => { if (!cancelled) runSync(); }, 3000);
    })();
    const int = setInterval(() => { if (!cancelled) runSync(); }, AUTO_SYNC_EVERY_MS);
    return () => { cancelled = true; clearInterval(int); };
  }, [isPro, user, runSync]);

  if (!user) return null;
  if (!isPro) return null; // silently hide for Free users

  const Icon =
    status === "syncing" ? RefreshCw :
    status === "error"   ? AlertGlyph :
    lastSync             ? Check :
    Cloud;

  const colorClass =
    status === "syncing" ? "text-cyan-300 animate-spin" :
    status === "error"   ? "text-red-300" :
    lastSync             ? "text-emerald-300" :
    "text-[#9aa7c7]";

  const label =
    status === "syncing" ? "Syncing…" :
    status === "error"   ? (error === "signed-out" ? "Sign in" : "Retry sync") :
    lastSync             ? `Synced ${formatAgo(lastSync)}` :
    "Sync now";

  return (
    <button
      onClick={runSync}
      disabled={status === "syncing"}
      data-testid="sync-badge"
      data-sync-status={status}
      title={
        error ? `Sync error: ${error}` :
        summary ? `Pushed ${summary.pushed} · Pulled ${summary.pulled} · Deleted ${summary.deleted}` :
        "Click to sync now · auto-syncs every 30s"
      }
      className={`mono text-[10px] uppercase tracking-[0.22em] px-2.5 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
        status === "error"
          ? "border-red-400/40 text-red-300 hover:border-red-400/60 bg-red-500/5"
          : "border-white/10 text-[#9aa7c7] hover:text-cyan-300 hover:border-cyan-400/40"
      } ${compact ? "px-2 py-1" : ""}`}
    >
      <Icon size={11} className={colorClass} />
      {!compact && <span>{label}</span>}
    </button>
  );
}

// Local glyph so we don't clash with lucide's AlertCircle import in other files.
const AlertGlyph = (props) => <AlertCircle {...props} />;
// Silence unused-var: some builds tree-shake CloudOff (reserved for offline state).
void CloudOff;

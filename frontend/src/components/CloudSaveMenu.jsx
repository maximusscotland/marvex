import React, { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2, ExternalLink, Lock, Cloud, Check, AlertCircle, FileText as FileTextIcon, Zap, Share2 } from "lucide-react";
import { buildMapBlob } from "@/lib/exportPng";
import {
  saveBlobToDrive,
  isConfigured as isDriveConfigured,
} from "@/lib/googleDrive";
import {
  saveBlobToDropbox,
  isConfigured as isDropboxConfigured,
} from "@/lib/dropbox";
import {
  saveMapToZotero,
  saveMapToZoteroFull,
  isZoteroConnected,
} from "@/lib/zotero";

/**
 * Cloud Save popover — launches format → target dialog for saving a mind-map
 * directly to the user's cloud storage. Targets:
 *   - Google Drive (all 6 formats; app-created files only via drive.file scope)
 *   - Dropbox (all 6 formats; PKCE-based OAuth, /Marvex Studio folder)
 *   - Zotero:
 *       · Markdown → HTML note attached to a parent "report" item
 *       · PDF → HTML note + binary PDF attachment via Zotero's 3-step MD5
 *         upload protocol (Phase 2, shipped Feb 2026)
 *   - All targets (Pro superpower — fires all 3 in parallel via Promise.allSettled)
 *
 * Pro-gated: non-Pro users see a lock badge and an "Upgrade" CTA.
 */
const FORMATS = [
  { id: "pdf",    label: "PDF",       hint: "Vector, shareable" },
  { id: "png",    label: "PNG",       hint: "Raster 2×" },
  { id: "png-4x", label: "PNG · 4×",  hint: "Retina / print" },
  { id: "svg",    label: "SVG",       hint: "Vector, editable" },
  { id: "md",     label: "Markdown",  hint: "Obsidian / Notion" },
  { id: "json",   label: "JSON",      hint: "Backup / re-import" },
];

const TARGETS = [
  { id: "drive",   label: "Drive",   folder: "Marvex Studio folder" },
  { id: "dropbox", label: "Dropbox", folder: "/Marvex Studio folder" },
  { id: "zotero",  label: "Zotero",  folder: "Zotero library as a note" },
  { id: "all",     label: "All",     folder: "Drive + Dropbox + Zotero in parallel" },
];

/** Zotero accepts Markdown (as HTML note) and PDF (as binary attachment via MD5 protocol). */
const targetSupports = (targetId, formatId) =>
  targetId !== "zotero" || formatId === "md" || formatId === "pdf";

/**
 * Dispatch a custom event Studio.jsx listens to → open ShareDialog.
 * Falls back gracefully if no listener is attached (e.g. embedded canvas).
 */
const triggerShareDialog = () => {
  try {
    window.dispatchEvent(new CustomEvent("mindmapper:open-share"));
  } catch {
    /* ignore */
  }
};

/**
 * Small inline CTA rendered at the bottom of every Cloud-Save success toast.
 * One click → share dialog. The whole point is to piggyback on the "I just
 * saved my map" moment and turn it into viral distribution.
 */
const ShareNudge = () => (
  <button
    data-testid="cloud-save-share-nudge"
    onClick={triggerShareDialog}
    className="mt-1 inline-flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-2"
  >
    <Share2 size={11} /> Share this map
  </button>
);

/** Run one target's save. Returns {label, ok, name, link, error, skipped}. */
const runTarget = async ({ targetId, map, formatId }) => {
  const label =
    targetId === "drive"   ? "Google Drive"
    : targetId === "dropbox" ? "Dropbox"
    : "Zotero";
  try {
    if (targetId === "drive") {
      if (!isDriveConfigured()) return { label, skipped: true, reason: "Drive keys not set" };
      const { blob, mimeType, filename } = await buildMapBlob(map, formatId);
      const res = await saveBlobToDrive({ blob, filename, mimeType });
      return { label, ok: true, name: res.fileName, link: res.webViewLink };
    }
    if (targetId === "dropbox") {
      if (!isDropboxConfigured()) return { label, skipped: true, reason: "Dropbox key not set" };
      const { blob, filename } = await buildMapBlob(map, formatId);
      const res = await saveBlobToDropbox({ blob, filename });
      return { label, ok: true, name: res.fileName, link: res.link };
    }
    // zotero
    if (!isZoteroConnected()) return { label, skipped: true, reason: "Zotero not connected" };
    if (formatId === "pdf") {
      const { blob, filename } = await buildMapBlob(map, "pdf");
      const res = await saveMapToZoteroFull({ map, pdfBlob: blob, pdfFilename: filename });
      const suffix = res.pdfDeduped ? " (PDF already in library)" : res.pdfKey ? " + PDF" : "";
      return { label, ok: true, name: `Mind-map · ${map.title || "Untitled"}${suffix}`, link: res.zoteroUrl };
    }
    const res = await saveMapToZotero({ map });
    return { label, ok: true, name: `Mind-map · ${map.title || "Untitled"}`, link: res.zoteroUrl };
  } catch (e) {
    return { label, ok: false, error: e.message || String(e) };
  }
};

const CloudSaveMenu = ({ open, map, isPro, isProOnly = false, onUpgrade, onClose }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null); // format id in progress
  const [target, setTarget] = useState("drive");

  if (!open) return null;

  const targetMeta = TARGETS.find((t) => t.id === target);
  const targetIsConfigured =
    target === "drive"   ? isDriveConfigured()
    : target === "dropbox" ? isDropboxConfigured()
    : target === "zotero"  ? isZoteroConnected()
    : true; // 'all' never blocks on single-target config (it skips gracefully)

  const handleSave = async (formatId) => {
    if (!map) {
      toast.error("Open a map first");
      return;
    }
    if (!isPro) {
      onClose && onClose();
      onUpgrade && onUpgrade();
      return;
    }
    // Save-to-all-targets is a Pro-only superpower (Lite tier excluded).
    // Single-target saves stay available to every paying tier.
    if (target === "all" && !isProOnly) {
      toast.error("Mirror to all 3 targets is a Pro feature — upgrade from Lite to enable");
      onClose && onClose();
      onUpgrade && onUpgrade();
      return;
    }
    if (!targetSupports(target, formatId)) {
      toast(`Zotero accepts Markdown notes and PDF attachments — other formats coming soon.`, { duration: 4500 });
      return;
    }
    if (target !== "all" && !targetIsConfigured) {
      if (target === "zotero") {
        toast.error("Connect Zotero first — opening Intake Studio…", { duration: 4500 });
        onClose && onClose();
        navigate("/intake");
        return;
      }
      const env = target === "drive" ? "REACT_APP_GOOGLE_DRIVE_*" : "REACT_APP_DROPBOX_APP_KEY";
      toast.error(`${targetMeta.label} isn't configured — ask the admin to set ${env} in .env`, { duration: 6000 });
      return;
    }

    setBusy(formatId);
    const toastId = `cloud-save-${target}-${formatId}`;

    // ───────── "All targets" ─────────
    if (target === "all") {
      toast.loading(`Mirroring to Drive · Dropbox · Zotero…`, { id: toastId });
      const results = await Promise.allSettled([
        runTarget({ targetId: "drive",   map, formatId }),
        runTarget({ targetId: "dropbox", map, formatId }),
        runTarget({ targetId: "zotero",  map, formatId }),
      ]);
      const flat = results.map((r) =>
        r.status === "fulfilled" ? r.value : { label: "?", ok: false, error: String(r.reason) }
      );
      const okCount = flat.filter((x) => x.ok).length;
      const skippedCount = flat.filter((x) => x.skipped).length;
      const failedCount = flat.filter((x) => !x.ok && !x.skipped).length;

      const StatusIcon = ({ state }) =>
        state === "ok" ? <Check size={11} className="text-emerald-300" />
        : state === "skipped" ? <AlertCircle size={11} className="text-amber-300" />
        : <AlertCircle size={11} className="text-rose-300" />;

      const anyOk = okCount > 0;
      const body = (
        <div className="flex flex-col gap-1" data-testid="cloud-save-all-result">
          <div className="flex items-center gap-1.5 font-semibold">
            <Zap size={12} className="text-cyan-300" />
            <span>{anyOk ? `Saved to ${okCount}/${flat.length} · ${formatId.toUpperCase()}` : "Mirror failed"}</span>
          </div>
          {flat.map((r, i) => {
            const state = r.ok ? "ok" : r.skipped ? "skipped" : "err";
            return (
              <div key={i} className="flex items-center gap-1.5 text-[11px]" data-testid={`cloud-save-all-row-${(r.label || "?").toLowerCase().replace(/\s+/g,'-')}`}>
                <StatusIcon state={state} />
                <span className="text-[#d6e3f5]">{r.label}</span>
                {r.ok && r.link && (
                  <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-0.5">
                    <ExternalLink size={10} /> open
                  </a>
                )}
                {r.skipped && <span className="text-amber-300/80">· {r.reason}</span>}
                {!r.ok && !r.skipped && <span className="text-rose-300/80 truncate max-w-[180px]">· {r.error}</span>}
              </div>
            );
          })}
          {skippedCount > 0 && !anyOk && (
            <div className="text-[10px] text-[#7a87ad] mt-0.5">Connect targets in Intake Studio / .env to enable mirroring.</div>
          )}
          {anyOk && <ShareNudge />}
        </div>
      );
      const toastFn = anyOk ? toast.success : (failedCount === 0 ? toast.warning ?? toast : toast.error);
      toastFn(body, { id: toastId, duration: 14000 });
      setBusy(null);
      if (anyOk) onClose && onClose();
      return;
    }

    // ───────── Single target ─────────
    const actionLabel = target === "zotero"
      ? "Saving note to Zotero"
      : `Saving ${formatId.toUpperCase()} to ${targetMeta.label}`;
    toast.loading(`${actionLabel}…`, { id: toastId });
    try {
      const res = await runTarget({ targetId: target, map, formatId });
      if (res.skipped) {
        toast.error(res.reason, { id: toastId, duration: 6000 });
        return;
      }
      if (!res.ok) throw new Error(res.error);
      toast.success(
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Cloud size={12} className="text-cyan-300" />
            <span>Saved to {res.label} · <span className="mono text-[11px]">{res.name}</span></span>
          </div>
          {res.link && (
            <a
              href={res.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-300 text-[11px] hover:text-cyan-200"
              data-testid={`cloud-save-open-${target}`}
            >
              <ExternalLink size={11} /> Open in {res.label}
            </a>
          )}
          <ShareNudge />
        </div>,
        { id: toastId, duration: 10000 }
      );
      onClose && onClose();
    } catch (e) {
      toast.error(`${targetMeta.label} save failed: ${e.message || e}`, { id: toastId, duration: 7000 });
    } finally {
      setBusy(null);
    }
  };

  const showingAll = target === "all";

  return (
    <div
      data-testid="cloud-save-menu"
      className="absolute top-full right-0 mt-2 p-3 glass-panel rounded-xl fade-up z-50"
      style={{ borderColor: "rgba(0,240,255,0.28)", minWidth: 288 }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80">
          Save to cloud
        </div>
        {!isPro && (
          <div
            className="flex items-center gap-1 mono text-[9px] uppercase tracking-[0.18em] text-fuchsia-300/90"
            data-testid="cloud-save-pro-badge"
          >
            <Lock size={9} /> Pro
          </div>
        )}
      </div>

      {/* Target pills — 4 across. The 'all' pill carries an extra Pro
          lock for Lite-tier users; clicking it pops the upgrade dialog
          instead of letting them drill into a feature they can't use. */}
      <div className="grid grid-cols-4 gap-1 mb-2.5" data-testid="cloud-save-targets">
        {TARGETS.map((t) => {
          const active = target === t.id;
          const isAll = t.id === "all";
          const allLocked = isAll && isPro && !isProOnly;
          return (
            <button
              key={t.id}
              data-testid={`cloud-save-target-${t.id}`}
              onClick={() => {
                if (allLocked) {
                  onClose && onClose();
                  onUpgrade && onUpgrade();
                  return;
                }
                setTarget(t.id);
              }}
              disabled={!!busy}
              title={allLocked ? "Pro-only — upgrade from Lite to mirror to all 3 targets" : undefined}
              className={`rounded-md px-1 py-1.5 text-center border transition mono text-[9px] uppercase tracking-[0.10em] flex items-center justify-center gap-0.5 ${
                active
                  ? isAll
                    ? "border-fuchsia-400 bg-fuchsia-400/10 text-fuchsia-200"
                    : "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                  : isAll
                    ? "border-fuchsia-400/30 bg-fuchsia-400/[0.03] text-fuchsia-200/80 hover:border-fuchsia-400/60"
                    : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50"
              } ${busy ? "opacity-60 cursor-wait" : ""} ${allLocked ? "opacity-70" : ""}`}
            >
              {isAll && <Zap size={9} />} {t.label}
              {allLocked && <Lock size={8} className="ml-0.5 text-fuchsia-300/90" />}
            </button>
          );
        })}
      </div>

      <div className="text-[10px] text-[#7a87ad] mb-2.5 leading-snug">
        {isPro ? (
          target === "zotero" && !targetIsConfigured ? (
            <>Connect Zotero from <button
              onClick={() => { onClose && onClose(); navigate("/intake"); }}
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
              data-testid="cloud-save-connect-zotero"
            >Intake Studio</button> first.</>
          ) : showingAll ? (
            <>Fires <span className="text-fuchsia-300">Drive + Dropbox + Zotero</span> in parallel. Not-connected targets are skipped gracefully.</>
          ) : (
            <>Uploads to <span className="text-cyan-300">{targetMeta.folder}</span>.</>
          )
        ) : (
          <>Save exports straight to {targetMeta.label} · <button
            onClick={() => { onClose && onClose(); onUpgrade && onUpgrade(); }}
            className="text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-2"
            data-testid="cloud-save-upgrade-link"
          >Upgrade</button></>
        )}
      </div>

      {target === "zotero" ? (
        // Zotero phase 1 = note only
        <button
          data-testid="cloud-save-md"
          disabled={!!busy}
          onClick={() => handleSave("md")}
          className={`w-full relative rounded-md px-3 py-2.5 text-left border transition ${
            isPro
              ? "border-white/10 bg-white/[0.02] text-[#d6e3f5] hover:border-cyan-400/50 hover:bg-cyan-400/[0.06]"
              : "border-white/10 bg-white/[0.02] text-[#7a6da0] hover:border-fuchsia-400/60"
          } ${busy ? "opacity-60 cursor-wait" : ""}`}
        >
          <div className="mono text-[10px] uppercase tracking-[0.14em] flex items-center gap-1.5">
            {busy === "md" ? <Loader2 size={10} className="animate-spin text-cyan-300" /> : <FileTextIcon size={11} />}
            Save as Zotero note
            {!isPro && <Lock size={8} className="ml-auto text-fuchsia-300/90" />}
          </div>
          <div className="text-[9px] text-[#6c7aa3] mt-0.5">Creates a report + child note, tagged #Marvex Studio</div>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {FORMATS.map((f) => {
            const inFlight = busy === f.id;
            const hoverBorder = showingAll ? "hover:border-fuchsia-400/60" : "hover:border-cyan-400/50";
            const hoverBg = showingAll ? "hover:bg-fuchsia-400/[0.06]" : "hover:bg-cyan-400/[0.06]";
            return (
              <button
                key={f.id}
                data-testid={`cloud-save-${f.id}${showingAll ? "-all" : ""}`}
                disabled={!!busy}
                onClick={() => handleSave(f.id)}
                className={`relative rounded-md px-2 py-1.5 text-left border transition ${
                  isPro
                    ? `border-white/10 bg-white/[0.02] text-[#d6e3f5] ${hoverBorder} ${hoverBg}`
                    : "border-white/10 bg-white/[0.02] text-[#7a6da0] hover:border-fuchsia-400/60"
                } ${busy ? "opacity-60 cursor-wait" : ""}`}
                title={isPro ? (showingAll ? `Mirror ${f.label} to all 3 targets` : `Save as ${f.label}`) : `${f.label} · Pro`}
              >
                <div className="mono text-[10px] uppercase tracking-[0.14em] flex items-center gap-1">
                  {inFlight && <Loader2 size={10} className={`animate-spin ${showingAll ? "text-fuchsia-300" : "text-cyan-300"}`} />}
                  {f.label}
                  {!isPro && <Lock size={8} className="ml-auto text-fuchsia-300/90" />}
                </div>
                <div className="text-[9px] text-[#6c7aa3] mt-0.5">{f.hint}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CloudSaveMenu;

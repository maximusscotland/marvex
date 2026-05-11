/* eslint-disable react/prop-types */
import React, { useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * FilePickerButton — small "Choose file…" affordance that pops the OS
 * file picker so users never have to remember a file path.
 *
 * Why a data URL (not a path)?
 *   Browser security strictly forbids handing back a real filesystem
 *   path; the File API only exposes a sandboxed File blob. Converting
 *   to a data URL is the only encoding that:
 *     (a) round-trips through localStorage / IndexedDB cleanly,
 *     (b) opens directly in a new tab when clicked,
 *     (c) works identically in the Electron desktop build.
 *
 * Size cap:
 *   12 MB hard cap (data URL is ~33% larger than the source).
 *   Larger files should live behind a cloud link (Drive / Dropbox).
 *
 * Caller contract:
 *   onPicked(dataUrl, fileName, file) is called once the file is read.
 *   The caller decides where to stash the result (typically into a
 *   `link` field on the node / annotation / timeline event).
 */
const MAX_BYTES = 12 * 1024 * 1024;

export default function FilePickerButton({
  onPicked,
  accept = "*/*",
  label = "Choose file…",
  testId = "file-picker-btn",
  compact = false,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error(
        `File too large — max ${Math.round(MAX_BYTES / 1024 / 1024)} MB. Use a cloud link (Drive / Dropbox) for bigger files.`,
      );
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      onPicked?.(dataUrl, file.name, file);
    } catch {
      toast.error("Couldn't read the file — try again.");
    } finally {
      setBusy(false);
    }
  };

  const cls = compact
    ? "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-cyan-400/40 bg-cyan-400/[0.06] text-cyan-200 hover:bg-cyan-400/15 hover:border-cyan-300/60 text-[11px] transition disabled:opacity-60 disabled:cursor-not-allowed"
    : "shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-400/40 bg-cyan-400/[0.06] text-cyan-200 hover:bg-cyan-400/15 hover:border-cyan-300/60 text-[12px] transition disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        data-testid={`${testId}-input`}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || disabled}
        data-testid={testId}
        className={cls}
        title="Pick a file from your computer — no path typing needed"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
        {busy ? "Reading…" : label}
      </button>
    </>
  );
}

/**
 * Tiny helper component — renders a friendly "📎 Attached: filename"
 * preview pill when a `link` field actually contains an inline data
 * URL (so the raw base64 isn't shown to the user). Filename is
 * extracted from the mime type if not provided.
 */
export function AttachedFilePill({ value, fileName, onClear, testId = "file-picker-pill" }) {
  if (!value || !String(value).startsWith("data:")) return null;
  const mime = String(value).slice(5, String(value).indexOf(";")) || "file";
  const display = fileName || `${mime.replace("/", ".")}`;
  return (
    <div
      data-testid={testId}
      className="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/[0.06] text-[11px] text-emerald-100"
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <Paperclip size={11} className="shrink-0" />
        <span className="truncate">Attached: {display}</span>
      </span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          data-testid={`${testId}-clear`}
          className="shrink-0 mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded border border-white/15 text-[#9aaad0] hover:text-white hover:border-white/40 transition"
        >
          Remove
        </button>
      )}
    </div>
  );
}

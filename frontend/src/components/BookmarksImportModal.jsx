import React, { useRef, useState } from "react";
import { Bookmark, Upload, X, ExternalLink } from "lucide-react";
import { buildMapFromBookmarks } from "@/lib/bookmarksImport";
import { saveMap } from "@/lib/storage";
import { toast } from "sonner";

/**
 * BookmarksImportModal — drop a bookmarks.html file (the standard Netscape
 * format every major browser exports) and we'll turn the entire folder tree
 * into a mind-map. Folders become branch nodes, individual bookmarks become
 * leaf nodes with .link set so a node-click opens the URL.
 *
 * Wired into the Studio sidebar's "+ New" / Library "Import" menu.
 *
 * Props:
 *   open       - boolean, controls visibility
 *   onClose    - close callback
 *   onImported - (newMap) => void, called once the map is saved (lets the
 *                caller jump into it / refresh library)
 */
export default function BookmarksImportModal({ open, onClose, onImported }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // { html, linkCount, folderCount, title }
  const [dragOver, setDragOver] = useState(false);

  if (!open) return null;

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".html") && !file.name.toLowerCase().endsWith(".htm")) {
      toast.error("That doesn't look like a bookmarks .html file");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Bookmarks file is over 25 MB — try splitting it");
      return;
    }
    try {
      setBusy(true);
      const html = await file.text();
      // Quick sanity check — Netscape format always starts with this DOCTYPE.
      if (!/<DL/i.test(html)) {
        toast.error("File doesn't look like a Netscape bookmarks export. Re-export from your browser.");
        return;
      }
      // Parse once for the preview; we'll re-parse on commit so the resulting
      // map has fresh node IDs (avoids edge case where the user previews,
      // tweaks the title, and re-imports).
      const { map, linkCount, folderCount } = buildMapFromBookmarks(html, {
        rootTitle: file.name.replace(/\.html?$/i, "").slice(0, 120) || "Browser bookmarks",
      });
      setPreview({
        html,
        linkCount,
        folderCount,
        title: map.title,
      });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't read that file");
    } finally {
      setBusy(false);
    }
  };

  const commitImport = () => {
    if (!preview) return;
    try {
      setBusy(true);
      const { map } = buildMapFromBookmarks(preview.html, {
        rootTitle: preview.title || "Browser bookmarks",
      });
      const saved = saveMap(map);
      toast.success(
        `Imported ${preview.linkCount} bookmark${preview.linkCount === 1 ? "" : "s"} across ${preview.folderCount} folder${preview.folderCount === 1 ? "" : "s"}`
      );
      onImported?.(saved);
      onClose?.();
      setPreview(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Couldn't save the imported map");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="bookmarks-import-modal"
      className="fixed inset-0 z-[100] grid place-items-center p-6"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(8px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="relative w-full max-w-xl rounded-2xl border border-cyan-400/30 bg-[#0a0f24]/95 p-6"
        style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.55)" }}
      >
        <button
          data-testid="bookmarks-import-close"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md text-[#7a87ad] hover:text-white hover:bg-white/5 transition"
          title="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <Bookmark size={20} className="text-cyan-300" />
          <h2 className="text-xl font-semibold text-white">Import browser bookmarks</h2>
        </div>
        <p className="text-[13px] text-[#9aa7c7] leading-relaxed mb-5">
          Drop a <code className="mono text-cyan-300/90">bookmarks.html</code> file
          (exported from any browser) and we'll turn every folder + link into
          an editable mind-map. Each link becomes a clickable node.
        </p>

        {/* Step-by-step quick guide */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 mb-5">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
            How to export
          </div>
          <ul className="text-[12.5px] text-[#cfdaf3] space-y-1.5">
            <li>· <span className="text-white font-medium">Chrome / Edge / Brave:</span> ⋯ menu → Bookmarks → Bookmark manager → ⋮ → Export bookmarks</li>
            <li>· <span className="text-white font-medium">Firefox:</span> ☰ → Bookmarks → Manage bookmarks → Import &amp; Backup → Export bookmarks to HTML</li>
            <li>· <span className="text-white font-medium">Safari:</span> File → Export → Bookmarks…</li>
          </ul>
        </div>

        {!preview && (
          <label
            htmlFor="bookmarks-import-input"
            data-testid="bookmarks-import-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer?.files?.[0];
              if (f) handleFile(f);
            }}
            className={`flex flex-col items-center justify-center text-center px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition ${
              dragOver
                ? "border-cyan-400 bg-cyan-400/[0.06]"
                : "border-white/15 hover:border-cyan-400/50 hover:bg-white/[0.02]"
            }`}
          >
            <Upload size={28} className={dragOver ? "text-cyan-300" : "text-[#7a87ad]"} />
            <div className="mt-2 text-white text-sm font-medium">
              Drag a bookmarks.html file here
            </div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mt-1">
              or click to browse
            </div>
            <input
              ref={fileRef}
              id="bookmarks-import-input"
              data-testid="bookmarks-import-input"
              type="file"
              accept=".html,.htm,text/html"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
              disabled={busy}
            />
          </label>
        )}

        {preview && (
          <div data-testid="bookmarks-import-preview" className="rounded-xl border border-cyan-400/30 bg-cyan-400/[0.04] p-4">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90 mb-3">
              Preview
            </div>
            <input
              data-testid="bookmarks-import-title"
              value={preview.title}
              onChange={(e) => setPreview((p) => ({ ...p, title: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-white text-base outline-none focus:border-cyan-400 mb-3"
              placeholder="Map title"
            />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Stat label="Bookmarks" value={preview.linkCount} />
              <Stat label="Folders" value={preview.folderCount} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                data-testid="bookmarks-import-cancel"
                onClick={() => setPreview(null)}
                className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-md border border-white/10 text-[#9aa7c7] hover:text-white hover:bg-white/5 transition"
              >
                Choose different file
              </button>
              <button
                data-testid="bookmarks-import-confirm"
                onClick={commitImport}
                disabled={busy || preview.linkCount === 0}
                className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-md bg-cyan-400 text-black font-bold hover:bg-cyan-300 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <ExternalLink size={11} />
                Create map
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-md bg-white/[0.03] border border-white/5">
    <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad]">{label}</div>
    <div className="text-2xl font-bold text-cyan-200 tabular-nums">{value}</div>
  </div>
);

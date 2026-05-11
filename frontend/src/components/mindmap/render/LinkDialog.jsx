import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import { listMaps } from "@/lib/storage";
import FilePickerButton, { AttachedFilePill } from "@/components/common/FilePickerButton";

/**
 * Modal for attaching/editing/removing the link on a map element.
 *
 * No URL validation here on purpose — the canvas's `normalizeLink` does
 * that on save so we don't reject e.g. `mailto:` or bare-domain inputs
 * the user typed without a scheme.  Ref-based autofocus uses a 30 ms
 * timeout because the surrounding overlay animates in via `fade-up`,
 * which would otherwise steal focus on first paint.
 *
 * Three exit paths:
 *   • `Save` button or Enter → onSave(currentValue)
 *   • Empty input + Save / "Remove link" button → onSave("") (caller treats
 *     an empty string as a removal request)
 *   • Cancel / Esc / backdrop click → onCancel()
 *
 * Bookmark hint:
 *   If the user has previously imported a bookmarks file (Studio sidebar →
 *   Bookmarks), we surface a "Pick from my bookmarks" affordance directly
 *   inside the input so the dialog itself becomes the discovery point —
 *   no need to find the right-click menu first.
 */
export default function LinkDialog({ initial = "", onSave, onCancel, onPickBookmark }) {
  const [val, setVal] = useState(initial);
  const [pickedName, setPickedName] = useState("");
  const inputRef = useRef(null);

  // Quick scan for any imported bookmarks; if present, show the
  // "Pick from bookmarks" CTA. Counted (not just boolean) so we can
  // show e.g. "92 bookmarks" right in the dialog.
  const bookmarkCount = useMemo(() => {
    try {
      let n = 0;
      const walk = (node) => {
        if (!node) return;
        if (node.link && typeof node.link === "string") n += 1;
        if (Array.isArray(node.children)) node.children.forEach(walk);
      };
      for (const stub of listMaps()) {
        if (stub.source !== "bookmarks-import") continue;
        walk(stub);
      }
      return n;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);
  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); onSave(val); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
    // Cmd/Ctrl-B → jump straight into the bookmark picker. Only fires
    // when the picker callback is wired (i.e. caller opted into it),
    // and only when the user has imported bookmarks worth picking from.
    if (
      (e.metaKey || e.ctrlKey) &&
      (e.key === "b" || e.key === "B") &&
      onPickBookmark &&
      bookmarkCount > 0
    ) {
      e.preventDefault();
      onPickBookmark();
    }
  };
  return (
    <div
      data-testid="mm-link-dialog"
      className="fixed inset-0 z-[60] grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg glass-panel rounded-2xl p-6 fade-up"
        style={{ borderColor: "rgba(0,240,255,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
          Attach link
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Link this map element to…
        </h3>
        <p className="text-[12px] text-[#7a87ad] mb-4 leading-relaxed">
          URL, email, or file path. Accepts <span className="text-cyan-300 mono">https://</span>,
          <span className="text-cyan-300 mono"> mailto:</span>,
          <span className="text-cyan-300 mono"> file://</span>, or bare domains
          (e.g. <span className="text-cyan-300 mono">arxiv.org/abs/2104.00234</span>).
        </p>
        <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          data-testid="mm-link-input"
          value={val.startsWith("data:") ? "" : val}
          onChange={(e) => { setVal(e.target.value); setPickedName(""); }}
          onKeyDown={onKey}
          placeholder="https://example.com  ·  me@x.com  ·  or click Choose file…"
          className="flex-1 min-w-0 bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-cyan-400/60 text-white text-[14px] placeholder-[#566187]"
        />
          <FilePickerButton
            testId="mm-link-file-picker"
            label="Choose file…"
            onPicked={(dataUrl, fileName) => {
              setVal(dataUrl);
              setPickedName(fileName);
            }}
          />
        </div>
        <AttachedFilePill
          value={val}
          fileName={pickedName}
          onClear={() => { setVal(""); setPickedName(""); }}
          testId="mm-link-attached"
        />
        {onPickBookmark && bookmarkCount > 0 && (
          <button
            type="button"
            data-testid="mm-link-pick-bookmark"
            onClick={onPickBookmark}
            className="mt-3 w-full flex items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3.5 py-2.5 text-left transition hover:bg-amber-400/[0.12] hover:border-amber-400/60"
            title="Open the bookmark picker (⌘/Ctrl-B)"
          >
            <span className="flex items-center gap-2">
              <Bookmark size={14} className="text-amber-300 shrink-0" />
              <span className="text-[13px] text-amber-100">
                Pick from your bookmarks
              </span>
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-amber-300/70">
                · {bookmarkCount} saved
              </span>
            </span>
            <span className="mono text-[9px] uppercase tracking-[0.22em] text-amber-200/60">
              ⌘ B
            </span>
          </button>
        )}
        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            data-testid="mm-link-remove"
            onClick={() => onSave("")}
            className="text-[12px] mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition"
          >
            Remove link
          </button>
          <div className="flex items-center gap-2">
            <button
              data-testid="mm-link-cancel"
              onClick={onCancel}
              className="text-[12px] mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-white/10 text-[#9aaad0] hover:text-white transition"
            >
              Cancel
            </button>
            <button
              data-testid="mm-link-save"
              onClick={() => onSave(val)}
              className="cta-pill text-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

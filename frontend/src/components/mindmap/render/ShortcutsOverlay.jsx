import React from "react";
import { X } from "lucide-react";

/**
 * Keyboard-shortcuts modal triggered by `?`.
 * Pure presentation. The shortcut list lives at module scope so it can also
 * be referenced by docs/help pages without dragging the overlay along.
 */

export const SHORTCUTS = [
  { group: "Map element", items: [
    { keys: ["Tab"], label: "Add child to selected map element" },
    { keys: ["Enter"], label: "Rename selected map element" },
    { keys: ["Delete"], label: "Remove selected branch" },
    { keys: ["Esc"], label: "Deselect / close menu" },
    { keys: ["⌘", "B"], label: "Insert one of your imported bookmarks as the link" },
  ]},
  { group: "Canvas", items: [
    { keys: ["Drag"], label: "Pan the canvas" },
    { keys: ["Scroll"], label: "Zoom in / out" },
    { keys: ["Double-click"], label: "Rename map element" },
    { keys: ["Right-click"], label: "Options menu" },
    { keys: ["Click line"], label: "Select connecting line" },
  ]},
  { group: "App", items: [
    { keys: ["⌘", "K"], label: "Global search across all maps" },
    { keys: ["⌘", "P"], label: "Jump to a map (command palette)" },
    { keys: ["⌘", "Z"], label: "Undo last edit" },
    { keys: ["⌘", "⇧", "Z"], label: "Redo" },
    { keys: ["["], label: "Hide / show sidebar" },
    { keys: ["?"], label: "Toggle this overlay" },
  ]},
];

export default function ShortcutsOverlay({ onClose }) {
  // The Mac-vs-Windows split lets us *filter* shortcut rows where each item
  // declares `mac: true|false`. Today every row is platform-agnostic so the
  // filter is a no-op; the hook is here so we don't have to re-plumb when
  // we add e.g. an `Option`-only Mac trick.
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  return (
    <div
      data-testid="shortcuts-overlay"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.72)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl glass-panel rounded-2xl p-7 fade-up"
        style={{ borderColor: "rgba(0,240,255,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">Keyboard</div>
            <h3 className="text-xl font-semibold text-white">Shortcuts</h3>
          </div>
          <button
            data-testid="shortcuts-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {SHORTCUTS.map((grp) => (
            <div key={grp.group}>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3">{grp.group}</div>
              <ul className="space-y-2.5">
                {grp.items
                  .filter((item) => item.mac === undefined || item.mac === isMac)
                  .map((item, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-[#cfdaf3]">{item.label}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, j) => (
                          <kbd
                            key={j}
                            className="mono text-[10px] px-1.5 py-0.5 rounded bg-[#0a0f24] border border-white/15 text-cyan-200"
                            style={{ boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.5)" }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-white/5 mono text-[10px] uppercase tracking-[0.22em] text-[#566187] text-center">
          Press <kbd className="mono text-[10px] px-1 py-0.5 rounded bg-[#0a0f24] border border-white/15 text-cyan-200">?</kbd> anywhere to toggle
        </div>
      </div>
    </div>
  );
}

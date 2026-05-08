import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, X, Search, ExternalLink, Clock } from "lucide-react";
import { listMaps } from "@/lib/storage";

// Saved maps store children directly at the top level (no wrapper `.root`
// property — `buildMapFromBookmarks` spreads the parsed root node onto the
// map doc). So we walk the stub itself.

// localStorage key for the most-recently-picked bookmarks.  We keep the
// last 5 because that's enough to cover daily-use shortcuts (people tend
// to drop the same papers/URLs onto multiple maps for cross-referencing)
// without crowding the modal.
const RECENTS_KEY = "mm.bookmarkPicker.recents";
const RECENTS_MAX = 5;

const readRecents = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

/** Public helper so callers (MindMapCanvas) can record a pick once it has
 * been applied successfully. Keeping the writer external means a failed
 * apply never pollutes the recents list. */
export const recordBookmarkPick = (bookmark) => {
  if (!bookmark?.url) return;
  try {
    const existing = readRecents().filter((b) => b.url !== bookmark.url);
    const next = [
      { url: bookmark.url, title: bookmark.title, mapTitle: bookmark.mapTitle, ts: Date.now() },
      ...existing,
    ].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — non-fatal */
  }
};

/**
 * BookmarkPickerModal — quickly attach a previously-imported bookmark as a
 * node's link.
 *
 * Scans the user's local library for maps whose metadata flags them as
 * imported bookmarks (`source === "bookmarks-import"`) and flattens every
 * leaf node that has a URL into a single searchable list. Picking one calls
 * `onPick({ url, title })` — the caller decides what to do (attach to a
 * node, paste into a text field, etc.).
 *
 * The most recently-picked bookmarks (max 5) get pinned at the top so
 * frequent-flyers don't have to keep searching for the same URLs.
 *
 * Design notes:
 *   • No fuzzy search library — users typically have a few hundred
 *     bookmarks at most, plain substring matching is plenty and keeps the
 *     bundle small.
 *   • We surface the origin map's name next to each bookmark so a user who
 *     imported multiple bookmark files (work / personal / old-browser) can
 *     disambiguate.
 *   • Empty-state leads the user to the import flow rather than dead-ending.
 */
export default function BookmarkPickerModal({ open, onClose, onPick, onOpenImport }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState([]);
  const [recents, setRecents] = useState([]);

  // Re-scan on every open so newly-imported bookmarks show up immediately.
  useEffect(() => {
    if (!open) return;
    const collected = [];
    try {
      for (const stub of listMaps()) {
        if (stub.source !== "bookmarks-import") continue;
        walk(stub, (node) => {
          if (node.link && typeof node.link === "string") {
            collected.push({
              url: node.link,
              title: node.title || "Untitled",
              mapTitle: stub.title || "Bookmarks",
              mapId: stub.id,
              nodeId: node.id,
            });
          }
        });
      }
    } catch {
      /* ignore — a single corrupt map shouldn't break the picker */
    }
    setAll(collected);
    // Drop any recents whose URL has since been removed from the library
    // (otherwise we'd surface phantom entries that 404 on click).
    const liveUrls = new Set(collected.map((b) => b.url));
    setRecents(readRecents().filter((r) => liveUrls.has(r.url)));
    setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return all.slice(0, 500);   // cap render size; plenty for UX
    const q = query.trim().toLowerCase();
    return all
      .filter((b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.mapTitle.toLowerCase().includes(q),
      )
      .slice(0, 500);
  }, [all, query]);

  // Only show recents when there is no active search — they'd duplicate
  // matches in `filtered` otherwise.
  const showRecents = !query.trim() && recents.length > 0;

  const handlePick = (b) => {
    onPick?.(b);
    recordBookmarkPick(b);
    onClose?.();
  };

  if (!open) return null;

  return createPortal(
    <div
      data-testid="bookmark-picker-modal"
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/70 backdrop-blur-sm pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0a0f24] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Bookmark size={14} className="text-amber-300" />
            </div>
            <div>
              <div className="text-white font-semibold text-[15px] leading-tight">Insert imported bookmark</div>
              <div className="text-[#9aaad0] text-xs mt-0.5">
                Attach a URL from a bookmarks file you've already imported.
              </div>
            </div>
          </div>
          <button
            data-testid="bookmark-picker-close"
            onClick={onClose}
            className="p-1.5 text-[#9aaad0] hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566187]" />
            <input
              data-testid="bookmark-picker-search"
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={all.length ? `Search ${all.length} imported bookmarks…` : "No imported bookmarks yet"}
              disabled={!all.length}
              className="w-full bg-[#040814] border border-white/10 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-amber-400/50 text-white text-sm placeholder-[#566187] disabled:opacity-60"
            />
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto">
          {all.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="text-[#9aaad0] text-sm mb-4">
                You haven't imported any bookmarks yet. Export your Chrome /
                Firefox bookmarks as an HTML file, then drop it here:
              </div>
              <button
                data-testid="bookmark-picker-open-import"
                onClick={() => { onOpenImport?.(); onClose?.(); }}
                className="cta-pill text-sm"
              >
                <Bookmark size={14} /> Import bookmarks.html
              </button>
            </div>
          ) : (
            <>
              {showRecents && (
                <div data-testid="bookmark-picker-recents" className="border-b border-white/5 bg-amber-500/[0.03]">
                  <div className="px-5 pt-3 pb-1.5 flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.18em] text-amber-300/80">
                    <Clock size={10} /> Recently used
                  </div>
                  <ul className="pb-1">
                    {recents.map((b, i) => (
                      <li key={`recent-${b.url}-${i}`}>
                        <button
                          data-testid={`bookmark-pick-recent-${i}`}
                          onClick={() => handlePick(b)}
                          className="w-full text-left px-5 py-2 hover:bg-white/5 transition flex items-start gap-3 group"
                        >
                          <Clock size={14} className="text-amber-300/70 group-hover:text-amber-200 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-white text-sm font-medium truncate">
                              {b.title}
                            </div>
                            <div className="text-[#6c7aa0] text-xs truncate">{b.url}</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center text-[#9aaad0] text-sm">
                  No matches for <span className="text-white">{query}</span>
                </div>
              ) : (
                <ul className="py-1">
                  {filtered.map((b, i) => (
                    <li key={`${b.mapId}-${b.nodeId}-${i}`}>
                      <button
                        data-testid={`bookmark-pick-${i}`}
                        onClick={() => handlePick(b)}
                        className="w-full text-left px-5 py-2.5 hover:bg-white/5 transition flex items-start gap-3 group"
                      >
                        <ExternalLink size={14} className="text-[#566187] group-hover:text-amber-300 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-white text-sm font-medium truncate">
                            {b.title}
                          </div>
                          <div className="text-[#6c7aa0] text-xs truncate">{b.url}</div>
                          <div className="text-[#4a5577] text-[10px] mt-0.5 mono uppercase tracking-wider">
                            from {b.mapTitle}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Recursive DFS over the map node tree. Exposed here (not in lib/) because
 * it's the only place that needs it — keeping the helper inline avoids yet
 * another single-export util file. */
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const c of node.children) walk(c, visit);
  }
}

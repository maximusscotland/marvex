import React, { useEffect, useMemo, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { listCategories, saveCategories, getAllCategory, addCategory, removeCategory } from "@/lib/categories";

/**
 * CategoryMiniMap — a small SVG mind-map at the top of the Library that
 * doubles as the category picker.
 *
 * Centre node = "Categories" hub. Surrounding nodes = "All" + every
 * user-defined category.  Click a node to filter the library; right-click
 * to delete; the trailing `+ New` node spawns an inline name prompt.
 *
 * Why a mind-map and not a row of pills? Three reasons, in this order:
 *   1. The product IS a mind-mapping app — every visible artefact should
 *      reinforce that vocabulary.
 *   2. Categories naturally form a star-graph: one hub, many leaves.
 *      A mind-map is the most honest visualisation of that shape.
 *   3. It scales gracefully — 5 default categories fit comfortably; a
 *      power user with 15 still gets a readable orbit instead of
 *      overflowing horizontal pills.
 *
 * Dimensions are fixed (440 × 220 viewBox) because a small canvas is the
 * right answer here: the picker should never feel like another canvas to
 * pan.  Click-targets are generously oversized (each leaf is ~84 × 32 px
 * on screen) so this works on tablets too.
 */
export default function CategoryMiniMap({ selected, onSelect, mapCounts, compact = false }) {
  // Re-fetch on every relevant change so add/remove from another tab
  // syncs automatically (storage event) and our own writes show up
  // immediately (custom event).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sync = () => setTick((n) => n + 1);
    window.addEventListener("mm:categories-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mm:categories-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const all = getAllCategory();
  const cats = useMemo(() => listCategories(), [tick]);
  const items = useMemo(() => [all, ...cats], [all, cats]);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  // Ring layout: place items evenly around the centre.  Larger N → bigger
  // radius, so 4 categories don't sprawl while 12 still fit. We add a
  // little jitter on the angle so symmetric counts (4, 8) don't end up
  // axis-aligned (which looks rigid against the canvas grid below).
  // ViewBox is 440 × 280 (NOT 220) so leaf chips at the top/bottom of
  // the orbit (e.g. "All" near 12 o'clock, "Research" near 6 o'clock)
  // don't get visually clipped by the surrounding card edges. The
  // hub stays vertically centred at cy=140.
  const cx = 220;
  const cy = 140;
  const N = items.length + 1; // +1 for the "+ New" leaf
  const baseRadius = 102;
  const stretch = Math.max(0, N - 6) * 4;     // grow with crowd
  const radius = baseRadius + stretch;
  const startAngle = -Math.PI / 2 - 0.18;     // start near top, slight tilt

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) { setAdding(false); return; }
    addCategory({ name: trimmed, color: "#9aaad0", icon: "tag" });
    setNewName("");
    setAdding(false);
  };

  return (
    <div
      data-testid="library-categories"
      className="relative"
      style={compact ? { maxWidth: 360, margin: "0 auto" } : undefined}
    >
      <svg
        viewBox="0 0 440 280"
        className="w-full mx-auto block"
        style={{ height: "auto", maxWidth: compact ? 360 : 640 }}
      >
        {/* Hub node */}
        <g>
          <line
            x1={cx} y1={cy} x2={cx} y2={cy} stroke="rgba(0,240,255,0.25)" strokeWidth="1"
          />
          <ellipse
            cx={cx} cy={cy} rx={48} ry={28}
            fill="rgba(0,240,255,0.10)" stroke="#00f0ff" strokeWidth="1.5"
          />
          <text
            x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
            fontFamily="'Sora',sans-serif" fontSize="12" fontWeight="700"
            fill="#cfeefb" letterSpacing="0.5"
          >
            CATEGORIES
          </text>
        </g>

        {items.map((cat, i) => {
          const a = startAngle + (i / N) * Math.PI * 2;
          const x = cx + Math.cos(a) * radius;
          const y = cy + Math.sin(a) * radius;
          const isActive = (selected || "all") === cat.id;
          const count = mapCounts ? (mapCounts[cat.id] ?? 0) : null;
          const isAll = cat.id === "all";
          return (
            <g
              key={cat.id}
              data-testid={`library-category-${cat.id}`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(cat.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!isAll) setConfirmRemoveId(cat.id);
              }}
            >
              <line x1={cx} y1={cy} x2={x} y2={y}
                    stroke={isActive ? cat.color : "rgba(255,255,255,0.12)"}
                    strokeWidth={isActive ? 1.6 : 1} />
              <rect
                x={x - 42} y={y - 16} width={84} height={32} rx={16} ry={16}
                fill={isActive ? `${cat.color}22` : "rgba(7,18,38,0.9)"}
                stroke={isActive ? cat.color : "rgba(255,255,255,0.18)"}
                strokeWidth={isActive ? 1.7 : 1}
                style={{ filter: isActive ? `drop-shadow(0 0 6px ${cat.color}55)` : undefined }}
              />
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                    fontFamily="'Sora',sans-serif" fontSize="11.5" fontWeight={isActive ? 700 : 600}
                    fill={isActive ? "#ffffff" : "#cfdaf3"} letterSpacing="0.3">
                {cat.name}{count != null ? ` · ${count}` : ""}
              </text>
            </g>
          );
        })}

        {/* + New leaf */}
        {(() => {
          const i = items.length;
          const a = startAngle + (i / N) * Math.PI * 2;
          const x = cx + Math.cos(a) * radius;
          const y = cy + Math.sin(a) * radius;
          return (
            <g
              data-testid="library-category-add"
              style={{ cursor: "pointer" }}
              onClick={() => setAdding(true)}
            >
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3 3" />
              <rect x={x - 40} y={y - 14} width={80} height={28} rx={14} ry={14}
                    fill="rgba(7,18,38,0.6)" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                    fontFamily="'Sora',sans-serif" fontSize="11" fontWeight="600"
                    fill="#9aaad0" letterSpacing="0.4">
                + NEW
              </text>
            </g>
          );
        })()}
      </svg>

      {adding && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
             onClick={() => setAdding(false)}>
          <div className="glass-panel rounded-xl p-4 w-72" onClick={(e) => e.stopPropagation()}>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
              New category
            </div>
            <input
              data-testid="library-category-new-input"
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="e.g. Side projects"
              className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-cyan-400/60 text-white text-sm"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setAdding(false)}
                className="text-[11px] mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-full text-[#9aaad0] hover:text-white"
              >
                Cancel
              </button>
              <button
                data-testid="library-category-new-save"
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="cta-pill text-[12px] disabled:opacity-50"
              >
                <Plus size={11} /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveId && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl"
             onClick={() => setConfirmRemoveId(null)}>
          <div className="glass-panel rounded-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-red-300/90 mb-1.5">Remove category</div>
            <div className="text-[13px] text-[#cfdaf3] mb-3">
              Maps tagged &quot;{(listCategories().find((c) => c.id === confirmRemoveId) || {}).name}&quot; stay in the library — only the tag is removed.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemoveId(null)}
                className="text-[11px] mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-full text-[#9aaad0] hover:text-white"
              >
                <X size={11} className="inline mr-1" /> Cancel
              </button>
              <button
                data-testid="library-category-remove-confirm"
                onClick={() => { removeCategory(confirmRemoveId); setConfirmRemoveId(null); }}
                className="text-[11px] mono uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-red-400/40 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition"
              >
                <Check size={11} className="inline mr-1" /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

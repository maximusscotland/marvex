/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { newCategoryId } from "@/lib/timelineStorage";

const COLOR_PALETTE = [
  "#00f0ff", "#ff6ad5", "#a08cff", "#ffd66b",
  "#7cf5b6", "#ff8c5a", "#5b9bff", "#ff5d8f",
  "#b6ff8c", "#c084fc", "#fbbf24", "#34d399",
];

/**
 * TimelineCategoriesSidebar — colour-coded category legend that lives
 * to the right of the canvas.  Lets users add new categories, rename,
 * recolour, delete, and toggle visibility.  Mirrors the legend on the
 * right-hand side of the user's reference sketch.
 */
export default function TimelineCategoriesSidebar({
  categories = [],
  hidden = new Set(),
  onChange,
  onToggleHidden,
  readOnly = false,
}) {
  const [editingId, setEditingId] = useState(null);
  const [pickerId, setPickerId] = useState(null);

  const update = (id, patch) =>
    onChange?.(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const remove = (id) => onChange?.(categories.filter((c) => c.id !== id));

  const add = () => {
    const used = new Set(categories.map((c) => c.color));
    const nextColor = COLOR_PALETTE.find((c) => !used.has(c)) || COLOR_PALETTE[0];
    onChange?.([
      ...categories,
      { id: newCategoryId(), name: `Category ${categories.length + 1}`, color: nextColor },
    ]);
  };

  return (
    <aside
      data-testid="timeline-categories-sidebar"
      className="w-60 shrink-0 border-l border-white/10 bg-[#03040a]/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-4 flex items-center justify-between">
        <span>Categories</span>
        {!readOnly && (
          <button
            onClick={add}
            data-testid="tl-cat-add"
            className="w-6 h-6 rounded-full border border-cyan-400/40 bg-cyan-400/10 flex items-center justify-center hover:bg-cyan-400/20 transition"
            title="Add category"
          >
            <Plus size={11} className="text-cyan-300" />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {categories.map((c) => {
          const isHidden = hidden.has(c.id);
          return (
            <div
              key={c.id}
              data-testid={`tl-cat-${c.id}`}
              className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition"
              style={{ opacity: isHidden ? 0.4 : 1 }}
            >
              <button
                onClick={() => !readOnly && setPickerId(pickerId === c.id ? null : c.id)}
                data-testid={`tl-cat-color-${c.id}`}
                className="w-5 h-5 rounded shrink-0 transition-transform hover:scale-110"
                style={{
                  background: c.color,
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  boxShadow: `0 0 6px ${c.color}aa`,
                }}
                title={readOnly ? c.name : "Change colour"}
              />
              {editingId === c.id ? (
                <input
                  autoFocus
                  defaultValue={c.name}
                  onBlur={(e) => {
                    update(c.id, { name: e.target.value || c.name });
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.target.blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 bg-[#0a0f24] border border-white/15 rounded px-1.5 py-0.5 text-[12px] text-white outline-none focus:border-cyan-400/60"
                  data-testid={`tl-cat-name-input-${c.id}`}
                />
              ) : (
                <button
                  onClick={() => !readOnly && setEditingId(c.id)}
                  className="flex-1 text-left text-[13px] text-[#cfdaf3] hover:text-white truncate"
                  data-testid={`tl-cat-name-${c.id}`}
                >
                  {c.name}
                </button>
              )}
              <button
                onClick={() => onToggleHidden?.(c.id)}
                data-testid={`tl-cat-toggle-${c.id}`}
                className="opacity-0 group-hover:opacity-100 transition text-[#7a87ad] hover:text-cyan-300"
                title={isHidden ? "Show" : "Hide"}
              >
                {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              {!readOnly && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete category "${c.name}"?`)) remove(c.id);
                  }}
                  data-testid={`tl-cat-del-${c.id}`}
                  className="opacity-0 group-hover:opacity-100 transition text-[#7a87ad] hover:text-red-400"
                  title="Delete category"
                >
                  <Trash2 size={11} />
                </button>
              )}
              {pickerId === c.id && (
                <div className="absolute right-4 mt-12 z-30 grid grid-cols-6 gap-1.5 p-2.5 rounded-lg border border-white/15 bg-[#0a0f24] shadow-2xl">
                  {COLOR_PALETTE.map((col) => (
                    <button
                      key={col}
                      onClick={() => { update(c.id, { color: col }); setPickerId(null); }}
                      className="w-6 h-6 rounded transition-transform hover:scale-110"
                      data-testid={`tl-color-pick-${col}`}
                      style={{
                        background: col,
                        boxShadow: `0 0 6px ${col}80`,
                        outline: c.color === col ? "2px solid white" : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {categories.length === 0 && (
          <div className="text-[12px] text-[#566187] italic px-2">
            No categories yet.
          </div>
        )}
      </div>
    </aside>
  );
}

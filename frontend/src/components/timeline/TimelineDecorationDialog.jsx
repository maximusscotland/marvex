/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { X, Trash2, Calendar, Layers, Flag } from "lucide-react";

const COLOR_PALETTE = [
  "#ff6ad5", "#ff8c5a", "#ffd66b", "#7cf5b6",
  "#00f0ff", "#a08cff", "#5b9bff", "#ff5d8f",
];

/**
 * TimelineDecorationDialog — combined modal for editing a `period`
 * (date-range edge bar) or a `milestone` (single-date vertical line).
 * The variant is picked from `decoration.kind` ("period" | "milestone").
 *
 * Periods need: label, startISO, endISO, color
 * Milestones need: label, dateISO, color
 */
export default function TimelineDecorationDialog({
  open,
  decoration,
  onSave,
  onDelete,
  onClose,
}) {
  const [draft, setDraft] = useState(decoration || null);
  useEffect(() => { setDraft(decoration || null); }, [decoration?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !draft) return null;
  const isPeriod = draft.kind === "period";

  const startVal = isPeriod
    ? (draft.startISO || "").slice(0, 10)
    : (draft.dateISO || "").slice(0, 10);
  const endVal = isPeriod ? (draft.endISO || "").slice(0, 10) : "";
  const isNew = String(draft.id || "").includes("_new");

  return (
    <div
      data-testid="timeline-decoration-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0a0f24] via-[#0a0f24] to-[#0e1632] p-6 shadow-[0_0_60px_rgba(0,240,255,0.2)]"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {isPeriod ? <Layers size={16} className="text-fuchsia-300" /> : <Flag size={16} className="text-violet-300" />}
            {isNew ? `New ${isPeriod ? "period" : "milestone"}` : `Edit ${isPeriod ? "period" : "milestone"}`}
          </h2>
          <button onClick={onClose} className="text-[#7a87ad] hover:text-white transition" data-testid="tl-deco-close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">Label</label>
            <input
              autoFocus
              value={draft.label || ""}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              data-testid="tl-deco-label"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-cyan-400/60"
              placeholder={isPeriod ? "e.g. Term 1, Holiday, Sprint 3" : "e.g. Project deadline"}
            />
          </div>

          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
              <Calendar size={10} /> {isPeriod ? "Start date" : "Date"}
            </label>
            <input
              type="date"
              value={startVal}
              onChange={(e) => {
                const iso = e.target.value
                  ? new Date(`${e.target.value}T12:00:00Z`).toISOString()
                  : null;
                setDraft(isPeriod ? { ...draft, startISO: iso } : { ...draft, dateISO: iso });
              }}
              data-testid="tl-deco-start"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-cyan-400/60"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {isPeriod && (
            <div>
              <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
                <Calendar size={10} /> End date
              </label>
              <input
                type="date"
                value={endVal}
                onChange={(e) => {
                  const iso = e.target.value
                    ? new Date(`${e.target.value}T12:00:00Z`).toISOString()
                    : null;
                  setDraft({ ...draft, endISO: iso });
                }}
                data-testid="tl-deco-end"
                className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-cyan-400/60"
                style={{ colorScheme: "dark" }}
              />
            </div>
          )}

          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">Colour</label>
            <div className="grid grid-cols-8 gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setDraft({ ...draft, color: c })}
                  data-testid={`tl-deco-color-${c}`}
                  className="w-7 h-7 rounded transition-transform hover:scale-110"
                  style={{
                    background: c,
                    boxShadow: `0 0 6px ${c}80`,
                    outline: draft.color === c ? "2px solid white" : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/8">
          {!isNew ? (
            <button
              onClick={() => {
                if (window.confirm(`Delete this ${isPeriod ? "period" : "milestone"}?`)) onDelete?.(draft.id);
              }}
              data-testid="tl-deco-delete"
              className="text-[12px] text-red-400 hover:text-red-300 transition flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="cta-ghost text-[12px]" data-testid="tl-deco-cancel">Cancel</button>
            <button
              onClick={() => onSave?.({ ...draft, label: draft.label?.trim() || (isPeriod ? "Period" : "Milestone") })}
              className="cta-pill text-[12px]"
              data-testid="tl-deco-save"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

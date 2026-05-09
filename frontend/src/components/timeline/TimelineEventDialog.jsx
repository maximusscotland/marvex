/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { X, Trash2, Link2, Calendar } from "lucide-react";

/**
 * TimelineEventDialog — modal for editing a single event on a timeline.
 *
 * Renders a date picker (HTML5 <input type="date">), label input,
 * category radios, position toggle (above/below axis), and an
 * optional link field.  Triggered by clicking an event cube on the
 * canvas, or right after a click-to-add gesture.
 */
export default function TimelineEventDialog({
  open,
  event,
  categories = [],
  onSave,
  onDelete,
  onClose,
}) {
  const [draft, setDraft] = useState(event || null);
  React.useEffect(() => { setDraft(event || null); }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !draft) return null;
  const dateValue = draft.dateISO ? draft.dateISO.slice(0, 10) : "";

  return (
    <div
      data-testid="timeline-event-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0a0f24] via-[#0a0f24] to-[#0e1632] p-6 shadow-[0_0_60px_rgba(0,240,255,0.2)]"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">
            {event?.id?.startsWith("ev_new") ? "New event" : "Edit event"}
          </h2>
          <button
            onClick={onClose}
            data-testid="tl-evt-close"
            className="text-[#7a87ad] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Label */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Label
            </label>
            <input
              autoFocus
              value={draft.label || ""}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              data-testid="tl-evt-label"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-cyan-400/60"
              placeholder="e.g. Maths exam, Battle of Hastings, Holiday booking…"
            />
          </div>

          {/* Date */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
              <Calendar size={10} /> Date
            </label>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => {
                const iso = e.target.value
                  ? new Date(`${e.target.value}T12:00:00Z`).toISOString()
                  : draft.dateISO;
                setDraft({ ...draft, dateISO: iso });
              }}
              data-testid="tl-evt-date"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[14px] text-white outline-none focus:border-cyan-400/60"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Category */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDraft({ ...draft, categoryId: c.id })}
                  data-testid={`tl-evt-cat-${c.id}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[12px] transition"
                  style={{
                    background:
                      draft.categoryId === c.id
                        ? `${c.color}26`
                        : "transparent",
                    borderColor:
                      draft.categoryId === c.id
                        ? c.color
                        : "rgba(255,255,255,0.15)",
                    color:
                      draft.categoryId === c.id ? "#fff" : "#cfdaf3",
                  }}
                >
                  <span
                    className="w-3 h-3 rounded"
                    style={{
                      background: c.color,
                      boxShadow: `0 0 6px ${c.color}aa`,
                    }}
                  />
                  {c.name}
                </button>
              ))}
              {categories.length === 0 && (
                <div className="text-[12px] text-[#566187] italic">
                  Add a category in the sidebar first.
                </div>
              )}
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Stack position
            </label>
            <div className="flex gap-2">
              {["above", "below"].map((p) => (
                <button
                  key={p}
                  onClick={() => setDraft({ ...draft, position: p })}
                  data-testid={`tl-evt-pos-${p}`}
                  className="flex-1 px-3 py-2 rounded-lg border text-[12px] uppercase tracking-[0.18em] transition"
                  style={{
                    background:
                      draft.position === p ? "rgba(0,240,255,0.12)" : "transparent",
                    borderColor:
                      draft.position === p
                        ? "rgba(0,240,255,0.5)"
                        : "rgba(255,255,255,0.15)",
                    color: draft.position === p ? "#00f0ff" : "#9aa7c7",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
              <Link2 size={10} /> Link (optional — file, URL or mailto:)
            </label>
            <input
              value={draft.link || ""}
              onChange={(e) => setDraft({ ...draft, link: e.target.value })}
              data-testid="tl-evt-link"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-white font-mono outline-none focus:border-cyan-400/60"
              placeholder="https://… or mailto:… or local path"
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/8">
          {event?.id && !event.id.startsWith("ev_new") ? (
            <button
              onClick={() => {
                if (window.confirm("Delete this event?")) onDelete?.(event.id);
              }}
              data-testid="tl-evt-delete"
              className="text-[12px] text-red-400 hover:text-red-300 transition flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="cta-ghost text-[12px]"
              data-testid="tl-evt-cancel"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!draft.label?.trim()) {
                  setDraft({ ...draft, label: "Event" });
                }
                onSave?.({ ...draft, label: draft.label?.trim() || "Event" });
              }}
              className="cta-pill text-[12px]"
              data-testid="tl-evt-save"
            >
              Save event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

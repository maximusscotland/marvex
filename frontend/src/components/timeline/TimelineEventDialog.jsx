/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { X, Trash2, Link2, Calendar, Tag } from "lucide-react";
import FilePickerButton, { AttachedFilePill } from "@/components/common/FilePickerButton";

/**
 * Available shapes for an event block. Mirror naming with mind-map
 * shapes so users get a familiar mental model. Each is rendered via
 * CSS clip-path on the cube's wrapper button.
 */
export const EVENT_SHAPES = [
  { id: "rect",    label: "Square" },
  { id: "pill",    label: "Pill" },
  { id: "circle",  label: "Circle" },
  { id: "diamond", label: "Diamond" },
  { id: "hex",     label: "Hex" },
  { id: "pin",     label: "Pin" },
];

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18];

const SWATCHES = [
  null, "#00f0ff", "#ff6ad5", "#a08cff", "#ffd66b",
  "#76ff9d", "#ff8a65", "#42a5f5", "#e2e8f0",
];

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

  // Submit handler used by both Save button + Enter-key in any text field.
  // Trims label, defaults to "Event" if blank, then hands off to parent.
  const handleSave = (e) => {
    e?.preventDefault?.();
    onSave?.({ ...draft, label: (draft.label || "").trim() || "Event" });
  };

  return (
    <div
      data-testid="timeline-event-dialog"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm py-6 sm:py-10"
      onClick={onClose}
    >
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md mx-4 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0a0f24] via-[#0a0f24] to-[#0e1632] shadow-[0_0_60px_rgba(0,240,255,0.2)] flex flex-col max-h-[calc(100vh-3rem)]"
      >
        {/* Header — fixed at top */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">
            {event?.id?.startsWith("ev_new") ? "New event" : "Edit event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="tl-evt-close"
            className="text-[#7a87ad] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — the only scrolling region */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
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
              <Link2 size={10} /> Link (optional — URL or attach a file)
            </label>
            <div className="flex items-stretch gap-2">
              <input
                value={(draft.link || "").startsWith("data:") ? "" : (draft.link || "")}
                onChange={(e) => setDraft({ ...draft, link: e.target.value, linkName: undefined })}
                data-testid="tl-evt-link"
                className="flex-1 min-w-0 bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-white font-mono outline-none focus:border-cyan-400/60"
                placeholder="https://… or pick a file →"
              />
              <FilePickerButton
                testId="tl-evt-link-pick"
                label="Choose file…"
                onPicked={(dataUrl, fileName) => {
                  setDraft({ ...draft, link: dataUrl, linkName: fileName });
                }}
              />
            </div>
            <AttachedFilePill
              value={draft.link}
              fileName={draft.linkName}
              onClear={() => setDraft({ ...draft, link: "", linkName: undefined })}
              testId="tl-evt-link-attached"
            />
          </div>

          {/* Shape — visual parity with mind-map nodes. */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Shape
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_SHAPES.map((s) => {
                const active = (draft.shape || "rect") === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setDraft({ ...draft, shape: s.id })}
                    data-testid={`tl-evt-shape-${s.id}`}
                    className="px-2.5 py-1.5 rounded-lg border text-[11px] transition"
                    style={{
                      background: active ? "rgba(0,240,255,0.12)" : "transparent",
                      borderColor: active ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.15)",
                      color: active ? "#00f0ff" : "#cfdaf3",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colour override — null falls back to category colour. */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Block colour <span className="text-[#566187] normal-case tracking-normal">(overrides category)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => {
                const active = (draft.colorOverride || null) === c;
                return (
                  <button
                    key={c || "auto"}
                    onClick={() => setDraft({ ...draft, colorOverride: c })}
                    data-testid={`tl-evt-color-${c || "auto"}`}
                    className="w-7 h-7 rounded-md border-2 transition"
                    style={{
                      borderColor: active ? "#fff" : "rgba(255,255,255,0.15)",
                      background: c || "transparent",
                      backgroundImage: c ? "none" : "linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.4) 45% 55%, transparent 55%)",
                      boxShadow: active && c ? `0 0 12px ${c}` : "none",
                    }}
                    title={c || "Use category colour"}
                  />
                );
              })}
            </div>
          </div>

          {/* Font size */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Label font size
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FONT_SIZES.map((s) => {
                const active = (draft.fontSize || 11) === s;
                return (
                  <button
                    key={s}
                    onClick={() => setDraft({ ...draft, fontSize: s })}
                    data-testid={`tl-evt-fs-${s}`}
                    className="px-2.5 py-1 rounded-md border text-white transition"
                    style={{
                      fontSize: s,
                      background: active ? "rgba(0,240,255,0.12)" : "transparent",
                      borderColor: active ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.15)",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags — comma-separated chips. */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
              <Tag size={10} /> Labels / tags <span className="text-[#566187] normal-case tracking-normal">(comma-separated)</span>
            </label>
            <input
              value={(draft.tags || []).join(", ")}
              onChange={(e) => {
                const tags = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 8);
                setDraft({ ...draft, tags });
              }}
              data-testid="tl-evt-tags"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/60"
              placeholder="urgent, milestone, q3-priority"
            />
            {(draft.tags || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(draft.tags || []).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full text-[10px] mono uppercase tracking-[0.18em] bg-white/[0.06] border border-white/15 text-[#cfdaf3]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
        {/* Footer — fixed at bottom, always visible */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/8 flex-shrink-0">
          {event?.id && !event.id.startsWith("ev_new") ? (
            <button
              type="button"
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
              type="button"
              onClick={onClose}
              className="cta-ghost text-[12px]"
              data-testid="tl-evt-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cta-pill text-[12px]"
              data-testid="tl-evt-save"
            >
              Save event
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

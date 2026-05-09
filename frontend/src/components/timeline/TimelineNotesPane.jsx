/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { Plus, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * TimelineNotesPane — bottom-half panel on the standalone timeline
 * page. Two complementary inputs:
 *
 *   1. Quick-add event input  — `YYYY-MM-DD | Label` format. Enter
 *      to drop an event on the canvas without leaving the keyboard.
 *      Accepts loose date formats: 2026-05-09, 09/05/2026,
 *      May 9 2026 — anything `Date.parse` understands.
 *
 *   2. Free-form notes textarea — markdown-friendly scratchpad that
 *      auto-saves on blur. Saved to `timeline.notes` so it persists
 *      with the timeline and stays per-timeline (not global).
 */
export default function TimelineNotesPane({
  timeline,
  onChange,
  onAddEvent,
  defaultCategoryId,
}) {
  const [quick, setQuick] = useState("");
  const [notesDraft, setNotesDraft] = useState(timeline.notes || "");
  // Sync draft when the user switches between timelines.
  React.useEffect(() => {
    setNotesDraft(timeline.notes || "");
  }, [timeline.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseQuick = (raw) => {
    const text = (raw || "").trim();
    if (!text) return null;
    // Only split on `|` or `:` — never on `-` (would corrupt
    // "1939-09-01 | Outbreak"). The pipe is the documented separator;
    // colon is also allowed because it reads naturally.
    let idx = text.indexOf("|");
    if (idx === -1) {
      // Find the first `:` that isn't part of a time-of-day pattern
      // (e.g. "10:30 | Lunch" should still split on `|`, not `:`).
      // We require the colon to NOT be flanked by digits on both sides.
      const colonMatch = text.match(/(\D|^)\s*:\s*(\D|$)/);
      if (colonMatch) idx = text.indexOf(colonMatch[0]) + colonMatch[0].indexOf(":");
    }
    if (idx === -1) return null;
    const datePart = text.slice(0, idx).trim();
    const label = text.slice(idx + 1).trim();
    if (!label) return null;
    const t = Date.parse(datePart);
    if (!Number.isFinite(t)) return null;
    return { dateISO: new Date(t).toISOString(), label };
  };

  const handleQuickAdd = () => {
    const parsed = parseQuick(quick);
    if (!parsed) {
      toast.error('Format: "YYYY-MM-DD | Event label" (or use a date Date.parse understands)');
      return;
    }
    onAddEvent?.({
      ...parsed,
      categoryId: defaultCategoryId,
      position: "below",
    });
    setQuick("");
  };

  const commitNotes = () => {
    if ((notesDraft || "") === (timeline.notes || "")) return;
    onChange?.({ ...timeline, notes: notesDraft });
  };

  return (
    <section
      data-testid="timeline-notes-pane"
      className="border-t border-white/10 bg-[#03040a]/85 backdrop-blur-md flex flex-col"
      style={{ minHeight: 0 }} // lets parent flex correctly
    >
      {/* Quick-add row — keyboard-first event creation */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/90 flex items-center gap-1.5 shrink-0">
          <Sparkles size={11} /> Quick add
        </div>
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleQuickAdd(); } }}
          data-testid="tl-quick-add-input"
          placeholder='e.g. "2026-05-15 | Maths exam" — press Enter'
          className="flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white font-mono outline-none focus:border-fuchsia-400/60 transition"
        />
        <button
          onClick={handleQuickAdd}
          disabled={!quick.trim()}
          data-testid="tl-quick-add-btn"
          className="cta-pill text-[11px] py-2 disabled:opacity-50"
        >
          <Plus size={11} /> Add
        </button>
      </div>

      {/* Notes textarea — free-form per-timeline scratchpad */}
      <div className="px-5 pb-4 flex-1 flex flex-col min-h-0">
        <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 flex items-center gap-1.5">
          <FileText size={10} /> Notes
          <span className="text-[9px] text-[#566187] normal-case tracking-normal">
            · markdown OK · auto-saves on blur
          </span>
        </label>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
          data-testid="tl-notes"
          placeholder="Background research, sources, dates you're considering, links to PDFs… anything that supports this timeline. Stays attached to this timeline only."
          className="w-full flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-3.5 py-2.5 text-[13.5px] text-[#eaf6ff] outline-none focus:border-cyan-400/60 transition resize-none leading-relaxed"
          style={{ fontFamily: "'Sora', sans-serif", minHeight: 80 }}
        />
      </div>
    </section>
  );
}

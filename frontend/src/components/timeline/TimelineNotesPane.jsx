/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { Plus, FileText, Sparkles, Slash } from "lucide-react";
import { toast } from "sonner";

/**
 * TimelineNotesPane — bottom-half panel on the standalone timeline
 * page. Three complementary inputs:
 *
 *   1. Quick-add event input  — `YYYY-MM-DD | Label` format. Enter
 *      to drop an event on the canvas without leaving the keyboard.
 *      Accepts loose date formats: 2026-05-09, 09/05/2026,
 *      May 9 2026 — anything `Date.parse` understands.
 *
 *   2. Free-form notes textarea WITH slash commands — markdown-friendly
 *      scratchpad, auto-saves on blur. Lines starting with `/event`,
 *      `/period`, or `/milestone` are parsed and converted into
 *      structured timeline entries on Enter — the line is then stripped
 *      from the notes so it doesn't accumulate. Saved to
 *      `timeline.notes` so it persists per-timeline.
 *
 *   Slash command grammar:
 *     /event YYYY-MM-DD | Label
 *     /period YYYY-MM-DD | YYYY-MM-DD | Label
 *     /milestone YYYY-MM-DD | Label
 */
export default function TimelineNotesPane({
  timeline,
  onChange,
  onAddEvent,
  onAddPeriod,
  onAddMilestone,
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
    let idx = text.indexOf("|");
    if (idx === -1) {
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

  // ---------- Slash-command parser ----------
  // Returns { kind, entry } where entry is the structured payload,
  // or null when the line isn't a recognised slash command.
  const parseSlashLine = (line) => {
    const trimmed = (line || "").trim();
    const m = trimmed.match(/^\/(event|period|milestone)\s+(.+)$/i);
    if (!m) return null;
    const kind = m[1].toLowerCase();
    const args = m[2].split("|").map((s) => s.trim()).filter(Boolean);
    if (kind === "event" && args.length >= 2) {
      const t = Date.parse(args[0]);
      if (!Number.isFinite(t)) return null;
      return {
        kind: "event",
        entry: {
          dateISO: new Date(t).toISOString(),
          label: args.slice(1).join(" | "),
          categoryId: defaultCategoryId,
          position: "below",
        },
      };
    }
    if (kind === "period" && args.length >= 3) {
      const t1 = Date.parse(args[0]);
      const t2 = Date.parse(args[1]);
      if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
      return {
        kind: "period",
        entry: {
          startISO: new Date(Math.min(t1, t2)).toISOString(),
          endISO: new Date(Math.max(t1, t2)).toISOString(),
          label: args.slice(2).join(" | "),
          color: "#ff6ad5",
        },
      };
    }
    if (kind === "milestone" && args.length >= 2) {
      const t = Date.parse(args[0]);
      if (!Number.isFinite(t)) return null;
      return {
        kind: "milestone",
        entry: {
          dateISO: new Date(t).toISOString(),
          label: args.slice(1).join(" | "),
          color: "#a08cff",
        },
      };
    }
    return null;
  };

  const onNotesKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    const ta = e.target;
    const text = ta.value;
    const cursor = ta.selectionStart;
    // Find the line bounds the cursor is in.
    const lineStart = text.lastIndexOf("\n", cursor - 1) + 1;
    const lineEnd = text.indexOf("\n", cursor);
    const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
    if (!line.trim().startsWith("/")) return; // not a slash command — let Enter insert newline normally
    const parsed = parseSlashLine(line);
    if (!parsed) {
      // Looks like a slash command but malformed — surface format hint
      // without consuming the Enter (let user fix).
      toast.error(
        line.trim().startsWith("/event")
          ? 'Format: /event YYYY-MM-DD | Label'
          : line.trim().startsWith("/period")
            ? 'Format: /period YYYY-MM-DD | YYYY-MM-DD | Label'
            : line.trim().startsWith("/milestone")
              ? 'Format: /milestone YYYY-MM-DD | Label'
              : 'Unknown slash command (try /event /period /milestone)'
      );
      return;
    }
    e.preventDefault();
    if (parsed.kind === "event") onAddEvent?.(parsed.entry);
    else if (parsed.kind === "period") onAddPeriod?.(parsed.entry);
    else if (parsed.kind === "milestone") onAddMilestone?.(parsed.entry);
    // Strip the consumed line from the textarea (and the trailing newline
    // if any) so the user sees the line "evaporate" into the canvas.
    const before = text.slice(0, lineStart);
    const after = text.slice(lineEnd === -1 ? text.length : lineEnd + 1);
    const next = before + after;
    setNotesDraft(next);
    // We deliberately do NOT call onChange here — onAddEvent/Period/
    // Milestone above already triggers an handleChange that re-reads
    // fresh state from storage. Persisting `notes` from this stale
    // closure would clobber the structured entries that just landed.
    // Notes get committed on blur or next slash command turnover.
    // Restore caret to the start of the line that took the slash's place.
    requestAnimationFrame(() => {
      try { ta.setSelectionRange(lineStart, lineStart); } catch { /* ignore */ }
    });
  };

  const commitNotes = () => {
    if ((notesDraft || "") === (timeline.notes || "")) return;
    onChange?.({ ...timeline, notes: notesDraft });
  };

  return (
    <section
      data-testid="timeline-notes-pane"
      className="border-t border-white/10 bg-[#03040a]/85 backdrop-blur-md flex flex-col"
      style={{ minHeight: 0 }}
    >
      {/* Quick-add row */}
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

      {/* Notes textarea with slash-command support */}
      <div className="px-5 pb-4 flex-1 flex flex-col min-h-0">
        <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 flex items-center gap-1.5 flex-wrap">
          <FileText size={10} /> Notes
          <span className="text-[9px] text-[#566187] normal-case tracking-normal">
            · markdown OK · auto-saves on blur
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-violet-300/80 normal-case tracking-normal">
            <Slash size={9} />
            try <code className="text-violet-200">/event</code>
            <code className="text-violet-200">/period</code>
            <code className="text-violet-200">/milestone</code>
            on a new line
          </span>
        </label>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={onNotesKeyDown}
          data-testid="tl-notes"
          placeholder={`Background research, sources, dates… anything that supports this timeline.

Slash command examples:
/event 2026-05-15 | Maths exam
/period 2026-07-01 | 2026-08-31 | Summer holiday
/milestone 2026-12-15 | Project deadline`}
          className="w-full flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-3.5 py-2.5 text-[13.5px] text-[#eaf6ff] outline-none focus:border-cyan-400/60 transition resize-none leading-relaxed"
          style={{ fontFamily: "'Sora', sans-serif", minHeight: 80 }}
        />
      </div>
    </section>
  );
}

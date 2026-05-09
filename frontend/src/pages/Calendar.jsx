/**
 * /calendar — month-grid view of every reminder + deadline across every map.
 *
 * Why a derived view? Reminders ARE sticky-note annotations stored on each
 * map (single source of truth). Adding a `dueDate: yyyy-mm-dd` to any sticky
 * surfaces it here with no extra collection / migration. Users can also
 * create date-anchored reminders directly from this page — those land on a
 * dedicated "Calendar reminders" map so the rest of the studio sees them
 * the same way as map-attached stickies.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, ArrowLeft,
  Trash2, Check, Clock, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  listReminders,
  remindersByDate,
  setReminderDueDate,
  createCalendarReminder,
  updateReminder,
  toggleReminderDone,
  deleteReminder,
  timelineEventsByDate,
} from "@/lib/reminders";
import AssetsSidebar from "@/components/AssetsSidebar";

const fmtIso = (d) => d.toISOString().slice(0, 10);
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const monthLabel = (d) =>
  d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

export default function Calendar() {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => fmtIso(new Date()));
  const [grouped, setGrouped] = useState({});
  const [timelineGrouped, setTimelineGrouped] = useState({});
  const [tick, setTick] = useState(0); // bump to force re-pull
  const [draft, setDraft] = useState({ text: "", notes: "", time: "" });

  // Pull reminders + timeline events whenever the month changes or after any mutation.
  useEffect(() => {
    setGrouped(remindersByDate());
    setTimelineGrouped(timelineEventsByDate());
  }, [tick]);

  // Build the month grid: pad to start on Sunday and fill 6 rows × 7 columns
  // so the calendar height stays stable across short and long months.
  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startDay = first.getDay(); // 0 = Sun
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - startDay + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const todayIso = fmtIso(new Date());
  const selectedReminders = grouped[selectedDate] || [];
  const selectedTimelineEvents = timelineGrouped[selectedDate] || [];
  const undated = grouped[""] || [];

  const refresh = () => setTick((n) => n + 1);

  const handleAdd = () => {
    if (!draft.text.trim()) return;
    const text = draft.time
      ? `${draft.time} — ${draft.text.trim()}`
      : draft.text.trim();
    createCalendarReminder({
      text,
      dueDate: selectedDate,
      notes: draft.notes,
    });
    setDraft({ text: "", notes: "", time: "" });
    toast.success("Reminder added");
    refresh();
  };

  const dropDate = (mapId, stickyId) => {
    setReminderDueDate(mapId, stickyId, null);
    toast.success("Removed from calendar");
    refresh();
  };

  return (
    <div className="min-h-screen w-full bg-[#03040a] text-white flex">
      <AssetsSidebar />
      <div className="flex-1 px-6 lg:px-12 py-10 max-w-[1400px] mx-auto">
        <button
          data-testid="cal-back"
          onClick={() => navigate(-1)}
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] hover:text-cyan-300 inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft size={12} /> Back
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CalendarDays size={22} className="text-cyan-300" />
            <h1 className="text-3xl md:text-4xl font-bold">Calendar</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="cal-prev"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="p-2 rounded-md border border-white/10 text-[#9aa7c7] hover:text-cyan-200 hover:border-cyan-400/40 transition"
              title="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <div data-testid="cal-month" className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-200 px-2 min-w-[120px] text-center">
              {monthLabel(cursor)}
            </div>
            <button
              data-testid="cal-next"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="p-2 rounded-md border border-white/10 text-[#9aa7c7] hover:text-cyan-200 hover:border-cyan-400/40 transition"
              title="Next month"
            >
              <ChevronRight size={14} />
            </button>
            <button
              data-testid="cal-today"
              onClick={() => {
                const t = new Date();
                setCursor(startOfMonth(t));
                setSelectedDate(fmtIso(t));
              }}
              className="ml-2 mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-md border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10 transition"
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Month grid */}
          <div className="rounded-2xl border border-white/10 bg-[#0a0f24]/80 p-3">
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                <div key={d} className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] text-center pb-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d) => {
                const iso = fmtIso(d);
                const inMonth = d.getMonth() === cursor.getMonth();
                const isToday = iso === todayIso;
                const isSelected = iso === selectedDate;
                const dayReminders = grouped[iso] || [];
                const dayTimeline = timelineGrouped[iso] || [];
                const totalCount = dayReminders.length + dayTimeline.length;
                return (
                  <button
                    key={iso}
                    data-testid={`cal-day-${iso}`}
                    onClick={() => setSelectedDate(iso)}
                    className={`relative aspect-square rounded-md text-left p-1.5 border transition flex flex-col gap-1 ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-400/10"
                        : isToday
                          ? "border-fuchsia-400/50 bg-fuchsia-400/5"
                          : "border-white/5 hover:border-cyan-400/30 hover:bg-white/[0.03]"
                    } ${inMonth ? "" : "opacity-35"}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className={`text-[12px] font-semibold tabular-nums ${
                        isToday ? "text-fuchsia-300" : "text-[#cfdaf3]"
                      }`}>
                        {d.getDate()}
                      </span>
                      {totalCount > 0 && (
                        <span className="mono text-[8px] tabular-nums text-cyan-300 bg-cyan-400/15 border border-cyan-400/40 rounded px-1 leading-none py-0.5">
                          {totalCount}
                        </span>
                      )}
                    </div>
                    {/* Timeline-event pills — coloured by category */}
                    {dayTimeline.slice(0, 2).map((te) => (
                      <div
                        key={te.eventId}
                        className="truncate text-[10px] leading-tight flex items-center gap-1"
                        style={{ color: te.color }}
                        title={`${te.label} · ${te.timelineTitle}${te.category ? ` · ${te.category}` : ""}`}
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-sm shrink-0"
                          style={{ background: te.color, boxShadow: `0 0 4px ${te.color}` }}
                        />
                        <span className="truncate">{te.label}</span>
                      </div>
                    ))}
                    {dayReminders.slice(0, Math.max(0, 2 - dayTimeline.length)).map((r) => (
                      <div
                        key={r.stickyId}
                        className={`truncate text-[10px] leading-tight ${
                          r.done ? "line-through text-[#566187]" : "text-[#9aa7c7]"
                        }`}
                        title={r.text}
                      >
                        · {r.text}
                      </div>
                    ))}
                    {totalCount > 2 && (
                      <div className="text-[9px] text-[#566187]">
                        +{totalCount - 2} more
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail / new-reminder column */}
          <div className="space-y-4">
            <div data-testid="cal-day-detail" className="rounded-2xl border border-cyan-400/25 bg-[#0a0f24]/80 p-4">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-3">
                {new Date(selectedDate).toLocaleDateString(undefined, {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
              </div>
              {selectedReminders.length === 0 && (selectedTimelineEvents.length === 0) && (
                <div className="text-[#7a87ad] text-[12.5px] italic mb-3">
                  No reminders for this day. Add one below.
                </div>
              )}
              {/* Timeline events for the selected day — coloured pills
                  with a "Open timeline" link straight to the source. */}
              {selectedTimelineEvents.length > 0 && (
                <div className="mb-4 space-y-1.5" data-testid="cal-timeline-events">
                  <div className="mono text-[9px] uppercase tracking-[0.22em] text-violet-300/80 mb-1.5 flex items-center gap-1">
                    <Clock size={9} /> Timeline events
                  </div>
                  {selectedTimelineEvents.map((te) => (
                    <button
                      key={te.eventId}
                      data-testid={`cal-tl-${te.eventId}`}
                      onClick={() => navigate(`/timeline/${te.timelineId}`)}
                      className="w-full text-left flex items-start gap-2 p-2 rounded-md border transition hover:bg-white/[0.04]"
                      style={{ borderColor: `${te.color}55`, background: `${te.color}0d` }}
                      title={`Open ${te.timelineTitle}`}
                    >
                      <span
                        className="w-3 h-3 rounded-sm mt-0.5 shrink-0"
                        style={{ background: te.color, boxShadow: `0 0 4px ${te.color}aa` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-white truncate">{te.label}</div>
                        <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#7a87ad] mt-0.5 flex items-center gap-1.5">
                          <span>{te.timelineTitle}</span>
                          {te.category && <><span>·</span><span style={{ color: te.color }}>{te.category}</span></>}
                          <ExternalLink size={9} className="opacity-60" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2 mb-4">
                {selectedReminders.map((r) => (
                  <ReminderRow
                    key={r.stickyId}
                    r={r}
                    onToggle={() => { toggleReminderDone(r.mapId, r.stickyId); refresh(); }}
                    onDropDate={() => dropDate(r.mapId, r.stickyId)}
                    onDelete={() => { deleteReminder(r.mapId, r.stickyId); toast.success("Reminder removed"); refresh(); }}
                    onEdit={(patch) => { updateReminder(r.mapId, r.stickyId, patch); refresh(); }}
                  />
                ))}
              </div>
              {/* Add new */}
              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="mono text-[9px] uppercase tracking-[0.22em] text-fuchsia-300/80">
                  Add reminder
                </div>
                <input
                  data-testid="cal-add-text"
                  placeholder="What needs doing?"
                  value={draft.text}
                  onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400"
                />
                <div className="flex gap-2">
                  <input
                    data-testid="cal-add-time"
                    type="time"
                    placeholder="hh:mm"
                    value={draft.time}
                    onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                    className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-2 text-[12px] text-cyan-200 outline-none focus:border-cyan-400 w-28"
                  />
                  <button
                    data-testid="cal-add-submit"
                    onClick={handleAdd}
                    disabled={!draft.text.trim()}
                    className="flex-1 mono text-[10px] uppercase tracking-[0.22em] px-3 py-2 rounded-md bg-cyan-400 text-black font-bold hover:bg-cyan-300 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                <textarea
                  data-testid="cal-add-notes"
                  placeholder="Notes (optional)"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-md px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </div>

            {/* Undated reminders — sticky notes from maps that haven't been
                pinned to a day yet. Drag-to-day would be ideal; for now we
                show a list with a "Pin to selected day" button. */}
            {undated.length > 0 && (
              <div data-testid="cal-undated" className="rounded-2xl border border-white/10 bg-[#0a0f24]/60 p-4">
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">
                  Undated reminders ({undated.length})
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {undated.map((r) => (
                    <div key={r.stickyId} className="flex items-start gap-2 px-2 py-1.5 rounded border border-white/5 bg-white/[0.02]">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-[#cfdaf3] truncate" title={r.text}>{r.text}</div>
                        <div className="text-[10px] text-[#7a87ad] truncate">{r.mapTitle}</div>
                      </div>
                      <button
                        title={`Pin to ${selectedDate}`}
                        onClick={() => { setReminderDueDate(r.mapId, r.stickyId, selectedDate); toast.success("Pinned"); refresh(); }}
                        className="text-[10px] mono uppercase tracking-[0.18em] px-2 py-0.5 rounded border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10 transition shrink-0"
                      >
                        Pin
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ReminderRow = ({ r, onToggle, onDropDate, onDelete, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.text);
  const [notes, setNotes] = useState(""); // pulled lazily on edit start
  return (
    <div data-testid={`cal-reminder-${r.stickyId}`} className="rounded border border-white/5 bg-white/[0.02] p-2">
      <div className="flex items-start gap-2">
        <button
          onClick={onToggle}
          title={r.done ? "Mark as not done" : "Mark as done"}
          className={`mt-0.5 w-4 h-4 rounded-sm border transition flex items-center justify-center ${
            r.done ? "bg-cyan-400 border-cyan-400" : "border-white/30 hover:border-cyan-400"
          }`}
        >
          {r.done && <Check size={10} className="text-black" />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full bg-white/[0.04] border border-cyan-400/40 rounded px-2 py-1 text-[12.5px] text-white outline-none mb-1"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[11.5px] text-white outline-none resize-none"
              />
              <div className="flex gap-1.5 mt-1">
                <button
                  onClick={() => { onEdit({ text, notes: notes || undefined }); setEditing(false); }}
                  className="text-[10px] mono uppercase px-2 py-0.5 rounded bg-cyan-400 text-black font-bold"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setText(r.text); }}
                  className="text-[10px] mono uppercase px-2 py-0.5 rounded border border-white/10 text-[#9aa7c7]"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={`text-left w-full ${r.done ? "line-through text-[#566187]" : "text-[#cfdaf3]"} text-[12.5px] hover:text-cyan-200 transition`}
            >
              {r.text}
            </button>
          )}
          <div className="text-[10px] text-[#7a87ad] truncate">from “{r.mapTitle}”</div>
        </div>
        <button
          onClick={onDropDate}
          title="Remove from calendar (keep on map)"
          className="text-[#7a87ad] hover:text-cyan-300 px-1"
        >
          ✕
        </button>
        <button
          onClick={onDelete}
          title="Delete reminder"
          className="text-[#7a87ad] hover:text-red-300 px-1"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
};

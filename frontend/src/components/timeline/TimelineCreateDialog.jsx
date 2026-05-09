/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { X, Calendar } from "lucide-react";

/**
 * TimelineCreateDialog — first-time setup for a new timeline.  Asks
 * the user for a title + start date + (length OR end date).  The
 * user's reference sketch implies "100 years of history" or "a
 * month's expenses" — so we offer five quick presets plus custom.
 */

const PRESETS = [
  { id: "month",    label: "1 Month",         days: 31 },
  { id: "quarter",  label: "1 Quarter",       days: 92 },
  { id: "year",     label: "1 Year",          days: 365 },
  { id: "decade",   label: "10 Years",        days: 365 * 10 },
  { id: "century",  label: "100 Years",       days: 365 * 100 },
  { id: "open",     label: "Open-ended",      days: null },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function TimelineCreateDialog({
  open,
  onCreate,
  onClose,
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [presetId, setPresetId] = useState("year");
  const [customEnd, setCustomEnd] = useState("");

  if (!open) return null;
  const preset = PRESETS.find((p) => p.id === presetId);

  const computedEndISO = (() => {
    if (presetId === "custom" && customEnd) {
      return new Date(`${customEnd}T12:00:00Z`).toISOString();
    }
    if (preset?.days) {
      const d = new Date(`${startDate}T12:00:00Z`);
      d.setDate(d.getDate() + preset.days);
      return d.toISOString();
    }
    return null; // open-ended
  })();

  const submit = () => {
    onCreate?.({
      title: title.trim() || "Untitled timeline",
      startISO: new Date(`${startDate}T12:00:00Z`).toISOString(),
      endISO: computedEndISO,
      unit: preset?.days && preset.days < 100 ? "days"
        : preset?.days && preset.days < 1000 ? "weeks"
        : preset?.days && preset.days < 5000 ? "months"
        : "years",
    });
  };

  return (
    <div
      data-testid="timeline-create-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg mx-4 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0a0f24] via-[#0a0f24] to-[#0e1632] p-7 shadow-[0_0_60px_rgba(0,240,255,0.2)]"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">New timeline</h2>
          <button
            onClick={onClose}
            data-testid="tl-create-close"
            className="text-[#7a87ad] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[13px] text-[#9aa7c7] mb-5">
          Pick a name and the time scope.  Examples: <em className="text-cyan-300/80">"School year 2026"</em> · <em className="text-cyan-300/80">"WW2 timeline"</em> · <em className="text-cyan-300/80">"March expenses"</em>.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="tl-create-title"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2.5 text-[14px] text-white outline-none focus:border-cyan-400/60"
              placeholder="e.g. School year 2026"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>

          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
              <Calendar size={10} /> Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="tl-create-start"
              className="w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2.5 text-[14px] text-white outline-none focus:border-cyan-400/60"
              style={{ colorScheme: "dark" }}
            />
          </div>

          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  data-testid={`tl-create-preset-${p.id}`}
                  className="px-2.5 py-2 rounded-lg border text-[12px] transition"
                  style={{
                    background: presetId === p.id ? "rgba(0,240,255,0.12)" : "transparent",
                    borderColor:
                      presetId === p.id ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.15)",
                    color: presetId === p.id ? "#00f0ff" : "#cfdaf3",
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setPresetId("custom")}
                data-testid="tl-create-preset-custom"
                className="px-2.5 py-2 rounded-lg border text-[12px] transition"
                style={{
                  background: presetId === "custom" ? "rgba(0,240,255,0.12)" : "transparent",
                  borderColor:
                    presetId === "custom" ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.15)",
                  color: presetId === "custom" ? "#00f0ff" : "#cfdaf3",
                }}
              >
                Custom end…
              </button>
            </div>
            {presetId === "custom" && (
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                data-testid="tl-create-custom-end"
                className="mt-2 w-full bg-[#03040a] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/60"
                style={{ colorScheme: "dark" }}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/8">
          <button
            onClick={onClose}
            className="cta-ghost text-[12px]"
            data-testid="tl-create-cancel"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="cta-pill text-[12px]"
            data-testid="tl-create-submit"
            disabled={!startDate}
          >
            Create timeline
          </button>
        </div>
      </div>
    </div>
  );
}

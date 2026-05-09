/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";
import { X, Calendar, GraduationCap, Briefcase, BookOpen, Heart, Rocket, Sparkles, Palette, Layers } from "lucide-react";
import {
  TIMELINE_TEMPLATES,
  TIMELINE_PALETTES,
  buildCategoriesFromTemplate,
} from "@/lib/timelineStorage";

/**
 * TimelineCreateDialog — first-time setup wizard for a new timeline.
 *
 * Asks for:
 *   1. Title
 *   2. Designation / template (Student, Professional, Historian, …)
 *   3. # of categories (1-8) — auto-named by the template, editable later
 *   4. Theme palette (Cosmic, Sunrise, Forest, Ocean, Mono)
 *   5. Start date + scope preset (1mo / 1q / 1yr / 10yr / 100yr / open / custom)
 *
 * On submit, returns { title, startISO, endISO, unit, categories,
 * designation, paletteId } so the caller can pre-seed `blankTimeline`.
 */

const SCOPE_PRESETS = [
  { id: "month",    label: "1 Month",    days: 31 },
  { id: "quarter",  label: "1 Quarter",  days: 92 },
  { id: "year",     label: "1 Year",     days: 365 },
  { id: "decade",   label: "10 Years",   days: 365 * 10 },
  { id: "century",  label: "100 Years",  days: 365 * 100 },
  { id: "open",     label: "Open-ended", days: null },
];

const DESIGNATION_ICONS = {
  student: GraduationCap,
  professional: Briefcase,
  historian: BookOpen,
  personal: Heart,
  project: Rocket,
  custom: Sparkles,
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function TimelineCreateDialog({ open, onCreate, onClose }) {
  const [title, setTitle] = useState("");
  const [designation, setDesignation] = useState("student");
  const [categoryCount, setCategoryCount] = useState(4);
  const [paletteId, setPaletteId] = useState("cosmic");
  const [startDate, setStartDate] = useState(todayISO());
  const [scopeId, setScopeId] = useState("year");
  const [customEnd, setCustomEnd] = useState("");

  const scope = SCOPE_PRESETS.find((p) => p.id === scopeId);

  // Live preview of the category chips so the user can see what they
  // are about to create. Pure derived state — no side effects.
  const previewCategories = useMemo(
    () => buildCategoriesFromTemplate({ designation, paletteId, count: categoryCount }),
    [designation, paletteId, categoryCount],
  );

  if (!open) return null;

  const computedEndISO = (() => {
    if (scopeId === "custom" && customEnd) {
      return new Date(`${customEnd}T12:00:00Z`).toISOString();
    }
    if (scope?.days) {
      const d = new Date(`${startDate}T12:00:00Z`);
      d.setDate(d.getDate() + scope.days);
      return d.toISOString();
    }
    return null;
  })();

  const submit = () => {
    onCreate?.({
      title: title.trim() || "Untitled timeline",
      startISO: new Date(`${startDate}T12:00:00Z`).toISOString(),
      endISO: computedEndISO,
      unit: scope?.days && scope.days < 100 ? "days"
        : scope?.days && scope.days < 1000 ? "weeks"
        : scope?.days && scope.days < 5000 ? "months"
        : "years",
      categories: previewCategories,
      designation,
      paletteId,
    });
  };

  return (
    <div
      data-testid="timeline-create-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl mx-4 my-8 rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#0a0f24] via-[#0a0f24] to-[#0e1632] p-7 shadow-[0_0_60px_rgba(0,240,255,0.2)]"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">New timeline</h2>
            <p className="text-[12px] text-[#9aa7c7] mt-0.5">
              Pick a template, palette, and scope. Everything is editable later.
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="tl-create-close"
            className="text-[#7a87ad] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* TITLE */}
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
              placeholder="e.g. School year 2026 · WW2 timeline · March expenses"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>

          {/* DESIGNATION / TEMPLATE */}
          <div>
            <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block">
              I'm using this for…
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {Object.entries(TIMELINE_TEMPLATES).map(([id, tpl]) => {
                const Icon = DESIGNATION_ICONS[id] || Sparkles;
                const active = designation === id;
                return (
                  <button
                    key={id}
                    onClick={() => setDesignation(id)}
                    data-testid={`tl-create-designation-${id}`}
                    className="px-2 py-2.5 rounded-lg border text-[11px] transition flex flex-col items-center gap-1"
                    style={{
                      background: active ? "rgba(0,240,255,0.10)" : "transparent",
                      borderColor: active ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.15)",
                      color: active ? "#00f0ff" : "#cfdaf3",
                    }}
                  >
                    <Icon size={14} />
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PALETTE + CATEGORY COUNT — side-by-side on wider screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
                <Palette size={10} /> Palette
              </label>
              <div className="space-y-1.5">
                {Object.entries(TIMELINE_PALETTES).map(([id, p]) => {
                  const active = paletteId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPaletteId(id)}
                      data-testid={`tl-create-palette-${id}`}
                      className="w-full px-3 py-2 rounded-lg border text-[11px] transition flex items-center gap-2.5"
                      style={{
                        background: active ? "rgba(0,240,255,0.08)" : "transparent",
                        borderColor: active ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.12)",
                        color: active ? "#cfeaff" : "#cfdaf3",
                      }}
                    >
                      <span className="flex-1 text-left">{p.label}</span>
                      <span className="flex gap-0.5">
                        {p.colors.slice(0, 5).map((c) => (
                          <span
                            key={c}
                            className="block w-3.5 h-3.5 rounded-sm"
                            style={{ background: c, boxShadow: `0 0 4px ${c}99` }}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 block flex items-center gap-1.5">
                <Layers size={10} /> Categories ({categoryCount})
              </label>
              <input
                type="range"
                min={1}
                max={8}
                value={categoryCount}
                onChange={(e) => setCategoryCount(parseInt(e.target.value, 10))}
                data-testid="tl-create-cat-count"
                className="w-full accent-cyan-400"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {previewCategories.map((c) => (
                  <span
                    key={c.id}
                    data-testid="tl-create-cat-preview"
                    className="px-2 py-1 rounded-md text-[10px] mono uppercase tracking-[0.16em] border"
                    style={{
                      borderColor: `${c.color}66`,
                      background: `${c.color}1a`,
                      color: c.color,
                    }}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[#7a87ad] leading-relaxed">
                You can rename, recolour, or add more after creation.
              </p>
            </div>
          </div>

          {/* START DATE + SCOPE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
              <div className="grid grid-cols-3 gap-1.5">
                {SCOPE_PRESETS.map((p) => {
                  const active = scopeId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setScopeId(p.id)}
                      data-testid={`tl-create-preset-${p.id}`}
                      className="px-2 py-2 rounded-lg border text-[11px] transition"
                      style={{
                        background: active ? "rgba(0,240,255,0.12)" : "transparent",
                        borderColor: active ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.15)",
                        color: active ? "#00f0ff" : "#cfdaf3",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setScopeId("custom")}
                  data-testid="tl-create-preset-custom"
                  className="col-span-3 px-2 py-2 rounded-lg border text-[11px] transition"
                  style={{
                    background: scopeId === "custom" ? "rgba(0,240,255,0.12)" : "transparent",
                    borderColor: scopeId === "custom" ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.15)",
                    color: scopeId === "custom" ? "#00f0ff" : "#cfdaf3",
                  }}
                >
                  Custom end…
                </button>
              </div>
              {scopeId === "custom" && (
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

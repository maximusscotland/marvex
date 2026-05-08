import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  StickyNote,
  Trash2,
  Sparkles,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import {
  listReminders,
  toggleReminderDone,
  deleteReminder,
} from "@/lib/reminders";
import Logo from "@/components/Logo";
import AssetsSidebar from "@/components/AssetsSidebar";
import MobileNav from "@/components/MobileNav";

/**
 * /output — the user's "out-tray". Contains:
 *   1. Reminders — every sticky note across every map, with done-toggle and delete
 *   2. AI Outputs — placeholder for future generated artefacts (Deep Research
 *      markdown, Quick Outline summaries, etc.)
 *
 * Sister page to /library: Library is *inputs* (research maps, PDFs), Output
 * is *outputs* (todos and AI artefacts you produced).
 */
export default function Output() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState("active"); // "active" | "all" | "done"

  const reminders = useMemo(() => {
    void tick;
    return listReminders();
  }, [tick]);

  const visible = useMemo(() => {
    if (filter === "all") return reminders;
    if (filter === "done") return reminders.filter((r) => r.done);
    return reminders.filter((r) => !r.done);
  }, [reminders, filter]);

  const counts = useMemo(
    () => ({
      active: reminders.filter((r) => !r.done).length,
      done: reminders.filter((r) => r.done).length,
      total: reminders.length,
    }),
    [reminders],
  );

  const toggle = (mapId, stickyId) => {
    toggleReminderDone(mapId, stickyId);
    setTick((t) => t + 1);
  };

  const remove = (mapId, stickyId) => {
    deleteReminder(mapId, stickyId);
    setTick((t) => t + 1);
    toast("Reminder removed");
  };

  const open = (mapId) => navigate(`/app?map=${mapId}`);

  return (
    <div
      data-testid="output-page"
      className="min-h-screen text-white flex"
      style={{
        background:
          "radial-gradient(1200px 800px at 15% -10%, rgba(255,221,68,0.10), transparent 60%)," +
          "radial-gradient(1000px 700px at 95% 110%, rgba(0,240,255,0.10), transparent 60%)," +
          "#03101c",
      }}
    >
      <aside
        data-testid="output-sidebar"
        className="flex-shrink-0 flex-col border-r border-white/5 overflow-hidden hidden md:flex"
        style={{
          background: "linear-gradient(180deg, #060a1c 0%, #04060f 100%)",
          width: 260,
        }}
      >
        <div className="px-5 py-6 flex items-center gap-3 border-b border-white/5">
          <Logo size={48} />
          <div className="leading-tight">
            <div className="text-[12px] mono uppercase tracking-[0.2em] text-cyan-300/80">
              Marvex Studio
            </div>
            <div className="text-[10px] mono uppercase tracking-[0.22em] text-amber-300/80">
              Requested Assets
            </div>
          </div>
        </div>
        <AssetsSidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <MobileNav />
        <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/5 backdrop-blur">
          <div className="flex items-center gap-2 pl-12 md:pl-0">
            <div>
              <div className="font-semibold text-[15px] tracking-tight">
                Requested Assets
              </div>
              <div className="mono text-[9px] uppercase tracking-[0.25em] text-amber-300/80">
                Reminders &amp; Requested Asset Generation
              </div>
            </div>
          </div>
        </header>

        <main className="px-6 md:px-10 py-10 max-w-5xl mx-auto w-full space-y-12">
          {/* REMINDERS */}
          <section data-testid="output-reminders">
            <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300 mb-1.5 flex items-center gap-2">
                  <StickyNote size={12} /> Reminders
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  Sticky notes from your maps
                </h2>
                <p className="text-[12px] text-[#7a87ad] mt-1">
                  Every sticky note across every map appears here. Tick it off
                  and it stays ticked on the map.
                </p>
              </div>
              <div
                role="tablist"
                className="flex items-center gap-1 rounded-full border border-white/10 p-1"
                data-testid="output-filter-tabs"
              >
                {[
                  { id: "active", label: `Active · ${counts.active}` },
                  { id: "done", label: `Done · ${counts.done}` },
                  { id: "all", label: `All · ${counts.total}` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    data-testid={`output-filter-${tab.id}`}
                    onClick={() => setFilter(tab.id)}
                    className={`mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full transition ${
                      filter === tab.id
                        ? "bg-amber-500/20 text-amber-100 border border-amber-300/40"
                        : "text-[#7a87ad] hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <div
                data-testid="output-reminders-empty"
                className="rounded-xl border border-white/5 bg-white/[0.02] py-14 text-center"
              >
                {reminders.length === 0 ? (
                  <>
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-400/30 grid place-items-center mb-4">
                      <Inbox size={24} className="text-amber-200" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      No reminders yet
                    </h3>
                    <p className="text-[#7a87ad] text-[13px] max-w-md mx-auto">
                      Open any map in the Studio, drop a sticky note (toolbar →
                      <span className="text-amber-200">
                        {" "}sticky icon
                      </span>
                      ), and it&apos;ll show up here automatically.
                    </p>
                  </>
                ) : (
                  <div className="text-[#7a87ad] text-[13px]">
                    Nothing in this filter — try Active or All.
                  </div>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {visible.map((r) => (
                  <li
                    key={`${r.mapId}-${r.stickyId}`}
                    data-testid={`output-reminder-${r.stickyId}`}
                    className={`rounded-xl border p-4 flex items-start gap-3 transition ${
                      r.done
                        ? "border-white/5 bg-white/[0.015] opacity-60"
                        : "border-amber-400/20 bg-amber-500/[0.04] hover:border-amber-300/40"
                    }`}
                  >
                    <button
                      data-testid={`output-toggle-${r.stickyId}`}
                      onClick={() => toggle(r.mapId, r.stickyId)}
                      className="mt-[2px] shrink-0 transition"
                      title={r.done ? "Mark active" : "Mark done"}
                    >
                      {r.done ? (
                        <CheckCircle2
                          size={18}
                          className="text-emerald-300"
                        />
                      ) : (
                        <Circle
                          size={18}
                          className="text-amber-300/70 hover:text-amber-200"
                        />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[14px] leading-relaxed whitespace-pre-wrap ${
                          r.done
                            ? "line-through text-[#7a87ad]"
                            : "text-[#cfdaf3]"
                        }`}
                      >
                        {r.text}
                      </p>
                      <button
                        onClick={() => open(r.mapId)}
                        data-testid={`output-jump-${r.stickyId}`}
                        className="mt-2 mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 hover:text-cyan-200 transition flex items-center gap-1"
                      >
                        From: {r.mapTitle}{" "}
                        <ArrowRight size={11} />
                      </button>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          data-testid={`output-due-${r.stickyId}`}
                          type="date"
                          defaultValue={(() => {
                            // Sticky's stored dueDate is fetched from the
                            // map; we can't read it here cheaply (listReminders
                            // doesn't expose it), so we leave the input blank
                            // by default. Setting a value writes via the
                            // imported helper.
                            return "";
                          })()}
                          onChange={(e) => {
                            import("@/lib/reminders").then((m) => {
                              m.setReminderDueDate(r.mapId, r.stickyId, e.target.value || null);
                              toast.success(e.target.value ? "Pinned to calendar" : "Removed from calendar");
                            });
                          }}
                          className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10.5px] text-cyan-100 outline-none focus:border-cyan-400 mono uppercase tracking-[0.18em]"
                          title="Set deadline / pin to calendar"
                        />
                      </div>
                    </div>
                    <button
                      data-testid={`output-delete-${r.stickyId}`}
                      onClick={() => remove(r.mapId, r.stickyId)}
                      title="Delete reminder (also removes the sticky)"
                      className="text-[#566187] hover:text-red-300 p-1 rounded transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* AI OUTPUTS — placeholder for future Deep Research / Outline artefacts */}
          <section data-testid="output-ai-artefacts">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 mb-1.5 flex items-center gap-2">
              <Sparkles size={12} /> Requested Assets
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Requested Asset Generation
            </h2>
            <p className="text-[12px] text-[#7a87ad] mt-1 mb-5">
              Deep Research reports, Quick Outlines, and other Research
              Assistant exports will collect here as soon as you generate them.
            </p>
            <div
              data-testid="output-ai-empty"
              className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-[#7a87ad] text-[13px] flex items-start gap-3"
            >
              <ArrowLeft
                size={14}
                className="rotate-180 shrink-0 mt-1 text-fuchsia-300/70"
              />
              <div>
                Use{" "}
                <span className="text-cyan-200 font-semibold">
                  Send to Research Assistant
                </span>{" "}
                from any node&apos;s right-click menu in the Studio. Generated
                map artefacts will appear here.
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

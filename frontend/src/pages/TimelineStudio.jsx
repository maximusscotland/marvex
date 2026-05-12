/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Library as LibraryIcon, Plus, CalendarDays, Keyboard } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import TimelineCanvas from "@/components/timeline/TimelineCanvas";
import TimelineCategoriesSidebar from "@/components/timeline/TimelineCategoriesSidebar";
import TimelineEventDialog from "@/components/timeline/TimelineEventDialog";
import TimelineCreateDialog from "@/components/timeline/TimelineCreateDialog";
import TimelineDecorationDialog from "@/components/timeline/TimelineDecorationDialog";
import TimelineNotesPane from "@/components/timeline/TimelineNotesPane";
import TimelinePaywall from "@/components/timeline/TimelinePaywall";
import { useLicense } from "@/lib/license";
import {
  getTimeline,
  saveTimeline,
  blankTimeline,
  newEventId,
  newPeriodId,
  newMilestoneId,
  listTimelines,
} from "@/lib/timelineStorage";
import usePageMeta from "@/lib/usePageMeta";

/**
 * /timeline/:id (or /timeline/new) — the Timeline Studio.
 *
 * Layout: header bar (logo + title + library link) + main row of
 * [TimelineCanvas | TimelineCategoriesSidebar].  Modals for creating
 * a new timeline and for editing an event.
 */
export default function TimelineStudio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const license = useLicense();
  // Gate: Pro / Founder / Lifetime only. Lite users see the upgrade
  // panel since timelines are a flagship Pro+ feature (still in beta).
  // We allow `loading` through to avoid a flash of paywall during the
  // initial license fetch.
  const canUseTimelines = license.loading || license.isProOnly || license.founder;
  const [timeline, setTimeline] = useState(() => (id && id !== "new" ? getTimeline(id) : null));
  const [createOpen, setCreateOpen] = useState(!timeline);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingDecoration, setEditingDecoration] = useState(null);
  const [hiddenCategories, setHiddenCategories] = useState(new Set());

  usePageMeta({
    title: timeline ? `${timeline.title} · Timeline · Marvex Studio` : "New Timeline · Marvex Studio",
    description: "Build interactive, pannable timelines with link-anywhere events. From 100 years of history to a month of expenses.",
  });

  // Keep state in sync if the URL id changes.
  useEffect(() => {
    if (id && id !== "new") {
      const t = getTimeline(id);
      if (t) {
        setTimeline(t);
        setCreateOpen(false);
      } else {
        navigate("/timeline/new", { replace: true });
      }
    }
  }, [id, navigate]);

  const handleChange = (next) => {
    try {
      const saved = saveTimeline(next);
      setTimeline(saved);
    } catch (e) {
      toast.error(e.message || "Could not save timeline");
    }
  };

  const handleCreate = (params) => {
    const fresh = blankTimeline(params);
    handleChange(fresh);
    setCreateOpen(false);
    navigate(`/timeline/${fresh.id}`, { replace: true });
  };

  const handleAddEventAtDate = (dateISO, position) => {
    if (!timeline) return;
    const cats = timeline.categories || [];
    setEditingEvent({
      id: `ev_new_${Date.now()}`,
      label: "",
      dateISO,
      categoryId: cats[0]?.id,
      position: position || "below",
      lane: 0,
    });
  };

  const handleSaveEvent = (event) => {
    if (!timeline) return;
    const isNew = event.id?.startsWith("ev_new");
    const newId = isNew ? newEventId() : event.id;
    const e = { ...event, id: newId };
    const events = isNew
      ? [...(timeline.events || []), e]
      : (timeline.events || []).map((ev) => (ev.id === e.id ? e : ev));
    handleChange({ ...timeline, events });
    setEditingEvent(null);
    toast.success(isNew ? "Event added" : "Event saved");
  };

  const handleDeleteEvent = (eventId) => {
    if (!timeline) return;
    handleChange({
      ...timeline,
      events: (timeline.events || []).filter((e) => e.id !== eventId),
    });
    setEditingEvent(null);
    toast.success("Event deleted");
  };

  // ---- Decoration (period/milestone) handlers ----
  const handleAddPeriod = () => {
    if (!timeline) return;
    const start = new Date(timeline.scope.startISO);
    const end = timeline.scope.endISO ? new Date(timeline.scope.endISO) : new Date(start.getTime() + 30 * 86_400_000);
    const span = end.getTime() - start.getTime();
    setEditingDecoration({
      id: `pd_new_${Date.now()}`,
      kind: "period",
      label: "Period",
      startISO: new Date(start.getTime() + span * 0.1).toISOString(),
      endISO: new Date(start.getTime() + span * 0.25).toISOString(),
      color: "#ff6ad5",
    });
  };

  const handleAddMilestone = () => {
    if (!timeline) return;
    const start = new Date(timeline.scope.startISO);
    const end = timeline.scope.endISO ? new Date(timeline.scope.endISO) : new Date(start.getTime() + 30 * 86_400_000);
    const mid = (start.getTime() + end.getTime()) / 2;
    setEditingDecoration({
      id: `ms_new_${Date.now()}`,
      kind: "milestone",
      label: "Milestone",
      dateISO: new Date(mid).toISOString(),
      color: "#a08cff",
    });
  };

  const handleSaveDecoration = (deco) => {
    if (!timeline) return;
    const isNew = String(deco.id).includes("_new");
    if (deco.kind === "period") {
      const newId = isNew ? newPeriodId() : deco.id;
      const period = {
        id: newId,
        label: deco.label,
        startISO: deco.startISO,
        endISO: deco.endISO,
        color: deco.color,
      };
      const periods = isNew
        ? [...(timeline.periods || []), period]
        : (timeline.periods || []).map((p) => (p.id === period.id ? period : p));
      handleChange({ ...timeline, periods });
    } else {
      const newId = isNew ? newMilestoneId() : deco.id;
      const milestone = {
        id: newId,
        label: deco.label,
        dateISO: deco.dateISO,
        color: deco.color,
      };
      const milestones = isNew
        ? [...(timeline.milestones || []), milestone]
        : (timeline.milestones || []).map((m) => (m.id === milestone.id ? milestone : m));
      handleChange({ ...timeline, milestones });
    }
    setEditingDecoration(null);
    toast.success(isNew ? `${deco.kind === "period" ? "Period" : "Milestone"} added` : "Saved");
  };

  const handleDeleteDecoration = (id) => {
    if (!timeline) return;
    if (id.startsWith("pd_")) {
      handleChange({ ...timeline, periods: (timeline.periods || []).filter((p) => p.id !== id) });
    } else {
      handleChange({ ...timeline, milestones: (timeline.milestones || []).filter((m) => m.id !== id) });
    }
    setEditingDecoration(null);
    toast.success("Removed");
  };

  const handleCategoriesChange = (categories) => {
    if (!timeline) return;
    handleChange({ ...timeline, categories });
  };

  const toggleCategoryVisibility = (catId) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // Filter events by hidden categories (visual only — doesn't mutate).
  const visibleTimeline = useMemo(() => {
    if (!timeline) return null;
    if (!hiddenCategories.size) return timeline;
    return {
      ...timeline,
      events: (timeline.events || []).filter(
        (e) => !hiddenCategories.has(e.categoryId),
      ),
    };
  }, [timeline, hiddenCategories]);

  if (!canUseTimelines) {
    return <TimelinePaywall tier={license.tier} />;
  }

  if (!timeline) {
    return (
      <>
        <div className="min-h-screen cosmic-bg text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-3">Timeline</h1>
            <p className="text-[#9aa7c7] mb-5 max-w-md">
              Build a timeline from scratch, or open an existing one from your library.
            </p>
            <button
              onClick={() => setCreateOpen(true)}
              data-testid="timeline-empty-create"
              className="cta-pill text-[13px]"
            >
              <Plus size={13} /> Create timeline
            </button>
          </div>
        </div>
        <TimelineCreateDialog
          open={createOpen}
          onClose={() => navigate("/library")}
          onCreate={handleCreate}
        />
      </>
    );
  }

  return (
    <div translate="no" className="notranslate min-h-screen cosmic-bg text-white flex flex-col">
      {/* Header */}
      <header className="px-5 py-3 border-b border-white/8 bg-[#03040a]/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/library" className="text-[#9aa7c7] hover:text-cyan-300 transition" data-testid="tl-back-library">
            <ArrowLeft size={16} />
          </Link>
          <Logo size={24} />
          <input
            value={timeline.title}
            onChange={(e) => handleChange({ ...timeline, title: e.target.value })}
            data-testid="timeline-title"
            className="bg-transparent text-[15px] font-semibold text-white outline-none border-b border-transparent focus:border-cyan-400/60 transition px-0.5"
          />
          <span
            data-testid="timeline-beta-pill"
            className="mono text-[9px] uppercase tracking-[0.22em] px-2 py-0.5 rounded-full border border-fuchsia-400/50 bg-fuchsia-500/[0.10] text-fuchsia-200"
            title="Timeline Studio is in public beta — we're still polishing. Feedback welcome at tech@marvex.app"
          >
            Beta
          </span>
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] hidden md:block">
            · timeline ·
            {" "}{new Date(timeline.scope.startISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
            {timeline.scope.endISO ? ` → ${new Date(timeline.scope.endISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}` : " → ∞"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => handleChange({ ...timeline, showOnCalendar: !timeline.showOnCalendar })}
            data-testid="tl-calendar-toggle"
            title={timeline.showOnCalendar
              ? "Events appear on the /calendar page — click to hide"
              : "Events are hidden from /calendar — click to show"}
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border transition flex items-center gap-1.5"
            style={{
              borderColor: timeline.showOnCalendar ? "rgba(0,240,255,0.6)" : "rgba(255,255,255,0.18)",
              background: timeline.showOnCalendar ? "rgba(0,240,255,0.08)" : "transparent",
              color: timeline.showOnCalendar ? "#67f0ff" : "#cfdaf3",
            }}
          >
            <CalendarDays size={11} />
            {timeline.showOnCalendar ? "On calendar" : "Off calendar"}
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            data-testid="tl-new"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-cyan-400/30 hover:border-cyan-300/60 hover:bg-cyan-500/[0.06] text-cyan-200 transition flex items-center gap-1.5"
          >
            <Plus size={11} /> New
          </button>
          <Link
            to="/library"
            data-testid="tl-library"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-white/15 hover:border-cyan-300/60 text-[#cfdaf3] hover:text-cyan-200 transition flex items-center gap-1.5"
          >
            <LibraryIcon size={11} /> Library
          </Link>
        </div>
      </header>

      {/* Body — canvas + sidebar on top, notes pane below.
          Top section is ~62% of the available height so the canvas
          stays the dominant surface; notes pane gets a sensible
          ~38% for typing without crowding. */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex overflow-hidden"
          style={{ flex: "1 1 62%", minHeight: 320 }}
        >
          <div className="flex-1 relative">
            <TimelineCanvas
              timeline={visibleTimeline}
              onChange={handleChange}
              onEditEvent={setEditingEvent}
              onAddEventAtDate={handleAddEventAtDate}
              onAddPeriod={handleAddPeriod}
              onAddMilestone={handleAddMilestone}
              onEditPeriod={(p) => setEditingDecoration({ ...p, kind: "period" })}
              onEditMilestone={(m) => setEditingDecoration({ ...m, kind: "milestone" })}
            />
          </div>
          <TimelineCategoriesSidebar
            categories={timeline.categories}
            hidden={hiddenCategories}
            onChange={handleCategoriesChange}
            onToggleHidden={toggleCategoryVisibility}
          />
        </div>
        <div style={{ flex: "1 1 38%", minHeight: 180, display: "flex", flexDirection: "column" }}>
          <TimelineNotesPane
            timeline={timeline}
            onChange={handleChange}
            defaultCategoryId={(timeline.categories || [])[0]?.id}
            onAddEvent={(seed) => {
              // Re-read fresh state from storage so a rapid-fire batch of
              // slash commands accumulates correctly (each callback is
              // closed over the same timeline snapshot otherwise — stale
              // closure → silent overwrites).
              const fresh = getTimeline(timeline.id) || timeline;
              const e = { ...seed, id: newEventId(), lane: 0 };
              handleChange({ ...fresh, events: [...(fresh.events || []), e] });
              toast.success(`Added "${e.label}" on ${new Date(e.dateISO).toLocaleDateString()}`);
            }}
            onAddPeriod={(seed) => {
              const fresh = getTimeline(timeline.id) || timeline;
              const p = { ...seed, id: newPeriodId() };
              handleChange({ ...fresh, periods: [...(fresh.periods || []), p] });
              toast.success(`Period "${p.label}" added`);
            }}
            onAddMilestone={(seed) => {
              const fresh = getTimeline(timeline.id) || timeline;
              const m = { ...seed, id: newMilestoneId() };
              handleChange({ ...fresh, milestones: [...(fresh.milestones || []), m] });
              toast.success(`Milestone "${m.label}" added`);
            }}
          />
        </div>
      </div>

      <TimelineCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <TimelineEventDialog
        open={!!editingEvent}
        event={editingEvent}
        categories={timeline.categories}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        onClose={() => setEditingEvent(null)}
      />
      <TimelineDecorationDialog
        open={!!editingDecoration}
        decoration={editingDecoration}
        onSave={handleSaveDecoration}
        onDelete={handleDeleteDecoration}
        onClose={() => setEditingDecoration(null)}
      />
    </div>
  );
}

// Re-export listTimelines for the Library page
export { listTimelines };

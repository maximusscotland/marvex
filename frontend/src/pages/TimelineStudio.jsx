/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Library as LibraryIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import TimelineCanvas from "@/components/timeline/TimelineCanvas";
import TimelineCategoriesSidebar from "@/components/timeline/TimelineCategoriesSidebar";
import TimelineEventDialog from "@/components/timeline/TimelineEventDialog";
import TimelineCreateDialog from "@/components/timeline/TimelineCreateDialog";
import {
  getTimeline,
  saveTimeline,
  blankTimeline,
  newEventId,
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
  const [timeline, setTimeline] = useState(() => (id && id !== "new" ? getTimeline(id) : null));
  const [createOpen, setCreateOpen] = useState(!timeline);
  const [editingEvent, setEditingEvent] = useState(null);
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
    <div className="min-h-screen cosmic-bg text-white flex flex-col">
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
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] hidden md:block">
            · timeline ·
            {" "}{new Date(timeline.scope.startISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
            {timeline.scope.endISO ? ` → ${new Date(timeline.scope.endISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}` : " → ∞"}
          </div>
        </div>
        <div className="flex items-center gap-3">
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

      {/* Body — canvas + sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <TimelineCanvas
            timeline={visibleTimeline}
            onChange={handleChange}
            onEditEvent={setEditingEvent}
            onAddEventAtDate={handleAddEventAtDate}
          />
        </div>
        <TimelineCategoriesSidebar
          categories={timeline.categories}
          hidden={hiddenCategories}
          onChange={handleCategoriesChange}
          onToggleHidden={toggleCategoryVisibility}
        />
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
    </div>
  );
}

// Re-export listTimelines for the Library page
export { listTimelines };

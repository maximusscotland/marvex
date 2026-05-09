/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus, Link2, Mail, File as FileIcon, Globe,
  ZoomIn, ZoomOut, Maximize2, Calendar as CalendarIcon, Flag, Layers,
  Edit3, Trash2, Palette, Type, Shapes, Move, StickyNote,
} from "lucide-react";
import { computeTicks, assignLanes } from "@/lib/timelineMath";
import { newNoteId } from "@/lib/timelineStorage";

const linkKind = (link) => {
  if (!link) return null;
  if (/^data:/i.test(link)) return "file";
  if (/^mailto:/i.test(link)) return "email";
  if (/^file:/i.test(link)) return "file";
  return "web";
};

/**
 * Normalise a user-typed link string (mirrors MindMapCanvas.normalizeLink).
 * `https://x`, `x.com`, `user@host`, `/abs`, `C:\…` all become a valid URL.
 */
const normalizeLink = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^[a-z]+:/i.test(s)) return s;
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
  if (/^\//.test(s)) return `file://${s}`;
  if (/^[A-Za-z]:[\\/]/.test(s)) return `file:///${s.replace(/\\/g, "/")}`;
  return `https://${s}`;
};

const CUBE_SIZE = 26;
const LANE_GAP = 6;
const AXIS_PADDING_X = 40;
const MINIMAP_HEIGHT = 50;

/**
 * Shape → CSS clip-path map. `null` means "use borderRadius instead".
 * Mirrors the mind-map node shape vocabulary so users get a familiar
 * mental model when editing block shapes.
 */
const SHAPE_CLIP = {
  rect:    null,
  pill:    null,
  circle:  null,
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hex:     "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)",
  pin:     "polygon(50% 0%, 100% 35%, 80% 100%, 20% 100%, 0% 35%)",
};
const SHAPE_RADIUS = {
  rect: 4,
  pill: 999,
  circle: 999,
  diamond: 0,
  hex: 0,
  pin: 0,
};

/** Per-shape minimum span width when an event has an endDateISO. */
const SPAN_HEIGHT = 20;

export default function TimelineCanvas({
  timeline,
  onChange,
  onEditEvent,
  onAddEventAtDate,
  onAddPeriod,
  onAddMilestone,
  onEditPeriod,
  onEditMilestone,
  readOnly = false,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 1600, h: 700 });
  const [view, setView] = useState(timeline.view || { x: 0, k: 1 });
  const [hover, setHover] = useState(null);
  const dragRef = useRef(null);
  const [cursorMs, setCursorMs] = useState(null);
  const [hoverPx, setHoverPx] = useState(null);
  // Phase 2/3 state: right-click context menu, inline rename, sticky notes.
  const [ctxMenu, setCtxMenu] = useState(null);          // { x, y, eventId }
  const [editingId, setEditingId] = useState(null);       // event id for inline rename
  const [editingNoteId, setEditingNoteId] = useState(null);

  // Persist view (debounced)
  useEffect(() => {
    if (!onChange) return;
    if (timeline.view?.x === view.x && timeline.view?.k === view.k) return;
    const t = setTimeout(() => { onChange({ ...timeline, view }); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.x, view.k]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(640, r.width), h: Math.max(400, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const startMs = useMemo(() => new Date(timeline.scope.startISO).getTime(), [timeline.scope.startISO]);
  const endMs = useMemo(() => {
    if (timeline.scope.endISO) return new Date(timeline.scope.endISO).getTime();
    const evs = timeline.events || [];
    if (evs.length) {
      const max = Math.max(...evs.map((e) => new Date(e.dateISO).getTime()));
      return max + (1 * 365.25 * 86_400_000);
    }
    return startMs + (5 * 365.25 * 86_400_000);
  }, [timeline.scope.endISO, timeline.events, startMs]);

  const worldXOf = useCallback((dateMs) => {
    const span = endMs - startMs;
    const usableW = size.w - 2 * AXIS_PADDING_X;
    return AXIS_PADDING_X + ((dateMs - startMs) / span) * usableW;
  }, [startMs, endMs, size.w]);
  const screenXOf = useCallback(
    (dateMs) => view.x + worldXOf(dateMs) * view.k,
    [view.x, view.k, worldXOf],
  );
  const dateOfScreenX = useCallback((px) => {
    const wx = (px - view.x) / view.k;
    const span = endMs - startMs;
    const usableW = size.w - 2 * AXIS_PADDING_X;
    return startMs + ((wx - AXIS_PADDING_X) / usableW) * span;
  }, [view.x, view.k, startMs, endMs, size.w]);

  const visibleStartMs = useMemo(() => dateOfScreenX(0), [dateOfScreenX]);
  const visibleEndMs = useMemo(() => dateOfScreenX(size.w), [dateOfScreenX, size.w]);
  const ticks = useMemo(
    () => computeTicks(
      Math.max(visibleStartMs, startMs),
      Math.min(visibleEndMs, endMs),
      size.w,
    ),
    [visibleStartMs, visibleEndMs, startMs, endMs, size.w],
  );

  const collideMs = useMemo(() => {
    const span = endMs - startMs;
    const usableW = size.w - 2 * AXIS_PADDING_X;
    const msPerPx = span / (usableW * view.k);
    return msPerPx * (CUBE_SIZE * 1.4);
  }, [startMs, endMs, size.w, view.k]);

  const eventsLaned = useMemo(() => {
    const cloned = (timeline.events || []).map((e) => ({ ...e }));
    return assignLanes(cloned, collideMs);
  }, [timeline.events, collideMs]);

  const categoryById = useMemo(() => {
    const m = {};
    for (const c of timeline.categories || []) m[c.id] = c;
    return m;
  }, [timeline.categories]);

  // ---------- Pan + Zoom ----------
  const onWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const newK = Math.max(0.05, Math.min(40, v.k * factor));
        const wx = (cx - v.x) / v.k;
        return { x: cx - wx * newK, k: newK };
      });
    } else {
      setView((v) => ({ ...v, x: v.x - e.deltaX }));
    }
  };

  // ---------- Mouse down dispatcher ----------
  // Distinguishes between (a) pan empty space, (b) drag an existing
  // event cube along the axis to retime it, (c) drag the right-edge
  // resize handle on an event to extend it into a span (sets endDateISO),
  // (d) drag a sticky note to reposition it.
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    // (c) Resize handle on an event — must come before the cube check
    // because the handle is a child of the cube.
    const resize = e.target.closest("[data-event-resize]");
    if (resize && !readOnly) {
      const eventId = resize.getAttribute("data-event-id");
      const ev = (timeline.events || []).find((x) => x.id === eventId);
      if (!ev) return;
      const startMs0 = new Date(ev.dateISO).getTime();
      const endMs0 = ev.endDateISO ? new Date(ev.endDateISO).getTime() : startMs0;
      dragRef.current = {
        kind: "resize-event",
        eventId,
        startMs0,
        endMs0,
        x0: e.clientX,
        moved: false,
      };
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // (d) Drag a sticky note.
    const note = e.target.closest("[data-note-handle]");
    if (note && !readOnly) {
      const noteId = note.getAttribute("data-note-id");
      const n = (timeline.notes || []).find((x) => x.id === noteId);
      if (!n) return;
      dragRef.current = {
        kind: "note",
        noteId,
        x0: e.clientX,
        y0: e.clientY,
        nx0: n.x ?? 80,
        ny0: n.y ?? 80,
        moved: false,
      };
      e.preventDefault();
      return;
    }
    const cube = e.target.closest("[data-event-cube]");
    if (cube && !readOnly) {
      const eventId = cube.getAttribute("data-event-id");
      const ev = (timeline.events || []).find((x) => x.id === eventId);
      if (!ev) return;
      dragRef.current = {
        kind: "event",
        eventId,
        startMs0: new Date(ev.dateISO).getTime(),
        endMs0: ev.endDateISO ? new Date(ev.endDateISO).getTime() : null,
        x0: e.clientX,
        moved: false,
      };
      e.preventDefault();
      return;
    }
    if (e.target.closest("[data-zoom-controls], [data-add-cta], [data-period-handle], [data-milestone-handle], [data-ctx-menu]")) return;
    dragRef.current = {
      kind: "pan",
      x0: e.clientX,
      vx0: view.x,
      moved: false,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.x0;
      if (!dragRef.current.moved && Math.abs(dx) > 3) dragRef.current.moved = true;
      if (dragRef.current.kind === "pan") {
        setView((v) => ({ ...v, x: dragRef.current.vx0 + dx }));
      } else if (dragRef.current.kind === "event") {
        // Retime: snap delta to ms — drag start AND end (if span) together.
        const span = endMs - startMs;
        const usableW = size.w - 2 * AXIS_PADDING_X;
        const msPerPx = span / (usableW * view.k);
        const deltaMs = dx * msPerPx;
        if (dragRef.current.moved) {
          const newStart = Math.max(startMs, Math.min(endMs, dragRef.current.startMs0 + deltaMs));
          const events = (timeline.events || []).map((x) => {
            if (x.id !== dragRef.current.eventId) return x;
            const next = { ...x, dateISO: new Date(newStart).toISOString() };
            if (dragRef.current.endMs0) {
              const newEnd = Math.max(newStart + 1, Math.min(endMs, dragRef.current.endMs0 + deltaMs));
              next.endDateISO = new Date(newEnd).toISOString();
            }
            return next;
          });
          onChange?.({ ...timeline, events });
        }
      } else if (dragRef.current.kind === "resize-event") {
        // Stretch the right edge → set/extend endDateISO. If the user
        // drags the handle back past the start, drop endDateISO so the
        // block reverts to a point event.
        const span = endMs - startMs;
        const usableW = size.w - 2 * AXIS_PADDING_X;
        const msPerPx = span / (usableW * view.k);
        const newEndMs = (dragRef.current.endMs0 || dragRef.current.startMs0) + dx * msPerPx;
        if (dragRef.current.moved) {
          const events = (timeline.events || []).map((x) => {
            if (x.id !== dragRef.current.eventId) return x;
            if (newEndMs <= dragRef.current.startMs0 + msPerPx * 4) {
              // Collapsed back to a point.
              const { endDateISO: _drop, ...rest } = x;
              return rest;
            }
            return { ...x, endDateISO: new Date(Math.min(endMs, newEndMs)).toISOString() };
          });
          onChange?.({ ...timeline, events });
        }
      } else if (dragRef.current.kind === "note") {
        const dy = e.clientY - dragRef.current.y0;
        if (dragRef.current.moved) {
          const notes = (timeline.notes || []).map((n) =>
            n.id === dragRef.current.noteId
              ? { ...n, x: Math.max(8, dragRef.current.nx0 + dx), y: Math.max(8, dragRef.current.ny0 + dy) }
              : n,
          );
          onChange?.({ ...timeline, notes });
        }
      }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, endMs, size.w, view.k, timeline.events, timeline.notes]);

  const onContainerMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setHoverPx({ x: px, y: py });
    if (Math.abs(py - size.h / 2) < 80) {
      setCursorMs(dateOfScreenX(px));
    } else {
      setCursorMs(null);
    }
  };

  const onContainerClick = (e) => {
    // Close the context menu on any click that isn't inside it.
    if (ctxMenu && !e.target.closest("[data-ctx-menu]")) {
      setCtxMenu(null);
    }
    if (readOnly) return;
    if (dragRef.current?.moved) return;
    if (e.target.closest("[data-event-cube], [data-zoom-controls], [data-period-handle], [data-milestone-handle], [data-add-cta], [data-note-handle], [data-ctx-menu]")) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (Math.abs(py - size.h / 2) < 60) {
      // Compute date from click coords directly so taps/touches work
      // even when no prior hover event set cursorMs.
      const dateMs = Math.max(startMs, Math.min(endMs, dateOfScreenX(px)));
      onAddEventAtDate?.(new Date(dateMs).toISOString(), py < size.h / 2 ? "above" : "below");
    }
  };

  // Right-click on an event cube → context menu (shape / colour / size /
  // edit / delete). Prevent the browser menu so ours wins.
  const onContainerContextMenu = (e) => {
    if (readOnly) return;
    const cube = e.target.closest("[data-event-cube]");
    if (!cube) {
      setCtxMenu(null);
      return;
    }
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    setCtxMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      eventId: cube.getAttribute("data-event-id"),
    });
  };

  // Close context menu on Escape.
  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e) => { if (e.key === "Escape") setCtxMenu(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctxMenu]);

  // Helpers used by the context menu to patch a single event.
  const patchEvent = useCallback((id, patch) => {
    const events = (timeline.events || []).map((x) =>
      x.id === id ? { ...x, ...patch } : x,
    );
    onChange?.({ ...timeline, events });
  }, [timeline, onChange]);

  const removeEvent = useCallback((id) => {
    const events = (timeline.events || []).filter((x) => x.id !== id);
    onChange?.({ ...timeline, events });
    setCtxMenu(null);
  }, [timeline, onChange]);

  // Sticky-note CRUD (Phase 3).
  const addNoteAtCenter = () => {
    const n = {
      id: newNoteId(),
      text: "",
      x: 100 + Math.round(Math.random() * 80),
      y: 100 + Math.round(Math.random() * 60),
      color: "#ffd66b",
    };
    onChange?.({ ...timeline, notes: [...(timeline.notes || []), n] });
    setEditingNoteId(n.id);
  };
  const patchNote = (id, patch) => {
    const notes = (timeline.notes || []).map((n) =>
      n.id === id ? { ...n, ...patch } : n,
    );
    onChange?.({ ...timeline, notes });
  };
  const removeNote = (id) => {
    onChange?.({ ...timeline, notes: (timeline.notes || []).filter((n) => n.id !== id) });
    setEditingNoteId(null);
  };

  // ---------- Zoom control helpers (g + c keyboard + on-screen) ----------
  const zoomBy = useCallback((factor) => {
    const cx = size.w / 2;
    setView((v) => {
      const newK = Math.max(0.05, Math.min(40, v.k * factor));
      const wx = (cx - v.x) / v.k;
      return { x: cx - wx * newK, k: newK };
    });
  }, [size.w]);

  const fitAll = useCallback(() => {
    setView({ x: 0, k: 1 });
  }, []);

  const goToToday = useCallback(() => {
    const now = Date.now();
    if (now < startMs || now > endMs) return; // outside scope
    const targetWorldX = worldXOf(now);
    const cx = size.w / 2;
    setView((v) => ({ ...v, x: cx - targetWorldX * v.k }));
  }, [startMs, endMs, worldXOf, size.w]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const handler = (e) => {
      // Skip if typing in an input/textarea anywhere
      const tgt = e.target;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (e.key === "ArrowLeft")  { setView((v) => ({ ...v, x: v.x + 80 })); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setView((v) => ({ ...v, x: v.x - 80 })); e.preventDefault(); }
      else if (e.key === "+" || e.key === "=") { zoomBy(1.25); e.preventDefault(); }
      else if (e.key === "-" || e.key === "_") { zoomBy(0.8); e.preventDefault(); }
      else if (e.key === "0") { fitAll(); e.preventDefault(); }
      else if (e.key === "t" || e.key === "T") { goToToday(); e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomBy, fitAll, goToToday]);

  const axisY = size.h / 2;
  const todayMs = Date.now();
  const todayInScope = todayMs >= startMs && todayMs <= endMs;
  const todayX = todayInScope ? screenXOf(todayMs) : null;

  return (
    <div
      ref={containerRef}
      data-testid="timeline-canvas"
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        cursor: dragRef.current ? "grabbing" : "default",
        background: "radial-gradient(ellipse at center, rgba(20,28,60,0.4) 0%, rgba(3,4,10,0.95) 70%)",
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onContainerMouseMove}
      onMouseLeave={() => { setCursorMs(null); setHoverPx(null); }}
      onClick={onContainerClick}
      onContextMenu={onContainerContextMenu}
    >
      {/* Period bars — coloured edge decorations behind everything else */}
      {(timeline.periods || []).map((p) => {
        const x1 = screenXOf(new Date(p.startISO).getTime());
        const x2 = screenXOf(new Date(p.endISO).getTime());
        if (x2 < -30 || x1 > size.w + 30) return null;
        return (
          <button
            key={p.id}
            data-period-handle
            data-testid={`tl-period-${p.id}`}
            onClick={(e) => { e.stopPropagation(); onEditPeriod?.(p); }}
            className="absolute top-0 group"
            style={{
              left: x1,
              width: Math.max(2, x2 - x1),
              height: size.h,
              background: `${p.color || "#ff6ad5"}1a`,
              borderLeft: `2px solid ${p.color || "#ff6ad5"}`,
              borderRight: `2px solid ${p.color || "#ff6ad5"}`,
              cursor: "pointer",
              boxShadow: `inset 0 0 32px ${p.color || "#ff6ad5"}22`,
            }}
            title={`${p.label} · click to edit`}
          >
            <div
              className="mono text-[9px] uppercase tracking-[0.22em] absolute left-1.5 top-1.5 px-1.5 py-0.5 rounded backdrop-blur"
              style={{
                background: "rgba(3,4,10,0.7)",
                color: p.color || "#ff6ad5",
                border: `1px solid ${p.color || "#ff6ad5"}66`,
                writingMode: "vertical-lr",
                textOrientation: "mixed",
              }}
            >
              {p.label}
            </div>
          </button>
        );
      })}

      {/* SVG layer — grid, ticks, axis line, today marker, milestones */}
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="absolute inset-0 pointer-events-none"
      >
        <defs>
          <pattern id="tl-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
          </pattern>
          <linearGradient id="tl-axis-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,240,255,0)" />
            <stop offset="6%" stopColor="rgba(0,240,255,1)" />
            <stop offset="50%" stopColor="rgba(160,140,255,1)" />
            <stop offset="94%" stopColor="rgba(255,106,213,1)" />
            <stop offset="100%" stopColor="rgba(255,106,213,0)" />
          </linearGradient>
        </defs>
        <rect width={size.w} height={size.h} fill="url(#tl-grid)" />

        {/* Ticks */}
        {ticks.map((t) => {
          const x = screenXOf(t.dateMs);
          if (x < -50 || x > size.w + 50) return null;
          return (
            <g key={t.dateMs}>
              <line
                x1={x}
                x2={x}
                y1={axisY - (t.major ? 22 : 10)}
                y2={axisY + (t.major ? 22 : 10)}
                stroke={t.major ? "rgba(0,240,255,0.85)" : "rgba(207,218,243,0.35)"}
                strokeWidth={t.major ? 1.6 : 1.1}
              />
              <text
                x={x}
                y={axisY + (t.major ? 42 : 28)}
                textAnchor="middle"
                fontSize={t.major ? 11 : 10}
                fontFamily="'JetBrains Mono', monospace"
                fill={t.major ? "rgba(207,218,243,1)" : "rgba(154,167,199,0.85)"}
                style={{ letterSpacing: "0.04em" }}
              >
                {t.label}
              </text>
            </g>
          );
        })}

        {/* Solid base axis line — guarantees centre line is visible at any
            zoom level even when the gradient stops fall off-screen. */}
        <line
          x1={0}
          x2={size.w}
          y1={axisY}
          y2={axisY}
          stroke="rgba(207,218,243,0.18)"
          strokeWidth={1.5}
        />
        {/* Glowing gradient overlay on top of the base line. */}
        <line
          x1={20}
          x2={size.w - 20}
          y1={axisY}
          y2={axisY}
          stroke="url(#tl-axis-gradient)"
          strokeWidth={3}
          strokeDasharray="6 6"
          style={{ filter: "drop-shadow(0 0 10px rgba(0,240,255,0.55))" }}
        />

        {/* TODAY marker — neon vertical line + label */}
        {todayInScope && todayX !== null && todayX > -20 && todayX < size.w + 20 && (
          <g>
            <line
              x1={todayX} x2={todayX}
              y1={20} y2={size.h - 20}
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={1.4}
              strokeDasharray="3 4"
              style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))" }}
            />
            <rect
              x={todayX - 24} y={8}
              width={48} height={18} rx={9}
              fill="rgba(255,255,255,0.95)"
            />
            <text
              x={todayX} y={21}
              textAnchor="middle"
              fontSize={10}
              fontFamily="'JetBrains Mono', monospace"
              fontWeight={700}
              fill="#0a0f24"
              style={{ letterSpacing: "0.18em" }}
            >TODAY</text>
          </g>
        )}

        {/* Milestone vertical lines */}
        {(timeline.milestones || []).map((m) => {
          const x = screenXOf(new Date(m.dateISO).getTime());
          if (x < -20 || x > size.w + 20) return null;
          const color = m.color || "#a08cff";
          return (
            <g key={m.id}>
              <line
                x1={x} x2={x}
                y1={32} y2={size.h - 60}
                stroke={color}
                strokeWidth={1.3}
                strokeDasharray="6 4"
                opacity={0.85}
                style={{ filter: `drop-shadow(0 0 5px ${color})` }}
              />
            </g>
          );
        })}
      </svg>

      {/* Milestone labels (interactive — click to edit) */}
      {(timeline.milestones || []).map((m) => {
        const x = screenXOf(new Date(m.dateISO).getTime());
        if (x < -40 || x > size.w + 40) return null;
        const color = m.color || "#a08cff";
        return (
          <button
            key={m.id}
            data-milestone-handle
            data-testid={`tl-milestone-${m.id}`}
            onClick={(e) => { e.stopPropagation(); onEditMilestone?.(m); }}
            className="absolute"
            style={{
              left: x - 60,
              top: 28,
              width: 120,
              height: 22,
              background: "rgba(3,4,10,0.85)",
              border: `1.5px solid ${color}`,
              borderRadius: 11,
              color,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textAlign: "center",
              cursor: "pointer",
              boxShadow: `0 0 8px ${color}66`,
            }}
            title={`${m.label} · click to edit`}
          >
            <Flag size={9} style={{ display: "inline", marginRight: 4, marginBottom: -1 }} />
            {m.label.length > 14 ? m.label.slice(0, 13) + "…" : m.label}
          </button>
        );
      })}

      {/* Cursor "add here" hint */}
      {!readOnly && cursorMs !== null && hoverPx && !dragRef.current && (
        <div
          data-add-cta
          className="absolute pointer-events-none"
          style={{ left: hoverPx.x - 14, top: axisY - 14, width: 28, height: 28 }}
        >
          <div
            className="w-7 h-7 rounded-md border-2 border-cyan-400/70 bg-cyan-500/10 flex items-center justify-center"
            style={{
              boxShadow: "0 0 12px rgba(0,240,255,0.5)",
              animation: "tlPulse 1.6s ease-in-out infinite",
            }}
          >
            <Plus size={14} className="text-cyan-200" />
          </div>
          <div
            className="absolute left-1/2 -translate-x-1/2 mono text-[9px] uppercase tracking-[0.18em] text-cyan-200 whitespace-nowrap"
            style={{ top: 32, textShadow: "0 0 8px rgba(0,240,255,0.6)" }}
          >
            {new Date(cursorMs).toLocaleDateString(undefined, {
              year: "numeric", month: "short", day: "numeric",
            })}
          </div>
        </div>
      )}

      {/* Event cubes / spans — shape, colour-override, font-size, tags,
          resize-to-span, inline-rename, hyperlink-badge all live here. */}
      {eventsLaned.map((e) => {
        const cat = categoryById[e.categoryId];
        const baseColor = e.colorOverride || cat?.color || "#00f0ff";
        const x = screenXOf(new Date(e.dateISO).getTime());
        const isSpan = !!e.endDateISO;
        const xEnd = isSpan ? screenXOf(new Date(e.endDateISO).getTime()) : x;
        const blockW = isSpan ? Math.max(CUBE_SIZE, xEnd - x) : CUBE_SIZE;
        const blockH = isSpan ? SPAN_HEIGHT : CUBE_SIZE;
        if ((isSpan ? xEnd : x) < -100 || x > size.w + 100) return null;
        const offset = (e.lane + 1) * (CUBE_SIZE + LANE_GAP);
        const y = e.position === "above" ? axisY - offset : axisY + offset - blockH;
        const kind = linkKind(e.link);
        const LinkIcon = kind === "email" ? Mail : kind === "file" ? FileIcon : kind === "web" ? Globe : null;
        const isHover = hover === e.id;
        const shapeId = e.shape || "rect";
        const clip = SHAPE_CLIP[shapeId];
        const radius = isSpan ? 4 : SHAPE_RADIUS[shapeId] ?? 4;
        const tags = e.tags || [];
        const labelFontSize = e.fontSize || 11;
        const isEditing = editingId === e.id;

        const cubeLeft = isSpan ? x : x - CUBE_SIZE / 2;

        return (
          <button
            key={e.id}
            data-event-cube
            data-event-id={e.id}
            data-testid={`tl-event-${e.id}`}
            onClick={(ev) => {
              ev.stopPropagation();
              if (dragRef.current?.moved) return;
              if (isEditing) return;
              // If the user clicked the link badge, open the link directly
              // (handler on the badge already stopped propagation, so this
              // branch is the cube-body fall-through → opens dialog).
              onEditEvent?.(e);
            }}
            onDoubleClick={(ev) => { ev.stopPropagation(); setEditingId(e.id); }}
            onMouseEnter={() => setHover(e.id)}
            onMouseLeave={() => setHover((h) => (h === e.id ? null : h))}
            className="absolute group flex items-center justify-center transition-transform"
            style={{
              left: cubeLeft,
              top: y,
              width: blockW,
              height: blockH,
              borderRadius: radius,
              clipPath: clip || undefined,
              background: baseColor,
              border: clip ? "none" : "1.5px solid rgba(255,255,255,0.35)",
              boxShadow: isHover
                ? `0 0 16px ${baseColor}cc, 0 0 32px ${baseColor}66`
                : `0 0 8px ${baseColor}aa`,
              transform: isHover && !isSpan ? "scale(1.12)" : "scale(1)",
              cursor: readOnly ? "pointer" : "grab",
            }}
            title={`${e.label}${cat ? ` · ${cat.name}` : ""} · ${new Date(e.dateISO).toLocaleDateString()}${isSpan ? ` → ${new Date(e.endDateISO).toLocaleDateString()}` : ""}${readOnly ? "" : " · drag to retime · double-click to rename · right-click for shape"}`}
          >
            {LinkIcon && !isSpan && (
              <LinkIcon size={11} className="text-white/90" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))" }} />
            )}
            {/* Connector line from cube/bar to axis — hide for spans
                (they sit closer to the axis already). */}
            {!isSpan && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: CUBE_SIZE / 2 - 1,
                  top: e.position === "above" ? CUBE_SIZE : -offset + CUBE_SIZE,
                  width: 2,
                  height: offset - CUBE_SIZE,
                  background: `${baseColor}66`,
                }}
              />
            )}
            {/* Hover tooltip / inline-rename input */}
            {isEditing ? (
              <input
                autoFocus
                defaultValue={e.label}
                onClick={(ev) => ev.stopPropagation()}
                onBlur={(ev) => {
                  patchEvent(e.id, { label: ev.target.value.trim() || "Event" });
                  setEditingId(null);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") { ev.target.blur(); }
                  if (ev.key === "Escape") { setEditingId(null); }
                }}
                data-testid={`tl-event-rename-${e.id}`}
                className="absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-[#0a0f24] border border-cyan-400/60 text-white whitespace-nowrap outline-none"
                style={{
                  top: e.position === "above" ? -36 : blockH + 6,
                  fontSize: labelFontSize,
                  minWidth: 120,
                  boxShadow: `0 0 12px ${baseColor}cc`,
                }}
              />
            ) : (
              <div
                className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-[#0a0f24] border border-white/15 text-white whitespace-nowrap pointer-events-none transition-opacity"
                style={{
                  top: e.position === "above" ? -32 : blockH + 6,
                  opacity: isHover || isSpan ? 1 : 0,
                  fontSize: labelFontSize,
                  boxShadow: `0 0 8px ${baseColor}55`,
                }}
              >
                {e.label || "Event"}
              </div>
            )}
            {/* Tags row — small chips beneath the label. */}
            {tags.length > 0 && !isEditing && (
              <div
                className="absolute left-1/2 -translate-x-1/2 flex gap-1 flex-wrap justify-center pointer-events-none"
                style={{
                  top: e.position === "above" ? -55 : blockH + 30,
                  opacity: isHover || isSpan ? 1 : 0.6,
                  maxWidth: Math.max(160, blockW + 80),
                }}
              >
                {tags.slice(0, 4).map((t) => (
                  <span
                    key={t}
                    className="mono text-[8px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(3,4,10,0.8)",
                      color: baseColor,
                      border: `1px solid ${baseColor}77`,
                      boxShadow: `0 0 4px ${baseColor}55`,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {LinkIcon && !isSpan && (
              <span
                role="link"
                tabIndex={0}
                onClick={(ev) => {
                  ev.stopPropagation();
                  ev.preventDefault();
                  try { window.open(normalizeLink(e.link), "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
                }}
                data-testid={`tl-event-link-${e.id}`}
                className="absolute"
                style={{
                  right: -6, top: -6,
                  width: 14, height: 14, borderRadius: 7,
                  background: "#0a0f24",
                  border: `1.5px solid ${baseColor}`,
                  display: "grid", placeItems: "center",
                  boxShadow: `0 0 6px ${baseColor}cc`,
                  cursor: "pointer",
                }}
                title="Open link"
              >
                <Link2 size={7} style={{ color: baseColor }} />
              </span>
            )}
            {/* Right-edge resize handle — appears on hover, drag to extend
                into a span. Hidden when the block is already a span (you
                can drag the right edge of the bar instead). */}
            {!readOnly && (isHover || isSpan) && (
              <span
                data-event-resize
                data-event-id={e.id}
                data-testid={`tl-event-resize-${e.id}`}
                className="absolute"
                style={{
                  right: -3,
                  top: 0,
                  height: blockH,
                  width: 8,
                  cursor: "ew-resize",
                  background: "transparent",
                  borderRight: `2px solid ${baseColor}`,
                  borderRadius: 2,
                  boxShadow: `0 0 4px ${baseColor}aa`,
                }}
                title="Drag to make this a duration / span"
              />
            )}
          </button>
        );
      })}

      {/* Empty state hint */}
      {!eventsLaned.length && (
        <div
          data-testid="timeline-empty"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
          style={{ marginTop: -120 }}
        >
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
            Empty timeline
          </div>
          <div className="text-[14px] text-[#9aa7c7] max-w-md">
            Click anywhere on the dotted line to drop an event.
          </div>
        </div>
      )}

      {/* ---------- BOTTOM-LEFT: Zoom + add-decoration controls ---------- */}
      <div
        data-zoom-controls
        className="absolute left-4 bottom-[78px] flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#03040a]/80 backdrop-blur-md p-1.5"
      >
        <button
          onClick={() => zoomBy(1.25)}
          data-testid="tl-zoom-in"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-cyan-200 hover:bg-cyan-500/15 transition"
          title="Zoom in (+)"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => zoomBy(0.8)}
          data-testid="tl-zoom-out"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-cyan-200 hover:bg-cyan-500/15 transition"
          title="Zoom out (-)"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={fitAll}
          data-testid="tl-fit"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-cyan-200 hover:bg-cyan-500/15 transition"
          title="Fit all (0)"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={goToToday}
          data-testid="tl-today"
          disabled={!todayInScope}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:bg-white/15 transition disabled:opacity-30 disabled:hover:bg-transparent"
          title="Go to today (T)"
        >
          <CalendarIcon size={14} />
        </button>
      </div>
      {!readOnly && (
        <div
          data-zoom-controls
          className="absolute right-4 bottom-[78px] flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#03040a]/80 backdrop-blur-md p-1.5"
        >
          <button
            onClick={onAddPeriod}
            data-testid="tl-add-period"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-fuchsia-200 hover:bg-fuchsia-500/15 transition"
            title="Add period bar (e.g. Term, Holiday, Sprint)"
          >
            <Layers size={14} />
          </button>
          <button
            onClick={onAddMilestone}
            data-testid="tl-add-milestone"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-violet-200 hover:bg-violet-500/15 transition"
            title="Add milestone (vertical marker line)"
          >
            <Flag size={14} />
          </button>
          <button
            onClick={addNoteAtCenter}
            data-testid="tl-add-note"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-200 hover:bg-amber-500/15 transition"
            title="Add sticky note"
          >
            <StickyNote size={14} />
          </button>
        </div>
      )}

      {/* Sticky notes layer (Phase 3) — free-floating annotations on top
          of the canvas. Drag the header to reposition; click the body to
          edit; × to delete. Note coords are screen-relative so a note
          stays visually anchored while the user pans the timeline. */}
      {(timeline.notes || []).map((n) => {
        const isEditing = editingNoteId === n.id;
        const noteColor = n.color || "#ffd66b";
        return (
          <div
            key={n.id}
            data-testid={`tl-note-${n.id}`}
            className="absolute"
            style={{
              left: n.x ?? 100,
              top: n.y ?? 100,
              width: 220,
              minHeight: 80,
              borderRadius: 10,
              background: `${noteColor}1a`,
              border: `1.5px solid ${noteColor}`,
              boxShadow: `0 6px 24px rgba(0,0,0,0.5), 0 0 16px ${noteColor}55`,
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              data-note-handle
              data-note-id={n.id}
              className="px-2.5 py-1.5 flex items-center justify-between rounded-t-[10px]"
              style={{
                background: `${noteColor}22`,
                borderBottom: `1px solid ${noteColor}55`,
                cursor: "grab",
              }}
            >
              <div className="flex items-center gap-1.5 mono text-[9px] uppercase tracking-[0.2em]" style={{ color: noteColor }}>
                <Move size={10} /> Note
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={noteColor}
                  onChange={(ev) => patchNote(n.id, { color: ev.target.value })}
                  data-testid={`tl-note-color-${n.id}`}
                  className="w-5 h-5 rounded border border-white/10 cursor-pointer bg-transparent"
                  style={{ padding: 0 }}
                  title="Change colour"
                />
                <button
                  onClick={() => removeNote(n.id)}
                  data-testid={`tl-note-delete-${n.id}`}
                  className="w-5 h-5 rounded grid place-items-center text-white/70 hover:text-rose-300 hover:bg-rose-500/15 transition"
                  title="Delete note"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            {isEditing ? (
              <textarea
                autoFocus
                defaultValue={n.text}
                onBlur={(ev) => { patchNote(n.id, { text: ev.target.value }); setEditingNoteId(null); }}
                onKeyDown={(ev) => {
                  if (ev.key === "Escape") setEditingNoteId(null);
                  if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) ev.target.blur();
                }}
                data-testid={`tl-note-edit-${n.id}`}
                className="w-full bg-transparent outline-none px-3 py-2 text-[13px] text-white resize-none leading-relaxed"
                style={{ minHeight: 56 }}
                placeholder="Type your note… (⌘/Ctrl + Enter to save)"
              />
            ) : (
              <div
                onClick={() => setEditingNoteId(n.id)}
                data-testid={`tl-note-body-${n.id}`}
                className="px-3 py-2 text-[13px] text-white whitespace-pre-wrap leading-relaxed cursor-text min-h-[56px]"
              >
                {n.text || <span className="text-white/40 italic">Click to add text…</span>}
              </div>
            )}
          </div>
        );
      })}

      {/* Right-click context menu — shape · colour · font size · edit · delete.
          Mirrors the mind-map node context menu so users get the same
          mental model when shaping timeline blocks. */}
      {ctxMenu && (() => {
        const ev = (timeline.events || []).find((e) => e.id === ctxMenu.eventId);
        if (!ev) return null;
        const cat = categoryById[ev.categoryId];
        const color = ev.colorOverride || cat?.color || "#00f0ff";
        const SHAPES = [
          { id: "rect", label: "Square" },
          { id: "pill", label: "Pill" },
          { id: "circle", label: "Circle" },
          { id: "diamond", label: "Diamond" },
          { id: "hex", label: "Hex" },
          { id: "pin", label: "Pin" },
        ];
        const SWATCHES = [null, "#00f0ff", "#ff6ad5", "#a08cff", "#ffd66b", "#76ff9d", "#ff8a65", "#42a5f5"];
        const FS = [10, 12, 14, 16, 18];
        return (
          <div
            data-ctx-menu
            data-testid="tl-ctx-menu"
            className="absolute z-30 rounded-xl border border-cyan-400/30 bg-[#0a0f24]/95 backdrop-blur-md shadow-[0_0_60px_rgba(0,240,255,0.25)] py-2 px-2 w-[260px]"
            style={{ left: Math.min(ctxMenu.x, size.w - 270), top: Math.min(ctxMenu.y, size.h - 320) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] px-1 mb-1.5 flex items-center gap-1.5">
              <Shapes size={9} /> Shape
            </div>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {SHAPES.map((s) => {
                const active = (ev.shape || "rect") === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => patchEvent(ev.id, { shape: s.id })}
                    data-testid={`tl-ctx-shape-${s.id}`}
                    className="px-1.5 py-1 rounded text-[10px] border transition"
                    style={{
                      background: active ? "rgba(0,240,255,0.15)" : "transparent",
                      borderColor: active ? "rgba(0,240,255,0.55)" : "rgba(255,255,255,0.12)",
                      color: active ? "#00f0ff" : "#cfdaf3",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] px-1 mb-1.5 flex items-center gap-1.5">
              <Palette size={9} /> Colour
            </div>
            <div className="flex flex-wrap gap-1 mb-2 px-1">
              {SWATCHES.map((c) => {
                const active = (ev.colorOverride || null) === c;
                return (
                  <button
                    key={c || "auto"}
                    onClick={() => patchEvent(ev.id, { colorOverride: c })}
                    data-testid={`tl-ctx-color-${c || "auto"}`}
                    className="w-6 h-6 rounded border-2 transition"
                    style={{
                      borderColor: active ? "#fff" : "rgba(255,255,255,0.12)",
                      background: c || "transparent",
                      backgroundImage: c ? "none" : "linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.4) 45% 55%, transparent 55%)",
                      boxShadow: active && c ? `0 0 8px ${c}` : "none",
                    }}
                    title={c || "Use category colour"}
                  />
                );
              })}
            </div>
            <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] px-1 mb-1.5 flex items-center gap-1.5">
              <Type size={9} /> Font size
            </div>
            <div className="flex gap-1 mb-2 px-1">
              {FS.map((s) => {
                const active = (ev.fontSize || 11) === s;
                return (
                  <button
                    key={s}
                    onClick={() => patchEvent(ev.id, { fontSize: s })}
                    data-testid={`tl-ctx-fs-${s}`}
                    className="flex-1 py-1 rounded border transition text-white"
                    style={{
                      fontSize: s,
                      background: active ? "rgba(0,240,255,0.15)" : "transparent",
                      borderColor: active ? "rgba(0,240,255,0.55)" : "rgba(255,255,255,0.12)",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/8 my-1.5" />
            <button
              onClick={() => { setCtxMenu(null); onEditEvent?.(ev); }}
              data-testid="tl-ctx-edit"
              className="w-full text-left px-2 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-white/[0.05] flex items-center gap-2"
            >
              <Edit3 size={11} style={{ color }} /> Edit details…
            </button>
            <button
              onClick={() => removeEvent(ev.id)}
              data-testid="tl-ctx-delete"
              className="w-full text-left px-2 py-1.5 rounded text-[12px] text-rose-300 hover:bg-rose-500/10 flex items-center gap-2"
            >
              <Trash2 size={11} /> Delete event
            </button>
          </div>
        );
      })()}

      {/* ---------- BOTTOM: Mini-map / scrubber ---------- */}
      <Minimap
        timeline={timeline}
        startMs={startMs}
        endMs={endMs}
        view={view}
        canvasW={size.w}
        canvasH={size.h}
        worldXOf={worldXOf}
        screenXOf={screenXOf}
        onScrub={(targetMs) => {
          // Centre the canvas on targetMs
          const cx = size.w / 2;
          const targetWorldX = worldXOf(targetMs);
          setView((v) => ({ ...v, x: cx - targetWorldX * v.k }));
        }}
        categoryById={categoryById}
      />

      <style>{`
        @keyframes tlPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

/**
 * Minimap — full-timeline strip with viewport indicator. Click anywhere
 * to jump-pan to that date. Renders all events as 2px ticks (coloured
 * by category) so users can see event density at a glance.
 */
function Minimap({ timeline, startMs, endMs, view, canvasW, canvasH, worldXOf, onScrub, categoryById }) {
  const ref = useRef(null);
  const span = endMs - startMs;
  const usableW = canvasW - 2 * AXIS_PADDING_X;

  // Map the visible viewport (in screen coords) back to a date range
  // for the indicator window in the minimap.
  const viewLeftWorld = (-view.x) / view.k;
  const viewRightWorld = (canvasW - view.x) / view.k;
  const viewLeftMs = startMs + ((viewLeftWorld - AXIS_PADDING_X) / usableW) * span;
  const viewRightMs = startMs + ((viewRightWorld - AXIS_PADDING_X) / usableW) * span;

  const msToFraction = (ms) => Math.max(0, Math.min(1, (ms - startMs) / span));

  const onClick = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const frac = px / rect.width;
    const targetMs = startMs + frac * span;
    onScrub?.(targetMs);
  };

  const dragMM = useRef(null);
  const onMouseDown = (e) => {
    dragMM.current = true;
    onClick(e);
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragMM.current) return;
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const px = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const frac = px / rect.width;
      onScrub?.(startMs + frac * span);
    };
    const onUp = () => { dragMM.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [startMs, span, onScrub]);

  return (
    <div
      ref={ref}
      data-testid="timeline-minimap"
      onMouseDown={onMouseDown}
      className="absolute left-4 right-4 bottom-4 rounded-lg border border-white/10 bg-[#03040a]/85 backdrop-blur-md cursor-pointer"
      style={{ height: MINIMAP_HEIGHT, overflow: "hidden" }}
    >
      {/* Centre line */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: MINIMAP_HEIGHT / 2,
          height: 1,
          background: "linear-gradient(to right, transparent, rgba(0,240,255,0.4), rgba(255,106,213,0.4), transparent)",
        }}
      />
      {/* Period bars */}
      {(timeline.periods || []).map((p) => {
        const f1 = msToFraction(new Date(p.startISO).getTime());
        const f2 = msToFraction(new Date(p.endISO).getTime());
        return (
          <div
            key={p.id}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${f1 * 100}%`,
              width: `${Math.max(0.2, (f2 - f1) * 100)}%`,
              background: `${p.color || "#ff6ad5"}26`,
              borderLeft: `1px solid ${p.color || "#ff6ad5"}88`,
              borderRight: `1px solid ${p.color || "#ff6ad5"}88`,
            }}
          />
        );
      })}
      {/* Event ticks */}
      {(timeline.events || []).map((e) => {
        const f = msToFraction(new Date(e.dateISO).getTime());
        const cat = categoryById[e.categoryId];
        const color = cat?.color || "#00f0ff";
        return (
          <div
            key={e.id}
            className="absolute pointer-events-none"
            style={{
              left: `calc(${f * 100}% - 1px)`,
              top: e.position === "above" ? 4 : MINIMAP_HEIGHT / 2 + 2,
              width: 2,
              height: MINIMAP_HEIGHT / 2 - 6,
              background: color,
              boxShadow: `0 0 4px ${color}cc`,
            }}
          />
        );
      })}
      {/* Viewport indicator */}
      <div
        className="absolute top-0 bottom-0 border border-cyan-400/70 bg-cyan-400/10 pointer-events-none"
        style={{
          left: `${msToFraction(viewLeftMs) * 100}%`,
          width: `${Math.max(0.5, (msToFraction(viewRightMs) - msToFraction(viewLeftMs)) * 100)}%`,
          boxShadow: "inset 0 0 8px rgba(0,240,255,0.3)",
        }}
      />
      {/* Today marker */}
      {Date.now() >= startMs && Date.now() <= endMs && (
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: `calc(${msToFraction(Date.now()) * 100}% - 1px)`,
            width: 2,
            background: "white",
            boxShadow: "0 0 6px rgba(255,255,255,0.7)",
          }}
        />
      )}
    </div>
  );
}

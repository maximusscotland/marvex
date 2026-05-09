/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Plus, Link2, Mail, FileIcon, Globe } from "lucide-react";
import { computeTicks, assignLanes } from "@/lib/timelineMath";

/**
 * TimelineCanvas — the SVG/HTML canvas surface for a Marvex Studio
 * timeline document.  Renders a horizontal time axis with auto-
 * scaling ticks, an axis line, and event "cubes" placed at their
 * dateISO positions, stacked vertically when they collide.
 *
 * Pan: click + drag empty space (1D — only horizontal motion sticks).
 * Zoom: mouse wheel (or pinch on trackpad) — scaled around cursor.
 * Add event: click any empty point on the axis line.
 * Right-click an event: open edit dialog (handled by parent via
 *   `onEditEvent`).
 */

const linkKind = (link) => {
  if (!link) return null;
  if (/^data:/i.test(link)) return "file";
  if (/^mailto:/i.test(link)) return "email";
  if (/^file:/i.test(link)) return "file";
  return "web";
};

const CUBE_SIZE = 26;       // px (will be scaled by k)
const LANE_GAP = 6;         // px between stacked cubes
const AXIS_PADDING_X = 40;  // left/right gutter so first/last event has room

export default function TimelineCanvas({
  timeline,
  onChange,
  onEditEvent,
  onAddEventAtDate,
  readOnly = false,
}) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 1600, h: 700 });
  const [view, setView] = useState(timeline.view || { x: 0, k: 1 });
  const [hover, setHover] = useState(null);
  const dragRef = useRef(null);
  const [cursorMs, setCursorMs] = useState(null); // for the "add here" hint
  const [hoverPx, setHoverPx] = useState(null);

  // Persist view changes back upstream (debounced via useEffect dep).
  useEffect(() => {
    if (!onChange) return;
    if (
      timeline.view?.x === view.x &&
      timeline.view?.k === view.k
    ) return;
    const t = setTimeout(() => {
      onChange({ ...timeline, view });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.x, view.k]);

  // Resize observer — keeps the SVG viewport synced with container size.
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

  // Compute the visible date range from the current view.
  const startMs = useMemo(() => new Date(timeline.scope.startISO).getTime(), [timeline.scope.startISO]);
  const endMs = useMemo(() => {
    if (timeline.scope.endISO) return new Date(timeline.scope.endISO).getTime();
    // Open-ended timelines default to "1 unit's worth" past the latest event
    const evs = timeline.events || [];
    if (evs.length) {
      const max = Math.max(...evs.map((e) => new Date(e.dateISO).getTime()));
      return max + (1 * 365.25 * 86_400_000);
    }
    // Fallback — show 5 years
    return startMs + (5 * 365.25 * 86_400_000);
  }, [timeline.scope.endISO, timeline.events, startMs]);

  // ---------- Coordinate transforms (px ↔ time, time ↔ px) ----------
  // The "world" maps [startMs, endMs] linearly to [AXIS_PADDING_X, size.w - AXIS_PADDING_X].
  // The view transform then applies pan (view.x) + zoom (view.k) on top.
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

  // ---------- Tick computation (memoised on visible range) ----------
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

  // ---------- Event lane assignment (collision stacking) ----------
  // Convert pixel-collide threshold to ms threshold so stacking "feels"
  // correct at any zoom level — events overlap visually iff < CUBE_SIZE
  // pixels apart.
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

  // ---------- Pan + Zoom interactions ----------
  const onWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      // Zoom around cursor
      const rect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const newK = Math.max(0.05, Math.min(40, v.k * factor));
        const wx = (cx - v.x) / v.k;
        return { x: cx - wx * newK, k: newK };
      });
    } else {
      // Horizontal pan
      setView((v) => ({ ...v, x: v.x - e.deltaX }));
    }
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("[data-event-cube]") || e.target.closest("[data-add-cta]")) return;
    dragRef.current = {
      x0: e.clientX,
      y0: e.clientY,
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
      setView((v) => ({ ...v, x: dragRef.current.vx0 + dx }));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onContainerMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setHoverPx({ x: px, y: py });
    // Only show "add here" hint when hovering near the axis (mid-y zone)
    if (Math.abs(py - size.h / 2) < 80) {
      setCursorMs(dateOfScreenX(px));
    } else {
      setCursorMs(null);
    }
  };

  const onContainerClick = (e) => {
    if (readOnly) return;
    if (dragRef.current?.moved) return;
    if (e.target.closest("[data-event-cube]")) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Clicking near the axis adds an event at that date
    if (Math.abs(py - size.h / 2) < 60 && cursorMs !== null) {
      const dateMs = Math.max(startMs, Math.min(endMs, cursorMs));
      onAddEventAtDate?.(new Date(dateMs).toISOString(), py < size.h / 2 ? "above" : "below");
    }
  };

  const axisY = size.h / 2;

  return (
    <div
      ref={containerRef}
      data-testid="timeline-canvas"
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        cursor: dragRef.current ? "grabbing" : "default",
        background:
          "radial-gradient(ellipse at center, rgba(20,28,60,0.4) 0%, rgba(3,4,10,0.95) 70%)",
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onContainerMouseMove}
      onMouseLeave={() => { setCursorMs(null); setHoverPx(null); }}
      onClick={onContainerClick}
    >
      {/* Cosmic background grid + glow */}
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
          <linearGradient id="tl-axis" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,240,255,0)" />
            <stop offset="8%" stopColor="rgba(0,240,255,0.95)" />
            <stop offset="50%" stopColor="rgba(160,140,255,1)" />
            <stop offset="92%" stopColor="rgba(255,106,213,0.95)" />
            <stop offset="100%" stopColor="rgba(255,106,213,0)" />
          </linearGradient>
        </defs>
        <rect width={size.w} height={size.h} fill="url(#tl-grid)" />

        {/* Tick marks */}
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

        {/* The axis line — gradient with subtle glow */}
        <line
          x1={20}
          x2={size.w - 20}
          y1={axisY}
          y2={axisY}
          stroke="url(#tl-axis)"
          strokeWidth={2.5}
          strokeDasharray="6 6"
          style={{ filter: "drop-shadow(0 0 8px rgba(0,240,255,0.5))" }}
        />
      </svg>

      {/* Cursor "add here" indicator */}
      {!readOnly && cursorMs !== null && hoverPx && (
        <div
          data-add-cta
          className="absolute pointer-events-none"
          style={{
            left: hoverPx.x - 14,
            top: axisY - 14,
            width: 28,
            height: 28,
          }}
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

      {/* Event cubes */}
      {eventsLaned.map((e) => {
        const cat = categoryById[e.categoryId];
        const color = cat?.color || "#00f0ff";
        const x = screenXOf(new Date(e.dateISO).getTime());
        if (x < -100 || x > size.w + 100) return null;
        const offset = (e.lane + 1) * (CUBE_SIZE + LANE_GAP);
        const y = e.position === "above" ? axisY - offset : axisY + offset - CUBE_SIZE;
        const kind = linkKind(e.link);
        const LinkIcon = kind === "email" ? Mail : kind === "file" ? FileIcon : kind === "web" ? Globe : null;
        const isHover = hover === e.id;
        return (
          <button
            key={e.id}
            data-event-cube
            data-testid={`tl-event-${e.id}`}
            onClick={(ev) => { ev.stopPropagation(); onEditEvent?.(e); }}
            onMouseEnter={() => setHover(e.id)}
            onMouseLeave={() => setHover((h) => (h === e.id ? null : h))}
            className="absolute group flex items-center justify-center transition-transform"
            style={{
              left: x - CUBE_SIZE / 2,
              top: y,
              width: CUBE_SIZE,
              height: CUBE_SIZE,
              borderRadius: 4,
              background: color,
              border: "1.5px solid rgba(255,255,255,0.35)",
              boxShadow: isHover
                ? `0 0 16px ${color}cc, 0 0 32px ${color}66`
                : `0 0 8px ${color}aa`,
              transform: isHover ? "scale(1.12)" : "scale(1)",
              cursor: "pointer",
            }}
            title={`${e.label}${cat ? ` · ${cat.name}` : ""} · ${new Date(e.dateISO).toLocaleDateString()}`}
          >
            {LinkIcon && (
              <LinkIcon size={11} className="text-white/90" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))" }} />
            )}
            {/* Connector tick from cube to axis */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: CUBE_SIZE / 2 - 1,
                top: e.position === "above" ? CUBE_SIZE : -offset + CUBE_SIZE,
                width: 2,
                height: e.position === "above" ? offset - CUBE_SIZE : offset - CUBE_SIZE,
                background: `${color}66`,
              }}
            />
            {/* Hover label */}
            <div
              className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-[#0a0f24] border border-white/15 text-white text-[11px] whitespace-nowrap pointer-events-none transition-opacity"
              style={{
                top: e.position === "above" ? -32 : CUBE_SIZE + 6,
                opacity: isHover ? 1 : 0,
                boxShadow: `0 0 8px ${color}55`,
              }}
            >
              {e.label}
            </div>
            {/* Link badge */}
            {LinkIcon && (
              <div
                className="absolute"
                style={{
                  right: -6, top: -6,
                  width: 14, height: 14, borderRadius: 7,
                  background: "#0a0f24",
                  border: `1.5px solid ${color}`,
                  display: "grid", placeItems: "center",
                  boxShadow: `0 0 6px ${color}cc`,
                }}
              >
                <Link2 size={7} style={{ color }} />
              </div>
            )}
          </button>
        );
      })}

      {/* Empty-state hint */}
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
            Above = optional differentiation, below = same.
          </div>
        </div>
      )}

      <style>{`
        @keyframes tlPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

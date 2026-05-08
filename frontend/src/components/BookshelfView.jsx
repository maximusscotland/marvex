import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Sparkles, Trash2, Target, Calendar, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * BookshelfView — renders a list of mind maps as book spines lined up on
 * a wooden shelf. Hovering a spine surfaces the map's full title, source
 * attribution, summary and metadata in a popover; clicking opens the map.
 *
 * Design notes
 * ────────────
 * • Each spine derives a distinct hue from the map id so a returning user
 *   sees the same colour for the same map every time. Hash → HSL with a
 *   constrained lightness band so colours always look "library leather"
 *   rather than highlighter-bright.
 * • Width varies subtly per map so the shelf doesn't feel like a Tetris
 *   row. A 32–58 px range keeps long-titled spines readable while still
 *   fitting ~25 books across a 1280-px viewport without horizontal scroll.
 * • The shelf wood is a CSS gradient — keeps the bundle slim. A thin
 *   highlight strip on the front edge of each spine + a darker edge on
 *   the back gives the 3D illusion without webGL.
 * • Hover popover anchors above the spine by default, flips below when
 *   the spine sits in the top quarter of the viewport.
 *
 * Edge cases handled:
 *   – Maps with very long titles → middle-truncation (head + tail) on the
 *     spine; the popover always shows the full title.
 *   – Empty `summary` → falls back to the title + branch count.
 *   – Deleting a map closes any popover that was open over it.
 */

const SPINE_HEIGHT = 220;

// Hash a string to a stable hue 0–360. Java's String.hashCode() shape —
// well-distributed enough for a few hundred shelves.
const hashHue = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return ((h % 360) + 360) % 360;
};

// Width derived from the map id so the same map keeps the same girth.
// 32–58 px feels close to physical paperback proportions next to a 220-px
// tall spine.
const widthForMap = (map) => 32 + ((hashHue(map.id) * 7) % 26);

const truncate = (s, n) => {
  if (!s) return "";
  if (s.length <= n) return s;
  const head = Math.ceil(n * 0.6);
  const tail = n - head - 1;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
};

export default function BookshelfView({ maps, onOpen, onDelete }) {
  // Index of the currently-hovered spine (null when none).  We track index
  // rather than id so the popover position calc has access to the same
  // sibling list the spine is rendered in.
  const [hoverIdx, setHoverIdx] = useState(null);

  return (
    <div data-testid="library-bookshelf" className="space-y-10">
      <Shelf maps={maps} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} onOpen={onOpen} onDelete={onDelete} />
    </div>
  );
}

const Shelf = ({ maps, hoverIdx, setHoverIdx, onOpen, onDelete }) => {
  // Horizontal scroll container ref so arrow buttons and the keyboard
  // hotkey can call scrollBy / scrollTo on it.
  const scrollerRef = useRef(null);
  // Track whether overflow exists at all (hide arrows when not needed) and
  // which direction is scrollable (for left/right arrow opacity).
  const [overflow, setOverflow] = useState({ canLeft: false, canRight: false, has: false });

  const recomputeOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const has = el.scrollWidth > el.clientWidth + 1;
    const canLeft = el.scrollLeft > 4;
    const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setOverflow({ has, canLeft, canRight });
  }, []);

  useEffect(() => {
    recomputeOverflow();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", recomputeOverflow, { passive: true });
    window.addEventListener("resize", recomputeOverflow);
    return () => {
      el.removeEventListener("scroll", recomputeOverflow);
      window.removeEventListener("resize", recomputeOverflow);
    };
  }, [recomputeOverflow, maps.length]);

  const scrollBy = (dx) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dx, behavior: "smooth" });
  };

  // Wheel-to-scroll-horizontally on desktop trackpads/mice. Vertical wheel
  // delta gets mapped to horizontal scroll so users don't need to know
  // they can shift+scroll. Native horizontal swipe (trackpad two-finger,
  // touch swipe on mobile/iPad) just works via overflow-x.
  const onWheel = useCallback((e) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  }, []);

  return (
    <div
      className="relative rounded-[6px] px-5 pt-8 pb-2"
      style={{
        // Library wall — dark walnut with vertical wood-grain bands so the
        // backdrop reads as panelling, not flat gradient. The amber radial
        // overlay simulates a single warm reading lamp casting light from
        // top-right; gives every spine a subtle gilt edge for free.
        background:
          "radial-gradient(circle at 78% -10%, rgba(255,193,107,0.18) 0%, rgba(255,193,107,0) 55%)," +
          "linear-gradient(180deg, #1a0f06 0%, #100905 45%, #0a0502 100%)," +
          "repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 38px, rgba(255,255,255,0.018) 38px 39px)",
        boxShadow:
          "0 0 0 1px rgba(120,80,40,0.22), 0 30px 80px rgba(0,0,0,0.55), inset 0 0 100px rgba(0,0,0,0.45)",
      }}
    >
      {/* Scroll fades — lets the user see "there's more this way" without
          fighting the visual. Pure CSS gradients pinned to the container
          edges; pointer-events:none so spine clicks pass through. Only
          shown when overflow exists in that direction. */}
      {overflow.canLeft && (
        <div
          aria-hidden="true"
          className="absolute top-8 bottom-6 left-5 w-10 z-10 pointer-events-none rounded-l-[2px]"
          style={{
            background: "linear-gradient(90deg, rgba(16,9,5,0.95) 0%, rgba(16,9,5,0) 100%)",
          }}
        />
      )}
      {overflow.canRight && (
        <div
          aria-hidden="true"
          className="absolute top-8 bottom-6 right-5 w-10 z-10 pointer-events-none rounded-r-[2px]"
          style={{
            background: "linear-gradient(270deg, rgba(16,9,5,0.95) 0%, rgba(16,9,5,0) 100%)",
          }}
        />
      )}

      {/* Scrollable books row. The scrollbar is hidden on Webkit / Firefox
          via classes set up in index.css (.scrollbar-none) — touch + wheel
          + arrow buttons + keyboard arrows all work without a visible bar
          because the wooden shelf already implies horizontal extent. */}
      <div
        ref={scrollerRef}
        data-testid="library-shelf-scroller"
        onWheel={onWheel}
        className="flex items-end gap-[3px] relative overflow-x-auto overflow-y-visible scrollbar-none"
        style={{
          paddingBottom: 8,
          scrollSnapType: "x proximity",
          // Wide tap-target for touch users; momentum scroll on iOS.
          WebkitOverflowScrolling: "touch",
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); scrollBy(220); }
          if (e.key === "ArrowLeft")  { e.preventDefault(); scrollBy(-220); }
        }}
        aria-label="Library bookshelf — use arrow keys, scroll wheel, or swipe to browse"
      >
        {maps.map((m, i) => (
          <div key={m.id} style={{ scrollSnapAlign: "start", flex: "0 0 auto" }}>
            <BookSpine
              map={m}
              index={i}
              isHover={hoverIdx === i}
              onEnter={() => setHoverIdx(i)}
              onLeave={() => setHoverIdx((c) => (c === i ? null : c))}
              onOpen={() => onOpen(m.id)}
              onDelete={() => { onDelete(m.id); setHoverIdx(null); }}
            />
          </div>
        ))}
      </div>

      {/* Mahogany shelf board — three-stop gradient + faint grain so the
          edge reads as polished hardwood rather than flat brown. Thin
          amber rim along the front edge picks up the lamp from the wall. */}
      <div
        className="relative h-4 rounded-[2px] mt-1"
        style={{
          background:
            "linear-gradient(180deg, #8b5a2b 0%, #5a3a1c 45%, #2a1809 100%)",
          boxShadow:
            "0 1px 0 rgba(255,200,140,0.18) inset, 0 8px 22px rgba(0,0,0,0.65), 0 -1px 0 rgba(0,0,0,0.7) inset",
        }}
      >
        {/* faint wood-grain striations */}
        <div
          className="absolute inset-0 opacity-35 mix-blend-overlay"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 11px)",
            pointerEvents: "none",
          }}
        />
        {/* Front edge glint — lamp catching the polished bevel */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "rgba(255,200,140,0.45)" }}
        />
      </div>

      {/* Arrow buttons live at the right edge of the shelf board so they
          read as physical "browse" handles. Hidden when no overflow. */}
      {overflow.has && (
        <div className="absolute -bottom-3 right-3 flex items-center gap-1 z-20">
          <button
            type="button"
            data-testid="library-shelf-prev"
            onClick={() => scrollBy(-260)}
            disabled={!overflow.canLeft}
            aria-label="Scroll bookshelf left"
            className="w-9 h-9 rounded-full border border-amber-400/35 bg-[#1a0f06] hover:bg-[#2a1809] hover:border-amber-300/60 text-amber-100 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center shadow-[0_3px_10px_rgba(0,0,0,0.55)]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            data-testid="library-shelf-next"
            onClick={() => scrollBy(260)}
            disabled={!overflow.canRight}
            aria-label="Scroll bookshelf right"
            className="w-9 h-9 rounded-full border border-amber-400/35 bg-[#1a0f06] hover:bg-[#2a1809] hover:border-amber-300/60 text-amber-100 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center shadow-[0_3px_10px_rgba(0,0,0,0.55)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

const BookSpine = ({ map, index, isHover, onEnter, onLeave, onOpen, onDelete }) => {
  const width = useMemo(() => widthForMap(map), [map.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const hue = useMemo(() => hashHue(map.id), [map.id]);
  // Lightness band 22–34: slightly darker than before so spines look like
  // worn library leather/cloth in lamplight, never neon.
  const lightness = 22 + ((index % 6) * 2);
  const baseColor = `hsl(${hue} 36% ${lightness}%)`;
  const edgeShadow = `hsl(${hue} 36% ${Math.max(6, lightness - 14)}%)`;
  const highlight = `hsl(${hue} 36% ${lightness + 14}%)`;
  // Saturation kicks up on hover so the chosen book "lights up" against
  // the shelf without fully changing colour. Cheap, classy.
  const hoverHighlight = `hsl(${hue} 60% ${lightness + 22}%)`;

  // Text colour: pale yellow gilt on dark spines reads like library type.
  const textColor = "rgba(245, 230, 190, 0.92)";

  return (
    <div className="relative group" data-testid={`shelf-spine-${map.id}`}>
      <button
        type="button"
        onClick={onOpen}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        title={map.title || "Untitled"}
        aria-label={map.title || "Untitled mind map"}
        className="relative block transition-all duration-200 ease-out hover:translate-y-[-6px] focus:translate-y-[-6px] focus:outline-none"
        style={{
          width,
          height: SPINE_HEIGHT,
          // Three-stop gradient + a vertical cloth-weave overlay creates
          // the look of bound cloth/leather under lamplight. Hovering
          // bumps the saturation so the spine glows.
          background:
            `linear-gradient(90deg, ${edgeShadow} 0%, ${baseColor} 14%, ${baseColor} 86%, ${isHover ? hoverHighlight : highlight} 100%),` +
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.10) 0 1px, transparent 1px 4px)",
          backgroundBlendMode: "normal, multiply",
          borderRadius: "2px 2px 0 0",
          boxShadow: isHover
            ? `inset 0 -3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 18px ${highlight}88, 0 0 24px ${hoverHighlight}55`
            : "inset 0 -3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.5)",
        }}
      >
        {/* gilt bands at top and bottom — classic library binding */}
        <div className="absolute top-2 left-1 right-1 h-px" style={{ background: "rgba(245,230,190,0.55)" }} />
        <div className="absolute bottom-3 left-1 right-1 h-px" style={{ background: "rgba(245,230,190,0.55)" }} />
        {/* Two thin gold rules near the top — mimics raised cords on a
            hardback spine. Subtle, but adds the "antique" feel. */}
        <div className="absolute top-7 left-1 right-1 h-px" style={{ background: "rgba(245,230,190,0.18)" }} />
        <div className="absolute top-9 left-1 right-1 h-px" style={{ background: "rgba(245,230,190,0.18)" }} />

        {/* Vertical title.  writing-mode rotates the glyphs in their box —
            no transform-origin headaches, and screen readers still see the
            text in document order. */}
        <span
          className="absolute inset-0 flex items-center justify-center px-1 select-none"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            transform: "rotate(180deg)",
            color: textColor,
            fontSize: width < 42 ? 10 : 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
            textShadow: "0 1px 0 rgba(0,0,0,0.5)",
            lineHeight: 1.05,
            maxHeight: SPINE_HEIGHT - 32,
          }}
        >
          {truncate(map.title || "Untitled", 32)}
        </span>

        {/* Tiny example/research badge dot */}
        <span
          className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            background: map.example ? "#fbbf24" : "#a78bfa",
            boxShadow: map.example ? "0 0 6px #fbbf24aa" : "0 0 6px #a78bfaaa",
          }}
          aria-hidden="true"
        />
      </button>

      {/* Hover popover — bigger details panel */}
      {isHover && (
        <SpinePopover map={map} onDelete={onDelete} />
      )}
    </div>
  );
};

const SpinePopover = ({ map, onDelete }) => {
  const meta = map.researchMeta || {};
  const created = new Date(meta.createdAt || map.updatedAt || Date.now());
  const branches = (map.children || []).length;
  // Brief summary fallback chain: explicit summary → first child title →
  // generic "N branches" line. We never show empty.
  const summary =
    map.summary ||
    (map.children && map.children[0]?.title
      ? `Starts with "${map.children[0].title}"…`
      : `A mind map with ${branches} top-level branch${branches === 1 ? "" : "es"}.`);

  return (
    <div
      role="tooltip"
      data-testid={`shelf-tooltip-${map.id}`}
      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-[280px] z-30 pointer-events-auto"
    >
      <div
        className="glass-panel rounded-xl p-4 fade-up"
        style={{
          borderColor: "rgba(0,240,255,0.28)",
          background: "rgba(4,12,28,0.96)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {map.demo || map.source === "ai-demo" ? (
              <span className="mono text-[8px] uppercase tracking-[0.22em] px-1.5 py-[2px] rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 inline-flex items-center gap-1 shrink-0">
                <Sparkles size={8} /> AI Demo
              </span>
            ) : map.example ? (
              <span className="mono text-[8px] uppercase tracking-[0.22em] px-1.5 py-[2px] rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 inline-flex items-center gap-1 shrink-0">
                <Sparkles size={8} /> Example
              </span>
            ) : meta.sourceNodeTitle ? (
              <span className="mono text-[8px] uppercase tracking-[0.22em] px-1.5 py-[2px] rounded-full bg-violet-500/20 text-violet-200 border border-violet-400/40 inline-flex items-center gap-1 shrink-0">
                <Sparkles size={8} /> Research
              </span>
            ) : (
              <span className="mono text-[8px] uppercase tracking-[0.22em] px-1.5 py-[2px] rounded-full bg-cyan-500/15 text-cyan-200 border border-cyan-400/30 inline-flex items-center gap-1 shrink-0">
                <BookOpen size={8} /> Map
              </span>
            )}
          </div>
          <button
            data-testid={`shelf-delete-${map.id}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
            className="text-[#7a87ad] hover:text-red-300 transition shrink-0"
          >
            <Trash2 size={11} />
          </button>
        </div>
        <div className="text-[14px] font-semibold leading-snug text-white mb-1.5">
          {map.title || "Untitled"}
        </div>
        <p className="text-[12px] leading-relaxed text-[#cfdaf3]/85 mb-2.5 line-clamp-3">
          {summary}
        </p>
        <div className="space-y-1">
          {meta.sourceNodeTitle && (
            <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] flex items-center gap-1 truncate">
              <Target size={9} className="shrink-0 text-cyan-300/80" />
              <span className="truncate">
                From "{meta.sourceNodeTitle}"{meta.sourceMapTitle ? ` in ${meta.sourceMapTitle}` : ""}
              </span>
            </div>
          )}
          <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] flex items-center gap-1.5">
            <Calendar size={9} /> {created.toLocaleDateString()} · {branches} branch{branches === 1 ? "" : "es"}
          </div>
        </div>
        {/* small downward chevron pointing at the spine */}
        <div
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
          style={{
            background: "rgba(4,12,28,0.96)",
            borderRight: "1px solid rgba(0,240,255,0.28)",
            borderBottom: "1px solid rgba(0,240,255,0.28)",
          }}
        />
      </div>
    </div>
  );
};

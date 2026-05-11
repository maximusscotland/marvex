import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Trash2, Check, X, StickyNote, MessageCircle, Clock, ExternalLink, Layers as LayersIcon } from "lucide-react";
import { CLIPART_REGISTRY, getClipart } from "@/components/ClipartLibrary";
import { WORDART_PRESETS, getWordArtStyle } from "@/lib/wordartPresets";
import { openLink as openLinkExternally } from "@/lib/openLink";
import { getTimeline } from "@/lib/timelineStorage";
import FilePickerButton, { AttachedFilePill } from "@/components/common/FilePickerButton";

/**
 * AnnotationsLayer — renders sticky notes, text boxes, images, clipart icons,
 * and free-floating connector lines/arrows that users have inserted onto the
 * canvas. Coordinates live in world-space (same system as mind-map nodes)
 * and are baked by the parent's viewport transform.
 *
 * Sticky-as-icon UX (Feb 2026):
 *   By default a sticky renders as a small 36×36 bright-yellow icon — barely
 *   bigger than a node badge. Click it once to expand into the full editor;
 *   blur or Escape collapses it back.
 *
 * Resize handles (Feb 2026):
 *   When an annotation is the active selection, four corner handles appear so
 *   users can resize stickies, text boxes, images, and clipart with the same
 *   gesture as nodes.
 *
 * Connectors (Feb 2026):
 *   Free-floating lines/arrows between two world-space endpoints. Endpoints
 *   are draggable when the connector is selected, and the body of the line
 *   is also draggable for translation.
 *
 * Props:
 *  - items: [{id, type, x, y, w, h, ...type-specific fields}]
 *  - baked: (x, y) → {x, y} — apply the canvas pan/zoom to world coords
 *  - scale: current zoom (used to reverse for drag-deltas)
 *  - onChange(updated): replace full array
 *  - onDelete(id)
 *  - onSelect(id) — called when the user clicks/drags an annotation
 *  - selectedId: the active single-selection (drives resize-handle display)
 *  - multiSelected: Set<string> of all multi-selected ids (driver for join)
 */
const MIN_W = 60;
const MIN_H = 30;

export default function AnnotationsLayer({
  items = [],
  baked,
  scale,
  onChange,
  onDelete,
  onSelect,
  selectedId = null,
  multiSelected = null,
}) {
  const [editingId, setEditingId] = useState(null);
  // Hovered comment id — drives the expanded-bubble preview without changing
  // selection state (so a quick mouse-over reads like a tooltip).
  const [hoverComment, setHoverComment] = useState(null);
  // Right-click mini-menu state for annotations: { id, x, y } | null
  const [annotMenu, setAnnotMenu] = useState(null);
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);
  const seenIdsRef = useRef(new Set(items.map((it) => it.id)));
  const navigate = useNavigate();

  // Robust dismiss for the right-click annotation menu.  The backdrop alone
  // proved fragile (something on top of it could swallow the click), so we
  // also listen at the window level: any mousedown / keydown / scroll that
  // isn't INSIDE the menu element closes it.
  useEffect(() => {
    if (!annotMenu) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setAnnotMenu(null); };
    const onWinDown = (e) => {
      const menuEl = document.querySelector('[data-testid="mm-annot-ctx-menu"]');
      if (menuEl && menuEl.contains(e.target)) return; // click inside the menu — keep open
      setAnnotMenu(null);
    };
    const onScroll = () => setAnnotMenu(null);
    document.addEventListener("keydown", onKey);
    // Capture phase so we run BEFORE any stopPropagation handlers.
    window.addEventListener("mousedown", onWinDown, true);
    window.addEventListener("contextmenu", onWinDown, true);
    window.addEventListener("scroll", onScroll, true);
    // Marvex Studio canvas pans via WHEEL events (not native scroll), so we
    // also dismiss on wheel — keeps the menu from following a panning canvas.
    window.addEventListener("wheel", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onWinDown, true);
      window.removeEventListener("contextmenu", onWinDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("wheel", onScroll, { capture: true });
    };
  }, [annotMenu]);

  // Auto-pop a freshly-inserted sticky into edit mode so the user can type
  // without an extra click.  Same treatment for fresh comments.
  useEffect(() => {
    for (const it of items) {
      if (!seenIdsRef.current.has(it.id)) {
        seenIdsRef.current.add(it.id);
        if ((it.type === "sticky" || it.type === "comment") && !it.text) {
          setEditingId(it.id);
        }
      }
    }
  }, [items]);

  const updateItem = (id, patch) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const onPointerDown = (e, id, mode = "move", extra = {}) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect && onSelect(id, e);
    const target = items.find((it) => it.id === id);
    if (!target) return;
    dragRef.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startItem: { ...target },
      ...extra,
    };
    dragMovedRef.current = false;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMovedRef.current = true;
    const it = d.startItem;
    if (d.mode === "move") {
      if (it.type === "connector") {
        updateItem(d.id, {
          x1: it.x1 + dx,
          y1: it.y1 + dy,
          x2: it.x2 + dx,
          y2: it.y2 + dy,
        });
      } else {
        updateItem(d.id, { x: it.x + dx, y: it.y + dy });
      }
    } else if (d.mode === "resize") {
      let w = it.w;
      let h = it.h;
      let x = it.x;
      let y = it.y;
      // Symmetric resize from centre — feels predictable for floating items
      if (d.corner.includes("r")) w = Math.max(MIN_W, it.w + dx * 2);
      if (d.corner.includes("l")) w = Math.max(MIN_W, it.w - dx * 2);
      if (d.corner.includes("b")) h = Math.max(MIN_H, it.h + dy * 2);
      if (d.corner.includes("t")) h = Math.max(MIN_H, it.h - dy * 2);
      updateItem(d.id, { w: Math.round(w), h: Math.round(h), x, y });
    } else if (d.mode === "endpoint") {
      // Connector endpoint drag — move x1/y1 or x2/y2
      if (d.end === 1) {
        updateItem(d.id, { x1: it.x1 + dx, y1: it.y1 + dy });
      } else {
        updateItem(d.id, { x2: it.x2 + dx, y2: it.y2 + dy });
      }
    }
  };

  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    dragRef.current = null;
  };

  // ---------- RENDER HELPERS ----------
  const isMulti = (id) => multiSelected && multiSelected.has && multiSelected.has(id);

  const renderConnector = (it) => {
    const a = baked(it.x1, it.y1);
    const b = baked(it.x2, it.y2);
    const sel = selectedId === it.id || isMulti(it.id);
    const color = it.color || "#00f0ff";
    const width = it.width || 1.6;
    const dashed = !!it.dashed;
    const arrow = it.arrow !== false; // default true
    // Bounding box for the SVG container (with a little padding for handle hit area)
    const minX = Math.min(a.x, b.x) - 16;
    const minY = Math.min(a.y, b.y) - 16;
    const maxX = Math.max(a.x, b.x) + 16;
    const maxY = Math.max(a.y, b.y) + 16;
    const svgW = maxX - minX;
    const svgH = maxY - minY;
    const ax = a.x - minX;
    const ay = a.y - minY;
    const bx = b.x - minX;
    const by = b.y - minY;
    return (
      <div
        key={it.id}
        data-testid={`mm-annot-connector-${it.id}`}
        style={{
          position: "absolute",
          left: minX,
          top: minY,
          width: svgW,
          height: svgH,
          pointerEvents: "none",
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect && onSelect(it.id, e);
          setAnnotMenu({ id: it.id, x: e.clientX, y: e.clientY });
        }}
      >
        <svg width={svgW} height={svgH} style={{ overflow: "visible" }}>
          <defs>
            <marker id={`arrow-${it.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 L2,5 Z" fill={color} opacity="0.95" />
            </marker>
          </defs>
          {/* invisible wide hit area for body-drag */}
          <line
            x1={ax} y1={ay} x2={bx} y2={by}
            stroke="transparent"
            strokeWidth={16}
            style={{ pointerEvents: "stroke", cursor: "move" }}
            onPointerDown={(e) => onPointerDown(e, it.id, "move")}
          />
          <line
            x1={ax} y1={ay} x2={bx} y2={by}
            stroke={color}
            strokeWidth={sel ? Math.max(2.4, width + 1) : width}
            strokeDasharray={dashed ? "6 5" : "none"}
            markerEnd={arrow ? `url(#arrow-${it.id})` : undefined}
            opacity={sel ? 1 : 0.9}
            style={{ pointerEvents: "none", filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        {sel && (
          <>
            <EndpointHandle
              testid={`mm-conn-endpoint-1-${it.id}`}
              x={ax} y={ay} color={color}
              onPointerDown={(e) => onPointerDown(e, it.id, "endpoint", { end: 1 })}
            />
            <EndpointHandle
              testid={`mm-conn-endpoint-2-${it.id}`}
              x={bx} y={by} color={color}
              onPointerDown={(e) => onPointerDown(e, it.id, "endpoint", { end: 2 })}
            />
          </>
        )}
      </div>
    );
  };

  // ---------- MAIN RENDER ----------
  return (
    <>
      {items.map((it) => {
        if (it.type === "connector") return renderConnector(it);
        const p = baked(it.x, it.y);
        const isEditing = editingId === it.id;
        const isSel = selectedId === it.id;
        const isM = isMulti(it.id);
        // Stickies collapse to a 36×36 icon when not editing AND not selected.
        // Selecting (single or multi) re-expands them so the user can resize
        // and see the full content.
        const collapsedSticky = it.type === "sticky" && !isEditing && !isSel && !isM;
        const w = collapsedSticky
          ? 36
          : (it.type === "comment" && !isEditing && !isSel && !isM)
            ? 32
            : it.w;
        const h = collapsedSticky
          ? 36
          : (it.type === "comment" && !isEditing && !isSel && !isM)
            ? 32
            : it.h;
        const style = {
          position: "absolute",
          left: p.x,
          top: p.y,
          width: w,
          height: h,
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
        };
        const expandSticky = () => {
          if (dragMovedRef.current) return;
          setEditingId(it.id);
        };
        // Comments use the same collapse-icon UX as stickies but with their
        // own hover-to-preview behaviour.  When unselected and not editing,
        // a comment renders as a small coloured speech-bubble icon.
        const collapsedComment = it.type === "comment" && !isEditing && !isSel && !isM;
        // Hover-preview kicks in on collapsed comments — shows the text
        // without committing to selection.
        const showCommentPreview = it.type === "comment" && collapsedComment && hoverComment === it.id && it.text;

        const showResize =
          (isSel || isM) && !isEditing && !collapsedSticky && !collapsedComment &&
          (it.type === "sticky" || it.type === "text" || it.type === "shape" || it.type === "image" || it.type === "clipart" || it.type === "comment");

        return (
          <div
            key={it.id}
            data-testid={`mm-annot-${it.type}-${it.id}`}
            style={style}
            onPointerDown={(e) => onPointerDown(e, it.id, "move")}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect && onSelect(it.id, e);
              setAnnotMenu({ id: it.id, x: e.clientX, y: e.clientY });
            }}
            className={`group select-none cursor-move ${isM ? "ring-2 ring-fuchsia-400/70 rounded-md" : ""}`}
          >
            {it.type === "sticky" && collapsedSticky && (
              <button
                data-testid={`mm-annot-sticky-collapsed-${it.id}`}
                onClick={(e) => { e.stopPropagation(); expandSticky(); }}
                onDoubleClick={(e) => { e.stopPropagation(); expandSticky(); }}
                title={
                  it.text
                    ? `${it.done ? "✓ " : ""}${it.text}\n\nClick to edit`
                    : "Empty sticky — click to edit"
                }
                className="w-full h-full rounded-md shadow-lg flex items-center justify-center transition-transform hover:scale-110"
                style={{
                  background: it.done ? "#fff58a" : "#ffec3d",
                  color: "#3d2e0a",
                  boxShadow: it.done
                    ? "0 4px 12px rgba(255,236,61,0.2), 0 0 0 1px rgba(0,0,0,0.15)"
                    : "0 6px 16px rgba(255,236,61,0.45), 0 0 0 1px rgba(0,0,0,0.2)",
                  transform: it.done ? "rotate(-2deg)" : "rotate(2deg)",
                  opacity: it.done ? 0.7 : 1,
                }}
              >
                {it.done ? (
                  <Check size={16} strokeWidth={3} />
                ) : (
                  <StickyNote size={16} strokeWidth={2.2} />
                )}
                {it.text && !it.done && (
                  <span
                    aria-hidden
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-600 border border-yellow-200"
                    style={{ boxShadow: "0 0 6px rgba(255,140,0,0.6)" }}
                  />
                )}
              </button>
            )}

            {it.type === "sticky" && !collapsedSticky && (
              <div
                className="w-full h-full rounded-md shadow-lg flex flex-col"
                style={{
                  background: it.done ? "#fff58a" : "#ffec3d",
                  color: "#3d2e0a",
                  boxShadow: "0 10px 24px rgba(255,236,61,0.35), 0 0 0 1px rgba(0,0,0,0.15)",
                  transform: it.done ? "rotate(-1deg)" : "rotate(0.7deg)",
                  fontFamily: "'Kalam','Sora',sans-serif",
                  padding: 12,
                  paddingTop: 22,
                }}
              >
                <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between">
                  <button
                    data-testid={`mm-annot-sticky-done-${it.id}`}
                    onClick={(e) => { e.stopPropagation(); updateItem(it.id, { done: !it.done }); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`w-4 h-4 rounded-sm border flex items-center justify-center transition ${
                      it.done ? "bg-emerald-500 border-emerald-600 text-white" : "bg-white/60 border-[#3d2e0a]/40 hover:border-[#3d2e0a]"
                    }`}
                    title="Mark done"
                  >
                    {it.done && <Check size={11} strokeWidth={3} />}
                  </button>
                  <ItemControls id={it.id} onDelete={onDelete} />
                </div>
                {isEditing ? (
                  <textarea
                    autoFocus
                    value={it.text || ""}
                    onChange={(e) => updateItem(it.id, { text: e.target.value })}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 bg-transparent outline-none text-[13px] leading-snug resize-none"
                  />
                ) : (
                  <div
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(it.id); }}
                    className={`flex-1 text-[13px] leading-snug whitespace-pre-wrap break-words ${it.done ? "line-through opacity-60" : ""}`}
                  >
                    {it.text || <span className="opacity-50">Double-click to edit…</span>}
                  </div>
                )}
              </div>
            )}

            {it.type === "text" && (() => {
              // WordArt-style preset (chosen via right-click menu). Falls back
              // to plain when unset. We always render an oversized text size
              // since WordArt looks weak at body text size; tunable via the
              // .fontSize annotation field if the user wants a smaller stamp.
              const wa = getWordArtStyle(it.style);
              const fontSize = it.fontSize || 36;
              return (
                <div
                  className={`w-full h-full rounded px-3 py-2 ${it.style ? "" : "border border-dashed border-cyan-400/40 hover:border-cyan-400/70"} transition`}
                  style={{ background: it.style ? "transparent" : "rgba(4,12,28,0.6)" }}
                >
                  <div className="absolute top-1 right-1">
                    <ItemControls id={it.id} onDelete={onDelete} />
                  </div>
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={it.text || ""}
                      onChange={(e) => updateItem(it.id, { text: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                      className="w-full h-full bg-transparent outline-none resize-none"
                      style={{
                        fontSize: it.style ? fontSize : 14,
                        lineHeight: 1.15,
                        ...wa,
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingId(it.id); }}
                      className="w-full h-full whitespace-pre-wrap break-words leading-tight"
                      style={{
                        fontSize: it.style ? fontSize : 14,
                        lineHeight: 1.15,
                        ...wa,
                      }}
                    >
                      {it.text || <span className="text-[#7a87ad]" style={{ fontSize: 14 }}>Double-click to edit…</span>}
                    </div>
                  )}
                </div>
              );
            })()}

            {it.type === "shape" && (() => {
              // Free-floating shape with editable text — useful for headings
              // and side-by-side mini-maps that aren't part of the main tree.
              const color = it.color || "#39E0FF";
              const shape = it.shape || "rect";
              const fill = `${color}1a`; // ~10% alpha
              const stroke = color;
              return (
                <div className="w-full h-full relative">
                  <svg
                    viewBox={`0 0 ${w} ${h}`}
                    width={w}
                    height={h}
                    className="absolute inset-0 pointer-events-none"
                  >
                    {shape === "ellipse" && (
                      <ellipse cx={w/2} cy={h/2} rx={w/2 - 2} ry={h/2 - 2} fill={fill} stroke={stroke} strokeWidth="2" />
                    )}
                    {shape === "rect" && (
                      <rect x={2} y={2} width={w-4} height={h-4} rx={12} ry={12} fill={fill} stroke={stroke} strokeWidth="2" />
                    )}
                    {shape === "hexagon" && (() => {
                      const cx = w/2, cy = h/2, rx = w/2 - 2, ry = h/2 - 2;
                      const pts = [
                        `${cx - rx*0.7},${cy - ry}`,
                        `${cx + rx*0.7},${cy - ry}`,
                        `${cx + rx},${cy}`,
                        `${cx + rx*0.7},${cy + ry}`,
                        `${cx - rx*0.7},${cy + ry}`,
                        `${cx - rx},${cy}`,
                      ].join(" ");
                      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="2" />;
                    })()}
                    {shape === "diamond" && (() => {
                      const cx = w/2, cy = h/2;
                      const pts = `${cx},2 ${w-2},${cy} ${cx},${h-2} 2,${cy}`;
                      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="2" />;
                    })()}
                  </svg>
                  <div className="absolute top-1 right-1 z-10">
                    <ItemControls id={it.id} onDelete={onDelete} />
                  </div>
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={it.text || ""}
                      onChange={(e) => updateItem(it.id, { text: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                      className="absolute inset-0 m-auto w-[calc(100%-32px)] h-[calc(100%-32px)] bg-transparent outline-none text-base font-semibold text-center resize-none text-white px-2 py-1"
                      style={{ color: stroke }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingId(it.id); }}
                      className="absolute inset-0 grid place-items-center text-center text-base font-semibold whitespace-pre-wrap break-words px-3"
                      style={{ color: stroke }}
                    >
                      {it.text || <span className="opacity-50">Double-click to edit…</span>}
                    </div>
                  )}
                </div>
              );
            })()}

            {it.type === "image" && it.src && (
              <div className="w-full h-full relative rounded-md overflow-hidden border border-cyan-400/30">
                <img src={it.src} alt={it.alt || it.title || "User image on Marvex Studio canvas"} draggable={false}
                     className="w-full h-full object-cover pointer-events-none" />
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
                  <ItemControls id={it.id} onDelete={onDelete} />
                </div>
              </div>
            )}

            {it.type === "timeline" && (
              <TimelineEmbedCard
                annotation={it}
                isSelected={isSel}
                onDelete={onDelete}
                onChangeAnnotation={(patch) => {
                  onChange(items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
                }}
              />
            )}

            {it.type === "clipart" && (() => {
              const cfg = getClipart(it.icon);
              if (!cfg) return null;
              const Icon = cfg.component;
              const color = it.color || cfg.color || "#00f0ff";
              return (
                <div
                  className="w-full h-full grid place-items-center relative"
                  style={{
                    color,
                    filter: `drop-shadow(0 0 8px ${color}aa) drop-shadow(0 0 14px ${color}33)`,
                  }}
                >
                  <Icon size={Math.min(w, h) * 0.85} strokeWidth={1.7} />
                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition">
                    <ItemControls id={it.id} onDelete={onDelete} dark />
                  </div>
                </div>
              );
            })()}

            {it.type === "comment" && (() => {
              const color = it.color || "#00f0ff";
              if (collapsedComment) {
                return (
                  <button
                    data-testid={`mm-annot-comment-collapsed-${it.id}`}
                    onClick={(e) => { e.stopPropagation(); if (!dragMovedRef.current) setEditingId(it.id); }}
                    onMouseEnter={() => setHoverComment(it.id)}
                    onMouseLeave={() => setHoverComment(null)}
                    title={it.text ? "Click to edit · hover for preview" : "Empty comment — click to edit"}
                    className="w-full h-full rounded-full grid place-items-center transition-transform hover:scale-110"
                    style={{
                      background: color,
                      color: "#03060f",
                      boxShadow: `0 4px 12px ${color}66, 0 0 0 1px rgba(0,0,0,0.15)`,
                    }}
                  >
                    <MessageCircle size={14} strokeWidth={2.4} />
                  </button>
                );
              }
              // Expanded mode — full speech-bubble with editable text.
              return (
                <div
                  className="w-full h-full rounded-2xl shadow-lg flex flex-col relative"
                  style={{
                    background: color,
                    color: "#03060f",
                    boxShadow: `0 8px 22px ${color}55, 0 0 0 1px rgba(0,0,0,0.2)`,
                    padding: "10px 12px 10px 12px",
                  }}
                >
                  {/* Speech-bubble tail bottom-left */}
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      bottom: -8,
                      left: 14,
                      width: 0,
                      height: 0,
                      borderLeft: "8px solid transparent",
                      borderRight: "8px solid transparent",
                      borderTop: `10px solid ${color}`,
                      filter: `drop-shadow(0 1px 0 rgba(0,0,0,0.15))`,
                    }}
                  />
                  <div className="absolute top-1 right-1.5">
                    <ItemControls id={it.id} onDelete={onDelete} dark />
                  </div>
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={it.text || ""}
                      onChange={(e) => updateItem(it.id, { text: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                      placeholder="Add a comment…"
                      className="flex-1 bg-transparent outline-none text-[13px] leading-snug resize-none placeholder-black/40"
                      style={{ fontFamily: "'Sora', sans-serif", fontWeight: 500 }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingId(it.id); }}
                      className="flex-1 text-[13px] leading-snug whitespace-pre-wrap break-words font-medium"
                    >
                      {it.text || <span className="opacity-50">Double-click to edit…</span>}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Hover-preview floating bubble for collapsed comments — anchored
                near the icon so it doesn't shift the layout. */}
            {showCommentPreview && (
              <div
                data-testid={`mm-annot-comment-preview-${it.id}`}
                className="absolute pointer-events-none rounded-xl shadow-2xl px-3 py-2"
                style={{
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  minWidth: 140,
                  maxWidth: 240,
                  background: it.color || "#00f0ff",
                  color: "#03060f",
                  boxShadow: `0 10px 30px ${(it.color || "#00f0ff")}88, 0 0 0 1px rgba(0,0,0,0.2)`,
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 500,
                  fontSize: 12,
                  lineHeight: 1.45,
                  zIndex: 20,
                }}
              >
                {it.text}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    bottom: -6,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0, height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: `8px solid ${it.color || "#00f0ff"}`,
                  }}
                />
              </div>
            )}

            {/* Resize handles */}
            {showResize && (
              <>
                {[
                  ["tl", 0, 0, "nwse-resize"],
                  ["tr", w, 0, "nesw-resize"],
                  ["bl", 0, h, "nesw-resize"],
                  ["br", w, h, "nwse-resize"],
                ].map(([corner, hx, hy, cur]) => (
                  <div
                    key={corner}
                    data-testid={`mm-annot-resize-${corner}-${it.id}`}
                    onPointerDown={(e) => onPointerDown(e, it.id, "resize", { corner })}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: hx - 6,
                      top: hy - 6,
                      width: 12,
                      height: 12,
                      background: "#0a0f24",
                      border: "1.5px solid #00f0ff",
                      borderRadius: 3,
                      boxShadow: "0 0 8px #00f0ff",
                      cursor: cur,
                      pointerEvents: "auto",
                    }}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}

      {/* Annotation right-click mini-menu — Edit / Duplicate / Delete.
          Portalled to document.body so position:fixed actually behaves like
          fixed (a CSS-transformed ancestor in the canvas viewport breaks
          fixed positioning otherwise — and that was the source of the
          "clicks pass through but menu won't dismiss" bug). */}
      {annotMenu && createPortal((
        <>
          <div
            data-testid="mm-annot-ctx-backdrop"
            className="fixed inset-0"
            style={{ zIndex: 9998, background: "transparent" }}
            onMouseDown={() => setAnnotMenu(null)}
            onClick={() => setAnnotMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setAnnotMenu(null); }}
          />
          <div
            data-testid="mm-annot-ctx-menu"
            className="fixed glass-panel rounded-lg p-1.5 fade-up"
            style={{
              zIndex: 9999,
              left: Math.min(annotMenu.x, window.innerWidth - 200),
              top: Math.min(annotMenu.y, window.innerHeight - 220),
              width: 190,
              borderColor: "rgba(0,240,255,0.3)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const target = items.find((x) => x.id === annotMenu.id);
              const isConn = target?.type === "connector";
              const isComment = target?.type === "comment";
              return (
                <>
                  {/* If the annotation has a link, show "Open link" at the
                      top of the menu so it's the most reachable action. */}
                  {!isConn && target?.link && (
                    <button
                      data-testid={`mm-annot-open-link-${annotMenu.id}`}
                      onClick={() => {
                        try {
                          openLinkExternally(target.link, {
                            label: target.linkLabel || target.title || "file",
                            navigate,
                          });
                        } catch { /* ignore */ }
                        setAnnotMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100 transition border-b border-white/5 mb-1"
                      title={target.link}
                    >
                      <span className="w-4 grid place-items-center">↗</span>
                      Open link
                    </button>
                  )}
                  {!isConn && (
                    <button
                      data-testid={`mm-annot-edit-${annotMenu.id}`}
                      onClick={() => { setEditingId(annotMenu.id); setAnnotMenu(null); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
                    >
                      <span className="w-4 grid place-items-center text-cyan-300">✎</span>
                      Edit text
                    </button>
                  )}
                  {/* PROPERTIES — shape colour + link URL.  Lets the user
                      attach a hyperlink to the annotation so a click opens
                      the file/web/program/bookmark it points at. Mirrors
                      the node "link" affordance. */}
                  {!isConn && (target?.type === "shape" || target?.type === "text" || target?.type === "sticky") && (
                    <div className="px-2 py-1.5 border-t border-white/5 mt-1">
                      <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 mb-1.5">
                        Link to file or URL
                      </div>
                      <div className="flex items-stretch gap-1.5">
                        <input
                          data-testid={`mm-annot-link-${annotMenu.id}`}
                          defaultValue={target?.link && String(target.link).startsWith("data:") ? "" : (target?.link || "")}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                              updateItem(annotMenu.id, { link: e.target.value.trim() || undefined });
                              setAnnotMenu(null);
                            }
                          }}
                          onBlur={(e) =>
                            updateItem(annotMenu.id, { link: e.target.value.trim() || undefined })
                          }
                          placeholder="https://… or pick a file →"
                          className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[11px] text-cyan-100 outline-none focus:border-cyan-400"
                        />
                        <FilePickerButton
                          testId={`mm-annot-link-pick-${annotMenu.id}`}
                          label="File…"
                          compact
                          onPicked={(dataUrl, fileName) => {
                            updateItem(annotMenu.id, { link: dataUrl, linkName: fileName });
                          }}
                        />
                      </div>
                      <AttachedFilePill
                        value={target?.link}
                        fileName={target?.linkName}
                        onClear={() => updateItem(annotMenu.id, { link: undefined, linkName: undefined })}
                        testId={`mm-annot-link-attached-${annotMenu.id}`}
                      />
                      {target?.type === "text" && (
                        <>
                          <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 mt-2 mb-1">
                            WordArt style
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {Object.entries(WORDART_PRESETS).map(([key, preset]) => (
                              <button
                                key={key}
                                data-testid={`mm-annot-wordart-${key}-${annotMenu.id}`}
                                onClick={() => {
                                  updateItem(annotMenu.id, { style: key === "plain" ? undefined : key });
                                  setAnnotMenu(null);
                                }}
                                title={preset.label}
                                className={`text-[10px] py-1 px-1 rounded border transition ${
                                  (target?.style || "plain") === key
                                    ? "border-cyan-400 bg-cyan-400/10"
                                    : "border-white/10 hover:border-cyan-400/40 bg-black/30"
                                }`}
                              >
                                <span style={{ ...preset.style, fontSize: 14, lineHeight: 1, display: "inline-block" }}>
                                  {preset.sample}
                                </span>
                                <div className="text-[8px] uppercase tracking-[0.18em] text-[#9aa7c7] mt-0.5 truncate">
                                  {preset.label}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 mt-2 mb-1">
                        Colour
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {["#00f0ff", "#39e0ff", "#ff6ad5", "#b88dff", "#3ddc84", "#ffb547", "#ffec3d", "#ffffff"].map((c) => (
                          <button
                            key={c}
                            data-testid={`mm-annot-shape-color-${c.slice(1)}-${annotMenu.id}`}
                            onClick={() => { updateItem(annotMenu.id, { color: c }); setAnnotMenu(null); }}
                            className="w-4 h-4 rounded-full border border-white/20 hover:scale-110 transition"
                            style={{ background: c, boxShadow: target?.color === c ? `0 0 8px ${c}` : "none" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {isComment && (
                    <div className="px-2 py-1.5">
                      <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 mb-1">Comment colour</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {["#00f0ff", "#3ddc84", "#ffec3d", "#ffb547", "#ff6b3d", "#ff6ad5", "#8a5bff", "#ffffff"].map((c) => (
                          <button
                            key={c}
                            data-testid={`mm-annot-comment-color-${c}-${annotMenu.id}`}
                            onClick={() => { updateItem(annotMenu.id, { color: c }); setAnnotMenu(null); }}
                            className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition"
                            style={{ background: c, boxShadow: target.color === c ? `0 0 8px ${c}` : "none" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {isConn && (
                    <>
                      <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 px-2 py-1">Line</div>
                      <button
                        data-testid={`mm-conn-toggle-arrow-${annotMenu.id}`}
                        onClick={() => { updateItem(annotMenu.id, { arrow: !(target.arrow !== false) }); setAnnotMenu(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
                      >
                        <span className="w-4 grid place-items-center text-cyan-300">→</span>
                        {target.arrow !== false ? "Remove arrowhead" : "Add arrowhead"}
                      </button>
                      <button
                        data-testid={`mm-conn-toggle-dashed-${annotMenu.id}`}
                        onClick={() => { updateItem(annotMenu.id, { dashed: !target.dashed }); setAnnotMenu(null); }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
                      >
                        <span className="w-4 grid place-items-center text-cyan-300">{target.dashed ? "—" : "- -"}</span>
                        {target.dashed ? "Solid line" : "Dashed line"}
                      </button>
                      <div className="px-2 py-1.5">
                        <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 mb-1">Colour</div>
                        <div className="flex gap-1.5">
                          {["#00f0ff", "#8a5bff", "#ff6ad5", "#ffb547", "#3ddc84", "#ffec3d"].map((c) => (
                            <button
                              key={c}
                              data-testid={`mm-conn-color-${c}-${annotMenu.id}`}
                              onClick={() => { updateItem(annotMenu.id, { color: c }); setAnnotMenu(null); }}
                              className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition"
                              style={{ background: c, boxShadow: target.color === c ? `0 0 8px ${c}` : "none" }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {!isConn && (
                    <button
                      data-testid={`mm-annot-duplicate-${annotMenu.id}`}
                      onClick={() => {
                        const it = items.find((x) => x.id === annotMenu.id);
                        if (it) {
                          const copy = {
                            ...it,
                            id: `${it.id}-${Date.now().toString(36)}`,
                            x: it.x + 24,
                            y: it.y + 24,
                          };
                          onChange([...items, copy]);
                        }
                        setAnnotMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
                    >
                      <span className="w-4 grid place-items-center text-cyan-300">⧉</span>
                      Duplicate
                    </button>
                  )}
                  {/* Promote a comment into a sticky note so it routes to
                      /output Reminders.  Comments stay decorative until the
                      user explicitly opts in — preserves the "comments do
                      nothing" UX guarantee. */}
                  {isComment && (
                    <button
                      data-testid={`mm-annot-promote-${annotMenu.id}`}
                      onClick={() => {
                        // Mutate type → sticky and reset comment-only fields.
                        // Default sticky size so it's readable when expanded.
                        onChange(items.map((x) =>
                          x.id === annotMenu.id
                            ? {
                                ...x,
                                type: "sticky",
                                w: Math.max(x.w || 0, 190),
                                h: Math.max(x.h || 0, 160),
                                done: false,
                                color: undefined, // stickies use their own bright-yellow palette
                              }
                            : x
                        ));
                        setAnnotMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-amber-200 hover:bg-amber-500/15 hover:text-amber-100 transition"
                      title="Convert this comment into a sticky note — appears in /output Reminders"
                    >
                      <StickyNote size={12} style={{ color: "#ffec3d" }} />
                      Promote to reminder
                    </button>
                  )}
                  <div className="h-px bg-white/5 my-1" />
                  <button
                    data-testid={`mm-annot-ctx-delete-${annotMenu.id}`}
                    onClick={() => { onDelete(annotMenu.id); setAnnotMenu(null); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-red-300 hover:bg-red-500/15 hover:text-red-200 transition"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </>
              );
            })()}
          </div>
        </>
      ), document.body)}
    </>
  );
}

const EndpointHandle = ({ x, y, color, onPointerDown, testid }) => (
  <div
    data-testid={testid}
    onPointerDown={onPointerDown}
    onClick={(e) => e.stopPropagation()}
    style={{
      position: "absolute",
      left: x - 7,
      top: y - 7,
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: "#0a0f24",
      border: `2px solid ${color}`,
      boxShadow: `0 0 8px ${color}`,
      cursor: "grab",
      pointerEvents: "auto",
    }}
  />
);

const ItemControls = ({ id, onDelete, dark }) => (
  <button
    data-testid={`mm-annot-delete-${id}`}
    onClick={(e) => { e.stopPropagation(); onDelete(id); }}
    onPointerDown={(e) => e.stopPropagation()}
    className={`w-5 h-5 rounded-sm grid place-items-center transition ${
      dark
        ? "bg-black/40 hover:bg-red-500/80 text-white"
        : "bg-white/30 hover:bg-red-500/80 hover:text-white text-[#3d2e0a]"
    }`}
    title="Delete"
  >
    <X size={11} strokeWidth={2.5} />
  </button>
);

// Re-export
export { Trash2 };

/**
 * TimelineEmbedCard — visual representation of a timeline embedded as
 * an annotation on a mind map. Reads the linked timeline from
 * localStorage and renders a 16:9 card showing the title, scope, and a
 * miniature axis with event ticks coloured by category. Click → opens
 * /timeline/:id in a new tab so the user keeps map context.
 */
function TimelineEmbedCard({ annotation, isSelected, onDelete, onChangeAnnotation }) {
  const [tl, setTl] = useState(() => (annotation.timelineId ? getTimeline(annotation.timelineId) : null));
  // Re-read on every render (cheap — single localStorage hit) so edits
  // made in the standalone Studio reflect here without manual refresh.
  // Doing it in an effect would lag a paint behind.
  useEffect(() => {
    if (!annotation.timelineId) return;
    setTl(getTimeline(annotation.timelineId));
  }, [annotation.timelineId, annotation._tick]);

  const navigate = useNavigate();
  const open = (e) => {
    e.stopPropagation();
    if (!annotation.timelineId) return;
    navigate(`/timeline/${annotation.timelineId}`);
  };

  if (!tl) {
    return (
      <div
        data-testid={`mm-tl-embed-${annotation.id}`}
        className="w-full h-full relative rounded-lg border border-violet-400/30 bg-[#0a0f24] flex items-center justify-center"
      >
        <div className="text-center px-4">
          <Clock size={24} className="text-violet-300 mx-auto mb-2" />
          <div className="text-[12px] text-[#9aa7c7] mb-2">Timeline missing — was it deleted from /library?</div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(annotation.id); }}
            className="mono text-[10px] uppercase tracking-[0.18em] text-red-300 hover:text-red-200"
          >
            Remove this card
          </button>
        </div>
      </div>
    );
  }

  const startMs = new Date(tl.scope.startISO).getTime();
  const endMs = tl.scope.endISO ? new Date(tl.scope.endISO).getTime() : startMs + 365 * 86_400_000;
  const span = endMs - startMs;
  const catById = {};
  for (const c of tl.categories || []) catById[c.id] = c;
  const fracOf = (ms) => Math.max(0, Math.min(1, (ms - startMs) / span));

  return (
    <div
      data-testid={`mm-tl-embed-${annotation.id}`}
      className="w-full h-full relative rounded-lg overflow-hidden group"
      style={{
        background: "radial-gradient(ellipse at center, rgba(20,28,60,0.7) 0%, rgba(3,4,10,0.95) 70%)",
        border: isSelected ? "1.5px solid rgba(160,140,255,0.9)" : "1.5px solid rgba(160,140,255,0.4)",
        boxShadow: isSelected
          ? "0 0 24px rgba(160,140,255,0.5)"
          : "0 0 12px rgba(160,140,255,0.2)",
      }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 px-3 py-2 flex items-center justify-between bg-gradient-to-b from-[#03040a]/80 to-transparent z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock size={11} className="text-violet-300 shrink-0" />
          <div className="text-[12px] text-white font-semibold truncate">{tl.title}</div>
          <span
            className="mono text-[7px] font-bold px-1 rounded-full bg-fuchsia-500 text-white shrink-0"
            style={{ letterSpacing: "0.06em", lineHeight: 1.2 }}
            title="Timeline Studio is in public beta"
          >
            β
          </span>
        </div>
        <button
          onClick={open}
          onPointerDown={(e) => e.stopPropagation()}
          data-testid={`mm-tl-open-${annotation.id}`}
          className="mono text-[9px] uppercase tracking-[0.18em] text-violet-200 hover:text-white px-2 py-1 rounded border border-violet-400/40 hover:border-violet-300/80 bg-violet-500/10 transition flex items-center gap-1 shrink-0"
          title="Open this timeline in Studio"
        >
          Open <ExternalLink size={9} />
        </button>
      </div>

      {/* Miniature axis preview */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        {/* Period bars */}
        {(tl.periods || []).map((p) => {
          const f1 = fracOf(new Date(p.startISO).getTime());
          const f2 = fracOf(new Date(p.endISO).getTime());
          return (
            <div
              key={p.id}
              className="absolute top-9 bottom-9 pointer-events-none"
              style={{
                left: `calc(${f1 * 100}% + ${24 - f1 * 48}px)`,
                width: `calc(${(f2 - f1) * 100}% + ${(f2 - f1) * -48}px)`,
                background: `${p.color || "#ff6ad5"}1f`,
                borderLeft: `1.5px solid ${p.color || "#ff6ad5"}`,
                borderRight: `1.5px solid ${p.color || "#ff6ad5"}`,
              }}
            />
          );
        })}

        {/* Axis line */}
        <div
          className="w-full h-px"
          style={{
            background: "linear-gradient(to right, transparent, rgba(0,240,255,0.9), rgba(160,140,255,1), rgba(255,106,213,0.9), transparent)",
            boxShadow: "0 0 8px rgba(0,240,255,0.4)",
          }}
        />

        {/* Today marker */}
        {Date.now() >= startMs && Date.now() <= endMs && (
          <div
            className="absolute top-9 bottom-9 pointer-events-none"
            style={{
              left: `calc(${fracOf(Date.now()) * 100}% - 1px)`,
              width: 2,
              background: "rgba(255,255,255,0.7)",
              boxShadow: "0 0 4px rgba(255,255,255,0.6)",
            }}
          />
        )}

        {/* Event ticks */}
        {(tl.events || []).map((e) => {
          const f = fracOf(new Date(e.dateISO).getTime());
          const color = catById[e.categoryId]?.color || "#00f0ff";
          return (
            <div
              key={e.id}
              className="absolute pointer-events-none"
              style={{
                left: `calc(${f * 100}% - 5px)`,
                top: e.position === "above" ? "calc(50% - 16px)" : "calc(50% + 6px)",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
                border: "1px solid rgba(255,255,255,0.35)",
                boxShadow: `0 0 4px ${color}cc`,
              }}
              title={`${e.label} · ${new Date(e.dateISO).toLocaleDateString()}`}
            />
          );
        })}
      </div>

      {/* Footer — counts */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 flex items-center justify-between bg-gradient-to-t from-[#03040a]/80 to-transparent">
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#9aa7c7]">
          {(tl.events || []).length} events · {(tl.periods || []).length} periods
        </div>
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad]">
          {new Date(tl.scope.startISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
          {tl.scope.endISO ? ` → ${new Date(tl.scope.endISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}` : " → ∞"}
        </div>
      </div>

      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
        <ItemControls id={annotation.id} onDelete={onDelete} dark />
      </div>
    </div>
  );
}

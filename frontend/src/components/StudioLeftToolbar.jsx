import React, { useEffect, useRef, useState } from "react";
import {
  Save,
  FileText,
  X as CloseIcon,
  Plus,
  ScrollText,
  GripVertical,
} from "lucide-react";

const STORAGE_KEY = "mindmapper.toolbar.pos.v1";

/**
 * Floating, draggable map-actions toolbar.
 *
 * Default position: top-right (so it doesn't clash with the map header).
 * The user can grab the "Map · drag" header and reposition anywhere on
 * screen; position is persisted in localStorage and restored on next load.
 */

/**
 * Vertical action toolbar that lives just below the map title + timestamp.
 *
 * Holds the two map-lifecycle actions the user asked for:
 *   • Save         — force a save now (auto-save runs anyway, this is for
 *                    confidence after a big change)
 *   • Save as…     — duplicate the current map under a new title
 *   • Close map    — auto-save current → fresh untitled "Map Title" map
 *   • New map      — same as Close map but explicit
 *   • Compile…     — open the Compile-to-Document dialog
 *
 * The toolbar is independent of selection state; the right-side selection
 * panel handles per-element properties (colour / font / size / shape).
 */
export default function StudioLeftToolbar({
  onSaveNow,
  onSaveAs,
  onCloseMap,
  onNewMap,
  onCompile,
  hidden = false,
  disabled = false,
}) {
  // Persisted free-floating position: { top, left }. null on first load →
  // default to "just below the READER button in the left sidebar".
  const DEFAULT_TOP = 530;
  const DEFAULT_LEFT = 20;
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.top === "number" && typeof parsed?.left === "number") return parsed;
    } catch { /* ignore */ }
    return null;
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startTop: 0, startLeft: 0 });

  const onDragStart = (e) => {
    e.preventDefault();
    const target = e.currentTarget.closest('[data-testid="studio-left-toolbar"]');
    const r = target?.getBoundingClientRect();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTop: r?.top ?? DEFAULT_TOP,
      startLeft: r?.left ?? DEFAULT_LEFT,
    };
    setDragging(true);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        top: Math.max(8, Math.min(window.innerHeight - 80, dragRef.current.startTop + dy)),
        left: Math.max(8, Math.min(window.innerWidth - 200, dragRef.current.startLeft + dx)),
      });
    };
    const onUp = () => {
      if (dragRef.current.active) {
        dragRef.current.active = false;
        setDragging(false);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pos]);

  if (hidden) return null;
  const Btn = ({ testid, icon: Icon, label, onClick, accent = "cyan", title }) => (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`group flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${
        accent === "fuchsia"
          ? "border-fuchsia-400/25 bg-fuchsia-500/[0.05] hover:border-fuchsia-400/55 hover:bg-fuchsia-500/[0.12] text-fuchsia-100"
          : accent === "amber"
          ? "border-amber-400/25 bg-amber-500/[0.05] hover:border-amber-400/55 hover:bg-amber-500/[0.12] text-amber-100"
          : "border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-cyan-500/[0.08] text-[#cfdaf3] hover:text-cyan-100"
      }`}
    >
      <Icon size={13} className="shrink-0 opacity-90 group-hover:opacity-100" />
      <span className="mono text-[10.5px] uppercase tracking-[0.2em]">{label}</span>
    </button>
  );

  return (
    <div
      data-testid="studio-left-toolbar"
      className="fixed z-30 w-[180px] flex flex-col gap-1.5 p-2 rounded-xl border border-white/10 bg-[#0a0f24]/85 backdrop-blur-md pointer-events-auto"
      style={{
        top: pos?.top ?? DEFAULT_TOP,
        left: pos?.left ?? DEFAULT_LEFT,
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        cursor: dragging ? "grabbing" : undefined,
      }}
    >
      <div
        data-testid="studio-toolbar-drag-handle"
        onMouseDown={onDragStart}
        title="Drag to move toolbar"
        className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 px-1 py-0.5 mb-1 flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none"
      >
        <GripVertical size={10} className="opacity-70" />
        Map · drag
      </div>
      <Btn testid="studio-toolbar-save"     icon={Save}       label="Save now"     onClick={onSaveNow}    title="Save the map immediately (auto-save runs in the background anyway)"/>
      <Btn testid="studio-toolbar-saveas"   icon={FileText}   label="Save as…"     onClick={onSaveAs}     title="Duplicate the current map under a new title"/>
      <div className="h-px bg-white/[0.06] mx-1 my-0.5" />
      <Btn testid="studio-toolbar-newmap"   icon={Plus}       label="New map"      onClick={onNewMap}     title="Start a fresh untitled map"/>
      <Btn testid="studio-toolbar-close"    icon={CloseIcon}  label="Close map"    onClick={onCloseMap}   accent="amber" title="Auto-save and replace with a fresh 'Map Title' map"/>
      <div className="h-px bg-white/[0.06] mx-1 my-0.5" />
      <Btn testid="studio-toolbar-compile"  icon={ScrollText} label="Compile…"     onClick={onCompile}    accent="fuchsia" title="Compile this map into a PDF or Markdown document"/>
    </div>
  );
}

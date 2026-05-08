import React, { useEffect, useRef, useState } from "react";
import { GripHorizontal } from "lucide-react";

/**
 * DraggablePanel — a thin floating-panel wrapper that adds a drag handle
 * along the top edge.  Position is persisted to localStorage by `storageKey`
 * so the panel stays where the user dropped it across reloads.
 *
 * Why a wrapper and not a hook?  The handle needs its own visual treatment
 * (a faint ⋮⋮ grip + label) and it's nicer to author once than to repeat the
 * grip JSX in every consumer.
 */
export default function DraggablePanel({
  storageKey,
  defaultPos,           // { x, y } in viewport coords
  width,                // px (used to clamp inside viewport)
  className = "",
  style = {},
  testid,
  label,                // small uppercase header shown next to grip
  children,
  zIndex = 25,
}) {
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") return p;
      }
    } catch { /* ignore */ }
    return defaultPos;
  });

  const dragRef = useRef(null); // { offsetX, offsetY }

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(pos)); }
    catch { /* ignore */ }
  }, [pos, storageKey]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    dragRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const maxX = window.innerWidth - (width || 200) - 8;
    const maxY = window.innerHeight - 60;
    const x = Math.max(8, Math.min(maxX, e.clientX - dragRef.current.offsetX));
    const y = Math.max(8, Math.min(maxY, e.clientY - dragRef.current.offsetY));
    setPos({ x, y });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      data-testid={testid}
      className={`fixed pointer-events-auto ${className}`}
      style={{
        left: pos.x,
        top: pos.y,
        zIndex,
        width: width ? `${width}px` : undefined,
        ...style,
      }}
    >
      {/* Drag handle */}
      <div
        data-testid={testid ? `${testid}-handle` : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex items-center gap-1.5 px-2 py-1 cursor-grab active:cursor-grabbing select-none border-b border-white/5 mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] hover:text-cyan-300 transition rounded-t-xl bg-white/[0.02]"
        title="Drag to move"
      >
        <GripHorizontal size={11} />
        {label}
      </div>
      {children}
    </div>
  );
}

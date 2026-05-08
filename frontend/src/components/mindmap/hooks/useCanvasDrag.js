import { useCallback, useRef, useState } from "react";

const MIN_W = 80;
const MIN_H = 36;

/**
 * Drag / resize / background-pan handlers for MindMapCanvas.
 *
 * Owns the `dragRef` mutable state machine for three interaction modes:
 *   - "pan"    — background drag translates the view
 *   - "node"   — node drag writes `map.positions[id]` via onChange
 *   - "resize" — corner-handle drag writes node `width` / `height`
 *
 * The hook is deliberately dumb: it reads the current `view` + `map` from
 * its closure, dispatches `onChange` for persistence, and never touches
 * selection or menu state beyond clearing them on bg-drag.
 *
 * Callers wire the returned handlers onto the canvas SVG root and the
 * per-node / per-handle event sources.
 */
export default function useCanvasDrag({
  map,
  onChange,
  view,
  setView,
  positions,
  setSelected,
  setSelectedEdge,
  setMenu,
  findAndUpdate,
  // Optional clears so a click on blank canvas wipes ALL selection state,
  // not just node + edge. Supplied by MindMapCanvas.
  setMultiSelected,
  setSelectedAnnotation,
}) {
  const dragRef = useRef({ kind: null });
  const [dragKind, setDragKind] = useState(null);

  const onMouseDown = useCallback((e) => {
    if (e.target.dataset?.role !== "canvas-bg") return;
    dragRef.current = {
      kind: "pan",
      startMouse: { x: e.clientX, y: e.clientY },
      startView: { ...view },
    };
    setDragKind("pan");
    setSelected?.(null);
    setSelectedEdge?.(null);
    setMenu?.(null);
    // De-select multi-pool + annotation when the user clicks bare canvas.
    setMultiSelected?.(new Set());
    setSelectedAnnotation?.(null);
  }, [view, setSelected, setSelectedEdge, setMenu, setMultiSelected, setSelectedAnnotation]);

  const onMouseMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.kind) return;
    if (d.kind === "pan") {
      setView({
        ...d.startView,
        x: d.startView.x + (e.clientX - d.startMouse.x),
        y: d.startView.y + (e.clientY - d.startMouse.y),
      });
    } else if (d.kind === "node") {
      const dx = (e.clientX - d.startMouse.x) / view.k;
      const dy = (e.clientY - d.startMouse.y) / view.k;
      const nx = d.startPos.x + dx;
      const ny = d.startPos.y + dy;
      const next = { ...map, positions: { ...(map.positions || {}), [d.id]: { x: nx, y: ny } } };
      onChange(next);
    } else if (d.kind === "resize") {
      const dx = (e.clientX - d.startMouse.x) / view.k;
      const dy = (e.clientY - d.startMouse.y) / view.k;
      let w = d.startW;
      let h = d.startH;
      if (d.corner.includes("r")) w = Math.max(MIN_W, d.startW + dx * 2);
      if (d.corner.includes("l")) w = Math.max(MIN_W, d.startW - dx * 2);
      if (d.corner.includes("b")) h = Math.max(MIN_H, d.startH + dy * 2);
      if (d.corner.includes("t")) h = Math.max(MIN_H, d.startH - dy * 2);
      const next = findAndUpdate(map, d.id, (n) => {
        n.width = Math.round(w);
        n.height = Math.round(h);
      });
      onChange(next);
    }
  }, [map, onChange, view, setView, findAndUpdate]);

  const onMouseUp = useCallback(() => {
    dragRef.current = { kind: null };
    setDragKind(null);
  }, []);

  const startNodeDrag = useCallback((e, id) => {
    e.stopPropagation();
    const pos = positions[id] || { x: 0, y: 0 };
    dragRef.current = {
      kind: "node",
      id,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { ...pos },
    };
    setDragKind("node");
    // Modifier keys (Shift / Ctrl / Cmd) are reserved for additive
    // multi-selection in the click handler — overwriting `selected` here
    // would race the upcoming onClick and the multi-select Set would
    // never get both nodes. Skip selection promotion for modified clicks.
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setSelected?.(id);
    }
    setSelectedEdge?.(null);
  }, [positions, setSelected, setSelectedEdge]);

  const startResize = useCallback((e, id, corner, w, h) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      kind: "resize",
      id,
      corner,
      startMouse: { x: e.clientX, y: e.clientY },
      startW: w,
      startH: h,
    };
    setDragKind("resize");
  }, []);

  return { onMouseDown, onMouseMove, onMouseUp, startNodeDrag, startResize, dragKind };
}

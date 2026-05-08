import { useCallback, useEffect, useState } from "react";

/**
 * Pan / zoom / wheel-zoom / fit / focus-node-center state for MindMapCanvas.
 *
 * Owns the `view = {x, y, k}` transform plus every effect that mutates it:
 *   - centre the canvas on map switch
 *   - wheel-zoom (attached non-passively so we can preventDefault)
 *   - focus-node-center when the command palette asks the canvas to focus an id
 *
 * Returned imperative helpers:
 *   - resetView: re-centres the canvas at 0.85× zoom
 *   - zoomBy(factor): clamp-safe multiplicative zoom (used by toolbar +/- buttons)
 *
 * The hook intentionally does NOT own `selected` state; when a focus request
 * arrives it calls the setters passed in so the rest of the canvas stays in
 * charge of selection.
 */
export default function usePanZoom({
  containerRef,
  mapId,
  focusNodeId,
  positions,
  onFocusConsumed,
  setSelected,
  setSelectedEdge,
}) {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });

  // Centre view on mount / map change.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView({ x: rect.width / 2, y: rect.height / 2, k: 0.85 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // Focus a specific node (command palette / highlight deep-link).
  useEffect(() => {
    if (!focusNodeId) return;
    const pos = positions[focusNodeId];
    const el = containerRef.current;
    if (!pos || !el) return;
    setSelected?.(focusNodeId);
    setSelectedEdge?.(null);
    const rect = el.getBoundingClientRect();
    const k = 1.0;
    setView({ x: rect.width / 2 - pos.x * k, y: rect.height / 2 - pos.y * k, k });
    onFocusConsumed && onFocusConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId, mapId]);

  // Wheel-zoom — attached non-passively so we can preventDefault on trackpads.
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView((v) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextK = Math.min(2.5, Math.max(0.25, v.k * factor));
      const wx = (mx - v.x) / v.k;
      const wy = (my - v.y) / v.k;
      return { k: nextK, x: mx - wx * nextK, y: my - wy * nextK };
    });
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => onWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onWheel, containerRef]);

  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setView({ x: rect.width / 2, y: rect.height / 2, k: 0.85 });
  }, [containerRef]);

  const zoomBy = useCallback((factor) => {
    setView((v) => ({ ...v, k: Math.min(2.5, Math.max(0.25, v.k * factor)) }));
  }, []);

  return { view, setView, resetView, zoomBy };
}

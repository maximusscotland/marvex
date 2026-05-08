/**
 * usePanZoom — pan / zoom / wheel-zoom / fit-to-bounds / focus-node state.
 *
 * On mount or map change we run a true **fit-to-bounds** auto-centring:
 * compute the axis-aligned bounding box of every positioned node, pick a
 * zoom level that fits the box in the viewport with a small margin,
 * then translate so the box midpoint sits at the screen centre. This
 * replaces the previous fixed `0.85` zoom which always assumed (0,0)
 * was the centre — a fine assumption for a 3-child seed but a poor
 * one for radial layouts with 5+ branches where leaves can reach
 * 600+ px from origin and disappear off the right/bottom edges.
 *
 * We only auto-fit ONCE per mapId so user pan/zoom interactions aren't
 * fought by the effect on every position recompute (e.g. dragging a
 * node updates `positions` continuously).
 */
import { useCallback, useEffect, useRef, useState } from "react";

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
  // Tracks the mapId we've already auto-fitted to, so the fit-to-bounds
  // effect runs exactly once per map switch (not on every position diff).
  const fittedRef = useRef(null);

  // Reset the "fitted" flag whenever the user opens a different map so
  // the next render does a fresh auto-fit.
  useEffect(() => { fittedRef.current = null; }, [mapId]);

  // Fit-to-bounds: runs after layout has populated `positions` for the
  // current map. We pad by NODE_PAD on every side to leave breathing
  // room for the actual node geometry (positions are node *centres*,
  // not bounding boxes), and clamp the zoom so a tiny 1-node map
  // doesn't snap to 200% or a huge 8-branch map to 0.05.
  useEffect(() => {
    if (fittedRef.current === mapId) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const ids = Object.keys(positions || {});
    if (ids.length === 0) {
      // Layout hasn't run yet — use the legacy "centre at origin, 0.85x"
      // behaviour as a transient default, then re-run when positions arrive.
      setView({ x: rect.width / 2, y: rect.height / 2, k: 0.85 });
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    if (!Number.isFinite(minX)) return;

    const NODE_PAD = 160; // generous so the largest leaf node still fits.
    const mapW = (maxX - minX) + NODE_PAD * 2;
    const mapH = (maxY - minY) + NODE_PAD * 2;
    const kFit = Math.min(rect.width / mapW, rect.height / mapH) * 0.92;
    // Clamp: don't zoom above 1.05× (avoid jarring snap on tiny maps)
    // and don't go below 0.32× (very dense maps will still be readable
    // and the user can zoom further in via wheel/+).
    const k = Math.min(1.05, Math.max(0.32, kFit));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({
      x: rect.width / 2 - cx * k,
      y: rect.height / 2 - cy * k,
      k,
    });
    fittedRef.current = mapId;
  }, [mapId, positions, containerRef]);

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

  // Manual re-centre — re-runs the fit-to-bounds logic above. Toolbar
  // "fit" button calls this, plus we expose it for keyboard shortcut "f".
  const resetView = useCallback(() => {
    fittedRef.current = null;        // force the auto-fit effect to re-run
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ids = Object.keys(positions || {});
    if (ids.length === 0) {
      setView({ x: rect.width / 2, y: rect.height / 2, k: 0.85 });
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    if (!Number.isFinite(minX)) return;
    const NODE_PAD = 160;
    const mapW = (maxX - minX) + NODE_PAD * 2;
    const mapH = (maxY - minY) + NODE_PAD * 2;
    const kFit = Math.min(rect.width / mapW, rect.height / mapH) * 0.92;
    const k = Math.min(1.05, Math.max(0.32, kFit));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({ x: rect.width / 2 - cx * k, y: rect.height / 2 - cy * k, k });
  }, [containerRef, positions]);

  const zoomBy = useCallback((factor) => {
    setView((v) => ({ ...v, k: Math.min(2.5, Math.max(0.25, v.k * factor)) }));
  }, []);

  return { view, setView, resetView, zoomBy };
}


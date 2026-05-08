import React, { useEffect, useRef } from "react";
import { INK_COLORS } from "@/lib/inkStorage";

/**
 * Per-page canvas overlay for freehand ink strokes.
 *
 * The canvas sits ABOVE the text layer when draw mode is ON (so the
 * pointer events are captured) and BELOW it when OFF (so text selection
 * still works and old strokes are visible through the page).
 *
 * Points are stored in normalized 0..1 space relative to the page viewport
 * so they scale correctly if the page is re-rendered at a different zoom.
 */
export default function InkLayer({
  strokes,
  drawMode,
  tool,           // "pen" | "eraser"
  color,          // "cyan" | "fuchsia" | "yellow"
  width,          // 2 | 4 | 8
  pageW, pageH,   // viewport dimensions in px (same as canvas)
  onStroke,       // (stroke) => void   — called on pointerup
  onEraseStroke,  // (strokeId) => void
}) {
  const canvasRef = useRef(null);
  const activeStrokeRef = useRef(null); // { color, width, points: [] }
  const erasingRef = useRef(false);     // true while eraser is being dragged

  // Redraw all strokes whenever the source changes.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes) drawStroke(ctx, s, pageW, pageH);
  }, [strokes, pageW, pageH]);

  const onPointerDown = (e) => {
    if (!drawMode) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (tool === "eraser") {
      // Start an erase drag — we keep the pointer captured so subsequent
      // moves (even off-stroke) still belong to the eraser, and we erase
      // any stroke under the cursor on every move.
      canvasRef.current.setPointerCapture?.(e.pointerId);
      erasingRef.current = true;
      const hitStroke = strokes.find((s) => strokeHit(s, x, y, pageW, pageH));
      if (hitStroke) onEraseStroke?.(hitStroke.id);
      return;
    }
    canvasRef.current.setPointerCapture?.(e.pointerId);
    activeStrokeRef.current = {
      id: `ink_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      color,
      width,
      points: [{ x, y }],
    };
  };

  const onPointerMove = (e) => {
    if (!drawMode) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Eraser drag — keep deleting strokes under the cursor as we move.
    if (tool === "eraser" && erasingRef.current) {
      const hitStroke = strokes.find((s) => strokeHit(s, x, y, pageW, pageH));
      if (hitStroke) onEraseStroke?.(hitStroke.id);
      return;
    }

    if (!activeStrokeRef.current) return;
    activeStrokeRef.current.points.push({ x, y });
    // Cheap incremental draw — paint just the newest segment.
    const ctx = canvasRef.current.getContext("2d");
    const pts = activeStrokeRef.current.points;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      ctx.strokeStyle = INK_COLORS[activeStrokeRef.current.color] || "#00f0ff";
      ctx.lineWidth = activeStrokeRef.current.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = activeStrokeRef.current.color === "yellow" ? 0.45 : 0.95;
      ctx.beginPath();
      ctx.moveTo(a.x * pageW, a.y * pageH);
      ctx.lineTo(b.x * pageW, b.y * pageH);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  const onPointerUp = () => {
    erasingRef.current = false;
    const s = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (!s || s.points.length < 2) return;
    onStroke?.(s);
  };

  return (
    <canvas
      ref={canvasRef}
      width={pageW}
      height={pageH}
      data-testid="reader-ink-layer"
      data-draw-mode={drawMode ? "true" : "false"}
      className={`pdf-ink-layer ${drawMode ? (tool === "eraser" ? "cursor-cell" : "cursor-crosshair") : ""}`}
      style={{
        position: "absolute",
        top: 0, left: 0,
        width: `${pageW}px`, height: `${pageH}px`,
        // When drawing, capture events above the text layer.
        // When not drawing, let clicks/selections pass to the text layer.
        pointerEvents: drawMode ? "auto" : "none",
        // Always render below text selection highlights so the yellow ink
        // doesn't make selected-text backgrounds look wrong.
        zIndex: drawMode ? 3 : 1,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}

function drawStroke(ctx, s, W, H) {
  if (!s.points || s.points.length < 2) return;
  ctx.strokeStyle = INK_COLORS[s.color] || "#00f0ff";
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = s.color === "yellow" ? 0.45 : 0.95;
  ctx.beginPath();
  const p0 = s.points[0];
  ctx.moveTo(p0.x * W, p0.y * H);
  for (let i = 1; i < s.points.length; i++) {
    const p = s.points[i];
    ctx.lineTo(p.x * W, p.y * H);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Rudimentary hit-testing for the eraser (~16px radius in viewport coords). */
function strokeHit(stroke, nx, ny, W, H) {
  const radius = 16;
  for (const p of stroke.points) {
    const dx = (p.x - nx) * W;
    const dy = (p.y - ny) * H;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}

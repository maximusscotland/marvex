import React from "react";
import { DEFAULT_EDGE_COLOR, DEFAULT_EDGE_WIDTH } from "@/components/mindmap/constants";

/**
 * MapEdges — renders the connecting lines (and optional textPath labels)
 * between every parent → child in the mind-map tree.
 *
 * Pure SVG, no React state.  Tightly tied to the canvas — relies on
 * the parent's `positions` map to locate where each map element sits in
 * world space.  Hit-testing is split into two stacked <line>s:
 *   1. an INVISIBLE thick line ("transparent", strokeWidth=14) that owns
 *      pointer events — gives the user a generous click target without
 *      requiring pixel-perfect aim;
 *   2. a thinner VISIBLE line on top with `pointerEvents:none` so the
 *      visible glyph never steals the click from the hit area below.
 *
 * Labels are rendered along an SVG `<textPath>` so they rotate with the
 * line direction; the path is flipped left-to-right when the edge points
 * right-to-left so labels never appear upside down.  Very short edges
 * (< 60 px) skip the label entirely — too cramped to read.
 */
export default function MapEdges({
  flat,
  positions,
  selectedEdge,
  selectEdge,
  closeMenu,
  openEdgeMenu,
}) {
  return (
    <>
      {flat.map(({ node, parent }) => {
        if (!parent) return null;
        const a = positions[parent.id];
        const b = positions[node.id];
        if (!a || !b) return null;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const ux = dx / len;
        const uy = dy / len;
        const pad = 24;
        const x2 = b.x - ux * pad;
        const y2 = b.y - uy * pad;
        const jx = a.x + ux * 26;
        const jy = a.y + uy * 26;
        const es = node.edgeStyle || {};
        const color = es.color || DEFAULT_EDGE_COLOR;
        const width = es.width || DEFAULT_EDGE_WIDTH;
        const dashed = !!es.dashed;
        const arrow = es.arrow !== false; // default true, opt-out
        const label = es.label || "";
        const isSelEdge = selectedEdge === node.id;
        return (
          <g key={`edge-${node.id}`} style={{ color }}>
            {/* invisible wide hit area */}
            <line
              data-testid={`mm-edge-${node.id}`}
              x1={a.x} y1={a.y} x2={x2} y2={y2}
              stroke="transparent" strokeWidth={14}
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); selectEdge(node.id); closeMenu(); }}
              onContextMenu={(e) => openEdgeMenu(e, node.id)}
            />
            {/* visible line */}
            <line
              x1={a.x} y1={a.y} x2={x2} y2={y2}
              stroke={color}
              strokeWidth={isSelEdge ? Math.max(2.2, width + 1) : width}
              strokeDasharray={dashed ? "6 5" : "none"}
              markerEnd={arrow ? "url(#arrow-cyan)" : undefined}
              opacity={isSelEdge ? 1 : 0.85}
              style={{ pointerEvents: "none" }}
            />
            {/* junction dot */}
            <circle
              cx={jx} cy={jy}
              r={isSelEdge ? 3 : 2.2}
              fill={color}
              opacity="0.9"
              style={{ filter: `drop-shadow(0 0 4px ${color})`, pointerEvents: "none" }}
            />
            {/* edge label — rendered ALONG THE PATH so it rotates with
                the line (textPath). Falls back to a horizontal pill at
                the midpoint for very short edges where on-path text
                becomes unreadable. */}
            {label && (() => {
              const pathLen = Math.sqrt((x2 - a.x) ** 2 + (y2 - a.y) ** 2);
              // Hide the label for super-short edges where it just clutters.
              if (pathLen < 60) return null;
              // Flip the path so the label always reads left-to-right
              // (otherwise edges going right-to-left render upside down).
              const reversed = x2 < a.x;
              const pathId = `edgepath-${node.id}`;
              const pathD = reversed
                ? `M ${x2} ${y2} L ${a.x} ${a.y}`
                : `M ${a.x} ${a.y} L ${x2} ${y2}`;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <defs>
                    <path id={pathId} d={pathD} />
                  </defs>
                  {/* Soft halo behind the text so it stays legible
                      when the line passes through dense areas. */}
                  <text
                    fontFamily="'Sora',sans-serif"
                    fontSize="11"
                    fontWeight="600"
                    letterSpacing="0.4"
                    stroke="rgba(4,6,15,0.95)"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                    paintOrder="stroke fill"
                    fill={color}
                  >
                    <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                      {label}
                    </textPath>
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}
    </>
  );
}

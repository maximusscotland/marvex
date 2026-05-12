/* eslint-disable react/prop-types */
import React from "react";

/**
 * <MiniTimeline /> — read-only horizontal Gantt-style strip used in
 * Lesson 4 to *show* what a topic-map looks like once it's been
 * converted to Marvex's Timeline Studio.
 *
 * Renders the events from a `{ weeks, events: [{week, label, colour}] }`
 * data shape as coloured bars across a week-axis. Same visual idiom as
 * the real Timeline Studio so visitors learn the affordance.
 */
export default function MiniTimeline({ timeline, caption, testid = "mini-timeline" }) {
  if (!timeline) return null;
  const { weeks = 6, events = [] } = timeline;
  const colWidth = 90;
  const rowHeight = 32;
  const headerH = 28;
  const padding = 20;
  const w = padding * 2 + colWidth * weeks;
  const h = padding * 2 + headerH + events.length * (rowHeight + 6);

  return (
    <figure data-testid={testid} className="my-8 rounded-2xl border border-white/10 bg-[#04060f]/70 overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block", maxHeight: 360 }}>
        {/* week headers */}
        {Array.from({ length: weeks }).map((_, i) => (
          <g key={`hdr-${i}`}>
            <text
              x={padding + colWidth * i + colWidth / 2}
              y={padding + 12}
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize={10}
              fill="rgba(125,211,252,0.55)"
              letterSpacing={2}
            >
              WK {i + 1}
            </text>
            <line
              x1={padding + colWidth * i}
              y1={padding + headerH}
              x2={padding + colWidth * i}
              y2={h - padding}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2 3"
            />
          </g>
        ))}
        <line
          x1={padding + colWidth * weeks}
          y1={padding + headerH}
          x2={padding + colWidth * weeks}
          y2={h - padding}
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray="2 3"
        />
        {/* events as bars */}
        {events.map((e, i) => {
          const x = padding + colWidth * (e.week - 1) + 6;
          const y = padding + headerH + i * (rowHeight + 6);
          const barW = colWidth - 12;
          const colour = e.colour || "#7dd3fc";
          return (
            <g key={`ev-${i}`}>
              <rect
                x={x} y={y} width={barW} height={rowHeight}
                rx={6} ry={6}
                fill={colour} fillOpacity={0.15}
                stroke={colour} strokeOpacity={0.6}
                strokeWidth={1}
              />
              <rect x={x} y={y} width={4} height={rowHeight} rx={2} fill={colour} opacity={0.85} />
              <foreignObject x={x + 10} y={y} width={barW - 12} height={rowHeight}>
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    display: "flex", alignItems: "center", height: "100%",
                    fontFamily: "Sora, system-ui, sans-serif",
                    fontSize: 11, color: "#dbe5ff", lineHeight: 1.1,
                    overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.label}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      {caption && (
        <figcaption className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70 px-4 py-3 border-t border-white/[0.04] bg-white/[0.015]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

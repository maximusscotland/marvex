/* eslint-disable react/prop-types */
import React, { useMemo } from "react";

/**
 * <MiniMap /> — a small, read-only mind-map renderer used inside the
 * mini-course lessons to *show* the maps the lesson is talking about.
 *
 * Why a bespoke renderer instead of dropping the real MindMapCanvas in?
 *   • MindMapCanvas carries pan/zoom, drag, context-menu, dialog and a
 *     thousand keyboard shortcuts.  None of that belongs inside an
 *     article body — it'd hijack scroll, trap focus, and balloon the
 *     bundle of every visitor who never opens Studio.
 *   • The course needs maps to be *fixed illustrations*, not toys. A
 *     consistent, predictable visual is more pedagogically useful than
 *     a fiddly interactive one.
 *
 * Layout:
 *   Simple horizontal radial.  Root node sits left-of-centre.  First-
 *   level children stack vertically on the right with even spacing.
 *   Second-level children stack further-right under their parent.
 *   Depth >2 collapses into a "+N more" hint to keep the visual tidy.
 *   Two visual flags supported:
 *     - `fill`           — colour the node header pill (used to denote
 *                          categories e.g. absolute vs qualified rights)
 *     - `link`           — render a small link badge so the resource-
 *                          attachment lesson (Lesson 3) actually SHOWS
 *                          link badges instead of just describing them.
 *     - `videoLink`      — boolean — render a ▶ play badge variant.
 *
 * Sizing: the component scales itself to the available width via SVG
 * viewBox + width="100%". Default height 320; pass `height` to override.
 */

const PADDING = 24;
const NODE_W = 200;
const NODE_H = 44;
const VGAP = 14;
const HGAP = 56;
const CHILD_W = 170;
const CHILD_H = 32;

function measureTree(tree) {
  const children = tree.children || [];
  if (!children.length) return { selfH: NODE_H, totalH: NODE_H };
  let totalH = 0;
  let firstLevelCount = 0;
  for (const c of children) {
    const subCount = c.children?.length || 0;
    const subH = subCount > 0 ? subCount * (CHILD_H + 8) - 8 : 0;
    const h = Math.max(NODE_H, subH);
    totalH += h + VGAP;
    firstLevelCount++;
  }
  totalH = Math.max(NODE_H, totalH - VGAP);
  return { selfH: NODE_H, totalH, firstLevelCount };
}

const colorOf = (fill) => fill || "#7dd3fc"; // sky-300

const Node = ({ x, y, w, h, title, fill, link, videoLink, isRoot }) => {
  const accent = colorOf(fill);
  const radius = isRoot ? 22 : 10;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0} y={0} width={w} height={h} rx={radius} ry={radius}
        fill={isRoot ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)"}
        stroke={accent}
        strokeOpacity={0.45}
        strokeWidth={isRoot ? 1.4 : 1}
      />
      {/* Left accent stripe — gives every node a strong colour cue at a
          glance, even at small zoom levels. */}
      <rect x={0} y={0} width={4} height={h} rx={2} fill={accent} opacity={0.85} />
      <foreignObject x={10} y={0} width={w - 22} height={h}>
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            display: "flex", alignItems: "center", height: "100%",
            fontFamily: "Sora, system-ui, sans-serif",
            color: "#dbe5ff",
            fontSize: isRoot ? 13 : 11.5,
            fontWeight: isRoot ? 700 : 500,
            lineHeight: 1.2,
            paddingRight: 4,
          }}
        >
          <span style={{
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            textOverflow: "ellipsis",
          }}>{title}</span>
        </div>
      </foreignObject>
      {(link || videoLink) && (
        <g transform={`translate(${w - 16}, ${h - 16})`}>
          <circle r={8} fill={videoLink ? "#a855f7" : "#22d3ee"} opacity={0.95} />
          <text
            x={0} y={1} textAnchor="middle" dominantBaseline="middle"
            fontSize={videoLink ? 8 : 9}
            fontFamily="Sora, system-ui, sans-serif"
            fontWeight={700}
            fill="#03040a"
          >
            {videoLink ? "▶" : "↗"}
          </text>
        </g>
      )}
    </g>
  );
};

const Edge = ({ x1, y1, x2, y2 }) => {
  // Bezier curve from parent right-edge to child left-edge.
  const dx = (x2 - x1) / 2;
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  return <path d={d} fill="none" stroke="rgba(125,211,252,0.35)" strokeWidth={1.2} />;
};

export default function MiniMap({
  map,
  height = 320,
  caption,
  testid = "mini-map",
}) {
  const layout = useMemo(() => {
    if (!map) return null;
    const children = map.children || [];
    const { totalH } = measureTree(map);
    // Final canvas dimensions.
    const w = PADDING + NODE_W + HGAP + CHILD_W + HGAP + CHILD_W + PADDING;
    const h = Math.max(NODE_H + PADDING * 2, totalH + PADDING * 2);
    // Root centred vertically.
    const rootX = PADDING;
    const rootY = (h - NODE_H) / 2;
    // Stack first-level children evenly along the right column.
    const firstLevelX = rootX + NODE_W + HGAP;
    let cursorY = PADDING;
    const placed = children.map((c) => {
      const subs = c.children || [];
      const blockH = Math.max(NODE_H, subs.length * (CHILD_H + 8) - 8);
      const myY = cursorY + (blockH - NODE_H) / 2;
      const subY0 = cursorY + (blockH - (subs.length * (CHILD_H + 8) - 8)) / 2;
      const subsPlaced = subs.slice(0, 4).map((s, i) => ({
        node: s,
        x: firstLevelX + CHILD_W + HGAP,
        y: subY0 + i * (CHILD_H + 8),
      }));
      const hiddenCount = Math.max(0, subs.length - 4);
      cursorY += blockH + VGAP;
      return {
        node: c,
        x: firstLevelX,
        y: myY,
        children: subsPlaced,
        hiddenCount,
      };
    });
    return { w, h, rootX, rootY, placed };
  }, [map]);

  if (!layout) return null;
  const { w, h, rootX, rootY, placed } = layout;
  return (
    <figure data-testid={testid} className="my-8 rounded-2xl border border-white/10 bg-[#04060f]/70 overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxHeight: height, display: "block" }}>
        {/* edges */}
        {placed.map((p, i) => (
          <g key={`e-${i}`}>
            <Edge x1={rootX + NODE_W} y1={rootY + NODE_H / 2} x2={p.x} y2={p.y + NODE_H / 2} />
            {p.children.map((sp, j) => (
              <Edge
                key={`se-${i}-${j}`}
                x1={p.x + NODE_W} y1={p.y + NODE_H / 2}
                x2={sp.x} y2={sp.y + CHILD_H / 2}
              />
            ))}
          </g>
        ))}
        {/* root */}
        <Node
          x={rootX} y={rootY} w={NODE_W} h={NODE_H}
          title={map.title} fill={map.fill} isRoot
        />
        {/* first-level + grandchildren */}
        {placed.map((p, i) => (
          <g key={`n-${i}`}>
            <Node
              x={p.x} y={p.y} w={NODE_W} h={NODE_H}
              title={p.node.title} fill={p.node.fill}
              link={p.node.link} videoLink={p.node.videoLink}
            />
            {p.children.map((sp, j) => (
              <Node
                key={`sn-${i}-${j}`}
                x={sp.x} y={sp.y} w={CHILD_W} h={CHILD_H}
                title={sp.node.title} fill={sp.node.fill}
                link={sp.node.link} videoLink={sp.node.videoLink}
              />
            ))}
            {p.hiddenCount > 0 && (
              <text
                x={p.x + NODE_W + HGAP + CHILD_W / 2}
                y={p.y + NODE_H + 18}
                textAnchor="middle"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fill="rgba(125,211,252,0.55)"
              >
                +{p.hiddenCount} more
              </text>
            )}
          </g>
        ))}
      </svg>
      {caption && (
        <figcaption className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70 px-4 py-3 border-t border-white/[0.04] bg-white/[0.015]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

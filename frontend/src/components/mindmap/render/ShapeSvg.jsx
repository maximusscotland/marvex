import React from "react";

/**
 * ShapeSvg — renders the geometry for a single map-element shape.
 *
 * Pure SVG primitives, no state, no event handlers.  Every shape returns
 * a stand-alone <ellipse>, <rect>, <polygon>, <path> or grouped <g>
 * suitable to drop directly into a parent <svg> at coords (0,0).
 *
 * Supported shapes (alphabetical):
 *   burst, cloud, cylinder, diamond, document, ellipse, heart, hex,
 *   parallelogram, pill, rect (default), round, speech, star, triangle.
 */
export default function ShapeSvg({ shape, w, h, fill, stroke, strokeWidth = 1.5 }) {
  const pad = 2;
  if (shape === "ellipse") {
    return (
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={w / 2 - pad}
        ry={h / 2 - pad}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === "round") {
    // Heavily-rounded rectangle ("pill" minus the extreme rx) — gentle, friendly.
    return (
      <rect
        x={pad}
        y={pad}
        width={w - 2 * pad}
        height={h - 2 * pad}
        rx={Math.min(20, (h - 2 * pad) / 2)}
        ry={Math.min(20, (h - 2 * pad) / 2)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === "triangle") {
    const pts = [
      [w / 2, pad],
      [w - pad, h - pad],
      [pad, h - pad],
    ].map((p) => p.join(",")).join(" ");
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  if (shape === "star") {
    // 5-pointed star centred in the box.
    const cx = w / 2;
    const cy = h / 2;
    const rOuter = Math.min(w, h) / 2 - pad;
    const rInner = rOuter * 0.42;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)].join(","));
    }
    return <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  if (shape === "heart") {
    const cx = w / 2;
    const top = h * 0.32;
    const bottom = h - pad;
    const left = pad;
    const right = w - pad;
    return (
      <path
        d={`M ${cx} ${bottom}
            C ${left} ${h * 0.6}, ${left} ${pad}, ${cx} ${top}
            C ${right} ${pad}, ${right} ${h * 0.6}, ${cx} ${bottom} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === "speech") {
    // Rounded-rect speech bubble with a tail in the bottom-left quadrant.
    const tailX = w * 0.25;
    const tailW = 18;
    const tailH = 14;
    return (
      <path
        d={`M ${pad + 12} ${pad}
            L ${w - pad - 12} ${pad}
            Q ${w - pad} ${pad}, ${w - pad} ${pad + 12}
            L ${w - pad} ${h - pad - tailH - 12}
            Q ${w - pad} ${h - pad - tailH}, ${w - pad - 12} ${h - pad - tailH}
            L ${tailX + tailW} ${h - pad - tailH}
            L ${tailX} ${h - pad}
            L ${tailX + 4} ${h - pad - tailH}
            L ${pad + 12} ${h - pad - tailH}
            Q ${pad} ${h - pad - tailH}, ${pad} ${h - pad - tailH - 12}
            L ${pad} ${pad + 12}
            Q ${pad} ${pad}, ${pad + 12} ${pad} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === "burst") {
    // 12-point starburst — for emphasis / "POW!" callouts.
    const cx = w / 2;
    const cy = h / 2;
    const rOuter = Math.min(w, h) / 2 - pad;
    const rInner = rOuter * 0.74;
    const pts = [];
    const N = 12;
    for (let i = 0; i < N * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (Math.PI / N) * i - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)].join(","));
    }
    return <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  if (shape === "hex") {
    const pts = [
      [w * 0.12, h / 2], [w * 0.3, pad], [w * 0.7, pad],
      [w * 0.88, h / 2], [w * 0.7, h - pad], [w * 0.3, h - pad],
    ].map((p) => p.join(",")).join(" ");
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  if (shape === "diamond") {
    const pts = [
      [w / 2, pad], [w - pad, h / 2], [w / 2, h - pad], [pad, h / 2],
    ].map((p) => p.join(",")).join(" ");
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  if (shape === "document") {
    const foldX = w - 18;
    const foldY = 16;
    const d = `M ${pad} ${pad} H ${foldX} L ${w - pad} ${foldY} V ${h - pad} H ${pad} Z`;
    return (
      <g>
        <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        <path
          d={`M ${foldX} ${pad} L ${w - pad} ${foldY} L ${foldX} ${foldY} Z`}
          fill="rgba(0,240,255,0.12)"
          stroke={stroke}
          strokeWidth={1}
        />
        <line x1={14} y1={pad + 22} x2={w - 22} y2={pad + 22} stroke={stroke} strokeWidth={0.7} opacity={0.4} />
        <line x1={14} y1={pad + 32} x2={w - 14} y2={pad + 32} stroke={stroke} strokeWidth={0.7} opacity={0.32} />
        <line x1={14} y1={pad + 42} x2={w - 32} y2={pad + 42} stroke={stroke} strokeWidth={0.7} opacity={0.24} />
      </g>
    );
  }
  if (shape === "pill") {
    // Terminator (start/end) — fully rounded rectangle
    const r = Math.min(w, h) / 2 - pad;
    return (
      <rect
        x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad}
        rx={r} ry={r}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === "parallelogram") {
    // Data / input
    const slant = 18;
    const pts = [
      [pad + slant, pad],
      [w - pad, pad],
      [w - pad - slant, h - pad],
      [pad, h - pad],
    ].map((p) => p.join(",")).join(" ");
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  if (shape === "cylinder") {
    // Stored data / database
    const ry = 10;
    return (
      <g>
        <path
          d={`M ${pad} ${pad + ry}
              A ${(w - 2 * pad) / 2} ${ry} 0 0 1 ${w - pad} ${pad + ry}
              L ${w - pad} ${h - pad - ry}
              A ${(w - 2 * pad) / 2} ${ry} 0 0 1 ${pad} ${h - pad - ry}
              Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        <path
          d={`M ${pad} ${pad + ry}
              A ${(w - 2 * pad) / 2} ${ry} 0 0 0 ${w - pad} ${pad + ry}`}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      </g>
    );
  }
  if (shape === "cloud") {
    const cx = w / 2;
    const cy = h / 2;
    // 5-bump cloud path
    return (
      <path
        d={`M ${cx - w * 0.3} ${cy + h * 0.15}
            C ${cx - w * 0.45} ${cy + h * 0.05}, ${cx - w * 0.4} ${cy - h * 0.3}, ${cx - w * 0.15} ${cy - h * 0.25}
            C ${cx - w * 0.1}  ${cy - h * 0.42}, ${cx + w * 0.12} ${cy - h * 0.42}, ${cx + w * 0.18} ${cy - h * 0.25}
            C ${cx + w * 0.4}  ${cy - h * 0.3},  ${cx + w * 0.45} ${cy + h * 0.05}, ${cx + w * 0.3} ${cy + h * 0.15}
            C ${cx + w * 0.42} ${cy + h * 0.3},  ${cx + w * 0.15} ${cy + h * 0.4}, ${cx}         ${cy + h * 0.32}
            C ${cx - w * 0.2}  ${cy + h * 0.42}, ${cx - w * 0.42} ${cy + h * 0.3}, ${cx - w * 0.3} ${cy + h * 0.15} Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  // rect (default)
  return (
    <rect
      x={pad}
      y={pad}
      width={w - 2 * pad}
      height={h - 2 * pad}
      rx={10}
      ry={10}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

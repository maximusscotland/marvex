import React, { useEffect, useRef, useState } from "react";

/**
 * LandingMindMap — organic version with:
 *  - Nebula cloud behind the centre node
 *  - Curved glowing connectors (quadratic Béziers)
 *  - Varied leaf icons per branch (docs · shapes · chip/key/brain · shield/folder/offline)
 *  - Slight positional variation so it doesn't feel like a grid
 *  - Scroll-triggered cascade animation
 */
export default function LandingMindMap() {
  const wrapperRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const W = 1400;
  const H = 800;
  const cx = W / 2;
  const cy = H / 2;

  const branches = [
    {
      title: "PDF → MIND-MAP",
      rect: { x: 360, y: 200 },
      leafSide: "left",
      leaves: [
        { label: "Quick outline (free)", icon: "doc",   pos: { x: 120, y: 80  } },
        { label: "AI deep analysis",     icon: "doc",   pos: { x: 70,  y: 230 } },
        { label: "500 pages · 60s",      icon: "doc",   pos: { x: 150, y: 370 } },
      ],
    },
    {
      title: "INTERACTIVE CANVAS",
      rect: { x: 1060, y: 210 },
      leafSide: "right",
      leaves: [
        { label: "Shapes & colours",   icon: "shapes",  pos: { x: W - 130, y: 80  } },
        { label: "Undo / Redo",        icon: "undo",    pos: { x: W - 70,  y: 230 } },
        { label: "Zoom · Pan · Fit",   icon: "zoom",    pos: { x: W - 140, y: 370 } },
      ],
    },
    {
      title: "AI POWERED",
      rect: { x: 1050, y: 600 },
      leafSide: "right",
      leaves: [
        { label: "Claude Sonnet 4.5",    icon: "brain", pos: { x: W - 150, y: 430 } },
        { label: "Smart structure",      icon: "chip",  pos: { x: W - 80,  y: 570 } },
        { label: "Bring-your-own key",   icon: "key",   pos: { x: W - 140, y: 720 } },
      ],
    },
    {
      title: "LOCAL FIRST",
      rect: { x: 360, y: 590 },
      leafSide: "left",
      leaves: [
        { label: "No cloud lock-in",    icon: "shield",  pos: { x: 140, y: 430 } },
        { label: "Works offline",       icon: "offline", pos: { x: 80,  y: 570 } },
        { label: "Your data, device",   icon: "folder",  pos: { x: 150, y: 720 } },
      ],
    },
  ];

  // Curved-path helper: quadratic Bézier with control point pulled outward
  const curve = (x1, y1, x2, y2, bend = 0.35) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    // perpendicular offset for control point
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const px = -dy / len;
    const py = dx / len;
    const outward = (mx - cx) * 0.002 + (my - cy) * 0.002; // subtle pull away from centre
    const offset = 40 * bend;
    const c1x = mx + px * offset + (mx - cx) * 0.08 * bend;
    const c1y = my + py * offset + (my - cy) * 0.08 * bend;
    void outward;
    return `M ${x1} ${y1} Q ${c1x} ${c1y} ${x2} ${y2}`;
  };

  return (
    <div ref={wrapperRef} className={`relative w-full h-full ${visible ? "mm-in" : "mm-out"}`}>
      <style>{`
        @keyframes mm-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mm-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%      { opacity: 0.95; transform: scale(1.06); }
        }
        @keyframes mm-drift {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .mm-out .mm-group, .mm-out .mm-line { opacity: 0; }
        .mm-in  .mm-group { animation: mm-fade 0.6s cubic-bezier(0.22,1,0.36,1) both; }
        .mm-in  .mm-line  { animation: mm-fade 0.55s cubic-bezier(0.22,1,0.36,1) both; }
        .mm-cloud { transform-origin: center; animation: mm-breathe 7s ease-in-out infinite; }
        .mm-cloud-puff { animation: mm-drift 9s ease-in-out infinite; }
      `}</style>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="mm-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="mm-glow-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="mm-cloud-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
          <radialGradient id="mm-cloud-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#00f0ff" stopOpacity="0.95" />
            <stop offset="45%"  stopColor="#4a7dff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── CLOUD / NEBULA behind centre (visible cyan bloom) ── */}
        <g className="mm-cloud">
          <ellipse
            cx={cx} cy={cy} rx={360} ry={180}
            fill="url(#mm-cloud-grad)"
            filter="url(#mm-cloud-blur)"
          />
        </g>

        {/* ── Decorative cloud clipart puffs scattered around ── */}
        <CloudPuff x={220} y={440} s={70} opacity={0.55} />
        <CloudPuff x={W - 260} y={470} s={80} opacity={0.5} />
        <CloudPuff x={cx - 40} y={140} s={55} opacity={0.35} />
        <CloudPuff x={cx + 80} y={H - 110} s={50} opacity={0.3} />
        <CloudPuff x={700} y={cy + 40} s={42} opacity={0.25} />

        {/* ── Branches ── */}
        {branches.map((b, i) => {
          const { x: rx, y: ry } = b.rect;
          const branchDelay = 0.35 + i * 0.08;
          const leafBaseDelay = 0.85 + i * 0.08;

          // Junction dot roughly 45% along the curve from centre to branch rect
          const jx = cx + (rx - cx) * 0.55;
          const jy = cy + (ry - cy) * 0.55;

          return (
            <g key={i}>
              {/* Centre → branch rect (curved) */}
              <path
                d={curve(cx, cy, rx, ry, 0.5)}
                stroke="#00f0ff" strokeWidth="1.3" fill="none" opacity="0.8"
                filter="url(#mm-glow-soft)"
                className="mm-line"
                style={{ animationDelay: `${branchDelay}s` }}
              />

              {/* Junction dot */}
              <g className="mm-group" style={{ animationDelay: `${branchDelay + 0.18}s` }}>
                <circle cx={jx} cy={jy} r={5} fill="#00f0ff" filter="url(#mm-glow)" />
                <circle cx={jx} cy={jy} r={2} fill="#e8fbff" />
              </g>

              {/* Branch label rect */}
              <g className="mm-group" style={{ animationDelay: `${branchDelay + 0.25}s` }}>
                <BranchRect x={rx} y={ry} label={b.title} />
              </g>

              {/* Leaves */}
              {b.leaves.map((leaf, li) => {
                const { x: lx, y: ly } = leaf.pos;
                const delay = leafBaseDelay + li * 0.1;
                const rightSide = b.leafSide === "right";
                return (
                  <g key={li}>
                    <path
                      d={curve(rx, ry, lx, ly, 0.6)}
                      stroke="#00e1ff" strokeWidth="0.9" fill="none" opacity="0.55"
                      className="mm-line"
                      style={{ animationDelay: `${delay - 0.15}s` }}
                    />
                    <g className="mm-group" style={{ animationDelay: `${delay}s` }}>
                      <circle cx={lx} cy={ly} r={3} fill="#00f0ff" opacity="0.9" />
                      <LeafIcon icon={leaf.icon} x={lx} y={ly} label={leaf.label} rightSide={rightSide} />
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* CENTRE NODE — on top of the cloud */}
        <g className="mm-group" style={{ animationDelay: "0.05s" }}>
          <CoreNode cx={cx} cy={cy} />
        </g>
      </svg>
    </div>
  );
}

// ── CENTRE NODE ─────────────────────────────────────────────
const CoreNode = ({ cx, cy }) => {
  const w = 330; const h = 96;
  return (
    <g filter="url(#mm-glow)">
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h}
            rx={12} ry={12} fill="rgba(4,12,28,0.92)" stroke="#00f0ff" strokeWidth="2" />
      <text x={cx} y={cy - 5} textAnchor="middle" fill="#eaf6ff"
            fontFamily="'Sora', sans-serif" fontSize="22" fontWeight="700" letterSpacing="2">
        MARVEX
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill="#7fe8ff"
            fontFamily="'Sora', sans-serif" fontSize="12" letterSpacing="4">
        — FEATURES
      </text>
    </g>
  );
};

// ── BRANCH RECT ──────────────────────────────────────────────
const BranchRect = ({ x, y, label }) => {
  const w = Math.max(150, label.length * 9 + 32); const h = 38;
  return (
    <g filter="url(#mm-glow-soft)">
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h}
            rx={6} ry={6} fill="#062a4a" stroke="#00f0ff" strokeWidth="1.4" />
      <text x={x} y={y + 4} textAnchor="middle" fill="#eaf6ff"
            fontFamily="'Sora', sans-serif" fontSize="13" fontWeight="600" letterSpacing="1.5">
        {label}
      </text>
    </g>
  );
};

// ── LEAF ICON — dispatches to the correct shape and adds a label below ──
const LeafIcon = ({ icon, x, y, label, rightSide }) => {
  const size = 46; // canvas for the icon
  // position the icon card so its connector point hits x,y on the correct side
  const offX = rightSide ? 18 : -18 - size;
  const ix = x + offX; const iy = y - size / 2;
  return (
    <g>
      <g filter="url(#mm-glow-soft)">
        {icon === "doc"     && <DocIcon     x={ix} y={iy} s={size} />}
        {icon === "shapes"  && <ShapesIcon  x={ix} y={iy} s={size} />}
        {icon === "undo"    && <UndoIcon    x={ix} y={iy} s={size} />}
        {icon === "zoom"    && <ZoomIcon    x={ix} y={iy} s={size} />}
        {icon === "brain"   && <BrainIcon   x={ix} y={iy} s={size} />}
        {icon === "chip"    && <ChipIcon    x={ix} y={iy} s={size} />}
        {icon === "key"     && <KeyIcon     x={ix} y={iy} s={size} />}
        {icon === "shield"  && <ShieldIcon  x={ix} y={iy} s={size} />}
        {icon === "offline" && <OfflineIcon x={ix} y={iy} s={size} />}
        {icon === "folder"  && <FolderIcon  x={ix} y={iy} s={size} />}
      </g>
      <text x={ix + size / 2} y={iy + size + 14} textAnchor="middle"
            fill="#cfdaf3" fontFamily="'Sora', sans-serif" fontSize="10" letterSpacing="0.3">
        {label}
      </text>
    </g>
  );
};

// ── Individual icon primitives (all pure SVG, cyan neon outline) ──
const ICON_STYLE = {
  fill: "rgba(3,14,28,0.85)",
  stroke: "#00f0ff",
  strokeWidth: 1.4,
};

const DocIcon = ({ x, y, s }) => {
  const fold = s * 0.22;
  return (
    <g>
      <path
        d={`M ${x} ${y}
            L ${x + s - fold} ${y}
            L ${x + s} ${y + fold}
            L ${x + s} ${y + s}
            L ${x} ${y + s} Z`}
        {...ICON_STYLE}
      />
      <path d={`M ${x + s - fold} ${y} L ${x + s - fold} ${y + fold} L ${x + s} ${y + fold}`}
            fill="none" stroke="#00f0ff" strokeWidth="1" opacity="0.7" />
      {[0.5, 0.65, 0.8].map((f, i) => (
        <line key={i} x1={x + 6} y1={y + s * f} x2={x + s - 8} y2={y + s * f}
              stroke="#6ad6e8" strokeWidth="0.9" opacity={0.9 - i * 0.2} />
      ))}
    </g>
  );
};

const ShapesIcon = ({ x, y, s }) => {
  // small square + diamond + circle clustered
  const pad = 2;
  return (
    <g>
      <rect x={x + pad} y={y + pad} width={s - pad * 2} height={s - pad * 2} rx={6} ry={6}
            fill="rgba(3,14,28,0.85)" stroke="#00f0ff" strokeWidth="1.2" opacity="0.5" />
      <circle cx={x + s * 0.32} cy={y + s * 0.4} r={s * 0.18} {...ICON_STYLE} />
      <polygon points={`${x + s * 0.7},${y + s * 0.25} ${x + s * 0.88},${y + s * 0.5} ${x + s * 0.7},${y + s * 0.75} ${x + s * 0.52},${y + s * 0.5}`} {...ICON_STYLE} />
      <rect x={x + s * 0.2} y={y + s * 0.62} width={s * 0.3} height={s * 0.2} rx={2} ry={2} {...ICON_STYLE} />
    </g>
  );
};

const UndoIcon = ({ x, y, s }) => {
  const cxp = x + s / 2;
  const cyp = y + s / 2;
  const r = s * 0.3;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={6} ry={6}
            fill="rgba(3,14,28,0.85)" stroke="#00f0ff" strokeWidth="1.2" opacity="0.5" />
      <path d={`M ${cxp - r * 1.2} ${cyp + 2}
                A ${r} ${r} 0 1 1 ${cxp + r} ${cyp + r * 0.2}`}
            fill="none" stroke="#00f0ff" strokeWidth="1.8" strokeLinecap="round" />
      <polyline points={`${cxp - r * 1.2 - 2},${cyp - 4} ${cxp - r * 1.2},${cyp + 2} ${cxp - r * 0.4},${cyp - 2}`}
                fill="none" stroke="#00f0ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

const ZoomIcon = ({ x, y, s }) => {
  const lensR = s * 0.26;
  const lcx = x + s * 0.42;
  const lcy = y + s * 0.42;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={6} ry={6}
            fill="rgba(3,14,28,0.85)" stroke="#00f0ff" strokeWidth="1.2" opacity="0.5" />
      <circle cx={lcx} cy={lcy} r={lensR} fill="none" stroke="#00f0ff" strokeWidth="1.8" />
      <line x1={lcx + lensR * 0.7} y1={lcy + lensR * 0.7} x2={x + s - 7} y2={y + s - 7}
            stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" />
      <line x1={lcx - lensR * 0.45} y1={lcy} x2={lcx + lensR * 0.45} y2={lcy}
            stroke="#7fe8ff" strokeWidth="1.2" />
      <line x1={lcx} y1={lcy - lensR * 0.45} x2={lcx} y2={lcy + lensR * 0.45}
            stroke="#7fe8ff" strokeWidth="1.2" />
    </g>
  );
};

const BrainIcon = ({ x, y, s }) => {
  // sparkle / neural node cluster
  const pts = [
    [s * 0.3, s * 0.3], [s * 0.7, s * 0.3],
    [s * 0.2, s * 0.55], [s * 0.5, s * 0.5], [s * 0.82, s * 0.55],
    [s * 0.35, s * 0.78], [s * 0.68, s * 0.78],
  ];
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={6} ry={6}
            fill="rgba(3,14,28,0.85)" stroke="#00f0ff" strokeWidth="1.2" opacity="0.5" />
      {/* connecting lines (neural) */}
      {[
        [0, 1], [0, 3], [1, 3], [0, 2], [1, 4], [2, 5], [3, 5], [3, 6], [4, 6],
      ].map(([a, b], i) => (
        <line key={i}
          x1={x + pts[a][0]} y1={y + pts[a][1]}
          x2={x + pts[b][0]} y2={y + pts[b][1]}
          stroke="#00e1ff" strokeWidth="0.9" opacity="0.75" />
      ))}
      {pts.map(([px, py], i) => (
        <circle key={i} cx={x + px} cy={y + py} r={2.5} fill="#00f0ff" filter="url(#mm-glow-soft)" />
      ))}
    </g>
  );
};

const ChipIcon = ({ x, y, s }) => {
  const inner = s * 0.5;
  const ix = x + s / 2 - inner / 2;
  const iy = y + s / 2 - inner / 2;
  const pins = [0.25, 0.5, 0.75];
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={6} ry={6}
            fill="rgba(3,14,28,0.85)" stroke="#00f0ff" strokeWidth="1.2" opacity="0.5" />
      <rect x={ix} y={iy} width={inner} height={inner} rx={3} ry={3} {...ICON_STYLE} />
      <text x={x + s / 2} y={y + s / 2 + 3} textAnchor="middle" fill="#00f0ff"
            fontFamily="'Sora', monospace" fontSize="7" letterSpacing="1">AI</text>
      {pins.map((f, i) => (
        <g key={i}>
          <line x1={ix} y1={iy + inner * f} x2={ix - 4} y2={iy + inner * f} stroke="#00f0ff" strokeWidth="1" />
          <line x1={ix + inner} y1={iy + inner * f} x2={ix + inner + 4} y2={iy + inner * f} stroke="#00f0ff" strokeWidth="1" />
          <line x1={ix + inner * f} y1={iy} x2={ix + inner * f} y2={iy - 4} stroke="#00f0ff" strokeWidth="1" />
          <line x1={ix + inner * f} y1={iy + inner} x2={ix + inner * f} y2={iy + inner + 4} stroke="#00f0ff" strokeWidth="1" />
        </g>
      ))}
    </g>
  );
};

const KeyIcon = ({ x, y, s }) => {
  const headCx = x + s * 0.3;
  const headCy = y + s / 2;
  const headR = s * 0.18;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={6} ry={6}
            fill="rgba(3,14,28,0.85)" stroke="#00f0ff" strokeWidth="1.2" opacity="0.5" />
      <circle cx={headCx} cy={headCy} r={headR} fill="none" stroke="#00f0ff" strokeWidth="1.8" />
      <circle cx={headCx} cy={headCy} r={headR * 0.4} fill="#00f0ff" />
      <line x1={headCx + headR} y1={headCy} x2={x + s - 6} y2={headCy}
            stroke="#00f0ff" strokeWidth="1.8" strokeLinecap="round" />
      {/* teeth */}
      <line x1={x + s - 16} y1={headCy} x2={x + s - 16} y2={headCy + 6}
            stroke="#00f0ff" strokeWidth="1.8" strokeLinecap="round" />
      <line x1={x + s - 9} y1={headCy} x2={x + s - 9} y2={headCy + 8}
            stroke="#00f0ff" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
};

const ShieldIcon = ({ x, y, s }) => {
  return (
    <g>
      <path
        d={`M ${x + s / 2} ${y + 4}
            L ${x + s - 6} ${y + 12}
            L ${x + s - 6} ${y + s * 0.55}
            Q ${x + s - 6} ${y + s - 4} ${x + s / 2} ${y + s - 2}
            Q ${x + 6} ${y + s - 4} ${x + 6} ${y + s * 0.55}
            L ${x + 6} ${y + 12} Z`}
        {...ICON_STYLE}
      />
      <polyline
        points={`${x + s * 0.35},${y + s * 0.5} ${x + s * 0.47},${y + s * 0.62} ${x + s * 0.7},${y + s * 0.38}`}
        fill="none" stroke="#00f0ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
    </g>
  );
};

const OfflineIcon = ({ x, y, s }) => {
  const cxp = x + s / 2;
  const cyp = y + s * 0.55;
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={s - 2} height={s - 2} rx={6} ry={6}
            fill="rgba(3,14,28,0.85)" stroke="#00f0ff" strokeWidth="1.2" opacity="0.5" />
      {/* wifi arcs */}
      <path d={`M ${cxp - 14} ${cyp - 10} Q ${cxp} ${cyp - 20} ${cxp + 14} ${cyp - 10}`}
            fill="none" stroke="#00f0ff" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M ${cxp - 9} ${cyp - 4} Q ${cxp} ${cyp - 11} ${cxp + 9} ${cyp - 4}`}
            fill="none" stroke="#00f0ff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx={cxp} cy={cyp + 2} r="2.2" fill="#00f0ff" />
      {/* slash */}
      <line x1={x + 7} y1={y + 7} x2={x + s - 7} y2={y + s - 7}
            stroke="#ff5577" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
};

const FolderIcon = ({ x, y, s }) => {
  const top = y + s * 0.22;
  return (
    <g>
      <path
        d={`M ${x + 4} ${top}
            L ${x + s * 0.4} ${top}
            L ${x + s * 0.48} ${top - s * 0.1}
            L ${x + s - 4} ${top - s * 0.1}
            L ${x + s - 4} ${y + s - 4}
            L ${x + 4} ${y + s - 4} Z`}
        {...ICON_STYLE}
      />
      <line x1={x + 6} y1={top + 10} x2={x + s - 6} y2={top + 10}
            stroke="#6ad6e8" strokeWidth="0.9" opacity="0.6" />
    </g>
  );
};

// ── CLOUD CLIPART PUFF — stylised cartoon cloud shape ──
const CloudPuff = ({ x, y, s, opacity = 0.5 }) => {
  // Classic "4-bump" cloud shape built with overlapping circles + a flat bottom rect
  const r1 = s * 0.38;
  const r2 = s * 0.5;
  const r3 = s * 0.42;
  const r4 = s * 0.3;
  return (
    <g opacity={opacity} className="mm-cloud-puff">
      <g filter="url(#mm-glow-soft)">
        {/* soft fill */}
        <circle cx={x + s * 0.25} cy={y + s * 0.55} r={r1} fill="rgba(0,210,255,0.18)" />
        <circle cx={x + s * 0.5}  cy={y + s * 0.4}  r={r2} fill="rgba(0,210,255,0.2)" />
        <circle cx={x + s * 0.78} cy={y + s * 0.52} r={r3} fill="rgba(0,210,255,0.18)" />
        <circle cx={x + s * 0.95} cy={y + s * 0.62} r={r4} fill="rgba(0,210,255,0.16)" />
        <rect x={x + s * 0.2} y={y + s * 0.55} width={s * 0.7} height={s * 0.3}
              fill="rgba(0,210,255,0.18)" />
        {/* neon outline */}
        <circle cx={x + s * 0.25} cy={y + s * 0.55} r={r1} fill="none" stroke="#00f0ff" strokeWidth="1.2" />
        <circle cx={x + s * 0.5}  cy={y + s * 0.4}  r={r2} fill="none" stroke="#00f0ff" strokeWidth="1.2" />
        <circle cx={x + s * 0.78} cy={y + s * 0.52} r={r3} fill="none" stroke="#00f0ff" strokeWidth="1.2" />
        <circle cx={x + s * 0.95} cy={y + s * 0.62} r={r4} fill="none" stroke="#00f0ff" strokeWidth="1.2" />
        <line x1={x + s * 0.1} y1={y + s * 0.85} x2={x + s * 1.0} y2={y + s * 0.85}
              stroke="#00f0ff" strokeWidth="1.2" />
      </g>
    </g>
  );
};

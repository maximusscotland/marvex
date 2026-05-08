/**
 * Flowchart studio shape palette and seed flowchart.
 *
 * The shapes here are a subset of the broader ShapeSvg library
 * (see frontend/src/components/mindmap/render/ShapeSvg.jsx) — chosen
 * to match standard ANSI/ISO 5807 + BPMN flowchart semantics so the
 * output looks like a "real" flowchart rather than a coloured mind-map.
 *
 * One palette entry per shape:
 *   { id, label, shape, fill, stroke, sub }
 * Where `shape` is the key understood by ShapeSvg, and `sub` is a
 * one-line user-facing description shown as a tooltip in the
 * Add-shape menu.
 */
export const FLOWCHART_SHAPES = [
  { id: "process",   label: "Process",       shape: "rect",          fill: "rgba(0,240,255,0.10)",  stroke: "#00f0ff", sub: "An action or operation" },
  { id: "decision",  label: "Decision",      shape: "diamond",       fill: "rgba(245,158,11,0.10)", stroke: "#f59e0b", sub: "Yes / no question" },
  { id: "terminator",label: "Start / End",   shape: "pill",          fill: "rgba(16,185,129,0.10)", stroke: "#10b981", sub: "Marks where the flow begins or ends" },
  { id: "io",        label: "Input / Output",shape: "parallelogram", fill: "rgba(167,139,250,0.10)",stroke: "#a78bfa", sub: "Data going in or coming out" },
  { id: "subprocess",label: "Subprocess",    shape: "hex",           fill: "rgba(244,114,182,0.10)",stroke: "#f472b6", sub: "Predefined or named process" },
  { id: "document",  label: "Document",      shape: "document",      fill: "rgba(0,240,255,0.08)",  stroke: "#67e8f9", sub: "Printed or written report" },
  { id: "database",  label: "Database",      shape: "cylinder",      fill: "rgba(56,189,248,0.10)", stroke: "#38bdf8", sub: "Stored data" },
  { id: "connector", label: "Connector",     shape: "ellipse",       fill: "rgba(148,163,184,0.10)",stroke: "#94a3b8", sub: "Off-page jump or rejoin" },
  { id: "note",      label: "Note",          shape: "speech",        fill: "rgba(253,224,71,0.10)", stroke: "#fde047", sub: "Comment or annotation" },
];

export const FLOWCHART_SHAPE_BY_ID = FLOWCHART_SHAPES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

/**
 * Generate a stable random-ish ID. Same approach the rest of the codebase
 * uses (see lib/storage.js newNodeId) — we stay independent so this lib
 * has no side imports.
 */
const rid = (prefix = "n") =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(-5)}`;

/**
 * Seed flowchart shown the first time a user opens Flowchart Studio.
 *
 * Composition (per user's spec — kept short and unintimidating):
 *   Start  →  Input  →  Process  →  Decision  →  End
 *
 * Five nodes total: a Start terminator (the map root, sitting dead-centre
 * of the canvas due to the canvas auto-centring on initial load), three
 * "in-between" shapes that show off the ANSI-flowchart vocabulary
 * (Input/Output, Process, Decision), and a closing End terminator. Each
 * shape uses its dedicated palette colour so the user instantly grasps
 * "different shape = different role" without reading any docs.
 *
 * Why these three middles? They cover ~80% of real-world flowchart use:
 *  - Input/Output: data entering or leaving the flow
 *  - Process:      the work the system actually does
 *  - Decision:     the branching gate that makes a flowchart a flowchart
 * The user can grow the chart from any of these via Tab / right-click,
 * and add the other 6 palette shapes (subprocess, document, database,
 * connector, note, terminator) on demand.
 *
 * The map ROOT itself is the Start node — that's how the rest of the
 * codebase models centre-of-canvas: `map.title` is rendered as the
 * central node label, so we set it to "Start" + use the terminator
 * shape so it visually reads as the entry point.
 */
export const blankFlowchart = () => {
  const inputId = rid("flow");
  const processId = rid("flow");
  const decisionId = rid("flow");
  const endId = rid("flow");

  const mk = (id, palette, titleOverride) => {
    const s = FLOWCHART_SHAPE_BY_ID[palette];
    return {
      id,
      title: titleOverride || s.label,
      shape: s.shape,
      fill: s.fill,
      stroke: s.stroke,
      flowchartShape: palette,
      children: [],
    };
  };

  return {
    id: rid("flowmap"),
    title: "Start",
    flowchart: true,
    isFlowchart: true,
    shape: FLOWCHART_SHAPE_BY_ID.terminator.shape,
    fill: FLOWCHART_SHAPE_BY_ID.terminator.fill,
    stroke: FLOWCHART_SHAPE_BY_ID.terminator.stroke,
    flowchartShape: "terminator",
    // Linear chain so the chart reads top-to-bottom like every flowchart
    // they've ever seen. Each child has exactly ONE child of its own —
    // the canvas's existing auto-layout handles the spacing/columns so
    // the result is centred and breathable on first paint.
    children: [
      {
        ...mk(inputId, "io", "Input"),
        children: [
          {
            ...mk(processId, "process", "Process"),
            children: [
              {
                ...mk(decisionId, "decision", "Decision"),
                children: [
                  { ...mk(endId, "terminator", "End") },
                ],
              },
            ],
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Heuristic — does a saved map look like a flowchart? Used by
 * Library / Sidebar to badge it accordingly. Cheap check.
 */
export const isFlowchartMap = (m) => !!(m && (m.isFlowchart || m.flowchart));

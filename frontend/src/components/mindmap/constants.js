/**
 * Mind-map canvas constants.
 *
 * Pulled out of `MindMapCanvas.jsx` so renderer, layout, and tree-mutation
 * code can share defaults without dragging the whole canvas component into
 * test environments.  Pure values only — no React, no DOM access.
 */

export const DEFAULT_FILL = "rgba(3,14,28,0.85)";
export const DEFAULT_STROKE = "#00e1ff";
export const DEFAULT_ROOT_FILL = "rgba(3,20,36,0.85)";
export const DEFAULT_ROOT_STROKE = "#00f0ff";
export const DEFAULT_EDGE_COLOR = "#00f0ff";
export const DEFAULT_EDGE_WIDTH = 1.1;

export const DEFAULT_SIZES = {
  rect: [176, 52],
  ellipse: [170, 70],
  hex: [180, 64],
  diamond: [170, 90],
  document: [140, 78],
  pill: [176, 52],
  parallelogram: [176, 60],
  cylinder: [150, 76],
  cloud: [170, 84],
};
export const ROOT_SIZE = [230, 78];
export const MIN_W = 80;
export const MIN_H = 36;

// Free-tier cap on map element count — surfaces in toasts and upgrade copy.
export const FREE_NODE_CAP = 30;

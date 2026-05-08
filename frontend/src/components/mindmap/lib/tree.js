/**
 * Pure tree + layout helpers for the mind-map canvas.
 *
 * Extracted from `MindMapCanvas.jsx` so they can be reused by the PNG
 * exporter, document compiler, future tests, etc. without bringing the
 * 2.5K-line canvas component along for the ride. No React imports — keeps
 * this module trivially mockable from a Node test runner.
 */

import { DEFAULT_SIZES, ROOT_SIZE } from "@/components/mindmap/constants";

/**
 * Compute {w,h} for a map element given its overrides + role.
 *
 * For non-root elements we auto-grow width/height with title length so a
 * long heading from a PDF doesn't get truncated awkwardly.  Manual
 * width/height overrides on the node always win.
 */
export const sizeOf = (node, isRoot) => {
  const shape = node.shape || (isRoot ? "rect" : "ellipse");
  const [dw, dh] = isRoot ? ROOT_SIZE : (DEFAULT_SIZES[shape] || DEFAULT_SIZES.rect);
  if (node.width || node.height) {
    return { w: node.width || dw, h: node.height || dh };
  }
  if (isRoot) return { w: dw, h: dh };
  const title = (node.title || "").trim();
  const len = title.length;
  if (len <= 14) return { w: dw, h: dh };
  // Aim for 2 lines max before growing width.
  const extraChars = len - 14;
  const widthBoost = Math.min(110, Math.round(extraChars * 4.2));
  const lines = Math.ceil((len + widthBoost / 4) / 24);
  const heightBoost = Math.min(40, (lines - 1) * 16);
  return { w: dw + widthBoost, h: dh + heightBoost };
};

/**
 * Radial layout: returns `{ [id]: {x, y} }`.
 * Children fan out around their parent; deeper levels push further away
 * with a "crowdBoost" that widens the arc when many siblings exist.
 */
export const computeLayout = (root) => {
  const positions = {};
  positions[root.id] = { x: 0, y: 0 };

  const placeChildren = (node, parentX, parentY, baseAngle, angleSpread, depth, baseRadius) => {
    const children = node.children || [];
    if (children.length === 0) return;
    const crowdBoost = Math.max(0, children.length - 4) * 14;
    const radius = baseRadius + depth * 70 + crowdBoost;
    const spread = Math.min(Math.PI * 1.6, angleSpread + Math.max(0, children.length - 4) * 0.12);
    const startAngle = baseAngle - spread / 2;
    const step = children.length === 1 ? 0 : spread / (children.length - 1);
    children.forEach((child, i) => {
      const angle = children.length === 1 ? baseAngle : startAngle + step * i;
      const x = parentX + Math.cos(angle) * radius;
      const y = parentY + Math.sin(angle) * radius;
      positions[child.id] = { x, y };
      const sub = Math.atan2(y - parentY, x - parentX);
      placeChildren(child, x, y, sub, Math.PI / 2.2, depth + 1, 100);
    });
  };

  const rootChildren = root.children || [];
  // Scale initial radius with number of top-level branches.
  const initialRadius = Math.max(300, 260 + rootChildren.length * 12);
  const stepAngle = (Math.PI * 2) / Math.max(rootChildren.length, 1);
  rootChildren.forEach((child, i) => {
    const angle = -Math.PI / 2 + stepAngle * i;
    const x = Math.cos(angle) * initialRadius;
    const y = Math.sin(angle) * initialRadius;
    positions[child.id] = { x, y };
    placeChildren(child, x, y, angle, Math.PI / 1.5, 1, 120);
  });

  return positions;
};

// -------- TREE HELPERS --------

/** DFS visitor: `fn(node, depth, parent)` for every map element. */
export const walk = (node, fn, depth = 0, parent = null) => {
  fn(node, depth, parent);
  (node.children || []).forEach((c) => walk(c, fn, depth + 1, node));
};

/**
 * Immutable update: deep-clone the tree, run `updater(node)` on the matching
 * id, return the clone.  We early-return after the first match so deeply
 * nested trees don't pay for the rest of the traversal.
 */
export const findAndUpdate = (root, id, updater) => {
  const clone = JSON.parse(JSON.stringify(root));
  let found = false;
  const recur = (n) => {
    if (found) return;
    if (n.id === id) { updater(n); found = true; return; }
    (n.children || []).forEach(recur);
  };
  recur(clone);
  return clone;
};

/** Immutable remove of any descendant with the given id. */
export const findAndRemove = (root, id) => {
  const clone = JSON.parse(JSON.stringify(root));
  const recur = (n) => {
    n.children = (n.children || []).filter((c) => c.id !== id);
    n.children.forEach(recur);
  };
  recur(clone);
  return clone;
};

/**
 * Generate a fresh map-element id.  Format is intentionally human-friendly
 * (`n_<base36-time>_<rand>`) so we can spot newly-added elements in dev
 * tools without firing up a debugger.
 */
export const newNodeId = () =>
  `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

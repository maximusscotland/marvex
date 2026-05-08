/**
 * Per-link share visibility.
 *
 * Each map can carry a `linkVisibility` map of `{ [nodeId]: false }` (an
 * opt-OUT model — anything not in the dict is treated as visible).  Before
 * we build a public artefact (share snapshot, SVG, PDF, Markdown export)
 * we run `applyLinkVisibility` to clone the tree with the disabled links
 * stripped at source.  Stripping > flagging: the URL never reaches the
 * recipient even if they view-source the artefact.
 *
 * The helpers are extracted into their own file (rather than living in
 * exportPng.js) so the share endpoint code paths and the export paths can
 * both depend on the same single source of truth.
 */

/** Recursively count map elements that have a (non-empty) link. */
export const countLinks = (node) => {
  if (!node) return 0;
  let n = node.link ? 1 : 0;
  for (const c of node.children || []) n += countLinks(c);
  return n;
};

/**
 * Walk the tree and yield `{ id, title, link }` for each map element with a
 * link.  Caller uses this to render a tickbox per row in the visibility
 * picker.  Skips empty / falsy links so the picker doesn't show useless
 * rows for elements where the user once attached a link and then cleared it.
 */
export const collectLinkedNodes = (root) => {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.link && typeof node.link === "string" && node.link.trim()) {
      out.push({ id: node.id, title: node.title || "Untitled", link: node.link });
    }
    for (const c of node.children || []) walk(c);
  };
  walk(root);
  return out;
};

/**
 * Return a deep clone of `map` with `node.link` deleted on any map element
 * whose id is opted-out in `linkVisibility`.  We deep-clone with
 * `structuredClone` (or JSON-fallback) so the caller can hand the result
 * to the share API or an exporter without worrying about it mutating the
 * user's local map.
 *
 * We also delete `linkVisibility` from the returned object so the share
 * snapshot never carries the user's private opt-out config.
 */
export const applyLinkVisibility = (map) => {
  if (!map) return map;
  const vis = map.linkVisibility || {};
  // Fast path: no opt-outs → nothing to strip, but still clone shallowly so
  // callers can mutate freely.
  const clone =
    typeof structuredClone === "function"
      ? structuredClone(map)
      : JSON.parse(JSON.stringify(map));
  delete clone.linkVisibility;
  // Nothing opted out? Skip the walk.
  if (!Object.values(vis).some((v) => v === false)) return clone;
  const strip = (node) => {
    if (!node) return;
    if (node.id && vis[node.id] === false) {
      delete node.link;
    }
    for (const c of node.children || []) strip(c);
  };
  strip(clone);
  return clone;
};

/**
 * Convenience: toggle visibility for a single node id, returning a new
 * `linkVisibility` object the caller can splat onto the map.  Stores the
 * opt-OUT only — implicit ON is the absence of a key, so the dict stays
 * small even on big maps.
 */
export const toggleLinkVisibility = (current, nodeId, visible) => {
  const next = { ...(current || {}) };
  if (visible) {
    delete next[nodeId];           // implicit "visible"
  } else {
    next[nodeId] = false;          // explicit opt-out
  }
  return next;
};

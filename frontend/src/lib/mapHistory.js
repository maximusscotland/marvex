/**
 * Per-map version ring buffer (cap 10 per map). Used by cloud sync to
 * snapshot the LOCAL version BEFORE overwriting it with a server winner,
 * so the user can tap Undo to roll back.
 *
 * Storage: localStorage key `mindmapper.mapHistory.v1`
 * Shape:
 *   {
 *     [mapId]: [
 *       { ts: epoch_ms, data: <full map JSON> },   // newest first
 *       …
 *     ]
 *   }
 *
 * Discipline:
 *   - Only the cloud-sync path pushes snapshots. Regular user edits do
 *     NOT go through here (that's what the saveMap auto-save + tombstones
 *     already cover).
 *   - Cap = 10 per map. Oldest is dropped on overflow.
 *   - popSnapshot() returns + removes; getSnapshot() returns a copy w/o mutating.
 *   - We never store the current (post-sync) state — only the BEFORE copy.
 */

const KEY = "mindmapper.mapHistory.v1";
const CAP_PER_MAP = 10;

const readAll = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch { return {}; }
};

const writeAll = (obj) => {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* quota */ }
};

/**
 * Push a BEFORE snapshot of a map onto the ring. Call this IMMEDIATELY
 * before overwriting local state with a server winner.
 */
export const pushSnapshot = (mapId, data) => {
  if (!mapId || !data) return;
  const all = readAll();
  const arr = Array.isArray(all[mapId]) ? all[mapId] : [];
  arr.unshift({ ts: Date.now(), data: JSON.parse(JSON.stringify(data)) });
  all[mapId] = arr.slice(0, CAP_PER_MAP);
  writeAll(all);
};

/**
 * Return (without removing) the newest snapshot for a map, or null.
 */
export const peekSnapshot = (mapId) => {
  if (!mapId) return null;
  const arr = readAll()[mapId];
  return Array.isArray(arr) && arr.length ? arr[0] : null;
};

/**
 * Pop (return + remove) the newest snapshot — used when the user taps
 * Undo on a sync-pull toast. Returns null if nothing to roll back.
 */
export const popSnapshot = (mapId) => {
  if (!mapId) return null;
  const all = readAll();
  const arr = Array.isArray(all[mapId]) ? all[mapId] : [];
  if (!arr.length) return null;
  const [head, ...rest] = arr;
  if (rest.length) all[mapId] = rest;
  else delete all[mapId];
  writeAll(all);
  return head;
};

export const hasSnapshot = (mapId) => !!peekSnapshot(mapId);

export const clearHistoryFor = (mapId) => {
  if (!mapId) return;
  const all = readAll();
  delete all[mapId];
  writeAll(all);
};

export const countSnapshots = (mapId) => {
  const arr = readAll()[mapId];
  return Array.isArray(arr) ? arr.length : 0;
};

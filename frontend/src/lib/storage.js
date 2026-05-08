// Local-first persistence for mind maps (zero cloud).
const KEY = "mindmapper.maps.v1";

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    // QuotaExceededError — usually triggered by large image annotations/backgrounds.
    const isQuota =
      err &&
      (err.name === "QuotaExceededError" ||
        err.code === 22 ||
        /quota/i.test(err.message || ""));
    const wrapped = new Error(
      isQuota
        ? "Your browser is out of storage — try removing large images from this map."
        : "Could not save map to local storage."
    );
    wrapped.name = isQuota ? "QuotaExceededError" : "StorageError";
    throw wrapped;
  }
};

export const listMaps = () => {
  const all = read();
  // newest first
  return [...all].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
};

export const getMap = (id) => read().find((m) => m.id === id) || null;

export const saveMap = (map) => {
  const all = read();
  const idx = all.findIndex((m) => m.id === map.id);
  const next = { ...map, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = next;
  else all.push({ ...next, createdAt: Date.now() });
  try {
    write(all);
  } catch (err) {
    // Surface to caller so the UI can toast. Callers already handle (or ignore).
    throw err;
  }
  return next;
};

export const deleteMap = (id) => {
  write(read().filter((m) => m.id !== id));
  // Queue a tombstone so the next cloud sync can DELETE this map server-side.
  // cloudSync.js reads the same key. Fire-and-forget; failure is non-fatal.
  try {
    const TOMB_KEY = "mindmapper.cloudSync.tombstones.v1";
    const raw = localStorage.getItem(TOMB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(arr) ? arr : []);
    set.add(id);
    localStorage.setItem(TOMB_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
};

export const newId = () =>
  `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Default map rendered the first time the studio is opened.
 * "Map Title" in the centre + 5 elliptical offshoots.
 *
 * Accepts an optional `t` function (react-i18next) so seed-node titles
 * render in the user's language. Falls back to English if i18n hasn't
 * initialised yet (e.g. module-level unit-test imports).
 */
export const buildDefaultMap = (t = null) => {
  const tr = (key, fallback) => (t ? t(key, { defaultValue: fallback }) : fallback);
  return {
    id: newId(),
    title: tr("studio.defaults.coreConcept", "Map Title"),
    summary: "",
    shape: "rect",
    fill: "rgba(3,20,36,0.85)",
    stroke: "#00f0ff",
    fontSize: 16,
    children: [
      { id: "c1", title: tr("studio.defaults.ideaOne",   "Idea One"),   shape: "ellipse", fill: "rgba(3,14,28,0.85)", stroke: "#00e1ff", children: [] },
      { id: "c2", title: tr("studio.defaults.ideaTwo",   "Idea Two"),   shape: "ellipse", fill: "rgba(3,14,28,0.85)", stroke: "#00e1ff", children: [] },
      { id: "c3", title: tr("studio.defaults.ideaThree", "Idea Three"), shape: "ellipse", fill: "rgba(3,14,28,0.85)", stroke: "#00e1ff", children: [] },
      { id: "c4", title: tr("studio.defaults.ideaFour",  "Idea Four"),  shape: "ellipse", fill: "rgba(3,14,28,0.85)", stroke: "#00e1ff", children: [] },
      { id: "c5", title: tr("studio.defaults.ideaFive",  "Idea Five"),  shape: "ellipse", fill: "rgba(3,14,28,0.85)", stroke: "#00e1ff", children: [] },
    ],
  };
};

export const ensureDefaultMap = (t = null) => {
  const all = listMaps();
  if (all.length > 0) return all[0];
  const m = buildDefaultMap(t);
  saveMap(m);
  return m;
};

// --- Recently opened ---
const RECENTS_KEY = "mindmapper.recents.v1";
const RECENTS_CAP = 10;

export const getRecents = () => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const addToRecents = (id) => {
  if (!id) return;
  const cur = getRecents().filter((x) => x !== id);
  const next = [id, ...cur].slice(0, RECENTS_CAP);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
};

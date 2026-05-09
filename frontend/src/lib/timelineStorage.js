/**
 * Timeline storage — local-first persistence for Marvex Studio
 * timelines, mirroring the `mindmapper.maps.v1` pattern in storage.js.
 *
 * A timeline lives in localStorage as a flat array of objects under
 * key "marvex.timelines.v1". Each timeline is a self-contained doc:
 *
 *   {
 *     id, title, type: 'timeline',
 *     createdAt, updatedAt,
 *     // Scope = the time window the canvas spans
 *     scope: {
 *       startISO,        // earliest visible date (ISO 8601)
 *       endISO,          // latest visible date — null means open-ended
 *       unit,            // 'years' | 'months' | 'weeks' | 'days' | 'hours'
 *     },
 *     categories: [{ id, name, color }],
 *     events: [{
 *       id, label, dateISO,
 *       categoryId,           // pointer into categories
 *       position: 'above'|'below',  // visual differentiation
 *       lane,                 // integer >=0, computed lane offset for stacking
 *       icon?, link?, linkLabel?, note?
 *     }],
 *     // Pan + zoom state (1D — only horizontal)
 *     view: { x, k },
 *   }
 */

const KEY = "marvex.timelines.v1";

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
    const isQuota =
      err &&
      (err.name === "QuotaExceededError" ||
        err.code === 22 ||
        /quota/i.test(err.message || ""));
    const wrapped = new Error(
      isQuota
        ? "Your browser is out of storage — try removing this timeline's link attachments or unused categories."
        : "Could not save timeline to local storage.",
    );
    wrapped.name = isQuota ? "QuotaExceededError" : "StorageError";
    throw wrapped;
  }
};

export const listTimelines = () => {
  // Sort by updatedAt desc so /library shows the most recently edited first.
  return read().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
};

export const getTimeline = (id) => read().find((t) => t.id === id) || null;

export const saveTimeline = (timeline) => {
  if (!timeline || !timeline.id) throw new Error("timeline.id is required");
  const list = read();
  const idx = list.findIndex((t) => t.id === timeline.id);
  const next = { ...timeline, type: "timeline", updatedAt: Date.now() };
  if (idx === -1) list.push(next);
  else list[idx] = next;
  write(list);
  return next;
};

export const deleteTimeline = (id) => {
  write(read().filter((t) => t.id !== id));
};

const newId = (prefix = "tl") =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const newTimelineId = () => newId("tl");
export const newEventId = () => newId("ev");
export const newCategoryId = () => newId("cat");

/**
 * Create a fresh blank timeline with a sensible starter category set.
 * Called by the create-dialog after the user provides title + scope.
 */
export const blankTimeline = ({ title, startISO, endISO, unit }) => {
  const now = Date.now();
  return {
    id: newTimelineId(),
    type: "timeline",
    title: title || "Untitled timeline",
    createdAt: now,
    updatedAt: now,
    scope: {
      startISO,
      endISO: endISO || null,
      unit: unit || "months",
    },
    // Default 4-colour category palette tuned for the cosmic-dark UI.
    categories: [
      { id: newCategoryId(), name: "Category A", color: "#00f0ff" }, // cyan
      { id: newCategoryId(), name: "Category B", color: "#ff6ad5" }, // fuchsia
      { id: newCategoryId(), name: "Category C", color: "#a08cff" }, // violet
      { id: newCategoryId(), name: "Category D", color: "#ffd66b" }, // amber
    ],
    events: [],
    view: { x: 0, k: 1 },
  };
};

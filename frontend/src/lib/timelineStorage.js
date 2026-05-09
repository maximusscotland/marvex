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
 * Built-in "designation" templates used by TimelineCreateDialog to
 * pre-seed sensibly-named categories. Each entry is just a list of
 * category names — colours are layered on top from the chosen palette
 * at create-time so a Student timeline in the Sunrise palette and a
 * Project timeline in the Forest palette stay visually consistent.
 */
export const TIMELINE_TEMPLATES = {
  student:      { label: "Student",      categories: ["Lectures", "Coursework", "Exams", "Personal"] },
  professional: { label: "Professional", categories: ["Projects", "Meetings", "Deadlines", "Travel"] },
  historian:    { label: "Historian",    categories: ["Politics", "Culture", "Science", "Conflict"] },
  personal:     { label: "Personal",     categories: ["Health", "Family", "Finance", "Travel"] },
  project:      { label: "Project",      categories: ["Discovery", "Build", "Test", "Launch"] },
  custom:       { label: "Custom",       categories: ["Category A", "Category B", "Category C", "Category D"] },
};

/**
 * Pre-built colour palettes for the timeline create dialog. Each is a
 * 5-stop palette tuned for the cosmic dark UI. The first 1-N entries
 * are sliced as-needed depending on how many categories the user picked.
 */
export const TIMELINE_PALETTES = {
  cosmic:  { label: "Cosmic",  colors: ["#00f0ff", "#ff6ad5", "#a08cff", "#ffd66b", "#76ff9d"] },
  sunrise: { label: "Sunrise", colors: ["#ff8a65", "#ffb74d", "#ffd54f", "#ec407a", "#ff6f91"] },
  forest:  { label: "Forest",  colors: ["#66bb6a", "#26a69a", "#cddc39", "#8d6e63", "#43a047"] },
  ocean:   { label: "Ocean",   colors: ["#4dd0e1", "#5c6bc0", "#7986cb", "#42a5f5", "#26c6da"] },
  mono:    { label: "Mono",    colors: ["#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569"] },
};

/**
 * Build a category list from a designation + palette + count combo.
 * Used by both `blankTimeline` and the create dialog's live preview.
 */
export const buildCategoriesFromTemplate = ({
  designation = "custom",
  paletteId = "cosmic",
  count = 4,
} = {}) => {
  const tpl = TIMELINE_TEMPLATES[designation] || TIMELINE_TEMPLATES.custom;
  const palette = (TIMELINE_PALETTES[paletteId] || TIMELINE_PALETTES.cosmic).colors;
  const n = Math.max(1, Math.min(8, count));
  const out = [];
  for (let i = 0; i < n; i++) {
    const name = tpl.categories[i] || `Category ${String.fromCharCode(65 + i)}`;
    const color = palette[i % palette.length];
    out.push({ id: newCategoryId(), name, color });
  }
  return out;
};

/**
 * Create a fresh blank timeline with a sensible starter category set.
 * Called by the create-dialog after the user provides title + scope.
 *
 * Optional `categories` — caller-supplied pre-seeded list (used by the
 * setup wizard to inject Student/Professional/etc. templates).  When
 * omitted we fall back to the original 4-stop cosmic default.
 */
export const blankTimeline = ({
  title, startISO, endISO, unit,
  categories: presetCategories,
  designation,
  paletteId,
} = {}) => {
  const now = Date.now();
  const categories = presetCategories && presetCategories.length
    ? presetCategories
    : [
        { id: newCategoryId(), name: "Category A", color: "#00f0ff" },
        { id: newCategoryId(), name: "Category B", color: "#ff6ad5" },
        { id: newCategoryId(), name: "Category C", color: "#a08cff" },
        { id: newCategoryId(), name: "Category D", color: "#ffd66b" },
      ];
  return {
    id: newTimelineId(),
    type: "timeline",
    title: title || "Untitled timeline",
    createdAt: now,
    updatedAt: now,
    // Persisted setup metadata so we can show "Student · Sunrise" in
    // the library + offer "edit setup" later. Optional; legacy
    // timelines that pre-date setup metadata stay perfectly readable.
    designation: designation || null,
    paletteId: paletteId || null,
    scope: {
      startISO,
      endISO: endISO || null,
      unit: unit || "months",
    },
    categories,
    events: [],
    // Edge-decoration bars from the user's reference sketch — coloured
    // vertical strips with a vertical label, used for "Term", "Holiday",
    // "Sprint 3", etc. spans defined by start/end ISO dates.
    periods: [],
    // Vertical milestone lines spanning the canvas height with a small
    // label tag at the top — used for "Term boundary", "Release v2",
    // "Project deadline", etc.
    milestones: [],
    // Free-floating sticky notes layered on top of the canvas — added
    // in Phase 3 to give timelines the same annotation feel mind maps
    // already have. Each: { id, text, x, y, color }. x/y are absolute
    // canvas pixel coords (NOT date-anchored) so the note stays put
    // relative to the viewport while the user pans the timeline.
    notes: [],
    // When true (default), this timeline's events appear on /calendar
    // as small coloured pills.
    showOnCalendar: true,
    view: { x: 0, k: 1 },
  };
};

export const newPeriodId = () => newId("pd");
export const newMilestoneId = () => newId("ms");
export const newNoteId = () => newId("nt");

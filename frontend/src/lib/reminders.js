/**
 * Reminders — a derived view of every sticky-note annotation across every
 * stored mind-map. Surfaced on the /output page as a unified checklist.
 *
 * Why derived (not a separate collection)?
 *   - Single source of truth: the sticky note IS the reminder
 *   - No migration step when stickies are edited / deleted
 *   - "Done" toggling on /output writes straight back to the sticky's `done`
 *     field on its host map, so it stays in sync everywhere
 *
 * The "added to reminders when map closes" UX is implemented as a toast
 * triggered when a user navigates away from /app — see Studio.jsx.
 */

import { listMaps, saveMap, getMap } from "./storage";

/**
 * Flatten every sticky annotation across every map into a reminder list.
 * Sorted: incomplete first, then done at the bottom; within each bucket,
 * newest first (uses the map's `updatedAt` as a proxy since stickies don't
 * carry their own timestamps).
 *
 * Returns: [{ mapId, mapTitle, stickyId, text, done, updatedAt }]
 */
export const listReminders = () => {
  const out = [];
  const maps = listMaps();
  for (const m of maps) {
    const annotations = m.annotations || [];
    for (const a of annotations) {
      if (a.type !== "sticky") continue;
      // Skip empty stickies — they're not reminders, they're placeholder doodles.
      const text = (a.text || "").trim();
      if (!text) continue;
      out.push({
        mapId: m.id,
        mapTitle: m.title || "Untitled map",
        stickyId: a.id,
        text,
        done: !!a.done,
        updatedAt: m.updatedAt || 0,
      });
    }
  }
  // Sort: undone first (by recency desc), then done (by recency desc).
  return out.sort((x, y) => {
    if (x.done !== y.done) return x.done ? 1 : -1;
    return (y.updatedAt || 0) - (x.updatedAt || 0);
  });
};

/**
 * Count just the *active* (incomplete, non-empty) reminders. Cheap pass for
 * the AssetsSidebar badge.
 */
export const countActiveReminders = () => {
  let n = 0;
  for (const m of listMaps()) {
    for (const a of (m.annotations || [])) {
      if (a.type === "sticky" && !a.done && (a.text || "").trim()) n += 1;
    }
  }
  return n;
};

/**
 * Toggle the `done` flag on a sticky reminder. Writes back to the host map's
 * annotations array and persists. Returns the new value of `done`.
 */
export const toggleReminderDone = (mapId, stickyId) => {
  const m = getMap(mapId);
  if (!m) return null;
  const next = { ...m, annotations: (m.annotations || []).map((a) =>
    a.id === stickyId && a.type === "sticky" ? { ...a, done: !a.done } : a,
  ) };
  saveMap(next);
  const updated = next.annotations.find((a) => a.id === stickyId);
  return updated ? updated.done : null;
};

/**
 * Set or clear a reminder's due date / deadline. Stored as ISO yyyy-mm-dd
 * on the sticky annotation so it can be sorted, filtered and rendered on
 * the /calendar page.
 *
 * Pass `null` (or empty string) to clear the date.
 */
export const setReminderDueDate = (mapId, stickyId, isoDate) => {
  const m = getMap(mapId);
  if (!m) return false;
  const next = {
    ...m,
    annotations: (m.annotations || []).map((a) =>
      a.id === stickyId && a.type === "sticky"
        ? { ...a, dueDate: isoDate || undefined }
        : a,
    ),
  };
  saveMap(next);
  return true;
};

/**
 * Group reminders by yyyy-mm-dd due date. Reminders WITHOUT a date go into
 * the special bucket key "" (empty string) so the calendar page can show
 * them as "Undated" in a side panel.
 */
export const remindersByDate = () => {
  const out = {};
  for (const r of listReminders()) {
    const m = getMap(r.mapId);
    const sticky = (m?.annotations || []).find((a) => a.id === r.stickyId);
    const key = sticky?.dueDate || "";
    if (!out[key]) out[key] = [];
    out[key].push({ ...r, dueDate: sticky?.dueDate || null });
  }
  return out;
};

/**
 * Create a brand-new reminder directly from the calendar UI without having
 * to first create a sticky on a map. Reminders need a host map (single
 * source of truth — every sticky lives on one), so we ensure a dedicated
 * "Calendar reminders" map exists and append a sticky there.
 */
export const createCalendarReminder = ({ text, dueDate, notes }) => {
  const CAL_MAP_ID = "calendar-reminders-map";
  let m = getMap(CAL_MAP_ID);
  if (!m) {
    m = {
      id: CAL_MAP_ID,
      title: "Calendar reminders",
      shape: "rect",
      children: [],
      annotations: [],
      source: "calendar",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  const stickyId = `cal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const next = {
    ...m,
    annotations: [
      ...(m.annotations || []),
      {
        id: stickyId,
        type: "sticky",
        x: 0, y: 0,
        w: 200, h: 160,
        text: (text || "").trim(),
        notes: (notes || "").trim() || undefined,
        dueDate: dueDate || undefined,
        done: false,
      },
    ],
    updatedAt: Date.now(),
  };
  saveMap(next);
  return stickyId;
};

/**
 * Update text + notes on an existing reminder sticky.
 */
export const updateReminder = (mapId, stickyId, patch) => {
  const m = getMap(mapId);
  if (!m) return false;
  const next = {
    ...m,
    annotations: (m.annotations || []).map((a) =>
      a.id === stickyId && a.type === "sticky"
        ? { ...a, ...patch }
        : a,
    ),
    updatedAt: Date.now(),
  };
  saveMap(next);
  return true;
};

/**
 * Delete a sticky reminder entirely (also deletes the sticky on the map).
 */
export const deleteReminder = (mapId, stickyId) => {
  const m = getMap(mapId);
  if (!m) return false;
  const next = {
    ...m,
    annotations: (m.annotations || []).filter(
      (a) => !(a.id === stickyId && a.type === "sticky"),
    ),
    updatedAt: Date.now(),
  };
  saveMap(next);
  return true;
};

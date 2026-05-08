/**
 * Library categories — labels users attach to maps so they can filter
 * "all my work maps" without writing a query.
 *
 * Persisted in `localStorage.mm.categories.v1` as an array of
 * `{ id, name, color, icon }`.  `id="all"` is a *virtual* sentinel — never
 * stored, never editable, always present, always selected by default.
 *
 * Maps reference categories via `map.categories: string[]`. A map without
 * the field belongs to `"All"` only (i.e. shows everywhere when "All" is
 * selected, nowhere when a specific category is).  Categories are by
 * design lightweight — no nested folders, no implicit selection rules.
 */

const STORAGE_KEY = "mm.categories.v1";

// Five sensible defaults.  Colours hand-picked so a user with all five
// active sees a gentle rainbow rather than five shades of cyan.
const DEFAULT_CATEGORIES = [
  { id: "work",      name: "Work",      color: "#39E0FF", icon: "briefcase" },
  { id: "study",     name: "Study",     color: "#A78BFA", icon: "graduation-cap" },
  { id: "personal",  name: "Personal",  color: "#FF6AD5", icon: "heart" },
  { id: "research",  name: "Research",  color: "#FFC857", icon: "flask" },
  { id: "finances",  name: "Finances",  color: "#3DDC84", icon: "wallet" },
];

const ALL = { id: "all", name: "All", color: "#9aaad0", icon: "layers" };

/** Read user-defined categories from storage. Returns the persistent list
 * (sans "All") — caller can prepend `getAllCategory()` when rendering. */
export const listCategories = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First-time user: seed defaults so the picker has content immediately.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      return [...DEFAULT_CATEGORIES];
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
};

export const saveCategories = (cats) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cats)); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent("mm:categories-changed")); } catch { /* ignore */ }
};

export const getAllCategory = () => ALL;

/** Add a category (lower-cased id, deduped). Returns the new full list. */
export const addCategory = ({ name, color, icon }) => {
  const cats = listCategories();
  const id = String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
  if (!id || id === "all" || cats.some((c) => c.id === id)) return cats;
  const next = [...cats, { id, name: name.trim(), color: color || "#9aaad0", icon: icon || "tag" }];
  saveCategories(next);
  return next;
};

export const renameCategory = (id, newName) => {
  const cats = listCategories();
  const next = cats.map((c) => (c.id === id ? { ...c, name: newName } : c));
  saveCategories(next);
  return next;
};

export const removeCategory = (id) => {
  const cats = listCategories().filter((c) => c.id !== id);
  saveCategories(cats);
  return cats;
};

/** Filter helper — given a map list and the selected category id, return
 * only the maps that belong to that category.  "all" passes everything. */
export const filterMapsByCategory = (maps, categoryId) => {
  if (!categoryId || categoryId === "all") return maps;
  return maps.filter((m) => Array.isArray(m.categories) && m.categories.includes(categoryId));
};

/** Toggle a category on/off for a single map; returns the updated `categories` array. */
export const toggleMapCategory = (map, categoryId) => {
  const cur = Array.isArray(map.categories) ? map.categories : [];
  if (cur.includes(categoryId)) return cur.filter((c) => c !== categoryId);
  return [...cur, categoryId];
};

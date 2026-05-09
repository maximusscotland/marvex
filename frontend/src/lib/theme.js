/**
 * theme — Sun/Moon dark/light toggle.
 *
 * Simplest viable implementation: a single `theme-light` class on
 * `<html>` flips a small set of CSS variables (background, ink) so
 * the page surface goes light. Glass panels and accent colours stay
 * unchanged — they read fine against either surface and rebuilding
 * every Tailwind class would be a multi-day refit.
 *
 * Persistence:
 *   - localStorage["marvex.theme.v1"] = "light" | "dark"
 *   - First visit: respects `(prefers-color-scheme: light)` from the
 *     user's OS. Falls back to dark (the brand default) otherwise.
 *
 * `initTheme()` is called from index.js BEFORE React renders so the
 * page paints in the correct mode on first frame (no flash-of-dark
 * for users who prefer light).
 */
const STORAGE_KEY = "marvex.theme.v1";
const LIGHT_CLASS = "theme-light";

const safeRead = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};
const safeWrite = (v) => {
  try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
};

/** Returns "light" | "dark", consulting (in order): saved pref → OS pref → "dark". */
export const getTheme = () => {
  const saved = safeRead();
  if (saved === "light" || saved === "dark") return saved;
  if (typeof window !== "undefined" && window.matchMedia) {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  }
  return "dark";
};

/** Applies the theme class on <html> and emits a `marvex:themechange` event. */
export const applyTheme = (next) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (next === "light") root.classList.add(LIGHT_CLASS);
  else root.classList.remove(LIGHT_CLASS);
  try {
    window.dispatchEvent(new CustomEvent("marvex:themechange", { detail: next }));
  } catch { /* ignore */ }
};

/** Persists + applies. Use from the toggle button. */
export const setTheme = (next) => {
  const v = next === "light" ? "light" : "dark";
  safeWrite(v);
  applyTheme(v);
};

/** Boot-time hook — call once from index.js before React renders. */
export const initTheme = () => {
  applyTheme(getTheme());
};

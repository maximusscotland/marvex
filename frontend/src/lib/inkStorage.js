/**
 * Persist/load freehand ink strokes per PDF file key.
 * Keyed in localStorage so strokes survive browser reloads and are tied to
 * the file itself (not a particular map).
 *
 * Schema:
 *   mindmapper.ink.v1.<fileKey> = {
 *     [pageNumber]: Stroke[]
 *   }
 *   Stroke = {
 *     id: string,
 *     color: "cyan" | "fuchsia" | "yellow",
 *     width: number,
 *     points: { x: number, y: number }[]   // normalized 0..1 to page viewport
 *   }
 */
const KEY = (fileKey) => `mindmapper.ink.v1.${fileKey}`;

export function loadInk(fileKey) {
  if (!fileKey) return {};
  try {
    const raw = localStorage.getItem(KEY(fileKey));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveInk(fileKey, data) {
  if (!fileKey) return;
  try {
    if (!data || Object.keys(data).length === 0) {
      localStorage.removeItem(KEY(fileKey));
    } else {
      localStorage.setItem(KEY(fileKey), JSON.stringify(data));
    }
  } catch { /* quota exceeded — silent, not worth breaking the session */ }
}

export const INK_COLORS = {
  cyan:    "#00f0ff",
  fuchsia: "#ff79c6",
  yellow:  "#ffd86b",
};

export const INK_WIDTHS = {
  fine: 2,
  med:  4,
  thick: 8,
};

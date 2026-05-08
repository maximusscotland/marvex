/**
 * Centralized link-opening behaviour for node links and annotation links.
 *
 * Rules (per product spec):
 *   1. PDFs → always open in the internal Reader (`/read?src=…`).
 *      Detection covers http(s) URLs ending in `.pdf` (with or without query
 *      string) AND `data:application/pdf` data URLs.
 *   2. Everything else → hand off to the OS so the user's default app opens it
 *      • Websites → default browser
 *      • Audio    → music app
 *      • Video    → video player
 *      • Images   → image viewer
 *      • Other    → whatever the OS associates with that file type
 *
 *   Hand-off mechanics:
 *      • Electron desktop: `shell.openExternal` for http(s); `shell.openPath`
 *        (after a temp-file write) for `data:` blobs.
 *      • Web: `window.open(_blank)` for http(s); for `data:` we trigger a
 *        download with the original filename, which tells the OS to handle it
 *        via the user's default app the moment they confirm the download.
 */

import { isDesktop } from "./desktopBridge";

const PDF_EXT_RE = /\.pdf(\?|#|$)/i;

const isPdfLink = (url) => {
  if (!url) return false;
  if (/^data:application\/pdf/i.test(url)) return true;
  if (/^https?:\/\//i.test(url) && PDF_EXT_RE.test(url)) return true;
  // Local blob URLs that our own Studio created from a PDF upload won't
  // match the data: prefix but ARE PDFs — caller can pass `forcePdf` for
  // those edge cases.
  return false;
};

const isDataUrl = (url) => /^data:/i.test(url || "");

/**
 * Best-effort filename derivation. For data URLs we read the optional
 * `;name=…` parameter (we add this when uploading files in the link dialog).
 * For http URLs we use the last path segment. Falls back to a generic stub.
 */
const filenameFor = (url, label) => {
  if (label && /\.[a-z0-9]{1,6}$/i.test(label)) return label;
  if (isDataUrl(url)) {
    const m = url.match(/^data:([^;,]+)(?:;name=([^;,]+))?/i);
    if (m && m[2]) return decodeURIComponent(m[2]);
    // No name → invent one with a sensible extension based on MIME.
    const mime = (m && m[1]) || "application/octet-stream";
    const ext = mime.split("/")[1]?.split("+")[0] || "bin";
    return `${label || "file"}.${ext}`;
  }
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch { /* not a parseable URL */ }
  return label || "file";
};

/** Open via the system default app — desktop or web. */
const openExternally = (url, label) => {
  // Electron: prefer the system handler so songs land in the music app, etc.
  if (isDesktop() && typeof window !== "undefined" && window.electronAPI) {
    if (isDataUrl(url) && window.electronAPI.openDataUrl) {
      window.electronAPI.openDataUrl(url, filenameFor(url, label));
      return;
    }
    if (window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
      return;
    }
  }
  // Web fallback. For data: URLs we trigger a download with a sensible
  // filename — the browser hands the file to the OS, which then uses the
  // default app for that extension.
  if (isDataUrl(url)) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFor(url, label);
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    } catch { /* fall through to window.open */ }
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

/**
 * Public API. Pass the URL and (optionally) a human label/filename so the
 * Reader tab title and downloaded-file name look nice.
 *
 * @param {string} url
 * @param {{label?: string, navigate?: (path: string) => void}} [opts]
 */
export function openLink(url, opts = {}) {
  if (!url) return false;
  const { label, navigate } = opts;

  // Rule 1 — PDFs always go through our Reader so users get highlights,
  // ink, and "send selection to map" instead of an external preview.
  if (isPdfLink(url)) {
    const target = `/read?src=${encodeURIComponent(url)}${label ? `&title=${encodeURIComponent(label)}` : ""}`;
    if (navigate) {
      navigate(target);
    } else if (typeof window !== "undefined") {
      // No router instance handed in → open Reader in a new tab so we don't
      // blow away whatever the user is doing in the current view.
      window.open(target, "_blank", "noopener,noreferrer");
    }
    return true;
  }

  // Rule 2 — defer to the OS / browser default.
  openExternally(url, label);
  return true;
}

export const isPdfUrl = isPdfLink;

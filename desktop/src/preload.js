/**
 * Preload bridge — the ONLY place the bundled web UI gets an injected
 * `window.electronAPI`. Keep this surface tiny so an XSS in the renderer
 * can't escalate to the Node side.
 *
 * Exposed:
 *   electronAPI.isDesktop   → true (lets the React app conditionally render
 *                             "Check for updates…" links + a small badge)
 *   electronAPI.platform    → "darwin" | "win32" | "linux"
 *   electronAPI.getVersion()        → resolves with semver string
 *   electronAPI.checkForUpdates()   → triggers the same flow as the menu
 *   electronAPI.onUpdateStatus(cb)  → subscribes to status events:
 *      { state: "checking" | "available" | "up-to-date" | "downloading"
 *               | "ready" | "deferred" | "error",
 *        version?, percent?, message? }
 *   electronAPI.openExternal(url)   → opens https:// in the system browser
 */
const { contextBridge, ipcRenderer } = require("electron");

const subscribers = new Set();
ipcRenderer.on("update:status", (_e, payload) => {
  for (const cb of subscribers) {
    try { cb(payload); } catch { /* swallow — never crash the renderer */ }
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  isDesktop: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  onUpdateStatus: (cb) => {
    if (typeof cb !== "function") return () => {};
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  // Persist a data: URL to the OS temp dir and ask the OS to open it with
  // the user's default app (mp3 → music app, mp4 → video player, etc.).
  // Returns true on success, false otherwise.
  openDataUrl: (dataUrl, filename) => ipcRenderer.invoke("shell:open-data-url", { dataUrl, filename }),
});

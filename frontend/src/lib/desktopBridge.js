/**
 * Tiny shim around `window.electronAPI` so the React app can ask
 *   "am I running in the desktop wrapper?"
 *   "trigger a manual update check"
 *   "subscribe to update status"
 * without crashing in the browser (where electronAPI is undefined).
 */

const api = (typeof window !== "undefined" && window.electronAPI) || null;

export const isDesktop = () => Boolean(api?.isDesktop);

export const desktopPlatform = () => api?.platform || null;

export const getDesktopVersion = async () => {
  if (!api) return null;
  try {
    return await api.getVersion();
  } catch {
    return null;
  }
};

export const checkForUpdates = async () => {
  if (!api) return false;
  try {
    await api.checkForUpdates();
    return true;
  } catch {
    return false;
  }
};

/**
 * @param {(payload: {state: string, version?: string, percent?: number, message?: string}) => void} cb
 * @returns {() => void} unsubscribe
 */
export const onUpdateStatus = (cb) => {
  if (!api?.onUpdateStatus) return () => {};
  return api.onUpdateStatus(cb);
};

export const openExternal = (url) => {
  if (api?.openExternal) {
    api.openExternal(url);
    return true;
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
};

/**
 * Desktop-only: write a data: URL to the OS temp dir and open it with the
 * system default app. Returns false (and the caller should fall back) when
 * we're running in a plain browser.
 */
export const openDataUrlExternal = async (dataUrl, filename) => {
  if (!api?.openDataUrl) return false;
  try {
    return Boolean(await api.openDataUrl(dataUrl, filename));
  } catch {
    return false;
  }
};

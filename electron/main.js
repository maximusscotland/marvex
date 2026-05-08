// Mind-Mapper — Electron main process.
//
// Wraps the deployed web app in a native desktop window. Local-first map
// data lives in the browser's localStorage (inside the Electron BrowserWindow),
// so maps created in the desktop app survive reloads and uninstalls (as long
// as the user doesn't nuke app data). AI / share / billing features call the
// backend exactly as they do in the web version.
//
// Auto-updates are wired via electron-updater against the GitHub Releases feed
// configured in package.json's `build.publish` block — set the owner/repo and
// run `yarn publish` (with a GH_TOKEN env var) to ship an update.

const { app, BrowserWindow, Menu, shell, dialog, ipcMain, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

// In production this points to the live site; override with WEB_URL for staging.
const WEB_URL = process.env.MM_WEB_URL || "https://mind-mapper.com";
const IS_DEV = !app.isPackaged;

// Offline fallback: path to the bundled React build. CI copies frontend/build/*
// into /app/electron/assets/web/ before running electron-builder. If the
// directory is missing (e.g. dev `yarn start` before running `yarn bundle`)
// we skip the fallback and surface the raw Chromium error page.
const OFFLINE_BUNDLE = path.join(__dirname, "assets", "web", "index.html");
const HAS_OFFLINE_BUNDLE = fs.existsSync(OFFLINE_BUNDLE);

// How long to wait for the live URL before falling back to the bundle.
const ONLINE_LOAD_TIMEOUT_MS = 6000;
// How often to probe connectivity when we're on the offline bundle — when
// the probe succeeds we auto-reload the live URL so the user gets the
// always-fresh feature set without a restart.
const ONLINE_PROBE_INTERVAL_MS = 30_000;

let mainWindow = null;
let currentMode = "online"; // "online" | "offline"
let onlineProbeTimer = null;

/**
 * Lightweight HEAD request against WEB_URL. Resolves true when the site
 * answers with a 2xx/3xx within `timeout` ms; false otherwise (ENETUNREACH,
 * timeout, DNS fail, 5xx). No body — just a reachability probe.
 */
const probeOnline = (timeout = 4000) =>
  new Promise((resolve) => {
    try {
      const req = net.request({ method: "HEAD", url: WEB_URL });
      const timer = setTimeout(() => { try { req.abort(); } catch { /* */ } resolve(false); }, timeout);
      req.on("response", (res) => {
        clearTimeout(timer);
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on("error", () => { clearTimeout(timer); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });

const loadOfflineBundle = () => {
  if (!mainWindow || !HAS_OFFLINE_BUNDLE) return;
  currentMode = "offline";
  // Pass ?offline=1 so the React app can surface the banner immediately.
  mainWindow.loadFile(OFFLINE_BUNDLE, { search: "offline=1" });
  // Start polling for connectivity so we can silently upgrade the user
  // back to the live build when the network returns.
  startOnlineProbe();
};

const loadLive = () => {
  if (!mainWindow) return;
  currentMode = "online";
  stopOnlineProbe();
  mainWindow.loadURL(WEB_URL);
};

const startOnlineProbe = () => {
  if (onlineProbeTimer) return;
  onlineProbeTimer = setInterval(async () => {
    const ok = await probeOnline(3000);
    if (ok && currentMode === "offline") {
      stopOnlineProbe();
      loadLive();
    }
  }, ONLINE_PROBE_INTERVAL_MS);
};
const stopOnlineProbe = () => {
  if (onlineProbeTimer) { clearInterval(onlineProbeTimer); onlineProbeTimer = null; }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: "#04060d",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow loading mixed http/https during local dev; stays strict in prod.
      webSecurity: !IS_DEV,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Route EXTERNAL links (target=_blank, mailto:, affiliate out-links) to the
  // user's OS default browser — NEVER spawn a new Electron window for them.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url) || /^mailto:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Same rule for in-page navigations to a different origin (e.g. Stripe checkout).
  mainWindow.webContents.on("will-navigate", (event, url) => {
    // file:// pages (offline bundle) may internally navigate to other file://
    // paths — don't treat that as cross-origin.
    if (url.startsWith("file://")) return;
    const target = new URL(url);
    const current = new URL(mainWindow.webContents.getURL() || WEB_URL);
    if (target.origin !== current.origin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // If the initial live-load fails (offline / DNS / 5xx), fall back to the
  // bundled static build. Also fires for navigation errors; guard by URL.
  mainWindow.webContents.on("did-fail-load", (_e, errorCode, errorDesc, validatedURL) => {
    if (!HAS_OFFLINE_BUNDLE) return;
    if (currentMode === "offline") return;               // already offline
    if (!validatedURL || validatedURL.startsWith("file://")) return; // bundle itself failed
    // errorCode -3 is "aborted", common when we manually loadFile — ignore.
    if (errorCode === -3) return;
    console.warn(`Live site unreachable (${errorCode} ${errorDesc}) — falling back to offline bundle.`);
    loadOfflineBundle();
  });

  // Kick off with a probe so slow networks don't hang on a white screen for
  // 30+ seconds. If the probe times out we go straight to the bundle.
  (async () => {
    if (!HAS_OFFLINE_BUNDLE) { mainWindow.loadURL(WEB_URL); return; }
    const online = await probeOnline(ONLINE_LOAD_TIMEOUT_MS);
    if (online) loadLive();
    else loadOfflineBundle();
  })();

  if (IS_DEV) mainWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.on("closed", () => { mainWindow = null; stopOnlineProbe(); });
}

function buildAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { label: "Check for Updates…", click: () => autoUpdater.checkForUpdatesAndNotify() },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }]
      : []),
    {
      label: "File",
      submenu: [
        { label: "New Map",    accelerator: "CmdOrCtrl+N", click: () => mainWindow?.webContents.loadURL(`${WEB_URL}/app?new=1`) },
        { label: "Open Map…",  accelerator: "CmdOrCtrl+O", click: () => mainWindow?.webContents.loadURL(`${WEB_URL}/app`) },
        { label: "PDF Studio", accelerator: "CmdOrCtrl+I", click: () => mainWindow?.webContents.loadURL(`${WEB_URL}/intake`) },
        { label: "Reader",     accelerator: "CmdOrCtrl+R", click: () => mainWindow?.webContents.loadURL(`${WEB_URL}/read`) },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Open mind-mapper.com",   click: () => shell.openExternal(WEB_URL) },
        { label: "Report an issue",        click: () => shell.openExternal("https://github.com/maximusscotland/marvex/issues/new") },
        { type: "separator" },
        { label: "Try to reconnect",       click: async () => { const ok = await probeOnline(4000); if (ok) loadLive(); } },
        { label: "Force offline mode",     click: () => { if (HAS_OFFLINE_BUNDLE) loadOfflineBundle(); } },
        { type: "separator" },
        { label: "Check for Updates…",     click: () => autoUpdater.checkForUpdatesAndNotify() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- App lifecycle ----

// Single-instance lock — second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    buildAppMenu();

    // Check for updates silently 5s after launch (prod only — dev mode has no
    // app.asar to diff against).
    if (!IS_DEV) {
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(() => { /* no network is ok */ });
      }, 5000);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

// ---- Auto-update UX ----
autoUpdater.on("update-available", (info) => {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    buttons: ["Later", "Download"],
    defaultId: 1,
    title: "Update available",
    message: `Mind-Mapper ${info?.version || ""} is available.`,
    detail: "Download the update in the background?",
  }).then(({ response }) => {
    if (response === 1) autoUpdater.downloadUpdate();
  });
});

autoUpdater.on("update-downloaded", () => {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    buttons: ["Later", "Restart now"],
    defaultId: 1,
    title: "Update ready",
    message: "Restart to apply the update?",
  }).then(({ response }) => {
    if (response === 1) autoUpdater.quitAndInstall();
  });
});

// ---- IPC — future hooks for native features ----
ipcMain.handle("mm:get-version", () => app.getVersion());
ipcMain.handle("mm:get-platform", () => ({
  platform: process.platform,
  arch: process.arch,
  electron: process.versions.electron,
}));
ipcMain.handle("mm:get-mode", () => ({
  mode: currentMode,                // "online" | "offline"
  hasBundle: HAS_OFFLINE_BUNDLE,
  webUrl: WEB_URL,
}));
ipcMain.handle("mm:try-reconnect", async () => {
  const ok = await probeOnline(4000);
  if (ok) { loadLive(); return { ok: true }; }
  return { ok: false };
});

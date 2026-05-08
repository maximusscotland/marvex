/**
 * Main (Node) process for the marvex.app desktop wrapper.
 *
 * Architecture (hybrid 4c):
 *   - The React UI is bundled at build time into ../renderer/ — fully offline
 *     for everything except AI calls, sync, and Stripe.
 *   - AI / cloud-sync / billing requests go to the public backend
 *     (REACT_APP_BACKEND_URL baked into the bundled JS).
 *   - Updates are user-initiated: the app NEVER auto-installs in the
 *     background. The user clicks "Check for updates…" (native menu OR
 *     in-app link) and we walk them through download → install on quit.
 */
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");

// ---- electron-log wiring (writes to ~/Library/Logs / %APPDATA% etc.) ----
log.transports.file.level = "info";
autoUpdater.logger = log;
// We never auto-download. The user always confirms first.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

const RENDERER_INDEX = path.join(__dirname, "..", "renderer", "index.html");
const PRELOAD = path.join(__dirname, "preload.js");

// Keep a reference so the window isn't garbage-collected.
let win = null;

// =========================================================================
//        First-launch "Set Marvex as default for .mmap / .mmlib" prompt
// =========================================================================
//
// Modern Windows + macOS no longer let apps register themselves as the
// default handler for a file extension — Microsoft and Apple deliberately
// removed those APIs to stop installers hijacking user choice. The realistic
// best-practice UX is therefore:
//
//   1. On the very first launch only, show a friendly dialog explaining the
//      benefit of setting Marvex as default.
//   2. Open the OS's own "Default Apps" panel (Windows) or print clear
//      Finder-driven steps (macOS) — never silently grab the association.
//   3. Persist the user's choice in `userData/first-run.json` so we ask
//      exactly once, ever, per user profile.
//
// The user can re-trigger the prompt anytime via Help → "Set as default…"
// (added below). They can also opt out permanently with "Don't ask again".

const FIRST_RUN_FILE = () => path.join(app.getPath("userData"), "first-run.json");

const readFirstRun = () => {
  try {
    const fs2 = require("fs");
    return JSON.parse(fs2.readFileSync(FIRST_RUN_FILE(), "utf8"));
  } catch {
    return null;
  }
};

const writeFirstRun = (state) => {
  try {
    const fs2 = require("fs");
    fs2.writeFileSync(FIRST_RUN_FILE(), JSON.stringify(state, null, 2));
  } catch (e) {
    log.warn("first-run write failed", e);
  }
};

/**
 * Show the "Open .mmap files with Marvex Studio?" dialog.
 * Honours `force` to bypass the once-per-profile guard (used by the menu item).
 */
const showDefaultAppPrompt = async ({ force = false } = {}) => {
  if (!win) return;
  if (!force && readFirstRun()) return;

  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  // Detail copy — platform-specific because the actual mechanic differs:
  //   Windows: deep-links to Default Apps panel (works on 10/11)
  //   macOS:   no API exists — we give the 3-step Finder recipe inline
  //   Linux:   xdg-mime command shown so user can paste it into a terminal
  const detail = isWin
    ? "Marvex Studio creates and reads .mmap (maps) and .mmlib (libraries). Setting it as default means double-clicking these files in File Explorer will open them right here.\n\nNext: we'll open Windows Default Apps. Find Marvex Studio in the list, then under \u2018Choose default file type\u2019 set .mmap and .mmlib to Marvex Studio."
    : isMac
    ? "Marvex Studio creates and reads .mmap (maps) and .mmlib (libraries). macOS doesn\u2019t let apps register themselves automatically \u2014 but it\u2019s a 10-second one-off:\n\n   1.  Right-click any .mmap file in Finder\n   2.  Choose Get Info \u2192 Open With \u2192 Marvex Studio\n   3.  Click \u2018Change All\u2026\u2019 to apply to every .mmap\n\nThen repeat for .mmlib. After that, double-clicking always opens Marvex."
    : "Marvex Studio creates and reads .mmap (maps) and .mmlib (libraries). To set it as default on Linux, paste this into a terminal:\n\n   xdg-mime default marvex.desktop application/x-marvex-map application/x-marvex-library\n\n(or use your file manager: right-click a .mmap \u2192 Properties \u2192 Open With)";

  const buttons = isWin
    ? ["Open Default Apps", "Maybe later", "Don\u2019t ask again"]
    : ["Got it", "Maybe later", "Don\u2019t ask again"];

  const res = await dialog.showMessageBox(win, {
    type: "question",
    title: "Welcome to Marvex Studio",
    message: "Open .mmap files with Marvex Studio?",
    detail,
    buttons,
    defaultId: 0,
    cancelId: 1,
  });

  const choice = ["set", "later", "never"][res.response] || "later";
  writeFirstRun({
    shown: true,
    choice,
    platform: process.platform,
    at: new Date().toISOString(),
  });

  if (choice === "set" && isWin) {
    // ms-settings: URI is honoured by Windows 10/11 Settings shell.
    shell.openExternal("ms-settings:defaultapps").catch(() => {
      // Fall back to the legacy Control Panel page if the URI isn't handled
      // (rare — only happens on stripped-down Server SKUs).
      shell.openExternal("ms-settings:defaultapps?registeredAppMachine");
    });
  }
  // macOS + Linux: dialog text already contained the recipe; nothing to launch.
};

const createWindow = () => {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#03060f",         // matches cosmic-bg so the flash is invisible
    autoHideMenuBar: false,
    show: false,
    title: "Marvex Studio",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Allow the bundled UI to talk to marvex.app for AI/sync.
      // That host comes from the baked-in REACT_APP_BACKEND_URL.
      webSecurity: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
    // Defer the first-launch default-app prompt by 800ms so the welcome
    // flash doesn't compete with a system dialog popping over an empty
    // window. Runs once ever per user profile (guarded by first-run.json).
    setTimeout(() => { showDefaultAppPrompt().catch(() => {}); }, 800);
  });

  // External links (mailto:, https://stripe.com etc.) open in the user's
  // default browser, NOT inside the Electron shell — avoids people getting
  // stuck logging into Stripe/Google in a tiny in-app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http") || url.startsWith("mailto:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  win.loadFile(RENDERER_INDEX);

  win.on("closed", () => { win = null; });
};

// ---- Single-instance lock — focus existing window if user re-launches ----
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    Menu.setApplicationMenu(buildMenu());

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// =========================================================================
//                   Update flow — manual, user-initiated
// =========================================================================
//
// State machine:
//   idle → checking → (up-to-date | available)
//   available → user-confirms → downloading → ready → user-confirms-install → quit-and-install
//
// Both the native menu item AND the in-app "Check for updates…" link
// trigger `triggerUpdateCheck()`. The renderer can subscribe to status
// events via `electronAPI.onUpdateStatus(cb)` exposed in preload.js.

let updateCheckInFlight = false;

const sendUpdateStatus = (payload) => {
  log.info("[updater]", payload);
  if (win && !win.isDestroyed()) {
    win.webContents.send("update:status", payload);
  }
};

const triggerUpdateCheck = async (opts = { silent: false }) => {
  if (updateCheckInFlight) return;
  updateCheckInFlight = true;
  sendUpdateStatus({ state: "checking" });
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    sendUpdateStatus({ state: "error", message: err?.message || String(err) });
    if (!opts.silent) {
      dialog.showMessageBox(win, {
        type: "warning",
        title: "Update check failed",
        message: "Couldn't reach the update server.",
        detail: (err && err.message) || "Check your internet connection and try again.",
        buttons: ["OK"],
      });
    }
  } finally {
    updateCheckInFlight = false;
  }
};

autoUpdater.on("update-available", (info) => {
  sendUpdateStatus({ state: "available", version: info?.version });
  // Always ask before downloading — that's the explicit promise we made
  // on the marketing site ("you control when new versions install").
  if (!win) return;
  dialog
    .showMessageBox(win, {
      type: "info",
      title: "Update available",
      message: `Marvex Studio ${info?.version || ""} is ready to download.`,
      detail: "Nothing installs without your say-so. Download in the background?",
      buttons: ["Download now", "Later"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((res) => {
      if (res.response === 0) {
        sendUpdateStatus({ state: "downloading", percent: 0 });
        autoUpdater.downloadUpdate().catch((err) => {
          sendUpdateStatus({ state: "error", message: err?.message || String(err) });
        });
      } else {
        sendUpdateStatus({ state: "deferred" });
      }
    });
});

autoUpdater.on("update-not-available", () => {
  sendUpdateStatus({ state: "up-to-date", version: app.getVersion() });
});

autoUpdater.on("download-progress", (p) => {
  sendUpdateStatus({ state: "downloading", percent: Math.round(p.percent || 0) });
});

autoUpdater.on("update-downloaded", (info) => {
  sendUpdateStatus({ state: "ready", version: info?.version });
  if (!win) return;
  dialog
    .showMessageBox(win, {
      type: "info",
      title: "Update ready",
      message: `Marvex Studio ${info?.version || ""} downloaded.`,
      detail: "Install now? The app will restart.",
      buttons: ["Install and restart", "Install on next quit"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((res) => {
      if (res.response === 0) autoUpdater.quitAndInstall(false, true);
    });
});

autoUpdater.on("error", (err) => {
  sendUpdateStatus({ state: "error", message: err?.message || String(err) });
});

// ---- IPC bridge: renderer can request a check on demand ---------------
ipcMain.handle("update:check", () => triggerUpdateCheck({ silent: false }));
ipcMain.handle("app:get-version", () => app.getVersion());
ipcMain.handle("shell:open-external", (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
});

// Open a data: URL with the OS default app. We persist the bytes to a
// per-launch temp directory (cleaned on quit) and call shell.openPath so
// the user's default music/video/image/etc. handler fires. PDFs are NOT
// routed here — the renderer hands those to the internal Reader instead.
const fs = require("fs");
const os = require("os");
const TEMP_DIR = path.join(os.tmpdir(), `marvex-${process.pid}`);
try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch { /* ignore */ }
app.on("will-quit", () => {
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

ipcMain.handle("shell:open-data-url", async (_e, payload) => {
  try {
    const { dataUrl, filename } = payload || {};
    if (typeof dataUrl !== "string" || !/^data:/i.test(dataUrl)) return false;
    const m = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/);
    if (!m) return false;
    const isBase64 = /;base64/i.test(dataUrl.slice(0, 200));
    const body = m[2];
    const buf = isBase64
      ? Buffer.from(body, "base64")
      : Buffer.from(decodeURIComponent(body), "utf8");
    const safe = String(filename || "file").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) || "file";
    const out = path.join(TEMP_DIR, `${Date.now().toString(36)}-${safe}`);
    fs.writeFileSync(out, buf);
    const err = await shell.openPath(out);
    return !err;
  } catch (e) {
    log.warn("shell:open-data-url failed", e);
    return false;
  }
});

// ---- Native menu --------------------------------------------------------
function buildMenu() {
  const isMac = process.platform === "darwin";
  const aboutItem = {
    label: "About Marvex Studio",
    click: () => {
      dialog.showMessageBox(win, {
        type: "info",
        title: "Marvex Studio",
        message: `Marvex Studio ${app.getVersion()}`,
        detail: "The Ultimate Research Lab.\nLocal-first, privacy-friendly, BYO-key.\n\nhttps://marvex.app",
        buttons: ["OK"],
      });
    },
  };
  const updateItem = {
    label: "Check for updates\u2026",
    click: () => triggerUpdateCheck({ silent: false }),
  };
  const setDefaultItem = {
    label: "Set Marvex as default for .mmap\u2026",
    click: () => showDefaultAppPrompt({ force: true }).catch(() => {}),
  };

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              aboutItem,
              { type: "separator" },
              updateItem,
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      label: "Help",
      submenu: [
        ...(isMac ? [] : [updateItem, { type: "separator" }]),
        setDefaultItem,
        { type: "separator" },
        {
          label: "Open marvex.app",
          click: () => shell.openExternal("https://marvex.app"),
        },
        {
          label: "Tutorials",
          click: () => shell.openExternal("https://marvex.app/learn"),
        },
        {
          label: "Privacy",
          click: () => shell.openExternal("https://marvex.app/privacy"),
        },
        ...(isMac ? [] : [{ type: "separator" }, aboutItem]),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// Tiny, safe preload bridge — exposes a minimal `window.mindMapperDesktop`
// namespace so the React app can detect the desktop runtime and call native
// helpers without needing full Node access in the renderer.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mindMapperDesktop", {
  isDesktop: true,
  getVersion:    () => ipcRenderer.invoke("mm:get-version"),
  getPlatform:   () => ipcRenderer.invoke("mm:get-platform"),
  getMode:       () => ipcRenderer.invoke("mm:get-mode"),
  tryReconnect:  () => ipcRenderer.invoke("mm:try-reconnect"),
});

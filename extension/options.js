// Options page — lets the user override the target Mind-Mapper host.
// Persisted in chrome.storage.sync so it follows the user across devices.

const $ = (s) => document.querySelector(s);
const hostInput = $("#host");
const statusEl  = $("#status");

async function load() {
  const { mmHost } = await chrome.storage.sync.get("mmHost");
  hostInput.value = mmHost || "";
}

$("#save").addEventListener("click", async () => {
  const raw = (hostInput.value || "").trim().replace(/\/+$/g, "");
  if (raw && !/^https?:\/\//i.test(raw)) {
    statusEl.textContent = "Must start with http:// or https://";
    statusEl.className = "status error";
    return;
  }
  await chrome.storage.sync.set({ mmHost: raw });
  statusEl.textContent = "Saved";
  statusEl.className = "status ok";
  setTimeout(() => { statusEl.textContent = ""; }, 1600);
});

load();

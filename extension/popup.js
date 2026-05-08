// Mind-Mapper — popup script.
// Shows the current tab's title + URL + any active selection, wires the
// "Send page" / "Send selection" buttons to the background service worker.

const $ = (sel) => document.querySelector(sel);

const setStatus = (text, level = "") => {
  const el = $("#status");
  el.textContent = text || "";
  el.className = `status ${level}`.trim();
};

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Ask the content page for its current selection. We don't inject a content
// script at install time (would require <all_urls> permission); instead we
// use activeTab + scripting on-demand, which only needs the user to have
// clicked the extension icon.
async function readSelection(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const sel = window.getSelection?.();
        return sel && !sel.isCollapsed ? sel.toString() : "";
      },
    });
    return (results?.[0]?.result || "").trim();
  } catch {
    return "";
  }
}

async function init() {
  const tab = await getActiveTab();
  if (!tab) { setStatus("No active tab", "error"); return; }

  $("#title").textContent = tab.title || "(untitled page)";
  $("#title").title = tab.title || "";
  $("#url").textContent = tab.url || "";
  $("#url").title = tab.url || "";

  // Selection is only readable on http(s) pages; silently skip otherwise.
  if (/^https?:/i.test(tab.url || "")) {
    const sel = await readSelection(tab.id);
    if (sel) {
      $("#selection").textContent = sel.slice(0, 400) + (sel.length > 400 ? "…" : "");
      $("#selection-row").classList.remove("hidden");
      $("#send-selection").classList.remove("hidden");
      $("#send-selection").dataset.selection = sel;
    }
  }

  $("#send-page").addEventListener("click", async () => {
    setStatus("Extracting article…");
    const res = await chrome.runtime.sendMessage({
      type: "mm:clip",
      payload: {
        url: tab.url || "",
        title: tab.title || "",
        // Ask the service worker to try Readability extraction on this tab.
        wantArticle: /^https?:/i.test(tab.url || ""),
        tabId: tab.id,
      },
    });
    if (res?.ok) {
      setStatus("Sent → a new Mind-Mapper tab opened", "ok");
      setTimeout(() => window.close(), 600);
    } else {
      setStatus(res?.error || "Could not send", "error");
    }
  });

  $("#send-selection").addEventListener("click", async () => {
    const selection = $("#send-selection").dataset.selection || "";
    setStatus("Opening Mind-Mapper…");
    const res = await chrome.runtime.sendMessage({
      type: "mm:clip",
      payload: { url: tab.url || "", title: tab.title || "", selection },
    });
    if (res?.ok) {
      setStatus("Sent → a new Mind-Mapper tab opened", "ok");
      setTimeout(() => window.close(), 600);
    } else {
      setStatus(res?.error || "Could not send", "error");
    }
  });
}

init();

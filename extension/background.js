// Mind-Mapper — Clip to Map
// Manifest V3 service worker.
//
// Responsibilities:
//   1. Install two context menu items:
//      "Send this page to Mind-Mapper"       (context: page)
//      "Send selection to Mind-Mapper"       (context: selection)
//   2. On click, collect {url, title, selection?} from the active tab and,
//      for page clips, ALSO try to extract the main article via Readability
//      (vendor/Readability.js + content/extract.js). If extraction succeeds,
//      the payload includes `{article: {title, byline, excerpt, sections}}`
//      so the frontend can build a structured mind-map immediately.
//   3. Open https://<MM_HOST>/intake?clip=<base64url-encoded JSON> in a new tab.
//   4. Also handle messages from the popup (same payload path).
//
// The target host is configurable via chrome.storage.sync (`mmHost`) so
// self-hosters and staging environments work without a rebuild. Default is
// https://mind-mapper.com.

const DEFAULT_HOST = "https://mind-mapper.com";

const MENU_PAGE = "mm_clip_page";
const MENU_SELECTION = "mm_clip_selection";

// ---- Helpers ----

const getHost = async () => {
  try {
    const { mmHost } = await chrome.storage.sync.get("mmHost");
    const s = (mmHost || "").trim();
    return s || DEFAULT_HOST;
  } catch {
    return DEFAULT_HOST;
  }
};

// base64url (URL-safe) — avoids `+`, `/`, `=` that mangle in query strings.
const base64UrlEncode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

/**
 * Try to extract a clean article from the active tab. Injects Readability
 * into the MAIN world (it uses `document.cloneNode`, which is fine there),
 * then runs extract.js which returns the structured article object.
 *
 * Returns null for non-http(s) tabs or when extraction fails — caller must
 * fall back to the bare {url,title} shape.
 */
const tryExtractArticle = async (tabId, url) => {
  if (!tabId || !url) return null;
  if (!/^https?:/i.test(url)) return null;
  try {
    // Inject Readability (library) then extract.js (IIFE that uses it).
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["vendor/Readability.js"],
      world: "MAIN",
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/extract.js"],
      world: "MAIN",
    });
    const payload = results && results[0] && results[0].result;
    if (payload && payload.ok) return payload;
    return null;
  } catch {
    // Chrome returns a permission error on chrome://, PDFs, and data: pages.
    return null;
  }
};

const buildClipUrl = async (payload) => {
  const host = await getHost();
  const body = JSON.stringify({
    ...payload,
    clippedAt: new Date().toISOString(),
    source: "chrome-extension",
    // Bump to v:2 to signal the richer payload may include `article`. The
    // frontend still supports v:1 for legacy or fallback clips.
    v: payload.article ? 2 : 1,
  });
  return `${host}/intake?clip=${base64UrlEncode(body)}`;
};

const openClip = async (payload) => {
  const url = await buildClipUrl(payload);
  await chrome.tabs.create({ url, active: true });
};

// ---- Context menus ----

chrome.runtime.onInstalled.addListener(() => {
  // Replace on install/update to avoid duplicates.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PAGE,
      title: "Send this page to Mind-Mapper",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: MENU_SELECTION,
      title: "Send selection to Mind-Mapper",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  const base = {
    url: tab.url || info.pageUrl || "",
    title: tab.title || "",
  };

  if (info.menuItemId === MENU_SELECTION && info.selectionText) {
    await openClip({ ...base, selection: info.selectionText });
    return;
  }
  if (info.menuItemId === MENU_PAGE) {
    const article = await tryExtractArticle(tab.id, base.url);
    await openClip(article ? { ...base, article } : base);
  }
});

// ---- Popup bridge ----

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "mm:clip") {
    const pl = msg.payload || {};
    const run = async () => {
      // Popup may pass a tabId + request extraction explicitly.
      if (pl.wantArticle && pl.tabId) {
        const article = await tryExtractArticle(pl.tabId, pl.url);
        if (article) pl.article = article;
      }
      // Strip helper fields before sending.
      delete pl.wantArticle;
      delete pl.tabId;
      await openClip(pl);
    };
    run().then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err?.message || err) })
    );
    return true; // async response
  }
  if (msg?.type === "mm:getHost") {
    getHost().then((host) => sendResponse({ host }));
    return true;
  }
  return false;
});

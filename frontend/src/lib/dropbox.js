/**
 * Dropbox Chooser loader — singleton, loads the Chooser SDK on demand.
 * Docs: https://www.dropbox.com/developers/chooser
 *
 * App key lives in frontend/.env as REACT_APP_DROPBOX_APP_KEY. When unset,
 * `isConfigured()` returns false and the UI shows a "coming soon" hint.
 */

const APP_KEY = process.env.REACT_APP_DROPBOX_APP_KEY || "";
const SCRIPT_URL = "https://www.dropbox.com/static/api/2/dropins.js";

let loadPromise = null;

export const isConfigured = () => !!APP_KEY;

const loadSdk = () => {
  if (window.Dropbox) return Promise.resolve(window.Dropbox);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.src = SCRIPT_URL;
    s.id = "dropboxjs";
    s.setAttribute("data-app-key", APP_KEY);
    s.onload = () => {
      // Give the SDK a tick to expose window.Dropbox
      const deadline = Date.now() + 3000;
      const check = () => {
        if (window.Dropbox) return resolve(window.Dropbox);
        if (Date.now() > deadline) return reject(new Error("Dropbox SDK failed to initialise"));
        setTimeout(check, 50);
      };
      check();
    };
    s.onerror = () => reject(new Error("Could not load the Dropbox SDK"));
    document.body.appendChild(s);
  });
  return loadPromise;
};

/**
 * Open the Dropbox file picker. Returns an array of selected files with
 * direct-link URLs (not download links, but the SDK returns temporary
 * directLink URLs that bypass the Dropbox UI and fetch the raw bytes).
 *
 * @param {{ multiselect?: boolean }} opts
 * @returns {Promise<Array<{name:string, link:string, bytes:number}>>}
 */
export const pickFromDropbox = async ({ multiselect = true } = {}) => {
  if (!isConfigured()) {
    throw new Error("Dropbox isn't configured yet — add REACT_APP_DROPBOX_APP_KEY");
  }
  const Dropbox = await loadSdk();
  return new Promise((resolve, reject) => {
    Dropbox.choose({
      extensions: [".pdf"],
      linkType: "direct",
      multiselect,
      folderselect: false,
      success: (files) => {
        resolve(
          (files || []).map((f) => ({
            name: f.name,
            link: f.link,
            bytes: f.bytes,
          }))
        );
      },
      cancel: () => resolve([]),
      error: (err) => reject(new Error(typeof err === "string" ? err : "Dropbox picker failed")),
    });
  });
};

/**
 * Fetch a Dropbox direct link and return a File blob ready for the intake queue.
 * directLink URLs are CORS-safe for GET requests (per Dropbox docs).
 */
export const fetchDropboxFile = async ({ link, name }) => {
  const res = await fetch(link);
  if (!res.ok) throw new Error(`Dropbox file fetch failed (${res.status})`);
  const blob = await res.blob();
  return new File([blob], name || "dropbox.pdf", { type: "application/pdf" });
};

/* ================== WRITE (upload / save-to-dropbox) ================== */
// OAuth 2.0 PKCE flow — frontend-only, no backend, no refresh tokens stored.
// Tokens live in sessionStorage (cleared on tab close) for 1h.

const TOKEN_KEY = "mindmapper.dropbox.token.v1";
const VERIFIER_KEY = "mindmapper.dropbox.pkce";
const STATE_KEY = "mindmapper.dropbox.state";
const FOLDER = "/Marvex Studio";

/** Derive the redirect URI. Defaults to origin + /dropbox-callback.html. */
const redirectUri = () =>
  process.env.REACT_APP_DROPBOX_REDIRECT_URI ||
  `${window.location.origin}/dropbox-callback.html`;

/** base64url encode an ArrayBuffer. */
const b64url = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Generate a PKCE code_verifier (64 chars, base64url-safe). */
const genVerifier = () => {
  const arr = new Uint8Array(48);
  crypto.getRandomValues(arr);
  return b64url(arr).slice(0, 64);
};

const sha256 = async (text) =>
  crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));

/** Returns a cached, non-expired token or null. */
const getCachedToken = () => {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (!token || !expiresAt || Date.now() >= expiresAt) return null;
    return token;
  } catch {
    return null;
  }
};

const cacheToken = (token, expiresInSec) => {
  const expiresAt = Date.now() + Math.max(60, expiresInSec - 30) * 1000;
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
};

/**
 * Pop up the Dropbox OAuth authorize page, wait for the callback HTML to
 * postMessage back with the auth code, and exchange it for a short-lived
 * access token.
 *
 * Must be invoked from a direct user gesture (button click) or the popup
 * gets blocked by the browser.
 */
const requestDropboxAccessToken = async () => {
  if (!APP_KEY) throw new Error("Dropbox isn't configured yet — add REACT_APP_DROPBOX_APP_KEY");

  const verifier = genVerifier();
  const challenge = b64url(await sha256(verifier));
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const authUrl = `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams({
    client_id: APP_KEY,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri(),
    token_access_type: "online",
    state,
  }).toString()}`;

  // Popup must be opened synchronously from the user gesture.
  const popup = window.open(authUrl, "dropbox-oauth", "width=520,height=680");
  if (!popup) throw new Error("Dropbox popup blocked — allow popups and try again");

  // Listen for the callback postMessage.
  const code = await new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, val) => { if (!done) { done = true; window.removeEventListener("message", onMsg); clearInterval(closedCheck); fn(val); } };
    const onMsg = (ev) => {
      if (ev.origin !== window.location.origin) return;
      const d = ev.data || {};
      if (d.type !== "mindmapper:dropbox-oauth") return;
      if (d.error) return finish(reject, new Error(`Dropbox: ${d.error}`));
      if (d.state !== state) return finish(reject, new Error("Dropbox OAuth state mismatch"));
      if (d.code) return finish(resolve, d.code);
    };
    window.addEventListener("message", onMsg);

    // Detect popup closed without a code
    const closedCheck = setInterval(() => {
      if (popup.closed) finish(reject, new Error("Dropbox sign-in cancelled"));
    }, 600);

    setTimeout(() => finish(reject, new Error("Dropbox sign-in timed out")), 120000);
  });

  // Exchange code → access_token
  const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: APP_KEY,
      code_verifier: sessionStorage.getItem(VERIFIER_KEY) || "",
      redirect_uri: redirectUri(),
    }).toString(),
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    throw new Error(`Dropbox token exchange failed (${tokenRes.status})${errText ? ": " + errText.slice(0, 160) : ""}`);
  }
  const data = await tokenRes.json();
  if (!data.access_token) throw new Error("Dropbox did not return an access_token");
  cacheToken(data.access_token, data.expires_in || 3600);
  return data.access_token;
};

/**
 * Upload a blob to /Marvex Studio/<filename> in the user's Dropbox. Returns the
 * Dropbox file metadata (path_display, id, name, size).
 *
 * autorename=true so repeated saves don't fail with "path/conflict"; Dropbox
 * will append (1), (2) etc.
 */
const uploadBlobToDropbox = async ({ token, filename, blob }) => {
  const apiArg = {
    path: `${FOLDER}/${filename}`,
    mode: "add",
    autorename: true,
    mute: false,
    strict_conflict: false,
  };
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify(apiArg),
      "Content-Type": "application/octet-stream",
    },
    body: blob,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Dropbox upload failed (${res.status})${errText ? ": " + errText.slice(0, 160) : ""}`);
  }
  return res.json();
};

/**
 * Create a temporary 4-hour shareable link to the just-uploaded file. Used
 * so the success toast can offer a "Open in Dropbox" CTA.
 */
const getDropboxLink = async ({ token, path }) => {
  try {
    const res = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.link || null;
  } catch {
    return null;
  }
};

/**
 * High-level: reuse cached token OR auth → upload → fetch temp link.
 * @param {{ blob: Blob, filename: string }} opts
 */
export const saveBlobToDropbox = async ({ blob, filename }) => {
  if (!isConfigured()) {
    throw new Error("Dropbox isn't configured yet — add REACT_APP_DROPBOX_APP_KEY");
  }
  if (!blob) throw new Error("Nothing to upload");
  let token = getCachedToken();
  if (!token) token = await requestDropboxAccessToken();
  const file = await uploadBlobToDropbox({ token, filename, blob });
  const link = await getDropboxLink({ token, path: file.path_lower || file.path_display });
  return {
    fileName: file.name,
    path: file.path_display,
    size: file.size,
    link,
  };
};

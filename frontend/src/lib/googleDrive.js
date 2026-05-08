/**
 * Google Drive Picker — frontend-only (Feb 2026).
 *
 * Flow:
 *   1. Lazy-load `gapi` + `gsi/client` + `google.picker` scripts.
 *   2. Use GIS `initTokenClient` to get a `drive.readonly` access token in a
 *      popup (independent of Emergent Google Auth — user can be signed in to
 *      a DIFFERENT Google account for Drive if they want).
 *   3. Build the Picker with a PDF-only DocsView.
 *   4. Download chosen files directly from Drive using files.get?alt=media
 *      with the access token as a Bearer header — CORS-safe.
 *
 * No refresh tokens are stored anywhere — the access token lives only in
 * memory during the picker session.
 *
 * Env requirements (frontend/.env):
 *   REACT_APP_GOOGLE_DRIVE_CLIENT_ID   OAuth 2.0 Web Client ID
 *   REACT_APP_GOOGLE_DRIVE_API_KEY     Browser API Key (restricted to Picker)
 *   REACT_APP_GOOGLE_DRIVE_APP_ID      GCP project number (digits only)
 */

const CLIENT_ID = process.env.REACT_APP_GOOGLE_DRIVE_CLIENT_ID || "";
const API_KEY = process.env.REACT_APP_GOOGLE_DRIVE_API_KEY || "";
const APP_ID = process.env.REACT_APP_GOOGLE_DRIVE_APP_ID || "";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const WRITE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Marvex Studio";

const GAPI_SRC = "https://apis.google.com/js/api.js";
const GSI_SRC = "https://accounts.google.com/gsi/client";

export const isConfigured = () => !!(CLIENT_ID && API_KEY && APP_ID);

/* ---------- Script loading ---------- */

const loadScript = (src, id) =>
  new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.id = id;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

const loadGapiPicker = () =>
  new Promise((resolve, reject) => {
    if (window.gapi && window.google && window.google.picker) return resolve();
    loadScript(GAPI_SRC, "gdrive-gapi")
      .then(() => {
        if (!window.gapi) return reject(new Error("gapi did not initialise"));
        window.gapi.load("picker", {
          callback: () => resolve(),
          onerror: () => reject(new Error("Could not load Google Picker")),
          timeout: 6000,
          ontimeout: () => reject(new Error("Google Picker load timed out")),
        });
      })
      .catch(reject);
  });

const loadGsi = () => loadScript(GSI_SRC, "gdrive-gsi").then(() => {
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    throw new Error("Google Identity Services did not initialise");
  }
});

/* ---------- OAuth token ---------- */

/**
 * Request a Drive.readonly access token via GIS popup.
 * Resolves with { access_token, expires_in } or rejects on user dismissal.
 */
const requestAccessToken = () =>
  new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      return reject(new Error("Google Identity Services not loaded"));
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        resolve(resp);
      },
      error_callback: (err) => reject(new Error(err?.message || "Drive auth cancelled")),
    });
    // `consent` prompt the first time, silent afterwards. An empty prompt
    // leaves the decision to Google (returns token silently if already
    // consented, else popup).
    tokenClient.requestAccessToken({ prompt: "" });
  });

/* ---------- Picker ---------- */

/**
 * Open the Drive Picker and return an array of selected file metadata.
 * @param {{ accessToken: string, multiselect?: boolean }} opts
 * @returns {Promise<Array<{id: string, name: string, mimeType: string, sizeBytes?: number}>>}
 */
const openPicker = ({ accessToken, multiselect = true }) =>
  new Promise((resolve, reject) => {
    if (!window.google || !window.google.picker) {
      return reject(new Error("Google Picker API not loaded"));
    }
    const { google } = window;
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes("application/pdf")
      .setIncludeFolders(false)
      .setOwnedByMe(false);
    const builder = new google.picker.PickerBuilder()
      .setAppId(APP_ID)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .addView(view)
      .addView(new google.picker.DocsUploadView())
      .setCallback((data) => {
        const action = data[google.picker.Response.ACTION];
        if (action === google.picker.Action.PICKED) {
          const docs = data[google.picker.Response.DOCUMENTS] || [];
          resolve(
            docs.map((d) => ({
              id: d[google.picker.Document.ID],
              name: d[google.picker.Document.NAME] || `${d[google.picker.Document.ID]}.pdf`,
              mimeType: d[google.picker.Document.MIME_TYPE] || "application/pdf",
              sizeBytes: d.sizeBytes,
            }))
          );
        } else if (action === google.picker.Action.CANCEL) {
          resolve([]);
        }
      });
    if (multiselect) builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });

/* ---------- Public API ---------- */

/** Launch the full picker flow. Returns [{id,name,accessToken,...}]. */
export const pickFromDrive = async ({ multiselect = true } = {}) => {
  if (!isConfigured()) {
    throw new Error("Google Drive isn't configured yet — add CLIENT_ID / API_KEY / APP_ID to .env");
  }
  await Promise.all([loadGapiPicker(), loadGsi()]);
  const tok = await requestAccessToken();
  const accessToken = tok.access_token;
  if (!accessToken) throw new Error("Drive did not return an access token");
  const docs = await openPicker({ accessToken, multiselect });
  return docs.map((d) => ({ ...d, accessToken }));
};

/**
 * Download a picked Drive file as a File blob.
 * Works for both native `application/pdf` files and Google Docs exported as PDF.
 */
export const fetchDriveFile = async ({ id, name, mimeType, accessToken }) => {
  // Google-native docs need /export; everything else uses alt=media.
  const isGoogleDoc = mimeType && mimeType.startsWith("application/vnd.google-apps");
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/pdf`
    : `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  const blob = await res.blob();
  const safeName = (name || `${id}.pdf`).replace(/[^\w\-. ]+/g, "_");
  return new File([blob], safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`, {
    type: "application/pdf",
  });
};

/* ================== WRITE (upload / save-to-drive) ================== */

/**
 * Request a `drive.file` access token via GIS popup — grants permission to
 * create / edit only the files this app creates. No read access to existing
 * user files. Separate consent from the picker's drive.readonly scope so
 * users never accidentally grant more than they need.
 *
 * @returns {Promise<{ access_token: string, expires_in: number }>}
 */
const requestWriteAccessToken = () =>
  new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      return reject(new Error("Google Identity Services not loaded"));
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: WRITE_SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        resolve(resp);
      },
      error_callback: (err) => reject(new Error(err?.message || "Drive auth cancelled")),
    });
    tokenClient.requestAccessToken({ prompt: "" });
  });

/**
 * Find or create a "Marvex Studio" folder in the user's Drive root. Since we
 * use the `drive.file` scope, this folder is only visible to this app AND
 * to the user — not to any other app or other Drive clients with drive.file.
 *
 * @returns {Promise<{ id: string, name: string, created: boolean }>}
 */
const ensureMindMapperFolder = async (accessToken) => {
  // 1. Search for an existing folder created by us
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) throw new Error(`Drive folder lookup failed (${searchRes.status})`);
  const { files = [] } = await searchRes.json();
  if (files.length > 0) return { id: files[0].id, name: files[0].name, created: false };

  // 2. Create it
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) throw new Error(`Drive folder create failed (${createRes.status})`);
  const folder = await createRes.json();
  return { id: folder.id, name: folder.name, created: true };
};

/**
 * Multipart upload a single Blob to Drive. Returns { id, name, webViewLink }.
 * Sizes <5MB go through uploadType=multipart; our map exports are well under
 * that (largest PDFs ~500KB) so we don't need resumable uploads.
 *
 * @param {{ accessToken: string, folderId?: string, filename: string, blob: Blob, mimeType: string }} opts
 */
const uploadBlobToDrive = async ({ accessToken, folderId, filename, blob, mimeType }) => {
  const metadata = {
    name: filename,
    mimeType,
    ...(folderId ? { parents: [folderId] } : {}),
  };
  const boundary = `mm-${Math.random().toString(36).slice(2)}`;
  const delim = `--${boundary}`;
  const close = `--${boundary}--`;

  // Drive's multipart/related expects metadata as JSON, then the raw bytes.
  const metaPart =
    `${delim}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n`;
  const filePartHeader = `${delim}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const closePart = `\r\n${close}`;

  const bodyBlob = new Blob([metaPart, filePartHeader, blob, closePart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Drive upload failed (${res.status})${errText ? `: ${errText.slice(0, 160)}` : ""}`);
  }
  return res.json();
};

/**
 * High-level: auth → ensure folder → upload → return { webViewLink, fileName,
 * folderCreated }. Throws if not configured or the user cancels consent.
 *
 * @param {{ blob: Blob, filename: string, mimeType: string }} opts
 */
export const saveBlobToDrive = async ({ blob, filename, mimeType }) => {
  if (!isConfigured()) {
    throw new Error("Google Drive isn't configured yet — add CLIENT_ID / API_KEY / APP_ID to .env");
  }
  if (!blob) throw new Error("Nothing to upload");
  await loadGsi();
  const tok = await requestWriteAccessToken();
  const accessToken = tok.access_token;
  if (!accessToken) throw new Error("Drive did not return an access token");
  const folder = await ensureMindMapperFolder(accessToken);
  const file = await uploadBlobToDrive({
    accessToken,
    folderId: folder.id,
    filename,
    blob,
    mimeType,
  });
  return {
    fileId: file.id,
    fileName: file.name,
    webViewLink: file.webViewLink,
    folderCreated: folder.created,
    folderName: folder.name,
  };
};

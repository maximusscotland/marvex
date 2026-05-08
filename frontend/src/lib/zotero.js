/**
 * Zotero API client — frontend-only. Users paste their personal key + userID
 * into the Connect dialog; we store both in localStorage (privacy-first, no
 * backend round-trip).
 *
 * Docs: https://www.zotero.org/support/dev/web_api/v3/basics
 *  - CORS-safe for browser use
 *  - Auth: `Authorization: Bearer <apiKey>` + `Zotero-API-Version: 3`
 *  - Pagination: `Total-Results` header, `Link` header (rel=next)
 *  - File download: redirects to S3, CORS-safe with follow-redirects
 */

const KEY = "mindmapper.zotero.v1";
const BASE = "https://api.zotero.org";

/** Persisted credentials: { apiKey, userId } */
export const getZoteroCreds = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setZoteroCreds = ({ apiKey, userId }) => {
  const entry = { apiKey: String(apiKey || "").trim(), userId: String(userId || "").trim() };
  if (!entry.apiKey || !entry.userId) throw new Error("Both API key and user ID are required");
  localStorage.setItem(KEY, JSON.stringify(entry));
  return entry;
};

export const clearZoteroCreds = () => localStorage.removeItem(KEY);

export const maskZoteroKey = (k) => {
  if (!k) return "";
  if (k.length <= 10) return "•".repeat(k.length);
  return `${k.slice(0, 4)}${"•".repeat(Math.max(4, k.length - 8))}${k.slice(-4)}`;
};

const authHeaders = (apiKey) => ({
  Authorization: `Bearer ${apiKey}`,
  "Zotero-API-Version": "3",
});

const request = async (path, { apiKey, params, binary = false } = {}) => {
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { headers: authHeaders(apiKey) });
  if (res.status === 401) throw new Error("Zotero rejected your API key");
  if (res.status === 403) throw new Error("This Zotero library is private or key lacks permission");
  if (res.status === 429) throw new Error("Rate limited by Zotero — try again in a moment");
  if (!res.ok) throw new Error(`Zotero error ${res.status}`);
  if (binary) return res.blob();
  const total = parseInt(res.headers.get("Total-Results") || "0", 10);
  const link = res.headers.get("Link") || "";
  const hasNext = /rel="next"/.test(link);
  const json = await res.json();
  return { data: json, total, hasNext };
};

/** Test a credential pair by hitting /keys/current. Returns { ok, username? }. */
export const verifyCreds = async ({ apiKey, userId }) => {
  try {
    const res = await fetch(`${BASE}/keys/current`, { headers: authHeaders(apiKey) });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Zotero rejected your API key — double-check the key and user ID" };
    }
    if (!res.ok) return { ok: false, error: `Zotero error ${res.status}` };
    const data = await res.json();
    // Sanity check: the returned userID should match what the user entered.
    // (Only fail when the API explicitly returns a different non-null userID.)
    const keyUserId = data.userID != null ? String(data.userID) : "";
    if (keyUserId && keyUserId !== String(userId)) {
      return { ok: false, error: `Key belongs to user ${keyUserId}, not ${userId}` };
    }
    return { ok: true, username: data.username || "" };
  } catch (e) {
    return { ok: false, error: e.message || "Network error" };
  }
};

/** List group libraries the user has access to. */
export const listGroups = async ({ apiKey, userId }) => {
  const { data } = await request(`/users/${userId}/groups`, { apiKey, params: { limit: 100 } });
  return (data || []).map((g) => ({
    id: String(g.id),
    name: g.data?.name || `Group ${g.id}`,
    numItems: g.meta?.numItems ?? null,
  }));
};

/**
 * List items with PDF-focused defaults: exclude notes/attachments from top-level,
 * include only parent items, sorted by newest.
 */
export const listItems = async ({ apiKey, libraryType, libraryId, start = 0, limit = 50, search = "" }) => {
  const path = `/${libraryType}s/${libraryId}/items/top`;
  const params = { limit, start, sort: "dateModified", direction: "desc" };
  if (search) params.q = search;
  const { data, total, hasNext } = await request(path, { apiKey, params });
  const items = (data || []).map((it) => ({
    key: it.key,
    libraryType,
    libraryId,
    title: it.data?.title || "(untitled)",
    itemType: it.data?.itemType || "item",
    creators: (it.data?.creators || []).map((c) => c.lastName || c.name || "").filter(Boolean),
    year: (it.data?.date || "").match(/\d{4}/)?.[0] || "",
    numChildren: it.meta?.numChildren ?? 0,
    tags: (it.data?.tags || []).map((t) => t.tag).slice(0, 4),
  }));
  return { items, total, hasNext };
};

/** List PDF attachments attached to one parent item. */
export const listPdfAttachments = async ({ apiKey, libraryType, libraryId, parentKey }) => {
  const { data } = await request(
    `/${libraryType}s/${libraryId}/items/${parentKey}/children`,
    { apiKey, params: { limit: 50 } }
  );
  return (data || [])
    .filter(
      (c) =>
        c.data?.itemType === "attachment" &&
        (c.data?.contentType === "application/pdf" || /\.pdf$/i.test(c.data?.filename || ""))
    )
    .map((c) => ({
      key: c.key,
      filename: c.data?.filename || `${c.key}.pdf`,
      contentType: c.data?.contentType || "application/pdf",
      title: c.data?.title || "",
    }));
};

/**
 * Download an attachment's file contents as a File object so we can feed it
 * straight into the intake queue as if the user had drag-dropped it.
 */
export const downloadAttachmentFile = async ({ apiKey, libraryType, libraryId, attachmentKey, filename }) => {
  const blob = await request(
    `/${libraryType}s/${libraryId}/items/${attachmentKey}/file`,
    { apiKey, binary: true }
  );
  return new File([blob], filename || `${attachmentKey}.pdf`, { type: "application/pdf" });
};

/* ================== WRITE (push map → Zotero note) ================== */

/** Escape HTML-dangerous chars. */
const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Build an HTML representation of a map tree — used as a Zotero note body.
 * Zotero notes accept HTML. Depth 0 → <h1>, depth 1–4 → <h2>–<h5>, deeper
 * → bullet lists. Preserves summaries as <p>.
 */
const buildMapHtmlNote = (map) => {
  if (!map) return "";
  const lines = [];
  lines.push(`<h1>${esc(map.title || "Untitled map")}</h1>`);
  if (map.summary) lines.push(`<p>${esc(map.summary)}</p>`);

  const emit = (node, depth) => {
    if (depth <= 4) {
      lines.push(`<h${Math.min(depth + 1, 6)}>${esc(node.title || "Untitled")}</h${Math.min(depth + 1, 6)}>`);
      if (node.summary) lines.push(`<p>${esc(node.summary)}</p>`);
      (node.children || []).forEach((c) => emit(c, depth + 1));
    } else {
      // Deeper — flat bullet list
      const kids = node.children || [];
      if (!kids.length) {
        lines.push(`<ul><li>${esc(node.title)}${node.summary ? " — " + esc(node.summary) : ""}</li></ul>`);
      } else {
        lines.push(`<ul><li>${esc(node.title)}`);
        kids.forEach((c) => {
          lines.push(`<ul><li>${esc(c.title)}${c.summary ? " — " + esc(c.summary) : ""}</li></ul>`);
        });
        lines.push(`</li></ul>`);
      }
    }
  };
  (map.children || []).forEach((b) => emit(b, 1));
  lines.push(
    `<hr><p><em>Exported from <a href="https://marvex.app">marvex.app</a></em></p>`
  );
  return lines.join("");
};

/** Generic POST to /users/:userID/items. Returns the created items' keys. */
const createItems = async ({ apiKey, userId, items }) => {
  const res = await fetch(`${BASE}/users/${userId}/items`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });
  if (res.status === 401) throw new Error("Zotero rejected your API key");
  if (res.status === 403) throw new Error("Your Zotero API key lacks write permission — re-issue with library write access");
  if (res.status === 412) throw new Error("Zotero item-template validation failed");
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Zotero create failed (${res.status})${errText ? ": " + errText.slice(0, 160) : ""}`);
  }
  const data = await res.json();
  // Zotero returns { successful: { "0": {...}, "1": {...} }, failed: {...} }
  if (data.failed && Object.keys(data.failed).length) {
    const first = Object.values(data.failed)[0];
    throw new Error(`Zotero rejected item: ${first?.message || "unknown"}`);
  }
  const successful = data.successful || {};
  return Object.values(successful).map((s) => ({
    key: s.key,
    version: s.version,
    ...s,
  }));
};

/**
 * Push a map to the user's personal Zotero library as a "report" item with a
 * child note containing the full map outline as HTML. Tagged #mind-mapper.
 *
 * Credentials come from the same localStorage store used by the reader flow
 * (setZoteroCreds). Returns { parentKey, noteKey, zoteroUrl }.
 */
export const saveMapToZotero = async ({ map }) => {
  const creds = getZoteroCreds();
  if (!creds?.apiKey || !creds?.userId) {
    throw new Error("Connect Zotero first — open Zotero Connect from Intake Studio");
  }
  if (!map) throw new Error("Nothing to save");

  const title = (map.title || "Untitled mind-map").slice(0, 250);
  const today = new Date().toISOString().slice(0, 10);

  // 1. Parent "report" item so the note has a meaningful home in Zotero.
  const [parent] = await createItems({
    apiKey: creds.apiKey,
    userId: creds.userId,
    items: [
      {
        itemType: "report",
        title: `Mind-map · ${title}`,
        reportType: "Mind-map",
        date: today,
        accessDate: new Date().toISOString(),
        url: "https://marvex.app",
        tags: [{ tag: "mind-mapper" }],
      },
    ],
  });
  if (!parent?.key) throw new Error("Zotero parent item creation returned no key");

  // 2. Child note with the full map outline as HTML.
  const html = buildMapHtmlNote(map);
  const [note] = await createItems({
    apiKey: creds.apiKey,
    userId: creds.userId,
    items: [
      {
        itemType: "note",
        parentItem: parent.key,
        note: html,
        tags: [{ tag: "mind-mapper" }],
      },
    ],
  });

  const zoteroUrl = `https://www.zotero.org/users/${creds.userId}/items/${parent.key}`;
  return {
    parentKey: parent.key,
    noteKey: note?.key || null,
    zoteroUrl,
    libraryType: "user",
    libraryId: creds.userId,
  };
};

/** True if the user has already connected Zotero (creds stored locally). */
export const isZoteroConnected = () => {
  const c = getZoteroCreds();
  return !!(c?.apiKey && c?.userId);
};

/* ================== WRITE (push PDF binary attachment) ================== */

/**
 * MD5 hex digest of a Blob. Zotero requires MD5 (not SHA) for its 3-step
 * upload protocol — Web Crypto doesn't do MD5, so we lean on SparkMD5 which
 * streams buffers so a 10 MB PDF doesn't blow memory.
 */
const md5OfBlob = async (blob) => {
  const SparkMD5 = (await import("spark-md5")).default;
  const spark = new SparkMD5.ArrayBuffer();
  const CHUNK = 2 * 1024 * 1024; // 2 MB
  let offset = 0;
  while (offset < blob.size) {
    const slice = blob.slice(offset, Math.min(offset + CHUNK, blob.size));
    const buf = await slice.arrayBuffer();
    spark.append(buf);
    offset += CHUNK;
  }
  return spark.end();
};

/** Concatenate [string prefix][ArrayBuffer fileBytes][string suffix] into one Blob. */
const buildUploadBody = (prefix, fileBlob, suffix) => {
  const enc = new TextEncoder();
  return new Blob([enc.encode(prefix), fileBlob, enc.encode(suffix)]);
};

/**
 * Upload a binary file (PDF, PNG, etc.) as an attachment child of the given
 * Zotero parent item, following the 3-step protocol:
 *
 *   1. Create child attachment (linkMode="imported_file", md5, mtime)
 *   2. POST /items/{key}/file → get S3 upload authorization
 *   3. POST to S3 url with prefix+bytes+suffix
 *   4. POST /items/{key}/file?upload=<uploadKey> → register
 *
 * Returns { attachmentKey, deduped }. `deduped=true` means Zotero already had
 * an identical file server-side and we didn't re-upload (still linked).
 *
 * Docs: https://www.zotero.org/support/dev/web_api/v3/file_upload
 */
export const uploadFileAttachment = async ({
  apiKey,
  userId,
  parentKey,
  blob,
  filename,
  contentType = "application/pdf",
  title = "",
}) => {
  if (!apiKey || !userId) throw new Error("Missing Zotero credentials");
  if (!parentKey) throw new Error("parentKey is required");
  if (!blob || !blob.size) throw new Error("Empty file — nothing to upload");

  const md5 = await md5OfBlob(blob);
  const mtime = Date.now();
  const filesize = blob.size;

  // Step 1 — create the child attachment item
  const [att] = await createItems({
    apiKey,
    userId,
    items: [
      {
        itemType: "attachment",
        parentItem: parentKey,
        linkMode: "imported_file",
        title: title || filename,
        filename,
        contentType,
        md5,
        mtime,
        tags: [{ tag: "mind-mapper" }],
      },
    ],
  });
  if (!att?.key) throw new Error("Zotero attachment item creation returned no key");
  const attachmentKey = att.key;

  // Step 2 — authorise upload
  const authRes = await fetch(`${BASE}/users/${userId}/items/${attachmentKey}/file`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/x-www-form-urlencoded",
      "If-None-Match": "*",
    },
    body: new URLSearchParams({
      md5,
      filename,
      filesize: String(filesize),
      mtime: String(mtime),
    }).toString(),
  });
  if (authRes.status === 403) {
    throw new Error("Your Zotero API key lacks file-write permission — re-issue with 'Allow file editing'");
  }
  if (!authRes.ok) {
    const txt = await authRes.text().catch(() => "");
    throw new Error(`Zotero upload-authorise failed (${authRes.status})${txt ? ": " + txt.slice(0, 200) : ""}`);
  }
  const auth = await authRes.json();

  // Server-side dedup — Zotero already has an identical file, we're done
  if (auth.exists === 1 || auth.exists === "1" || auth.exists === true) {
    return { attachmentKey, deduped: true };
  }

  if (!auth.url || !auth.uploadKey) {
    throw new Error("Zotero returned an unexpected upload response");
  }

  // Step 3 — push bytes to S3 (no auth header — the URL is pre-signed)
  const s3Body = buildUploadBody(auth.prefix || "", blob, auth.suffix || "");
  const s3Res = await fetch(auth.url, {
    method: "POST",
    headers: { "Content-Type": auth.contentType || "multipart/form-data" },
    body: s3Body,
  });
  if (!s3Res.ok) {
    const txt = await s3Res.text().catch(() => "");
    throw new Error(`S3 upload failed (${s3Res.status})${txt ? ": " + txt.slice(0, 200) : ""}`);
  }

  // Step 4 — register the upload against Zotero
  const regRes = await fetch(`${BASE}/users/${userId}/items/${attachmentKey}/file`, {
    method: "POST",
    headers: {
      ...authHeaders(apiKey),
      "Content-Type": "application/x-www-form-urlencoded",
      "If-None-Match": "*",
    },
    body: new URLSearchParams({ upload: auth.uploadKey }).toString(),
  });
  if (!regRes.ok) {
    const txt = await regRes.text().catch(() => "");
    throw new Error(`Zotero upload-register failed (${regRes.status})${txt ? ": " + txt.slice(0, 200) : ""}`);
  }

  return { attachmentKey, deduped: false };
};

/**
 * One-shot: push a mind-map to Zotero as (a) a parent report item, (b) an
 * HTML note child with the outline, AND (c) a binary PDF attachment.
 * Falls back gracefully — if the PDF attach fails, the note is still saved.
 */
export const saveMapToZoteroFull = async ({ map, pdfBlob, pdfFilename }) => {
  const base = await saveMapToZotero({ map });
  if (!pdfBlob) return { ...base, pdfKey: null, pdfDeduped: false };

  const creds = getZoteroCreds();
  try {
    const { attachmentKey, deduped } = await uploadFileAttachment({
      apiKey: creds.apiKey,
      userId: creds.userId,
      parentKey: base.parentKey,
      blob: pdfBlob,
      filename: pdfFilename || `${(map.title || "mind-map").slice(0, 80)}.pdf`,
      contentType: "application/pdf",
      title: (map.title || "Mind-map") + " · PDF",
    });
    return { ...base, pdfKey: attachmentKey, pdfDeduped: deduped };
  } catch (err) {
    // Soft-fail — the HTML note is already saved, so the user has *something*.
    return { ...base, pdfKey: null, pdfError: err.message || String(err) };
  }
};

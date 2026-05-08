import axios from "axios";
import { rewriteMapAffiliates } from "@/lib/affiliates";
import { recordAiCall } from "@/lib/aiLedger";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Resolve which provider an outbound call is using so the gauge ledger stays
// honest. Falls back to "shared" — which represents the Emergent LLM key /
// free-tier path — so signed-in free users still see the needle move.
const provOf = (userKey) => (userKey && userKey.key && userKey.provider) || "shared";

export const parsePdfHeuristic = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${API}/mindmap/parse-pdf`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
  return res.data;
};

export const generateMindMapFromPdf = async (file, userKey) => {
  const form = new FormData();
  form.append("file", file);
  const headers = { "Content-Type": "multipart/form-data" };
  if (userKey && userKey.key) {
    headers["x-user-api-key"] = userKey.key;
    headers["x-user-api-provider"] = userKey.provider || "anthropic";
  }
  const res = await axios.post(`${API}/mindmap/from-pdf`, form, {
    headers,
    timeout: 180000,
  });
  recordAiCall(provOf(userKey));
  return rewriteMapAffiliates(res.data);
};

export const runResearchAssistant = async ({ mapContext, persona, audience, depth, userKey, memory }) => {
  const headers = { "Content-Type": "application/json" };
  if (userKey && userKey.key) {
    headers["x-user-api-key"] = userKey.key;
    headers["x-user-api-provider"] = userKey.provider || "anthropic";
  }
  const res = await axios.post(
    `${API}/research`,
    {
      map_context: mapContext,
      persona: persona || "",
      audience: audience || "",
      depth: depth || "balanced",
      memory: Array.isArray(memory) ? memory : [],
    },
    { headers, timeout: 180000, withCredentials: true }
  );
  recordAiCall(provOf(userKey));
  return rewriteMapAffiliates(res.data);
};

/**
 * Streaming variant of runResearchAssistant — uses Server-Sent Events so the
 * UI can reveal branches progressively. Calls `onEvent({type, ...})` for each
 * SSE message where type is one of: 'phase', 'branch', 'done', 'error'.
 * Returns the final map JSON on success, or throws on HTTP / parse errors.
 */
export const runResearchAssistantStream = async ({
  mapContext, persona, audience, depth, userKey, memory, onEvent, signal,
}) => {
  const headers = { "Content-Type": "application/json", "Accept": "text/event-stream" };
  if (userKey && userKey.key) {
    headers["x-user-api-key"] = userKey.key;
    headers["x-user-api-provider"] = userKey.provider || "anthropic";
  }
  const res = await fetch(`${API}/research/stream`, {
    method: "POST",
    headers,
    credentials: "include",
    signal,
    body: JSON.stringify({
      map_context: mapContext,
      persona: persona || "",
      audience: audience || "curious generalist",
      depth: depth || "balanced",
      memory: Array.isArray(memory) ? memory : [],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = "";
    try { detail = JSON.parse(text)?.detail || ""; } catch { /* ignore */ }
    const err = new Error(detail || `HTTP ${res.status}`);
    err.response = { status: res.status, data: { detail } };
    throw err;
  }

  // Parse SSE stream.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalMap = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete events separated by blank line.
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = block.split("\n");
      let event = "message";
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (!dataLines.length) continue;
      let data;
      try { data = JSON.parse(dataLines.join("\n")); } catch { continue; }
      onEvent?.({ type: event, ...data });
      if (event === "done") {
        finalMap = data.map ? rewriteMapAffiliates(data.map) : null;
        recordAiCall(provOf(userKey));
      }
      if (event === "error") {
        const err = new Error(data.detail || "Research stream failed");
        err.response = { status: 502, data };
        throw err;
      }
    }
  }

  return finalMap;
};


export const enrichOutline = async ({ title, headings, audience, userKey }) => {
  const headers = { "Content-Type": "application/json" };
  if (userKey && userKey.key) {
    headers["x-user-api-key"] = userKey.key;
    headers["x-user-api-provider"] = userKey.provider || "anthropic";
  }
  const res = await axios.post(
    `${API}/research/enrich-outline`,
    { title: title || "Untitled", headings: headings || [], audience: audience || "" },
    { headers, timeout: 180000, withCredentials: true }
  );
  recordAiCall(provOf(userKey));
  return rewriteMapAffiliates(res.data);
};

/**
 * Compile a (sub)tree into a Markdown document. Returns
 * { markdown, word_count, model_used }. Frontend renders the markdown into a
 * styled preview modal — user clicks "Save as PDF" to trigger window.print().
 */
export const compileDocument = async ({
  root, mapTitle, style, lengthPreset, customWords, persona, audience, userKey,
}) => {
  const headers = { "Content-Type": "application/json" };
  if (userKey && userKey.key) {
    headers["x-user-api-key"] = userKey.key;
    headers["x-user-api-provider"] = userKey.provider || "anthropic";
  }
  const res = await axios.post(
    `${API}/compile/document`,
    {
      root: root || { title: "", children: [] },
      map_title: mapTitle || "",
      style: style || "essay",
      length_preset: lengthPreset || "standard",
      custom_words: typeof customWords === "number" ? customWords : null,
      persona: persona || "",
      audience: audience || "",
    },
    { headers, timeout: 180000, withCredentials: true }
  );
  recordAiCall(provOf(userKey));
  return res.data;
};

/* ---------- Share ---------- */

export const createShare = async (map) => {
  const res = await axios.post(
    `${API}/share`,
    { map },
    { withCredentials: true, timeout: 20000 }
  );
  return res.data; // { slug, view_count, created_at, title }
};

export const getSharedMap = async (slug) => {
  const res = await axios.get(`${API}/share/${slug}`, { timeout: 15000 });
  return res.data; // { slug, map, view_count, created_at, title }
};

export const revokeShare = async (slug) => {
  const res = await axios.delete(`${API}/share/${slug}`, {
    withCredentials: true,
    timeout: 10000,
  });
  return res.data;
};

export const listMyShares = async () => {
  const res = await axios.get(`${API}/share/mine`, {
    withCredentials: true,
    timeout: 10000,
  });
  return res.data;
};


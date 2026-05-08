/**
 * Local-first RAG memory for the Research Assistant.
 *
 * Each time the user runs research (or Deepen / Deep Research) we distil the
 * result into a compact "memory entry" and store it in localStorage. On the
 * next research call we pluck the top-K most related entries (cheap keyword
 * overlap) and pass their titles as context to the LLM so the agent:
 *   - avoids duplicating work the user already did
 *   - can reference prior findings ("as you learned when researching X…")
 *   - builds a coherent, longitudinal research thread instead of isolated maps
 *
 * No embeddings. No backend. No database. Just a Jaccard-on-tokens cache.
 *
 * Schema:
 *   localStorage["mindmapper.researchMemory.v1"] = MemoryEntry[]  (newest first)
 *   MemoryEntry = {
 *     id:         string,
 *     ts:         number,
 *     focusTitle: string,
 *     mapTitle:   string,
 *     persona:    string,
 *     audience:   string,
 *     depth:      "concise" | "balanced" | "deep",
 *     keywords:   string[],            // tokenised from focus + branches
 *     branches:   [ { title, summary?, children: [ { title, summary? } ] } ]
 *   }
 */

const KEY = "mindmapper.researchMemory.v1";
const MAX_ENTRIES = 50;
const MAX_BRANCHES_STORED = 8;
const MAX_L2_STORED = 4;

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","in","on","to","for","with","by","as",
  "is","are","was","were","be","been","being","this","that","these","those",
  "it","its","at","from","into","about","over","under","up","down","out","so",
  "if","not","no","yes","can","may","might","should","would","could","will",
  "do","does","did","done","has","have","had","than","then","which","who",
  "what","how","why","when","where","we","you","your","our","their","his",
  "her","they","them","one","two","new","use","used","using","via",
]);

const tokenize = (text) => {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
};

const uniq = (arr) => Array.from(new Set(arr));

const nowId = () =>
  `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const loadRaw = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const saveRaw = (arr) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX_ENTRIES)));
  } catch { /* quota — silently drop, not worth failing the research */ }
};

/**
 * Append a research result to memory. `focus` is the focus-node title the
 * user clicked, `mapTitle` is the source map's title, and `map` is the JSON
 * returned from the Research Assistant endpoint (with children).
 */
export const appendResearchMemory = ({
  focus, mapTitle, persona, audience, depth, map,
}) => {
  const focusTitle = (focus || "").trim();
  if (!focusTitle) return null;

  const branches = (map?.children || [])
    .slice(0, MAX_BRANCHES_STORED)
    .map((b) => ({
      title: String(b.title || "").slice(0, 120),
      summary: String(b.summary || "").slice(0, 220),
      children: (b.children || []).slice(0, MAX_L2_STORED).map((c) => ({
        title: String(c.title || "").slice(0, 120),
        summary: String(c.summary || "").slice(0, 220),
      })),
    }))
    .filter((b) => b.title);

  // Harvest keywords from focus + all (L1+L2) titles + summaries.
  const kwText = [
    focusTitle,
    ...branches.flatMap((b) => [
      b.title, b.summary,
      ...(b.children || []).flatMap((c) => [c.title, c.summary]),
    ]),
  ].join(" ");
  const keywords = uniq(tokenize(kwText)).slice(0, 60);

  const entry = {
    id: nowId(),
    ts: Date.now(),
    focusTitle: focusTitle.slice(0, 160),
    mapTitle: String(mapTitle || "").slice(0, 160),
    persona: String(persona || "").slice(0, 240),
    audience: String(audience || "").slice(0, 120),
    depth: depth || "balanced",
    keywords,
    branches,
  };

  const arr = loadRaw();
  arr.unshift(entry);
  saveRaw(arr);
  return entry;
};

/**
 * Find the top-K past memory entries most related to the given query string.
 * Uses keyword Jaccard-like overlap — simple, fast, no dependencies.
 *
 * Excludes entries whose focusTitle exactly matches the query (case-insensitive)
 * since those would just echo the user's current node back at them.
 */
export const findRelatedMemories = (query, k = 3) => {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];

  const q = (query || "").trim().toLowerCase();
  const scored = [];
  for (const e of loadRaw()) {
    if ((e.focusTitle || "").toLowerCase() === q) continue;
    const kw = new Set(e.keywords || []);
    let overlap = 0;
    for (const t of qTokens) if (kw.has(t)) overlap += 1;
    if (overlap === 0) continue;
    const union = qTokens.size + kw.size - overlap;
    const jaccard = union > 0 ? overlap / union : 0;
    // Favour recent entries slightly (recency tie-breaker).
    const ageDays = (Date.now() - (e.ts || 0)) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 1 - ageDays / 60) * 0.05;
    scored.push({ entry: e, score: jaccard + recencyBoost, overlap });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.entry);
};

/**
 * Serialise a memory entry into the compact shape we send to the backend.
 * (Keeps bytes small — we only need titles to ground the LLM.)
 */
export const shapeMemoryForBackend = (entry) => ({
  focus_title: entry.focusTitle,
  map_title: entry.mapTitle,
  branches: (entry.branches || []).map((b) => ({
    title: b.title,
    children: (b.children || []).map((c) => c.title).filter(Boolean),
  })),
});

/**
 * Top-level helper used by API callers: returns the backend-ready memory
 * list for the given focus query. Returns [] when memory is empty.
 */
export const buildMemoryContext = (focusTitle, focusSummary = "", k = 3) => {
  const related = findRelatedMemories(`${focusTitle} ${focusSummary}`, k);
  return related.map(shapeMemoryForBackend);
};

export const listResearchMemories = () => loadRaw();

export const countResearchMemories = () => loadRaw().length;

export const clearResearchMemory = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
};

export const deleteResearchMemory = (id) => {
  const next = loadRaw().filter((e) => e.id !== id);
  saveRaw(next);
};

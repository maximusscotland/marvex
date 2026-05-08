/**
 * Intake queue persistence — lets users resume the Fixer after a browser
 * crash or accidental tab close.
 *
 * Caveat: File/Blob objects can't be serialised to localStorage, so we only
 * persist items that already reached the PREVIEW state (parsed + heading
 * tree is stable). OCR fallbacks that have produced headings also qualify.
 * Items in QUEUED/PARSING/FAILED states are dropped — the file handle is
 * gone anyway after a reload.
 */

const KEY = "mindmapper.intakeQueue.v1";
const MAX_AGE_HOURS = 72;

const safeItemForStorage = (it) => ({
  id: it.id,
  fileName: it.file?.name || "",
  status: "preview", // always stored as preview, regardless of original
  headings: (it.headings || []).map((h) => ({
    id: h.id,
    title: h.title,
    depth: h.depth | 0,
    page: h.page ?? null,
    summary: h.summary || "",
  })),
  parsedTitle: it.parsedTitle || "",
  sourcePages: it.sourcePages || 0,
  enrich: !!it.enrich,
  autoDeepen: !!it.autoDeepen,
});

export const saveIntakeQueue = (items) => {
  try {
    const persistable = (items || []).filter(
      (it) => it.status === "preview" && (it.headings || []).length > 0
    );
    if (!persistable.length) {
      localStorage.removeItem(KEY);
      return;
    }
    const payload = {
      savedAt: Date.now(),
      items: persistable.map(safeItemForStorage),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or serialisation error — safe to swallow.
  }
};

export const loadIntakeQueue = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.items) || !payload.items.length) return null;
    const ageHours = (Date.now() - (payload.savedAt || 0)) / (1000 * 60 * 60);
    if (ageHours > MAX_AGE_HOURS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const clearIntakeQueue = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
};

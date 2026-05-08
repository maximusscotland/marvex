/**
 * Intake helpers — transforms between a heading tree (from the backend PDF
 * parser or from OCR) and the mind-map shape used by the Studio canvas.
 * Also exposes a lazy-loaded OCR fallback for scanned / image-only PDFs.
 */
import { newId } from "@/lib/storage";

/* ---------- flatten / re-tree ---------- */

/**
 * Flatten a heading tree into a list of `{id, title, depth, page}` rows the
 * Fixer panel can render linearly with indent controls.
 */
export const flattenHeadings = (nodes = [], depth = 0, out = []) => {
  for (const n of nodes) {
    out.push({
      id: n.id || newId(),
      title: n.title || "Untitled",
      depth,
      page: n.page ?? null,
      summary: n.summary || "",
    });
    if (n.children && n.children.length) flattenHeadings(n.children, depth + 1, out);
  }
  return out;
};

/**
 * Re-build a nested tree from a flat list where `depth` dictates nesting.
 * Rows with depth > previous depth + 1 are clamped so we never skip a level.
 */
export const treeFromFlat = (rows = []) => {
  const root = { children: [] };
  const stack = [{ node: root, depth: -1 }];

  for (const r of rows) {
    const title = (r.title || "").trim();
    if (!title) continue;
    // clamp depth so we can't jump more than one level below the parent
    let depth = Math.max(0, r.depth | 0);
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) stack.pop();
    depth = Math.min(depth, stack[stack.length - 1].depth + 1);
    const node = {
      id: r.id || newId(),
      title: title.slice(0, 120),
      summary: r.summary || "",
      children: [],
    };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, depth });
  }
  return root.children;
};

/* ---------- build a Mind-Map record ---------- */

/**
 * Turn a parsed response ({title, children}) into a Studio-ready map.
 *
 * `attachment` is an optional `{ link, linkLabel, icon }` triple from the
 * caller — used by IntakeStudio to embed the source PDF as a clickable link
 * on the root node when the file is small enough to fit in localStorage.
 */
export const buildMapFromParse = (parsed, sourceName, attachment = null) => ({
  id: newId(),
  title: (parsed.title || sourceName || "Untitled").slice(0, 120),
  summary: parsed.summary || "",
  children: parsed.children || [],
  sourcePages: parsed.source_pages || 0,
  ...(attachment?.link ? { link: attachment.link, linkLabel: attachment.linkLabel || sourceName, icon: attachment.icon || "pdf" } : {}),
});

/**
 * Merge a batch of parse-results into a single super-map where each doc is a
 * top-level branch under the parent "Research Pack" root.
 */
export const buildSuperMap = (parsedList, packName = "Research Pack") => ({
  id: newId(),
  title: packName,
  summary: `Merged from ${parsedList.length} PDFs`,
  children: parsedList.map((p) => ({
    id: newId(),
    title: (p.title || "Document").slice(0, 120),
    summary: p.summary || `${p.source_pages || 0} pages`,
    children: p.children || [],
  })),
});

/* ---------- OCR fallback (lazy-loaded) ---------- */

let _pdfjs = null;
let _tess = null;

const loadPdfJs = async () => {
  if (_pdfjs) return _pdfjs;
  _pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js v5 ships an ESM worker that's happiest as a `new URL` ref
  _pdfjs.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url").catch(() => null)
  )?.default || _pdfjs.GlobalWorkerOptions.workerSrc;
  return _pdfjs;
};

const loadTesseract = async () => {
  if (_tess) return _tess;
  const mod = await import("tesseract.js");
  _tess = mod;
  return mod;
};

/**
 * OCR a PDF by rendering each page to a canvas and passing it through
 * tesseract. Runs in the browser — zero backend / zero LLM cost.
 * Returns a best-effort list of heading-like lines.
 *
 * @param {File} file
 * @param {(msg: string, pct: number) => void} onProgress
 */
export async function ocrPdfToHeadings(file, onProgress = () => {}) {
  onProgress("Loading OCR engine…", 0.02);
  const pdfjs = await loadPdfJs();
  const tess = await loadTesseract();

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;
  const pages = Math.min(totalPages, 30); // cap so users don't hang on a 300-pg book
  if (totalPages > pages) {
    onProgress(`OCR will only cover first ${pages} of ${totalPages} pages…`, 0.04);
  }

  const worker = await tess.createWorker("eng", 1, { logger: () => {} });

  const linesByPage = [];
  for (let p = 1; p <= pages; p++) {
    onProgress(`OCR page ${p} / ${pages}…`, 0.05 + 0.9 * ((p - 1) / pages));
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const { data } = await worker.recognize(canvas);
    const lines = (data.text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    linesByPage.push({ page: p, lines });
  }
  await worker.terminate();
  onProgress("Extracting headings…", 0.98);

  // Heading heuristic (lightweight client-side version)
  const headings = [];
  for (const { page, lines } of linesByPage) {
    for (const raw of lines) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (line.length < 4 || line.length > 70) continue;
      const words = line.split(" ");
      if (words.length < 1 || words.length > 10) continue;
      if (/[.!?:,;]$/.test(line)) continue;
      const isNumbered = /^(\d+\.|\d+\.\d+|[IVX]+\.)\s+/.test(line);
      if (!(line === line.toUpperCase() || isTitleCase(line) || isNumbered)) continue;
      if (line.replace(/\s/g, "").match(/^\d+$/)) continue;
      // dedupe running headers
      if (headings.some((h) => h.title.toLowerCase() === line.toLowerCase())) continue;
      headings.push({
        id: `ocr-${page}-${headings.length}`,
        title: line.slice(0, 100),
        summary: `p. ${page}`,
        page,
        children: [],
      });
    }
  }
  onProgress("Done", 1);
  return headings;
}

const isTitleCase = (s) => {
  const words = s.split(/\s+/);
  if (!words.length) return false;
  const caps = words.filter((w) => /^[A-Z]/.test(w)).length;
  return caps >= Math.ceil(words.length * 0.6);
};

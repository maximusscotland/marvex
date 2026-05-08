/**
 * Decodes a ?clip=… query param posted by the Marvex Studio Chrome extension
 * and turns it into a synthetic Intake item (bypasses PDF parsing).
 *
 * Payload shape (produced by /app/extension/background.js):
 *   {
 *     url:       string,
 *     title:     string,
 *     selection: string?,     // present on selection clips
 *     clippedAt: ISO8601,
 *     source:    "chrome-extension",
 *     v:         1
 *   }
 *
 * Returns null if the param is missing / malformed — caller should ignore
 * rather than crash the page.
 */

const base64UrlDecode = (s) => {
  if (!s) return null;
  // Restore standard base64 padding + alphabet.
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const std = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try {
    const bin = atob(std);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

export const parseClipParam = (raw) => {
  const json = base64UrlDecode(raw);
  if (!json) return null;
  let obj;
  try { obj = JSON.parse(json); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  // Accept v:1 and v:2. Anything newer than we know → reject so we don't
  // silently misinterpret a future-incompatible payload.
  if (obj.v && obj.v > 2) return null;

  const article = obj.article && typeof obj.article === "object" ? {
    title:    String(obj.article.title    || "").slice(0, 200),
    byline:   obj.article.byline   ? String(obj.article.byline).slice(0, 200)   : null,
    excerpt:  obj.article.excerpt  ? String(obj.article.excerpt).slice(0, 400)  : null,
    siteName: obj.article.siteName ? String(obj.article.siteName).slice(0, 100) : null,
    length:   Number(obj.article.length) || 0,
    sections: Array.isArray(obj.article.sections) ? obj.article.sections.slice(0, 20).map((s) => ({
      heading: String(s.heading || "").slice(0, 160),
      level:   [2, 3, 4].includes(Number(s.level)) ? Number(s.level) : 2,
      paragraphs: Array.isArray(s.paragraphs)
        ? s.paragraphs.slice(0, 8).map((p) => String(p).slice(0, 280)).filter(Boolean)
        : [],
    })) : [],
  } : null;

  return {
    url:       String(obj.url || ""),
    title:     String(obj.title || "Untitled clip").slice(0, 200),
    selection: obj.selection ? String(obj.selection).slice(0, 4000) : "",
    article,
    clippedAt: obj.clippedAt || new Date().toISOString(),
    source:    obj.source || "chrome-extension",
  };
};

/**
 * Build a flat heading list (IntakeStudio's `headings` format) from a clip.
 *
 * Three shapes, in priority order:
 *
 *   A. `article.sections` present (Readability extracted a real article):
 *      - root = article.title (with byline + site + excerpt under "About")
 *      - each section heading becomes a depth-1 branch
 *      - each section's paragraphs become depth-2 leaves (capped at 5)
 *      - Source URL leaf at the bottom
 *
 *   B. `selection` present (user clipped a passage):
 *      - root title, Source URL, "Clipped passage" with sentence-split leaves
 *
 *   C. bare page clip (no article, no selection):
 *      - root title, Source URL, three "Key ideas / Open questions / Next steps"
 */
export const clipToHeadings = (clip) => {
  const headings = [];
  if (!clip) return headings;

  // ---- Shape A: structured article from Readability ----
  if (clip.article && Array.isArray(clip.article.sections) && clip.article.sections.length) {
    const a = clip.article;
    headings.push({ title: a.title || clip.title || "Untitled article", depth: 0 });

    if (a.byline || a.siteName || a.excerpt) {
      headings.push({ title: "About", depth: 1 });
      if (a.byline)   headings.push({ title: `By ${a.byline}`, depth: 2 });
      if (a.siteName) headings.push({ title: a.siteName, depth: 2 });
      if (a.excerpt)  headings.push({ title: a.excerpt, depth: 2 });
    }

    for (const s of a.sections) {
      const h = (s.heading || "").trim();
      if (h) headings.push({ title: h, depth: 1 });
      for (const p of (s.paragraphs || []).slice(0, 5)) {
        headings.push({ title: p, depth: h ? 2 : 1 });
      }
    }

    if (clip.url) {
      headings.push({ title: "Source", depth: 1 });
      headings.push({ title: clip.url, depth: 2 });
    }
    return headings;
  }

  // ---- Shape B / C: fall back to v:1 behaviour ----
  headings.push({ title: clip.title || "Untitled clip", depth: 0 });

  if (clip.url) {
    headings.push({ title: "Source", depth: 1 });
    // Store the bare URL as a leaf — user can delete / rename freely.
    headings.push({ title: clip.url, depth: 2 });
  }

  if (clip.selection) {
    headings.push({ title: "Clipped passage", depth: 1 });
    // Break the selection into paragraph-sized leaves for prettier mapping.
    const paras = clip.selection
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/g)
      .map((p) => p.trim())
      .filter((p) => p.length > 4)
      .slice(0, 6);
    for (const p of paras) {
      headings.push({ title: p.slice(0, 140), depth: 2 });
    }
  } else {
    // Placeholder children to give the user a starting structure.
    headings.push({ title: "Key ideas", depth: 1 });
    headings.push({ title: "Open questions", depth: 1 });
    headings.push({ title: "Next steps", depth: 1 });
  }

  return headings;
};

/**
 * Build a synthetic IntakeStudio item from a clip payload. The resulting
 * shape matches what `runParse()` normally produces, minus the `file`
 * handle (clips don't have one — they can't be re-parsed or OCR'd).
 */
export const clipToIntakeItem = (clip) => {
  const headings = clipToHeadings(clip);
  return {
    id: `clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    file: null,             // no PDF
    status: "preview",      // matches STATUS.PREVIEW in intakeStatus.js
    headings,
    error: null,
    ocrProgress: null,
    parsedTitle: (clip.article && clip.article.title) || clip.title || "Untitled clip",
    sourcePages: 0,
    enrich: false,
    autoDeepen: false,
    clipMeta: {
      url: clip.url,
      clippedAt: clip.clippedAt,
      source: clip.source,
      hasSelection: !!clip.selection,
      hasArticle: !!(clip.article && clip.article.sections && clip.article.sections.length),
      sectionCount: clip.article && clip.article.sections ? clip.article.sections.length : 0,
    },
  };
};

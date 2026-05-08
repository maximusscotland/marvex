// Mind-Mapper — article extractor content script.
// Runs inside the active tab via chrome.scripting.executeScript.
//
// Uses Mozilla's Readability (vendored in /vendor/Readability.js) to
// pull the main article content, then walks the cleaned HTML to emit
// a mind-map-friendly structure:
//
//   {
//     ok: boolean,
//     title: string,
//     byline: string | null,
//     excerpt: string | null,
//     length: number,           // char count of cleaned article
//     siteName: string | null,
//     sections: [
//       { heading: string, level: 2|3|4, paragraphs: string[] }
//     ]
//   }
//
// Falls back to `{ok: false}` when Readability refuses the page (login
// walls, captchas, SPAs without server-rendered content). Callers should
// degrade gracefully to the existing page-only clip shape.
//
// Notes:
//   - Runs in the page's isolated-world script context, so `Readability`
//     must be injected into the same world (see background.js).
//   - Caps: 20 sections, 8 paragraphs per section, 280 chars per paragraph,
//     160 chars per heading. The mind-map UI breaks past these limits.

(function extractArticle() {
  const MAX_SECTIONS = 20;
  const MAX_PARAS_PER_SECTION = 8;
  const MAX_PARA_CHARS = 280;
  const MAX_HEADING_CHARS = 160;

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

  try {
    // eslint-disable-next-line no-undef
    if (typeof Readability !== "function") {
      return { ok: false, reason: "readability-missing" };
    }

    // Clone the document so Readability's mutations don't wreck the live page.
    const docClone = document.cloneNode(true);
    // eslint-disable-next-line no-undef
    const parsed = new Readability(docClone).parse();
    if (!parsed || !parsed.content) {
      return { ok: false, reason: "no-article" };
    }

    // Re-parse the cleaned HTML so we can walk it as a DOM.
    const container = document.createElement("div");
    container.innerHTML = parsed.content;

    const sections = [];
    // The first "section" is the intro — everything before the first heading.
    let current = { heading: "", level: 2, paragraphs: [] };

    const pushCurrent = () => {
      if (current.heading || current.paragraphs.length) {
        sections.push({
          heading: clean(current.heading).slice(0, MAX_HEADING_CHARS),
          level: current.level,
          paragraphs: current.paragraphs
            .map((p) => clean(p).slice(0, MAX_PARA_CHARS))
            .filter((p) => p.length > 20)
            .slice(0, MAX_PARAS_PER_SECTION),
        });
      }
    };

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
    let node = walker.currentNode;
    while (node) {
      const tag = (node.tagName || "").toLowerCase();
      if (/^h[1-4]$/.test(tag)) {
        pushCurrent();
        const level = Math.min(4, Math.max(2, parseInt(tag.slice(1), 10)));
        current = { heading: node.textContent || "", level, paragraphs: [] };
      } else if (tag === "p" || tag === "li" || tag === "blockquote") {
        const txt = clean(node.textContent);
        if (txt.length > 20) current.paragraphs.push(txt);
      }
      node = walker.nextNode();
    }
    pushCurrent();

    // Strip the "intro" section if it's empty after cleaning.
    const filtered = sections
      .filter((s) => s.heading || s.paragraphs.length)
      .slice(0, MAX_SECTIONS);

    return {
      ok: true,
      title:    clean(parsed.title    || document.title).slice(0, 200),
      byline:   clean(parsed.byline   || "").slice(0, 200) || null,
      excerpt:  clean(parsed.excerpt  || "").slice(0, 400) || null,
      length:   parsed.length || 0,
      siteName: clean(parsed.siteName || "").slice(0, 100) || null,
      sections: filtered,
    };
  } catch (err) {
    return { ok: false, reason: String((err && err.message) || err) };
  }
})();

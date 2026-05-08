// Browser bookmarks importer — parses the standard Netscape Bookmark
// File Format (the HTML you get when you "Export bookmarks…" from Chrome,
// Firefox, Safari, Edge, Brave, Opera, etc.).
//
// The format is wonderfully simple:
//   <DL><p>
//     <DT><A HREF="https://example.com" ADD_DATE="..." ICON="data:...">Label</A>
//     <DT><H3 ADD_DATE="...">Folder Name</H3>
//     <DL><p>  ...nested...  </DL><p>
//   </DL><p>
//
// We walk the resulting DOM and produce a normal mind-mapper map tree:
//   folder <H3>  -> branch node (no link)
//   link   <A>   -> leaf node with .link = href and .icon = favicon
//
// Returns a `map` object compatible with /app/frontend/src/lib/storage.js
// `saveMap`. The caller decides whether to drop it as a new map, merge
// onto an existing one, or chunk per top-level folder.

import { newId } from "@/lib/storage";

const newNodeId = () =>
  `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Parse a Netscape Bookmark HTML string into a tree of nodes.
 *
 * Returns: { root, linkCount, folderCount }
 * where `root` is the top-level node (already wired with children).
 */
export function parseBookmarksHtml(html, { rootTitle = "Browser bookmarks" } = {}) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // The outermost DL is the global container — both Chrome and Firefox put
  // the entire tree under a single top-level <DL>. If we can't find one,
  // fall back to scanning the body so we don't blow up on edge formats.
  const topDL = doc.querySelector("DL") || doc.body;

  let linkCount = 0;
  let folderCount = 0;

  /**
   * Walk a <DL> element and return its direct children (folders + links).
   * Browsers serialise the format slightly inconsistently (Chrome puts a
   * <DT> wrapper, Firefox sometimes nests <p>s differently), so we walk
   * by tag rather than by structural position.
   */
  const walkDL = (dl) => {
    const out = [];
    if (!dl) return out;
    // Browsers put each item inside a <DT> child of the <DL>. The H3
    // (folder) appears alongside its sibling <DL> (the folder's contents).
    const items = dl.children;
    for (let i = 0; i < items.length; i++) {
      const dt = items[i];
      if (!dt || dt.tagName !== "DT") continue;
      // A folder <DT> contains an <H3> followed by a sibling <DL>. The
      // sibling <DL> can be either inside the same DT or a direct sibling
      // of the DT — both shapes occur in the wild.
      const h3 = dt.querySelector(":scope > H3");
      if (h3) {
        // Find the sibling DL that holds this folder's children. First
        // look INSIDE the DT (Firefox-shaped), then look at the next
        // direct sibling element of the DT (Chrome-shaped).
        let childDL = dt.querySelector(":scope > DL");
        if (!childDL) {
          let sib = dt.nextElementSibling;
          while (sib && sib.tagName !== "DL" && sib.tagName !== "DT") sib = sib.nextElementSibling;
          if (sib && sib.tagName === "DL") childDL = sib;
        }
        folderCount += 1;
        out.push({
          id: newNodeId(),
          title: (h3.textContent || "Folder").trim().slice(0, 120) || "Folder",
          shape: "rect",
          children: walkDL(childDL),
        });
        continue;
      }
      // A link DT contains an <A>.
      const a = dt.querySelector(":scope > A");
      if (a) {
        const href = a.getAttribute("HREF") || a.getAttribute("href") || "";
        if (!href) continue;
        const icon = a.getAttribute("ICON") || a.getAttribute("icon") || "";
        linkCount += 1;
        out.push({
          id: newNodeId(),
          title: (a.textContent || href).trim().slice(0, 120) || href,
          shape: "ellipse",
          link: href,
          ...(icon ? { icon } : {}),
          children: [],
        });
      }
    }
    return out;
  };

  const children = walkDL(topDL);

  const root = {
    id: newNodeId(),
    title: rootTitle,
    shape: "rect",
    children,
  };

  return { root, linkCount, folderCount };
}

/**
 * Build a complete mind-mapper map document (suitable for saveMap()) from
 * a parsed bookmarks tree.
 */
export function buildMapFromBookmarks(html, opts = {}) {
  const { root, linkCount, folderCount } = parseBookmarksHtml(html, opts);
  return {
    map: {
      id: newId(),
      title: opts.rootTitle || "Browser bookmarks",
      ...root,
      // metadata so the user knows this map originated from a bookmarks import
      source: "bookmarks-import",
      sourceDate: new Date().toISOString(),
    },
    linkCount,
    folderCount,
  };
}

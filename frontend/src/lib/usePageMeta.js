import { useEffect } from "react";

/**
 * Upsert a single <meta> tag into <head>. Returns the element so callers
 * can optionally hold a ref (we don't — we leave tags in place on unmount
 * since most navigations mount a new page that overwrites them).
 */
export const upsertMeta = (key, value, isProperty = true) => {
  if (typeof document === "undefined") return null;
  const attr = isProperty ? "property" : "name";
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value || "");
  return el;
};

/**
 * Hook — write title + og/twitter meta tags AND canonical URL for a page.
 * Restores the previous title on unmount but leaves meta tags in place
 * (see SharedMap precedent — the next page overwrites them).
 *
 * Pass a plain object:
 *   usePageMeta({ title, description, image?, url?, type? })
 *
 * The `url` value doubles as the canonical URL. Pass the absolute
 * production URL (e.g. https://marvex.app/press) — never the dev
 * preview origin, which would tell Google to index the wrong host.
 */
export default function usePageMeta({ title, description, image, url, type = "website" } = {}) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const prevTitle = document.title;
    if (title) document.title = title;

    const pageUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    if (title)       upsertMeta("og:title", title);
    if (description) {
      upsertMeta("og:description", description);
      upsertMeta("twitter:description", description, false);
      upsertMeta("description", description, false);
    }
    if (type)  upsertMeta("og:type", type);
    if (pageUrl) upsertMeta("og:url", pageUrl);
    if (image) {
      upsertMeta("og:image", image);
      upsertMeta("twitter:image", image, false);
      upsertMeta("twitter:card", "summary_large_image", false);
    }
    if (title) upsertMeta("twitter:title", title, false);

    // Canonical link — only set when an explicit `url` is provided, so we
    // never overwrite the global canonical with a localhost/preview origin.
    if (url) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", url);
    }

    return () => { document.title = prevTitle; };
  }, [title, description, image, url, type]);
}

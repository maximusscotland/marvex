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

// Site-wide default OG image — used by every page that doesn't pass its
// own `image`. 1200×630, brand-consistent cosmic mind-map silhouette.
// Generated via /app/backend/generate_og_card.py — re-run that script
// when the brand evolves.
const DEFAULT_OG_IMAGE = "https://marvex.app/og/marvex-default.png";

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
 *
 * If `image` is not provided we fall through to DEFAULT_OG_IMAGE so
 * social-share cards always render correctly. Pages that want a
 * page-specific OG card can pass an absolute URL to override.
 */
export default function usePageMeta({ title, description, image, url, type = "website", jsonLd } = {}) {
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

    // Always set OG image — falls through to brand default if page
    // didn't pass one. Prevents "stale image from previously-visited
    // route" bugs that previously polluted /pricing and /vs/* shares.
    const ogImage = image || DEFAULT_OG_IMAGE;
    upsertMeta("og:image", ogImage);
    upsertMeta("twitter:image", ogImage, false);
    upsertMeta("twitter:card", "summary_large_image", false);

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

    // JSON-LD structured data — accepts a single object or an array of
    // schema objects. Each entry becomes its own <script> tag tagged
    // with `data-managed-by="usePageMeta"` so we can clean them up on
    // unmount/route change without nuking globally-injected schemas
    // (Organization, WebSite, etc. live in /public/index.html and
    // don't carry this attribute).
    const ldScripts = [];
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const obj of items) {
        if (!obj) continue;
        const el = document.createElement("script");
        el.type = "application/ld+json";
        el.setAttribute("data-managed-by", "usePageMeta");
        el.textContent = JSON.stringify(obj);
        document.head.appendChild(el);
        ldScripts.push(el);
      }
    }

    return () => {
      document.title = prevTitle;
      ldScripts.forEach((el) => el.remove());
    };
  }, [title, description, image, url, type, jsonLd]);
}

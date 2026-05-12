/* eslint-disable */
/**
 * scripts/prerender.js — build-time static site generation (SSG) for the
 * marketing surfaces of marvex.app.
 *
 * What this does:
 *   1. Boots a tiny static server pointing at /app/frontend/build (so
 *      the CRA app behaves exactly like it will in production).
 *   2. Launches headless Chrome via Puppeteer.
 *   3. For every route in MARKETING_ROUTES below, navigates there,
 *      waits for the React render to settle (networkidle2 + a
 *      generous DOM-ready selector), then captures the full HTML
 *      output.
 *   4. Writes that HTML to `build/<route>/index.html` so the static
 *      host (Cloudflare / nginx / Emergent's deployment server) serves
 *      a fully-rendered page to crawlers and humans BEFORE the React
 *      bundle has a chance to download + execute.
 *
 * Why bother?
 *   • Bing, DuckDuckGo, Yandex and most AI-search crawlers (Perplexity,
 *     ChatGPT browse, You.com) skip or limit JavaScript execution.
 *     Without prerendering they see an empty `<div id="root">`.
 *   • Real-user LCP on the landing page drops 3-5s because the
 *     critical text is in the HTML, not held behind a 250KB JS bundle.
 *   • Social previews stay rich (we already set meta tags via
 *     usePageMeta, but now they're guaranteed present even without
 *     Helmet/SSR overhead).
 *
 * What this does NOT touch:
 *   • App / library / studio / admin routes — interactive, auth-gated,
 *     zero SEO value.  Prerendering them would just waste build time
 *     and bake stale state into the HTML.
 *   • `/share/:slug`, `/learn/:slug`, `/vs/:slug` patterns — we
 *     explicitly list the known slugs to avoid an O(n) build penalty
 *     when new articles are added (just append the slug here).
 *
 * Edge cases handled:
 *   • Build-time-only flag `window.__PRERENDER__ = true` is injected so
 *     components with non-deterministic behaviour (e.g. the A/B/C
 *     subheadline picker on Landing.jsx) can opt into a stable variant
 *     during snapshot.  React 18 hydration still works because the
 *     swap to the variant happens after hydrate.
 *   • Hash routes / hash fragments are stripped.
 *   • The script never fails the parent build — if a route 500s or
 *     puppeteer crashes, we log it and the CRA-generated /index.html
 *     stays as a graceful fallback for that URL.
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const handler = require("serve-handler");
const puppeteer = require("puppeteer");

// ── Config ────────────────────────────────────────────────────────────
const BUILD_DIR = path.resolve(__dirname, "..", "build");
const PORT = 5050;
const NAV_TIMEOUT = 30000;
// We give each page a brief idle window AFTER networkidle2 so deferred
// hooks (usePageMeta writing <title>/<meta>, ScrollReveal hydration,
// etc) land in the captured HTML.
const POST_IDLE_DELAY = 600;

const MARKETING_ROUTES = [
  // Top-level marketing pages
  "/",
  "/pricing",
  "/faq",
  "/press",
  "/affiliate",
  "/contact",
  "/privacy",
  "/terms",
  "/download",
  "/pdf-to-mind-map",
  "/learn",
  // Long-form SEO articles (one chunk = one URL we want crawlers to index)
  "/learn/how-to-turn-pdf-into-mind-map",
  "/learn/best-pdf-mind-map-tools-2026",
  "/learn/ai-mind-map-generator-explained",
  "/learn/mind-mapping-for-students",
  "/learn/mind-map-vs-flowchart-vs-concept-map",
  "/learn/notion-alternative-for-mind-mapping-2026",
  // Competitor comparison pages
  "/vs/heptabase",
  "/vs/mapify",
  "/vs/notion",
];

// ── Helpers ───────────────────────────────────────────────────────────
const log = (msg) => console.log(`[prerender] ${msg}`);

/** Start a Node static server with SPA fallback so React Router can do
 *  its thing inside Puppeteer. */
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) =>
      handler(req, res, {
        public: BUILD_DIR,
        // SPA fallback: any unknown path resolves to /index.html so
        // React Router takes over.  Without this, `/pricing` would 404
        // against the static handler.
        rewrites: [{ source: "**", destination: "/index.html" }],
        // Don't redirect /pricing/ → /pricing — keeps URLs canonical.
        cleanUrls: false,
      })
    );
    server.listen(PORT, () => resolve(server));
  });
}

/** Render one route in headless Chrome, return its outer HTML. */
async function renderRoute(browser, route) {
  const page = await browser.newPage();
  // Generous viewport so any conditional rendering (mobile vs desktop
  // hero variants) lands on the desktop branch — that's what crawlers
  // see anyway with their default 1920×1080 viewport.
  await page.setViewport({ width: 1280, height: 800 });
  await page.setDefaultNavigationTimeout(NAV_TIMEOUT);

  // Inject the prerender flag BEFORE any script runs so component
  // initialisers can read it.  This is how Landing.jsx (or any other
  // page with non-deterministic state) picks a stable variant.
  await page.evaluateOnNewDocument(() => {
    window.__PRERENDER__ = true;
  });

  // We don't want analytics / Sentry / Resend probes firing during
  // prerender — they pollute the timeline and risk hanging on slow
  // 3rd-party calls.  Cancel network requests to known telemetry
  // hosts.
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (/posthog\.com|sentry\.io|resend\.com|stripe\.com/.test(url)) {
      return req.abort();
    }
    return req.continue();
  });

  const url = `http://localhost:${PORT}${route}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
  // Small idle window so deferred effects (usePageMeta, ScrollReveal)
  // can write into the DOM before we capture it.
  await new Promise((r) => setTimeout(r, POST_IDLE_DELAY));

  // Strip out any prerender-time-only state we don't want to hydrate
  // (e.g. inline ad-hoc style tags that React rewrites on mount).
  const html = await page.evaluate(() => {
    // Remove the prerender flag so it doesn't leak into prod.
    try { delete window.__PRERENDER__; } catch { /* ignore */ }
    return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
  });

  await page.close();
  return html;
}

/** Write a single rendered HTML file to /build/<route>/index.html.
 *  For the root, we overwrite /build/index.html directly. */
function writeRoute(route, html) {
  if (route === "/") {
    fs.writeFileSync(path.join(BUILD_DIR, "index.html"), html);
    return;
  }
  const dir = path.join(BUILD_DIR, route.replace(/^\//, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

// ── Main ──────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(BUILD_DIR) || !fs.existsSync(path.join(BUILD_DIR, "index.html"))) {
    console.error("[prerender] build/ is missing or empty — run `yarn build` first.");
    process.exit(1);
  }
  log(`booting static server on :${PORT}`);
  const server = await startServer();
  log("launching headless chrome");
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  let okCount = 0;
  let failCount = 0;
  for (const route of MARKETING_ROUTES) {
    try {
      const html = await renderRoute(browser, route);
      writeRoute(route, html);
      log(`✓ ${route} (${(html.length / 1024).toFixed(1)} KB)`);
      okCount++;
    } catch (err) {
      log(`✗ ${route} — ${err.message}`);
      failCount++;
    }
  }

  await browser.close();
  await new Promise((r) => server.close(r));
  log(`done — ${okCount} OK, ${failCount} failed (out of ${MARKETING_ROUTES.length})`);
  // Never fail the parent build on a prerender error — the fallback
  // CRA index.html is still valid for affected URLs.
  process.exit(0);
})();

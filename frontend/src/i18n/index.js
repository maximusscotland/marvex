/**
 * i18n bootstrap — runs once at app startup.
 *
 * Locales:
 *   en (source of truth, bundled eagerly) · es · fr · de · pt · it · nl ·
 *   pl · ja · zh-Hans  (all loaded lazily as webpack chunks)
 *
 * JSON files live under /app/frontend/src/i18n/locales/<code>.json. They are
 * AI-generated at dev-time via `scripts/translate-locales.py` (one-shot
 * Claude call, reviewed + committed to the repo). No runtime LLM dependency.
 *
 * Loading strategy (Feb 2026 — perf overhaul):
 *   • `en` is statically imported so it's in the initial bundle.  English
 *     is the source-of-truth content seen by crawlers, screen-readers in
 *     no-JS contexts, and every visitor whose browser language isn't one
 *     of the other 9.
 *   • Every OTHER locale is a separate webpack chunk pulled in via
 *     dynamic `import()` only when the language detector picks it.  This
 *     trims ~210KB of JSON (~75KB gzipped) off the critical-path bundle.
 *     The user perceives no change — their language was always going to
 *     need a network roundtrip on first visit; we just stop loading the
 *     other 8 at the same time.
 *   • `i18next` shows the English fallback for ~50-150ms while the
 *     locale chunk arrives, then re-renders.  In practice the swap is
 *     invisible because the LCP candidate is the hero (image/heading) —
 *     localised body copy below it lands before the user reads down.
 *
 * Language detection order:
 *   1. `mindmapper.lang` in localStorage (user's explicit choice)
 *   2. ?lng=<code> querystring (useful for testing)
 *   3. browser navigator.language
 *   4. fallback → en
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";

// English is the canonical source — bundled eagerly so first paint
// (and SEO crawlers + JS-disabled visitors) never see a translation
// gap. All other locales are dynamic webpack chunks.
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en",      label: "English",    nativeLabel: "English" },
  { code: "es",      label: "Spanish",    nativeLabel: "Español" },
  { code: "fr",      label: "French",     nativeLabel: "Français" },
  { code: "de",      label: "German",     nativeLabel: "Deutsch" },
  { code: "pt",      label: "Portuguese", nativeLabel: "Português" },
  { code: "it",      label: "Italian",    nativeLabel: "Italiano" },
  { code: "nl",      label: "Dutch",      nativeLabel: "Nederlands" },
  { code: "pl",      label: "Polish",     nativeLabel: "Polski" },
  { code: "ja",      label: "Japanese",   nativeLabel: "日本語" },
  { code: "zh-Hans", label: "Chinese",    nativeLabel: "简体中文" },
];

const STORAGE_KEY = "mindmapper.lang";

// Lazy locale loader.  Maps the i18next-resources-to-backend callback
// signature to a webpack dynamic import so each locale becomes its own
// `locale-<lang>.<hash>.chunk.js`.  The `webpackChunkName` magic
// comment is what guarantees stable, debuggable filenames.
const lazyLocale = resourcesToBackend((language, namespace, callback) => {
  // `zh` is a detector alias for `zh-Hans` — route it to the same chunk.
  const code = language === "zh" ? "zh-Hans" : language;
  // English is already in memory; skip the network and resolve sync.
  if (code === "en") { callback(null, en); return; }
  import(
    /* webpackChunkName: "locale-[request]" */
    `./locales/${code}.json`
  )
    .then((mod) => callback(null, mod.default || mod))
    .catch((err) => {
      // Network failure → fall through to fallback (en).  i18next
      // already handles this gracefully; logging keeps a breadcrumb
      // for Sentry without crashing the page.
      // eslint-disable-next-line no-console
      console.warn(`[i18n] failed to load locale "${code}":`, err?.message);
      callback(err, null);
    });
});

i18n
  .use(lazyLocale)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // English is preloaded so the first paint always has copy in hand —
    // every other language hydrates from its chunk on demand.
    resources: { en: { translation: en } },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES.map((l) => l.code), "zh"],
    // Map region variants (en-GB, es-MX) back to the base language. zh-Hans
    // stays intact because it's listed explicitly in supportedLngs, and zh
    // is registered as an alias pointing at the same Simplified resource.
    nonExplicitSupportedLngs: true,
    // partialBundledLanguages so i18next knows en is already loaded and
    // doesn't try to re-fetch it via the backend.
    partialBundledLanguages: true,
    detection: {
      order: ["localStorage", "querystring", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      lookupQuerystring: "lng",
      caches: ["localStorage"],
      // Preserve script subtag casing (e.g. zh-Hans vs zh-hans). The default
      // detector lowercases everything, which breaks our Chinese locale.
      convertDetectedLanguage: (lng) => {
        if (!lng) return lng;
        const lower = String(lng).toLowerCase().replace("_", "-");
        if (lower === "zh-hans" || lower.startsWith("zh-hans-")) return "zh-Hans";
        if (lower === "zh-hant" || lower.startsWith("zh-hant-")) return "zh-Hans"; // graceful fallback
        return lower;
      },
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnEmptyString: false,
    // While the target locale chunk is in flight, fall back to en so
    // visible UI never flashes raw translation keys.
    react: { useSuspense: false },
  });

if (typeof window !== "undefined") {
  window.__i18n = i18n;
}

export default i18n;

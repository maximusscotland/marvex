/**
 * i18n bootstrap — runs once at app startup.
 *
 * Locales:
 *   en (source of truth) · es · fr · de · pt · it · nl · pl · ja · zh-Hans
 *
 * JSON files live under /app/frontend/src/i18n/locales/<code>.json. They are
 * AI-generated at dev-time via `scripts/translate-locales.py` (one-shot
 * Claude call, reviewed + committed to the repo). No runtime LLM dependency.
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

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";
import it from "./locales/it.json";
import nl from "./locales/nl.json";
import pl from "./locales/pl.json";
import ja from "./locales/ja.json";
import zhHans from "./locales/zh-Hans.json";

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      pt: { translation: pt },
      it: { translation: it },
      nl: { translation: nl },
      pl: { translation: pl },
      ja: { translation: ja },
      "zh-Hans": { translation: zhHans },
      // Alias so `zh` (stripped by nonExplicitSupportedLngs) + any zh-* region
      // variants still resolve to our Simplified Chinese bundle.
      zh: { translation: zhHans },
    },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES.map((l) => l.code), "zh"],
    // Map region variants (en-GB, es-MX) back to the base language. zh-Hans
    // stays intact because it's listed explicitly in supportedLngs, and zh
    // is registered as an alias pointing at the same Simplified resource.
    nonExplicitSupportedLngs: true,
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
  });

if (typeof window !== "undefined") {
  window.__i18n = i18n;
}

export default i18n;

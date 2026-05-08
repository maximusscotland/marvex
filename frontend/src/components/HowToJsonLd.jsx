import React, { useEffect } from "react";

/**
 * Injects a schema.org HowTo JSON-LD <script> into <head>. One per tutorial
 * page (each tutorial = one HowTo). Different schema family from FAQPage —
 * Google won't conflate them, and HowTo unlocks the step-by-step rich-result
 * carousel that's separate from the FAQ accordion on /pricing.
 *
 * The script is keyed by `id` so re-mounts (e.g. tutorial-to-tutorial nav)
 * REPLACE the previous payload rather than stacking duplicates in <head>.
 *
 * Required fields (per Google's HowTo schema docs):
 *   - name (the tutorial title)
 *   - step[] each with name + text
 * Optional we include because we have it:
 *   - description (subtitle)
 *   - totalTime (ISO 8601 duration "PT5M")
 *   - inLanguage (whatever the user has selected)
 */
export default function HowToJsonLd({ name, description, minutes, steps, lang = "en" }) {
  useEffect(() => {
    if (!name || !Array.isArray(steps) || steps.length === 0) return undefined;

    const id = "howto-json-ld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }

    const payload = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name,
      ...(description ? { description } : {}),
      ...(minutes ? { totalTime: `PT${minutes}M` } : {}),
      inLanguage: lang,
      step: steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.heading,
        text: s.body,
      })),
    };
    el.textContent = JSON.stringify(payload);

    return () => {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    };
  }, [name, description, minutes, steps, lang]);

  return null;
}

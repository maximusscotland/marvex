import React, { useEffect } from "react";
import { buildFaqJsonLd } from "@/lib/faqs";

/**
 * Injects an FAQPage JSON-LD <script> into <head> for Google rich-results.
 * Only one FAQ block on the site should render this — Pricing wins because
 * it's the canonical conversion page; Landing renders the FAQ visually but
 * does not duplicate the schema (Google flags duplicate FAQ schemas).
 *
 * The script is keyed by `id` so multiple mounts replace rather than stack.
 */
export default function FaqJsonLd() {
  useEffect(() => {
    const id = "faq-json-ld";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(buildFaqJsonLd());
    return () => {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    };
  }, []);
  return null;
}

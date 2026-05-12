import React from "react";
import { Link } from "react-router-dom";

/**
 * Tiny inline markdown renderer for FAQ-style answers across the app.
 * Supports two tokens only: **bold** and [text](href).
 *
 *   - href starting with "/"     → SPA <Link> (no full reload)
 *   - href starting with "mailto:" → <a> without target=_blank
 *   - everything else            → <a target="_blank" rel="noopener">
 *
 * Shared between LandingFaq.jsx and Pricing.jsx so the canonical FAQ
 * answer strings in /lib/faqs.js can carry internal links once and
 * surface them as real <Link>s on every page that renders them.
 *
 * Kept dependency-free (no remark / no react-markdown) — the bundle
 * cost of a real parser dwarfs the entire LandingFaq section.
 */
const TOKEN_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

export default function renderInline(text) {
  const parts = String(text).split(TOKEN_RE).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    const m = p.match(LINK_RE);
    if (m) {
      const [, label, href] = m;
      const isInternal = href.startsWith("/");
      const isMail = href.startsWith("mailto:");
      const cls = "text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/40 underline-offset-4";
      return isInternal ? (
        <Link key={i} to={href} className={cls}>{label}</Link>
      ) : (
        <a
          key={i}
          href={href}
          {...(isMail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          className={cls}
        >
          {label}
        </a>
      );
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

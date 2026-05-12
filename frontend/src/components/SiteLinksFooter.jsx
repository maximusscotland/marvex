import React from "react";
import { Link } from "react-router-dom";
import { ICO, ICO_REGISTERED } from "@/lib/legal";

/**
 * <SiteLinksFooter />
 *
 * Discreet text-link sitemap rendered above the legal/copyright footer.
 * Lives at the bottom of every public page so that:
 *   1. Visitors can navigate sideways without going back to the homepage.
 *   2. Search engines see internal links from every URL, spreading the
 *      "link juice" earned by the homepage to deep pages — the textbook
 *      pillar-and-cluster reinforcement model.
 *   3. Anchor text uses target keywords ("PDF to mind map", "AI mind
 *      map generator", "Marvex vs Heptabase") rather than generic
 *      "click here" — Google reads these as topic signals.
 *
 * Layout: 4 columns on desktop, 2 on tablet, 1 on mobile. Headings are
 * monospace caps to match the cosmic typography, links are subdued
 * cyan that lifts on hover.
 *
 * Used by: every public page (landing wraps it, /pdf-to-mind-map, all
 * /learn/* articles, /pricing, /press, /vs/*, /download). Authenticated
 * routes (/app, /library) deliberately skip it — clutter inside the
 * Studio is wasted real estate.
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { to: "/pdf-to-mind-map", label: "PDF to mind map" },
      { to: "/library",         label: "Open Studio (web)" },
      { to: "/download",        label: "Download desktop app" },
      { to: "/pricing",         label: "Pricing & plans" },
      { to: "/galaxy",          label: "Public maps gallery" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { to: "/learn",                                                  label: "All tutorials" },
      // Featured: the multi-lesson mini-course earns top placement in
      // the footer because it carries Course schema + is the deepest
      // SEO asset on the site.
      { to: "/mini-course/teaching-with-mind-maps",                    label: "Mini-course: Teaching with mind maps" },
      { to: "/learn/how-to-turn-pdf-into-mind-map",                    label: "How to turn a PDF into a mind map" },
      { to: "/learn/best-pdf-mind-map-tools-2026",                     label: "Best PDF mind map tools (2026)" },
      { to: "/learn/ai-mind-map-generator-explained",                  label: "How AI mind map generators work" },
      { to: "/learn/mind-mapping-for-students",                        label: "Mind mapping for students" },
      { to: "/learn/mind-map-vs-flowchart-vs-concept-map",             label: "Mind map vs flowchart vs concept map" },
      // Added Feb 2026 — was previously a "ghost" article (lived in
      // articles.js + /learn but unreachable from any footer). Free
      // internal-link equity now flowing from every public page.
      { to: "/learn/notion-alternative-for-mind-mapping-2026",         label: "Notion alternative for mind mapping" },
    ],
  },
  {
    heading: "Compare",
    links: [
      { to: "/vs/heptabase", label: "Marvex vs Heptabase" },
      { to: "/vs/mapify",    label: "Marvex vs Mapify" },
      { to: "/vs/notion",    label: "Marvex vs Notion" },
    ],
  },
  {
    heading: "Company",
    links: [
      { to: "/faq",       label: "FAQ" },
      { to: "/contact",   label: "Contact" },
      { to: "/press",     label: "Press & reviewers" },
      { to: "/affiliate", label: "Affiliate programme" },
      { to: "/redeem",    label: "Redeem an access code" },
      { to: "/report-bug",label: "Report a bug" },
      { to: "/privacy",   label: "Privacy policy" },
      { to: "/terms",     label: "Terms of service" },
    ],
  },
];

export default function SiteLinksFooter() {
  return (
    <nav
      aria-label="Site links"
      data-testid="site-links-footer"
      className="relative z-10 px-6 lg:px-12 py-14 border-t border-white/5"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
        {COLUMNS.map((col) => (
          <div key={col.heading} data-testid={`footer-col-${col.heading.toLowerCase()}`}>
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-4">
              {col.heading}
            </div>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    data-testid={`footer-link-${l.to.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")}`}
                    className="text-[12.5px] text-[#9aa7c7] hover:text-cyan-200 transition leading-snug"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Trust strip — ICO registration shown only once it's issued so we
          never display a placeholder/pending value to visitors. While the
          application is in flight (typically 3–10 days post-submission)
          the strip silently hides — the dedicated section in /privacy
          handles the "pending" UX with proper context. */}
      {ICO_REGISTERED && (
        <div
          data-testid="footer-ico-strip"
          className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 mono text-[10px] uppercase tracking-[0.22em] text-[#566187]"
        >
          <div>
            UK ICO registered ·{" "}
            <a
              href={ICO.verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7a87ad] hover:text-cyan-300"
              data-testid="footer-ico-verify"
            >
              {ICO.registrationNumber}
            </a>
          </div>
          <Link to="/privacy" className="text-[#7a87ad] hover:text-cyan-300">
            Privacy & data rights →
          </Link>
        </div>
      )}
    </nav>
  );
}

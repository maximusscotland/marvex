import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlignJustify,
  HelpCircle,
  BookOpen,
  Coins,
  ShieldCheck,
  FileText,
  Download,
  Ticket,
  Sparkles,
  Github,
  RefreshCw,
} from "lucide-react";
import { isDesktop, checkForUpdates } from "@/lib/desktopBridge";
import { toast } from "sonner";

/**
 * Universal "more links" pop-over — sits next to the primary CTA in the
 * landing header (and is reusable in the Studio chrome later). Opens on
 * click, closes on outside-click / Escape / nav. Keeps the header clean
 * while still surfacing the long tail of utility pages (FAQ, Help, Legal,
 * Affiliate, Redeem, Download).
 *
 * Why a kebab/dots icon: it's the universally recognised "more" affordance
 * across iOS, Android, web, and most desktop apps. Doesn't compete with
 * the brand mark or the primary CTA for visual weight.
 */
const SECTIONS = [
  {
    label: "Get started",
    items: [
      { to: "/learn", icon: BookOpen, label: "Tutorials", desc: "5-minute guided walk-throughs" },
      { to: "/download", icon: Download, label: "Download apps", desc: "Windows · macOS · Linux" },
    ],
  },
  {
    label: "Help & answers",
    items: [
      { to: "/pricing#faq", icon: HelpCircle, label: "FAQ", desc: "Pricing, AI keys, privacy" },
      { href: "mailto:press@marvex.app", icon: Sparkles, label: "Contact", desc: "We read every email" },
    ],
  },
  {
    label: "Make money / save money",
    items: [
      { to: "/affiliate", icon: Coins, label: "Affiliate program", desc: "Earn 5–25% on referrals" },
      { to: "/redeem", icon: Ticket, label: "Redeem invite code", desc: "Got a friend code? Activate Pro" },
    ],
  },
  {
    label: "Legal",
    items: [
      { to: "/privacy", icon: ShieldCheck, label: "Privacy", desc: "Local-first · we never sell" },
      { to: "/terms", icon: FileText, label: "Terms", desc: "Plain-English service terms" },
    ],
  },
];

export default function LinksMenu({ align = "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click / Escape — a11y baseline.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey   = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref} data-testid="links-menu">
      <button
        type="button"
        data-testid="links-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More links"
        className={`p-2 rounded-lg border transition ${
          open
            ? "border-cyan-400/50 bg-cyan-500/[0.08] text-cyan-200"
            : "border-white/10 bg-white/[0.02] text-[#cfdaf3] hover:border-cyan-400/30 hover:text-cyan-200"
        }`}
      >
        <AlignJustify size={16} />
      </button>

      {open && (
        <div
          role="menu"
          data-testid="links-menu-panel"
          className={`absolute top-full mt-2 w-[320px] rounded-xl border border-white/10 bg-[#0a0f24]/95 backdrop-blur-md shadow-2xl p-3 z-50 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {SECTIONS.map((section, idx) => (
            <div key={section.label} className={idx > 0 ? "mt-3 pt-3 border-t border-white/5" : ""}>
              <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] px-2 mb-1">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const className = "flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-white/[0.04] transition group";
                const inner = (
                  <>
                    <Icon size={14} className="text-[#9aaad0] group-hover:text-cyan-300 transition mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] text-white">{item.label}</div>
                      <div className="text-[11px] text-[#7a87ad] truncate">{item.desc}</div>
                    </div>
                  </>
                );
                if (item.href) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      data-testid={`links-menu-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      className={className}
                      onClick={() => setOpen(false)}
                    >
                      {inner}
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-testid={`links-menu-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className={className}
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          ))}

          {isDesktop() && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] px-2 mb-1">
                Desktop app
              </div>
              <button
                type="button"
                data-testid="links-menu-check-for-updates"
                onClick={() => {
                  setOpen(false);
                  checkForUpdates();
                  toast.message("Checking for updates…");
                }}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-white/[0.04] transition group text-left"
              >
                <RefreshCw size={14} className="text-[#9aaad0] group-hover:text-cyan-300 transition mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] text-white">Check for updates…</div>
                  <div className="text-[11px] text-[#7a87ad] truncate">User-initiated, never silent</div>
                </div>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

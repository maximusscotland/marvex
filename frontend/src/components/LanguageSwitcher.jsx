import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Check, ChevronDown } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/i18n";

/**
 * LanguageSwitcher — a compact Globe-icon dropdown for the nav.
 * Persists the user's choice to localStorage (via i18next detector config).
 */
export default function LanguageSwitcher({ compact = false, align = "right" }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ||
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language?.split("-")[0]) ||
    SUPPORTED_LANGUAGES[0];

  const pick = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const menuAlign = align === "right" ? "right-0" : "left-0";

  return (
    <div className="relative" ref={wrapRef} data-testid="lang-switcher">
      <button
        data-testid="lang-switcher-trigger"
        onClick={() => setOpen((o) => !o)}
        title={t("common.language")}
        className={`inline-flex items-center gap-1.5 rounded-full border transition ${
          open
            ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
            : "border-cyan-500/20 text-[#9aaad0] hover:border-cyan-400/50 hover:text-cyan-300"
        } ${compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"}`}
      >
        <Globe size={compact ? 11 : 13} />
        <span className="mono uppercase tracking-[0.14em]">{current.code.toUpperCase()}</span>
        <ChevronDown size={compact ? 10 : 12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          data-testid="lang-switcher-menu"
          className={`absolute ${menuAlign} top-full mt-2 z-50 min-w-[180px] py-1.5 rounded-xl glass-panel fade-up`}
          style={{ borderColor: "rgba(0,240,255,0.28)" }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = lang.code === current.code;
            return (
              <button
                key={lang.code}
                data-testid={`lang-option-${lang.code}`}
                onClick={() => pick(lang.code)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[13px] transition ${
                  active
                    ? "bg-cyan-400/10 text-cyan-200"
                    : "text-[#d6e3f5] hover:bg-cyan-400/[0.06] hover:text-cyan-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{lang.nativeLabel}</span>
                  <span className="mono text-[9px] uppercase tracking-[0.18em] text-[#6c7aa3]">
                    {lang.code}
                  </span>
                </span>
                {active && <Check size={12} className="text-cyan-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

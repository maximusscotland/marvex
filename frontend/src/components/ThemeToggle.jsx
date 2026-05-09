/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, setTheme } from "@/lib/theme";

/**
 * ThemeToggle — minimal Sun/Moon button.
 *
 * Listens for `marvex:themechange` so multiple toggles in the same
 * tree (e.g. landing nav + studio top bar) stay in sync without
 * prop-drilling state.
 */
export default function ThemeToggle({ className = "" }) {
  const [theme, setLocal] = useState(() => getTheme());

  useEffect(() => {
    const onChange = (e) => setLocal(e.detail || getTheme());
    window.addEventListener("marvex:themechange", onChange);
    return () => window.removeEventListener("marvex:themechange", onChange);
  }, []);

  const isLight = theme === "light";
  const flip = () => setTheme(isLight ? "dark" : "light");
  const Icon = isLight ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={flip}
      data-testid="theme-toggle"
      data-theme={theme}
      title={isLight ? "Switch to dark" : "Switch to light"}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-400/40 text-[#cfdaf3] hover:text-cyan-200 transition ${className}`}
    >
      <Icon size={14} />
    </button>
  );
}

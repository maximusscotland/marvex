import React, { useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";

/**
 * FilmModeToggle — single-click toggle in the Studio top-bar that hides
 * recording-distractions (Emergent badge, cookie consent banner, onboarding
 * tour, "Made with Emergent" link) so the owner can capture clean product
 * videos without retouching every frame.
 *
 * Implementation: toggles `body.film-mode` and persists the choice in
 * localStorage so the mode survives reloads. CSS rules in index.css under
 * `body.film-mode { ... }` do the actual hiding.
 *
 * Keyboard shortcut: Shift+F (Studio also has F=fullscreen, so we use Shift).
 */
const FILM_MODE_KEY = "mm.filmMode";

const apply = (on) => {
  if (on) document.body.classList.add("film-mode");
  else document.body.classList.remove("film-mode");
  // The Emergent badge anchor is injected with inline `display: inline-flex
  // !important`, which beats any external stylesheet — so we have to flip
  // its inline display from JS to truly remove it from the layout.
  const badge = document.getElementById("emergent-badge");
  if (badge) badge.style.setProperty("display", on ? "none" : "inline-flex", "important");
};

export default function FilmModeToggle() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(FILM_MODE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    apply(on);
    try {
      localStorage.setItem(FILM_MODE_KEY, on ? "1" : "0");
    } catch { /* ignore quota */ }
  }, [on]);

  // Shift+F shortcut, but only when not typing in an input/textarea.
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const editable = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (editable) return;
      if (e.shiftKey && (e.key === "F" || e.key === "f") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOn((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      data-testid="film-mode-toggle"
      onClick={() => setOn((v) => !v)}
      title={on
        ? "Film mode ON — Emergent badge, cookie banner, and tour hidden. Shift+F to exit."
        : "Film mode — hide Emergent badge, cookie banner, and onboarding tour for clean video shots. Shift+F."}
      aria-pressed={on}
      className={
        "mono text-[10px] uppercase tracking-[0.22em] px-2.5 py-1.5 rounded-full border transition flex items-center gap-1.5 " +
        (on
          ? "border-fuchsia-400 text-fuchsia-200 bg-fuchsia-400/10 shadow-[0_0_14px_rgba(255,106,213,0.4)]"
          : "border-white/10 text-[#7a87ad] hover:border-fuchsia-400/40 hover:text-fuchsia-200")
      }
    >
      <Clapperboard size={12} />
      {on ? "Film" : ""}
    </button>
  );
}

/* eslint-disable react/prop-types */
import React, { useEffect, useState, useCallback } from "react";
import { Palette, X, Check } from "lucide-react";

/**
 * ThemePreview — Landing-page-only theme experimenter.
 *
 * Why this lives outside the regular CSS:
 *   The site's colours are driven by CSS custom properties on `:root`
 *   (see `index.css` — `--bg-deepest`, `--neon-cyan`, etc.). Swapping
 *   them at runtime via `document.documentElement.style.setProperty`
 *   gives us a live, low-risk preview that touches every consumer
 *   (Tailwind colour utilities are NOT remapped, but bespoke styles in
 *   `index.css` like `.neon-text`, `.glass-panel`, `.cta-pill` ARE).
 *
 * Themes:
 *   - cosmic (default)        — current cyan/fuchsia
 *   - sunset (warmer dark)    — deep navy + sunset peach/amber
 *   - mono-luxe (premium)     — near-black + champagne gold accent
 *   - forest (calm)           — deep emerald + cream sage (extra)
 *
 * Toggle:  floating pill at top-right of Landing. Cycles through the
 * themes; click chosen theme to apply, click "Reset" to revert to the
 * default cosmic theme. Active theme persists in `sessionStorage` so a
 * page reload during evaluation doesn't jolt the user back to default.
 *
 * Cleanup:  on unmount we remove every override so other routes never
 * inherit a Landing-only theme.
 */

const STORAGE_KEY = "marvex.themepreview.v1";

const VARS = [
  "--bg-deepest",
  "--bg-deep",
  "--bg-panel",
  "--bg-panel-2",
  "--ink-50",
  "--ink-200",
  "--ink-400",
  "--ink-600",
  "--neon-cyan",
  "--neon-cyan-soft",
  "--neon-magenta",
  "--neon-violet",
  "--neon-amber",
  // Background glows on .cosmic-bg
  "--bg-glow-1",
  "--bg-glow-2",
  "--bg-glow-3",
  "--bg-nebula-1",
  "--bg-nebula-2",
  // Gradient-text stops
  "--gt-from",
  "--gt-via",
  "--gt-to",
  // Primary CTA pill
  "--cta-from",
  "--cta-to",
  "--cta-glow",
  "--cta-glow-hover",
];

const THEMES = {
  cosmic: {
    label: "Cosmic",
    sub: "Current — cyan/fuchsia neon",
    swatches: ["#00f0ff", "#ff2e6c", "#8a5bff"],
    vars: null, // null = clear all overrides
  },

  // Warmer dark — navy + sunset.  Backgrounds shift slightly more
  // indigo, accents rotate to coral/peach/amber.  Reads "study app at
  // golden hour" rather than "Tron arcade".
  sunset: {
    label: "Sunset",
    sub: "Deep navy · peach · amber",
    swatches: ["#ff8a65", "#ffb74d", "#ec407a"],
    vars: {
      "--bg-deepest": "#0a0612",
      "--bg-deep":   "#100a22",
      "--bg-panel":  "#181030",
      "--bg-panel-2":"#221848",
      "--ink-50":    "#fff5ee",
      "--ink-200":   "#e8d4c4",
      "--ink-400":   "#a8907a",
      "--ink-600":   "#5a4a3a",
      "--neon-cyan":      "#ff8a65",
      "--neon-cyan-soft": "#ffb088",
      "--neon-magenta":   "#ec407a",
      "--neon-violet":    "#b9588a",
      "--neon-amber":     "#ffd54f",
      "--bg-glow-1":  "rgba(255, 138, 101, 0.18)",
      "--bg-glow-2":  "rgba(236, 64, 122, 0.12)",
      "--bg-glow-3":  "rgba(255, 213, 79, 0.07)",
      "--bg-nebula-1":"rgba(255, 138, 101, 0.18)",
      "--bg-nebula-2":"rgba(236, 64, 122, 0.14)",
      "--gt-from":    "#ff8a65",
      "--gt-via":     "#ffb088",
      "--gt-to":      "#ec407a",
      "--cta-from":   "#ff6b4a",
      "--cta-to":     "#ec407a",
      "--cta-glow":      "rgba(255, 107, 74, 0.45)",
      "--cta-glow-hover":"rgba(255, 107, 74, 0.65)",
    },
  },

  // Mono-luxe — near-black background, single warm-gold accent. Drops
  // most of the secondary neons in favour of subtle cream contrast.
  mono: {
    label: "Mono-luxe",
    sub: "Near-black · champagne gold",
    swatches: ["#d4af37", "#f5e6c8", "#1a1a1a"],
    vars: {
      "--bg-deepest": "#0a0a0a",
      "--bg-deep":   "#0f0f0f",
      "--bg-panel":  "#161616",
      "--bg-panel-2":"#1f1f1f",
      "--ink-50":    "#f5e6c8",
      "--ink-200":   "#d4c5a8",
      "--ink-400":   "#8a7d65",
      "--ink-600":   "#4a4338",
      "--neon-cyan":      "#d4af37",
      "--neon-cyan-soft": "#e6c656",
      "--neon-magenta":   "#c89b3c",
      "--neon-violet":    "#b8862c",
      "--neon-amber":     "#f5e6c8",
      "--bg-glow-1":  "rgba(212, 175, 55, 0.10)",
      "--bg-glow-2":  "rgba(245, 230, 200, 0.05)",
      "--bg-glow-3":  "rgba(212, 175, 55, 0.04)",
      "--bg-nebula-1":"rgba(212, 175, 55, 0.10)",
      "--bg-nebula-2":"rgba(184, 134, 44, 0.08)",
      "--gt-from":    "#d4af37",
      "--gt-via":     "#e6c656",
      "--gt-to":      "#f5e6c8",
      "--cta-from":   "#d4af37",
      "--cta-to":     "#b8862c",
      "--cta-glow":      "rgba(212, 175, 55, 0.40)",
      "--cta-glow-hover":"rgba(212, 175, 55, 0.55)",
    },
  },

  // Forest — calm emerald + cream sage. Same brightness ramp as
  // cosmic so neon-text / glass-panel still pop.
  forest: {
    label: "Forest",
    sub: "Deep emerald · sage · cream",
    swatches: ["#43a047", "#cddc39", "#26a69a"],
    vars: {
      "--bg-deepest": "#06120c",
      "--bg-deep":   "#0a1a12",
      "--bg-panel":  "#0e2418",
      "--bg-panel-2":"#143020",
      "--ink-50":    "#eaf7ec",
      "--ink-200":   "#bdd5c2",
      "--ink-400":   "#6e8a76",
      "--ink-600":   "#3a4f40",
      "--neon-cyan":      "#43a047",
      "--neon-cyan-soft": "#66bb6a",
      "--neon-magenta":   "#cddc39",
      "--neon-violet":    "#26a69a",
      "--neon-amber":     "#dce775",
      "--bg-glow-1":  "rgba(67, 160, 71, 0.16)",
      "--bg-glow-2":  "rgba(38, 166, 154, 0.12)",
      "--bg-glow-3":  "rgba(205, 220, 57, 0.06)",
      "--bg-nebula-1":"rgba(67, 160, 71, 0.18)",
      "--bg-nebula-2":"rgba(38, 166, 154, 0.12)",
      "--gt-from":    "#43a047",
      "--gt-via":     "#66bb6a",
      "--gt-to":      "#26a69a",
      "--cta-from":   "#2e7d32",
      "--cta-to":     "#26a69a",
      "--cta-glow":      "rgba(67, 160, 71, 0.45)",
      "--cta-glow-hover":"rgba(67, 160, 71, 0.60)",
    },
  },
};

const applyTheme = (id) => {
  const root = document.documentElement;
  const theme = THEMES[id];
  if (!theme || !theme.vars) {
    // Reset → strip every override so :root cascade rules.
    VARS.forEach((v) => root.style.removeProperty(v));
    return;
  }
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
};

export default function ThemePreview() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) || "cosmic"; }
    catch { return "cosmic"; }
  });

  // Apply on mount + whenever current changes.  Cleanup wipes all
  // overrides so navigating away from /landing doesn't carry the theme.
  useEffect(() => {
    applyTheme(current);
    try { sessionStorage.setItem(STORAGE_KEY, current); } catch { /* ignore */ }
    return () => {
      // Only reset on full unmount (route change), not on theme change.
      // Effect cleanup also fires on dep change — to differentiate, we
      // schedule a microtask: if `current` is the same on next tick the
      // component is unmounting. Simpler though: always reset on unmount
      // via a separate effect below.
    };
  }, [current]);

  // True one-shot cleanup on unmount only.
  useEffect(() => {
    return () => {
      VARS.forEach((v) => document.documentElement.style.removeProperty(v));
    };
  }, []);

  const pick = useCallback((id) => {
    setCurrent(id);
    setOpen(false);
  }, []);

  return (
    <div
      data-testid="theme-preview-widget"
      className="fixed top-4 right-4 z-[60] flex flex-col items-end gap-2"
    >
      {/* Toggle pill */}
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="theme-preview-toggle"
        className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/15 bg-[#0a0f24]/85 backdrop-blur-md text-[#cfdaf3] hover:border-cyan-300/60 hover:text-white transition shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
        title="Preview alternate themes"
      >
        <Palette size={13} className="text-cyan-300" />
        <span className="mono text-[10px] uppercase tracking-[0.22em]">
          Theme · {THEMES[current]?.label || "Cosmic"}
        </span>
      </button>

      {/* Picker panel */}
      {open && (
        <div
          data-testid="theme-preview-panel"
          className="w-[300px] rounded-2xl border border-cyan-400/30 bg-[#0a0f24]/95 backdrop-blur-md p-3 shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(0,240,255,0.2)]"
        >
          <div className="flex items-center justify-between mb-2.5 px-1">
            <div>
              <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80">
                Preview a theme
              </div>
              <div className="text-[11px] text-[#7a87ad] mt-0.5">
                Live, home page only — refresh to revert.
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              data-testid="theme-preview-close"
              className="text-[#7a87ad] hover:text-white transition p-1"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-1.5">
            {Object.entries(THEMES).map(([id, t]) => {
              const active = current === id;
              return (
                <button
                  key={id}
                  onClick={() => pick(id)}
                  data-testid={`theme-preview-pick-${id}`}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition text-left"
                  style={{
                    background: active ? "rgba(0,240,255,0.10)" : "transparent",
                    borderColor: active ? "rgba(0,240,255,0.45)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="flex gap-1 flex-shrink-0">
                    {t.swatches.map((c) => (
                      <span
                        key={c}
                        className="block w-4 h-4 rounded-md"
                        style={{ background: c, boxShadow: `0 0 6px ${c}77` }}
                      />
                    ))}
                  </span>
                  <span className="flex-1 min-w-0">
                    <div className="text-[12px] text-white font-medium leading-tight">
                      {t.label}
                    </div>
                    <div className="text-[10px] text-[#7a87ad] leading-tight mt-0.5 truncate">
                      {t.sub}
                    </div>
                  </span>
                  {active && (
                    <Check size={13} className="text-cyan-300 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/8 px-1">
            <p className="text-[10px] text-[#566187] leading-relaxed">
              Themes affect colour variables on this page only. Internal
              app, pricing, and other routes still use the default cosmic
              palette until you decide.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

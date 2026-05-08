/**
 * WordArt-style preset library for the text annotation type.
 *
 * Each preset is a small CSS bundle the renderer applies to the text via
 * inline `style={...}`. They are intentionally PURE CSS — no SVG filters
 * — so the user can edit the text inline without any flicker, screenshot
 * capture works cleanly, and we don't need any extra dependencies.
 *
 * The user picks a preset from the right-click menu on a text annotation.
 * Falls back to the plain default when `style` is unset.
 */

export const WORDART_PRESETS = {
  plain: {
    label: "Plain",
    sample: "Aa",
    style: {
      color: "#ffffff",
      fontWeight: 600,
      letterSpacing: "0",
    },
  },
  neonCyan: {
    label: "Neon · Cyan",
    sample: "Aa",
    style: {
      color: "#bff7ff",
      fontWeight: 800,
      letterSpacing: "0.03em",
      textShadow: [
        "0 0 4px rgba(0,240,255,0.95)",
        "0 0 12px rgba(0,240,255,0.85)",
        "0 0 28px rgba(0,240,255,0.55)",
      ].join(", "),
    },
  },
  neonMagenta: {
    label: "Neon · Magenta",
    sample: "Aa",
    style: {
      color: "#ffd6f4",
      fontWeight: 800,
      letterSpacing: "0.03em",
      textShadow: [
        "0 0 4px rgba(255,106,213,0.95)",
        "0 0 12px rgba(255,106,213,0.85)",
        "0 0 26px rgba(184,141,255,0.5)",
      ].join(", "),
    },
  },
  gradient: {
    label: "Gradient",
    sample: "Aa",
    style: {
      // Background-clip:text builds a true text-gradient that copies cleanly
      // when the user takes a screenshot.
      background: "linear-gradient(90deg, #00f0ff 0%, #b88dff 50%, #ff6ad5 100%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
      fontWeight: 800,
      letterSpacing: "0.01em",
    },
  },
  goldFoil: {
    label: "Gold foil",
    sample: "Aa",
    style: {
      background: "linear-gradient(180deg, #fff7c2 0%, #f7c93b 45%, #b8860b 100%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
      fontWeight: 900,
      letterSpacing: "0.02em",
      textShadow: "0 1px 0 rgba(0,0,0,0.45)",
    },
  },
  outline: {
    label: "Outline",
    sample: "Aa",
    style: {
      color: "transparent",
      WebkitTextStroke: "2px #00f0ff",
      fontWeight: 900,
      letterSpacing: "0.04em",
    },
  },
  embossed: {
    label: "3D · Embossed",
    sample: "Aa",
    style: {
      color: "#cfdaf3",
      fontWeight: 900,
      letterSpacing: "0.02em",
      textShadow: [
        "1px 1px 0 #1a2350",
        "2px 2px 0 #1a2350",
        "3px 3px 0 #1a2350",
        "4px 4px 0 #1a2350",
        "5px 5px 8px rgba(0,0,0,0.55)",
      ].join(", "),
    },
  },
  shadow: {
    label: "Drop shadow",
    sample: "Aa",
    style: {
      color: "#ffffff",
      fontWeight: 700,
      letterSpacing: "0.01em",
      textShadow: "3px 3px 0 rgba(255,106,213,0.85), 6px 6px 18px rgba(0,0,0,0.55)",
    },
  },
  retro: {
    label: "Retro arcade",
    sample: "Aa",
    style: {
      color: "#fff",
      fontWeight: 900,
      letterSpacing: "0.08em",
      fontFamily: "'Press Start 2P', 'Courier New', monospace",
      textShadow: [
        "2px 2px 0 #ff6ad5",
        "4px 4px 0 #b88dff",
      ].join(", "),
    },
  },
  inferno: {
    label: "Inferno",
    sample: "Aa",
    style: {
      background: "linear-gradient(180deg, #fff394 0%, #ff8c00 45%, #ff2a04 100%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
      fontWeight: 900,
      letterSpacing: "0.02em",
      textShadow: "0 0 10px rgba(255,140,0,0.55), 0 0 22px rgba(255,42,4,0.45)",
    },
  },
};

/**
 * Get a CSS style object for a given preset key. Falls back to plain when
 * the key is missing or unknown.
 */
export const getWordArtStyle = (key) =>
  WORDART_PRESETS[key]?.style || WORDART_PRESETS.plain.style;

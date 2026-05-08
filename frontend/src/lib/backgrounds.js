/**
 * Canvas background presets — CSS-only so they're instant and work offline.
 * A map's `background` field holds either:
 *   - a preset id (e.g. "cosmic", "space")
 *   - a data URL of an uploaded image ("data:image/…")
 */

export const PRESET_BACKGROUNDS = [
  {
    id: "cosmic",
    name: "Cosmic",
    css: `
      radial-gradient(ellipse 80% 60% at 50% 35%, #0a1432 0%, #03040a 70%),
      radial-gradient(circle at 20% 80%, rgba(138,91,255,0.18), transparent 45%),
      #03040a
    `,
  },
  {
    id: "space",
    name: "Deep Space",
    css: `
      radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.9) 50%, transparent 51%),
      radial-gradient(1px 1px at 70% 60%, rgba(255,255,255,0.8) 50%, transparent 51%),
      radial-gradient(1.5px 1.5px at 40% 80%, rgba(180,220,255,0.9) 50%, transparent 51%),
      radial-gradient(1px 1px at 85% 25%, rgba(255,255,255,0.7) 50%, transparent 51%),
      radial-gradient(1px 1px at 15% 65%, rgba(200,220,255,0.8) 50%, transparent 51%),
      radial-gradient(2px 2px at 55% 40%, rgba(255,255,240,0.9) 50%, transparent 51%),
      radial-gradient(ellipse 60% 45% at 30% 30%, rgba(60,120,255,0.18), transparent 70%),
      radial-gradient(ellipse 55% 40% at 75% 75%, rgba(138,91,255,0.25), transparent 70%),
      linear-gradient(180deg, #020418 0%, #05091f 100%)
    `,
    size: "400px 400px, 300px 300px, 500px 500px, 350px 350px, 600px 600px, 700px 700px, 100% 100%, 100% 100%, 100% 100%",
  },
  {
    id: "nebula",
    name: "Nebula",
    css: `
      radial-gradient(circle at 25% 35%, rgba(138,91,255,0.45), transparent 45%),
      radial-gradient(circle at 75% 65%, rgba(255,106,213,0.32), transparent 50%),
      radial-gradient(circle at 60% 20%, rgba(0,240,255,0.2), transparent 55%),
      #05020f
    `,
  },
  {
    id: "aurora",
    name: "Aurora",
    css: `
      radial-gradient(ellipse 70% 50% at 50% 15%, rgba(0,240,255,0.35), transparent 70%),
      radial-gradient(ellipse 80% 60% at 50% 85%, rgba(61,220,132,0.28), transparent 75%),
      radial-gradient(ellipse 50% 40% at 85% 50%, rgba(122,59,255,0.2), transparent 70%),
      linear-gradient(180deg, #021612 0%, #03061a 100%)
    `,
  },
  {
    id: "parchment",
    name: "Parchment",
    css: `
      radial-gradient(ellipse at 30% 20%, #f6e9c9 0%, #e9d5a8 50%, #c7ae77 100%)
    `,
    light: true,
  },
  {
    id: "ink",
    name: "Pure Ink",
    css: "#060709",
  },
];

/**
 * Resolve a map's background value into a CSS `background` string
 * suitable for inline style application.
 */
export const resolveBackground = (value) => {
  if (!value) return null;
  if (typeof value === "string" && value.startsWith("data:")) {
    return {
      backgroundImage: `url("${value}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#03040a",
    };
  }
  const preset = PRESET_BACKGROUNDS.find((p) => p.id === value);
  if (!preset) return null;
  const style = { background: preset.css };
  if (preset.size) style.backgroundSize = preset.size;
  return style;
};

export const isLightBackground = (value) => {
  if (!value || typeof value !== "string" || value.startsWith("data:")) return false;
  return !!PRESET_BACKGROUNDS.find((p) => p.id === value)?.light;
};

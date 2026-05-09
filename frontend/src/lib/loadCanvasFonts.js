/**
 * loadCanvasFonts — lazy-loads the 30-family mind-map typography pack.
 *
 * Called by Studio.jsx on mount so marketing pages (landing, pricing,
 * FAQ, etc.) don't have to download ~600KB of font CSS + woff2 they
 * never use. Idempotent — calling twice is a no-op. Loaded with
 * display=swap so the canvas renders immediately in the fallback face
 * and re-flows when each web font arrives.
 */
const FONT_URL =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@400;600",
    "family=Outfit:wght@400;600",
    "family=Manrope:wght@400;600",
    "family=Lora:wght@400;600",
    "family=Playfair+Display:wght@400;700",
    "family=Crimson+Text:wght@400;700",
    "family=Cormorant+Garamond:wght@400;600",
    "family=Spectral:wght@400;600",
    "family=Fira+Code:wght@400;600",
    "family=IBM+Plex+Mono:wght@400;600",
    "family=Space+Mono:wght@400;700",
    "family=Bebas+Neue",
    "family=Space+Grotesk:wght@400;600",
    "family=Archivo+Black",
    "family=Anton",
    "family=Righteous",
    "family=Russo+One",
    "family=Caveat:wght@400;700",
    "family=Kalam:wght@400;700",
    "family=Patrick+Hand",
    "family=Indie+Flower",
    "family=Shadows+Into+Light",
    "family=Quicksand:wght@400;600",
    "family=Nunito:wght@400;600",
    "family=Poppins:wght@400;600",
    "family=DM+Sans:wght@400;600",
    "family=Work+Sans:wght@400;600",
  ].join("&") +
  "&display=swap";

let _loaded = false;

export function loadCanvasFonts() {
  if (_loaded) return;
  if (typeof document === "undefined") return;
  // Idempotency belt-and-braces: also detect if the link is already in
  // the DOM (e.g. carried over by HMR / route navigation).
  if (document.querySelector('link[data-marvex-fonts="canvas-pack"]')) {
    _loaded = true;
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_URL;
  link.dataset.marvexFonts = "canvas-pack";
  document.head.appendChild(link);
  _loaded = true;
}

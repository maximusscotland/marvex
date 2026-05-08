/**
 * Helpers for branded share-cards generated from a mind-map.
 * Wraps the existing exportPng rasterizer with a branded header/footer
 * so the output is tweet-ready without further editing.
 */
import { buildSvg } from "@/lib/exportPng";

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630; // Twitter/LinkedIn OG standard
const BG = "#03040a";
const ACCENT = "#00f0ff";
const BRAND = "marvex.app";

/**
 * Rasterises `map` into a 1200×630 branded PNG Blob:
 * - Dark cosmic background
 * - Map SVG centre-fit with padding
 * - Branded footer: cyan dot + "marvex.app — turn any PDF into a mind-map"
 */
export async function buildShareCardBlob(map) {
  const svgStr = buildSvg(map);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext("2d");

    // Cosmic gradient background
    const g = ctx.createRadialGradient(
      CARD_WIDTH * 0.3, CARD_HEIGHT * 0.4, 100,
      CARD_WIDTH * 0.3, CARD_HEIGHT * 0.4, CARD_WIDTH
    );
    g.addColorStop(0, "#0a1428");
    g.addColorStop(0.6, "#05080f");
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Subtle grid specks
    ctx.fillStyle = "rgba(0,240,255,0.08)";
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() * CARD_WIDTH) | 0;
      const y = (Math.random() * CARD_HEIGHT) | 0;
      ctx.fillRect(x, y, 1, 1);
    }

    // Fit map into the centre, leaving 120px for the footer.
    const availH = CARD_HEIGHT - 120;
    const availW = CARD_WIDTH - 120;
    const scale = Math.min(availW / img.width, availH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (CARD_WIDTH - drawW) / 2;
    const dy = 40 + (availH - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);

    // Footer bar
    const footerY = CARD_HEIGHT - 80;
    ctx.fillStyle = "rgba(4,6,13,0.85)";
    ctx.fillRect(0, footerY, CARD_WIDTH, 80);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, footerY, CARD_WIDTH, 2);

    // Cyan dot
    ctx.beginPath();
    ctx.arc(50, footerY + 40, 8, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Brand text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px -apple-system, 'Segoe UI', 'Inter', sans-serif";
    ctx.textBaseline = "middle";
    const brandWidth = ctx.measureText(BRAND).width;
    ctx.fillText(BRAND, 78, footerY + 40);
    ctx.fillStyle = "#9aa7c7";
    ctx.font = "16px -apple-system, 'Segoe UI', 'Inter', sans-serif";
    ctx.fillText("Turn any PDF into a mind-map", 78 + brandWidth + 18, footerY + 42);

    // Map title (top-left badge)
    const title = (map.title || "Mind-Map").slice(0, 80);
    ctx.font = "bold 18px -apple-system, 'Segoe UI', 'Inter', sans-serif";
    const titleWidth = ctx.measureText(title).width;
    const badgeWidth = Math.min(CARD_WIDTH - 80, titleWidth + 40);
    ctx.fillStyle = "rgba(0,240,255,0.1)";
    ctx.fillRect(40, 40, badgeWidth, 44);
    ctx.strokeStyle = "rgba(0,240,255,0.4)";
    ctx.strokeRect(40, 40, badgeWidth, 44);
    ctx.fillStyle = "#cfdaf3";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 56, 62);

    return await new Promise((res) => canvas.toBlob(res, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function buildTwitterIntent({ title, url }) {
  const t = `I just mapped "${title}" with mind-mapper in 30 seconds — turn any PDF into a research tree → ${url || "https://marvex.app"}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}`;
}

export function buildLinkedInIntent({ url }) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url || "https://marvex.app")}`;
}

export async function copyBlobToClipboard(blob) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error("Clipboard image copy is not supported on this browser");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type]: blob }),
  ]);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

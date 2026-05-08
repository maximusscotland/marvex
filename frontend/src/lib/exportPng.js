/**
 * Mind-map → PNG exporter.
 * Builds a pure SVG from the tree + positions (no DOM scraping, no external deps),
 * then rasterizes it through <canvas>.drawImage and downloads as a PNG.
 */

import { applyLinkVisibility } from "@/lib/linkVisibility";

const DEFAULT_FILL = "rgba(3,14,28,0.95)";
const DEFAULT_STROKE = "#00e1ff";
const DEFAULT_ROOT_FILL = "rgba(3,20,36,0.95)";
const DEFAULT_ROOT_STROKE = "#00f0ff";
const DEFAULT_EDGE_COLOR = "#00f0ff";
const DEFAULT_EDGE_WIDTH = 1.2;

const DEFAULT_SIZES = {
  rect: [176, 52],
  ellipse: [170, 70],
  hex: [180, 64],
  diamond: [170, 90],
  document: [140, 78],
  pill: [176, 52],
  parallelogram: [176, 60],
  cylinder: [150, 76],
  cloud: [170, 84],
};
const ROOT_SIZE = [230, 78];

const sizeOf = (node, isRoot) => {
  const shape = node.shape || (isRoot ? "rect" : "ellipse");
  const [dw, dh] = isRoot ? ROOT_SIZE : DEFAULT_SIZES[shape] || DEFAULT_SIZES.rect;
  return { w: node.width || dw, h: node.height || dh };
};

const walk = (node, fn, depth = 0, parent = null) => {
  fn(node, depth, parent);
  (node.children || []).forEach((c) => walk(c, fn, depth + 1, node));
};

// Duplicated layout so export matches what the canvas would lay out by default
const computeLayout = (root) => {
  const positions = {};
  positions[root.id] = { x: 0, y: 0 };
  const placeChildren = (node, parentX, parentY, baseAngle, spread, depth, baseRadius) => {
    const children = node.children || [];
    if (!children.length) return;
    const radius = baseRadius + depth * 70;
    const start = baseAngle - spread / 2;
    const step = children.length === 1 ? 0 : spread / (children.length - 1);
    children.forEach((child, i) => {
      const angle = children.length === 1 ? baseAngle : start + step * i;
      const x = parentX + Math.cos(angle) * radius;
      const y = parentY + Math.sin(angle) * radius;
      positions[child.id] = { x, y };
      const sub = Math.atan2(y - parentY, x - parentX);
      placeChildren(child, x, y, sub, Math.PI / 2.2, depth + 1, 90);
    });
  };
  const rootChildren = root.children || [];
  const initialRadius = 280;
  const stepAngle = (Math.PI * 2) / Math.max(rootChildren.length, 1);
  rootChildren.forEach((child, i) => {
    const angle = -Math.PI / 2 + stepAngle * i;
    const x = Math.cos(angle) * initialRadius;
    const y = Math.sin(angle) * initialRadius;
    positions[child.id] = { x, y };
    placeChildren(child, x, y, angle, Math.PI / 1.5, 1, 100);
  });
  return positions;
};

const escapeXml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Wrap a title into up to 3 lines that fit the node width (cheap char-count heuristic)
const wrapTitle = (title, w, fontSize) => {
  const maxChars = Math.max(6, Math.floor((w - 20) / (fontSize * 0.55)));
  const words = (title || "").split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length <= maxChars) cur = (cur + " " + word).trim();
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
    if (lines.length >= 2) break;
  }
  if (cur) lines.push(cur);
  if (lines.length > 3) lines.length = 3;
  return lines;
};

const shapePath = (shape, w, h) => {
  const pad = 2;
  if (shape === "ellipse") {
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - pad}" ry="${h / 2 - pad}"/>`;
  }
  if (shape === "hex") {
    const pts = [
      [w * 0.12, h / 2], [w * 0.3, pad], [w * 0.7, pad],
      [w * 0.88, h / 2], [w * 0.7, h - pad], [w * 0.3, h - pad],
    ].map((p) => p.join(",")).join(" ");
    return `<polygon points="${pts}"/>`;
  }
  if (shape === "diamond") {
    const pts = [
      [w / 2, pad], [w - pad, h / 2], [w / 2, h - pad], [pad, h / 2],
    ].map((p) => p.join(",")).join(" ");
    return `<polygon points="${pts}"/>`;
  }
  if (shape === "document") {
    const foldX = w - 18;
    const foldY = 16;
    return `<path d="M ${pad} ${pad} H ${foldX} L ${w - pad} ${foldY} V ${h - pad} H ${pad} Z"/>`;
  }
  if (shape === "pill") {
    const r = Math.min(w, h) / 2 - pad;
    return `<rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="${r}" ry="${r}"/>`;
  }
  if (shape === "parallelogram") {
    const slant = 18;
    const pts = [[pad + slant, pad], [w - pad, pad], [w - pad - slant, h - pad], [pad, h - pad]]
      .map((p) => p.join(",")).join(" ");
    return `<polygon points="${pts}"/>`;
  }
  if (shape === "cylinder") {
    const ry = 10;
    return `<path d="M ${pad} ${pad + ry} A ${(w - 2 * pad) / 2} ${ry} 0 0 1 ${w - pad} ${pad + ry} L ${w - pad} ${h - pad - ry} A ${(w - 2 * pad) / 2} ${ry} 0 0 1 ${pad} ${h - pad - ry} Z"/>`;
  }
  if (shape === "cloud") {
    const cx = w / 2, cy = h / 2;
    return `<path d="M ${cx - w * 0.3} ${cy + h * 0.15}
      C ${cx - w * 0.45} ${cy + h * 0.05}, ${cx - w * 0.4} ${cy - h * 0.3}, ${cx - w * 0.15} ${cy - h * 0.25}
      C ${cx - w * 0.1}  ${cy - h * 0.42}, ${cx + w * 0.12} ${cy - h * 0.42}, ${cx + w * 0.18} ${cy - h * 0.25}
      C ${cx + w * 0.4}  ${cy - h * 0.3},  ${cx + w * 0.45} ${cy + h * 0.05}, ${cx + w * 0.3} ${cy + h * 0.15}
      C ${cx + w * 0.42} ${cy + h * 0.3},  ${cx + w * 0.15} ${cy + h * 0.4}, ${cx} ${cy + h * 0.32}
      C ${cx - w * 0.2}  ${cy + h * 0.42}, ${cx - w * 0.42} ${cy + h * 0.3}, ${cx - w * 0.3} ${cy + h * 0.15} Z"/>`;
  }
  return `<rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}" rx="10" ry="10"/>`;
};

export function buildSvg(map, overrides = {}) {
  // Strip opt-out links from the snapshot before we render. The clone
  // returned here is what every downstream artefact (PNG, share embed,
  // direct SVG download) is built from — so visibility is enforced once,
  // at the top of the funnel.
  map = applyLinkVisibility(map);
  const positions = { ...computeLayout(map), ...(map.positions || {}) };

  const nodes = [];
  walk(map, (n, depth, parent) => nodes.push({ node: n, depth, parent }));

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(({ node, depth }) => {
    const pos = positions[node.id];
    if (!pos) return;
    const { w, h } = sizeOf(node, depth === 0);
    minX = Math.min(minX, pos.x - w / 2);
    minY = Math.min(minY, pos.y - h / 2);
    maxX = Math.max(maxX, pos.x + w / 2);
    maxY = Math.max(maxY, pos.y + h / 2);
  });
  const pad = 80;
  const W = Math.round(maxX - minX + pad * 2);
  const H = Math.round(maxY - minY + pad * 2);
  const ox = -minX + pad;
  const oy = -minY + pad;

  const edgeSvg = nodes
    .map(({ node, parent }) => {
      if (!parent) return "";
      const a = positions[parent.id];
      const b = positions[node.id];
      if (!a || !b) return "";
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const ux = dx / len;
      const uy = dy / len;
      const pad2 = 24;
      const x1 = (a.x + ox);
      const y1 = (a.y + oy);
      const x2 = (b.x - ux * pad2) + ox;
      const y2 = (b.y - uy * pad2) + oy;
      const es = node.edgeStyle || {};
      const color = es.color || DEFAULT_EDGE_COLOR;
      const width = es.width || DEFAULT_EDGE_WIDTH;
      const dashed = !!es.dashed;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${width}" ${dashed ? 'stroke-dasharray="6 5"' : ""} opacity="0.9"/>`;
    })
    .join("");

  const nodeSvg = nodes
    .map(({ node, depth }) => {
      const pos = positions[node.id];
      if (!pos) return "";
      const isRoot = depth === 0;
      const shape = node.shape || (isRoot ? "rect" : "ellipse");
      const { w, h } = sizeOf(node, isRoot);
      const fill = node.fill || (isRoot ? DEFAULT_ROOT_FILL : DEFAULT_FILL);
      const stroke = node.stroke || (isRoot ? DEFAULT_ROOT_STROKE : DEFAULT_STROKE);
      const fontSize = node.fontSize || (isRoot ? 16 : 13);
      const fontFamily = node.fontFamily || "'Sora', sans-serif";
      const fontWeight = isRoot ? 700 : 600;
      const letterSpacing = isRoot ? 0.8 : 0.3;
      const textTransform = isRoot ? "uppercase" : "none";
      const tx = pos.x + ox - w / 2;
      const ty = pos.y + oy - h / 2;
      const title = isRoot ? (node.title || "").toUpperCase() : node.title || "";
      const lines = wrapTitle(title, w, fontSize);
      const lineH = fontSize * 1.15;
      const totalH = lines.length * lineH;
      const startY = h / 2 - totalH / 2 + fontSize;
      const tspans = lines
        .map((ln, i) => {
          const ycoord = startY + i * lineH - fontSize * 0.15;
          return `<tspan x="${w / 2}" y="${ycoord}">${escapeXml(ln)}</tspan>`;
        })
        .join("");
      // If the map element has a link, wrap its <g> in <a href> so any SVG
      // viewer (browser, Inkscape, GitHub preview) makes the whole pill
      // clickable. We escape the URL with the same XML-attr escaper so
      // quotes / ampersands in user URLs don't break the SVG.
      const open = node.link
        ? `<a href="${escapeXml(node.link)}" target="_blank" rel="noopener noreferrer">`
        : "";
      const close = node.link ? `</a>` : "";
      return `
${open}<g transform="translate(${tx.toFixed(1)},${ty.toFixed(1)})">
  <g fill="${fill}" stroke="${stroke}" stroke-width="${isRoot ? 2 : 1.5}">${shapePath(
    shape,
    w,
    h
  )}</g>
  <text font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}" text-anchor="middle" fill="#eaf6ff" style="text-transform:${textTransform}">${tspans}</text>
</g>${close}`;
    })
    .join("");

  const bg = overrides.background || "#03040a";
  const bgId = overrides.bgId || "mm-bg";
  const transparent = !!overrides.transparent;

  const bgRect = transparent
    ? ""
    : `<defs>
    <radialGradient id="${bgId}" cx="50%" cy="45%" r="75%">
      <stop offset="0" stop-color="#0a1530" stop-opacity="1"/>
      <stop offset="1" stop-color="${bg}" stop-opacity="1"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${bgId})"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${bgRect}
  ${edgeSvg}
  ${nodeSvg}
</svg>`;
}

export function svgToDataUri(svg) {
  // base64-safe for unicode (titles may contain emoji, accents, etc.)
  const base64 =
    typeof window !== "undefined" && window.btoa
      ? window.btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

export function buildMapThumbnail(map) {
  // Unique gradient id per map so multiple thumbnails don't collide when inlined
  const id = `mm-bg-${(map?.id || "m").replace(/[^a-z0-9_-]/gi, "")}`;
  return svgToDataUri(buildSvg(map, { bgId: id }));
}

export async function exportMapAsPng(map, filename = "mindmap.png", scale = 2) {
  const pngBlob = await buildMapPngBlob(map, scale);
  const downloadUrl = URL.createObjectURL(pngBlob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Export the map as a HIGH-RES PNG. `scale` is a multiplier over the natural
 * SVG dimensions — 4× renders at ~retina+ resolution, good for presentations,
 * print proofs, and LinkedIn posts (~2200px wide).
 */
export async function exportMapAsHighResPng(map, filename = "mindmap@4x.png") {
  return exportMapAsPng(map, filename, 4);
}

/**
 * Download the map as a raw SVG file — infinitely scalable vector, perfect
 * for presentations, Figma imports, and print. No rasterisation.
 */
export function exportMapAsSvg(map, filename = "mindmap.svg") {
  const svgStr = buildSvg(map);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the map as Markdown. Tree layout:
 *   # Map title
 *   (optional summary para)
 *
 *   ## Branch 1 title
 *   branch summary
 *   - leaf 1 — leaf 1 summary
 *   - leaf 2
 *
 *   ### Sub-branch
 *   ...
 *
 * Goes up to heading level 4 (####) then falls back to bullet lists, which
 * matches the convention Obsidian / Notion / GitBook all understand.
 */
export function exportMapAsMarkdown(map, filename = "mindmap.md") {
  const md = buildMarkdown(map);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Pure string builder — exported so callers can copy to clipboard instead
 * of download (e.g. "Copy as Markdown" share card).
 */
export function buildMarkdown(map) {
  if (!map) return "";
  // Same visibility filter the SVG/PDF paths use — keeps Markdown exports
  // honouring the user's per-link opt-outs.
  map = applyLinkVisibility(map);
  const lines = [];
  const title = (map.title || "Untitled map").trim();
  lines.push(`# ${title}`, "");
  if (map.summary) lines.push(map.summary.trim(), "");

  const emitBranch = (node, depth) => {
    const t = (node.title || "Untitled").trim();
    const s = (node.summary || "").trim();
    // If the map element has an attached link, wrap the title in
    // [title](url) so any Markdown renderer (Obsidian, Notion, GitHub,
    // GitBook) shows a clickable hyperlink. We do NOT escape the URL —
    // Markdown handles spaces only via %20 which the user's input already
    // accounts for, and over-escaping would break legitimate
    // ?query=values & #hashes.
    const titleMd = node.link ? `[${t}](${node.link})` : t;
    if (depth <= 4) {
      // Heading (##, ###, ####) for depth 1–4
      lines.push(`${"#".repeat(Math.min(depth + 1, 6))} ${titleMd}`, "");
      if (s) lines.push(s, "");
    } else {
      // Depth ≥ 5 becomes nested bullet
      const indent = "  ".repeat(depth - 5);
      lines.push(`${indent}- ${titleMd}${s ? ` — ${s}` : ""}`);
    }
    for (const child of node.children || []) emitBranch(child, depth + 1);
  };

  for (const b of map.children || []) emitBranch(b, 1);

  // Tiny attribution footer — nice for evangelism + SEO backlinks in exports.
  lines.push("", "---", "", "*Exported from [marvex.app](https://marvex.app)*");
  return lines.join("\n");
}

// Shared helper — rasterises the SVG to a PNG Blob at `scale` resolution.
async function buildMapPngBlob(map, scale = 2) {
  const svgStr = buildSvg(map);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return await new Promise((res) => canvas.toBlob(res, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const LOGO_URL = "https://customer-assets.emergentagent.com/job_mindmap-studio-5/artifacts/whhcz93v_m-logo.jpeg";

async function loadLogoDataUrl() {
  try {
    const resp = await fetch(LOGO_URL, { mode: "cors" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * VECTOR PDF export — draws each node/edge/text using jsPDF primitives so
 * the result is crisp at any zoom and text is selectable.
 * Adds a branded header (logo + "marvex.app") and footer.
 */
export async function exportMapAsPdf(map, filename = "mindmap.pdf") {
  // Apply opt-out filter once — child helpers (drawShape, walkers) trust
  // that any node.link still on the tree is meant to be clickable.
  map = applyLinkVisibility(map);
  const pdf = await buildMapPdf(map);
  pdf.save(filename);
}

/** Build a PDF Blob without triggering a download — used by cloud-save. */
export async function buildMapPdfBlob(map) {
  const pdf = await buildMapPdf(map);
  return pdf.output("blob");
}

async function buildMapPdf(map) {
  const { jsPDF } = await import("jspdf");

  // 1. Reuse the same layout engine used for SVG/PNG
  const positions = { ...computeLayout(map), ...(map.positions || {}) };
  const nodes = [];
  walk(map, (n, depth, parent) => nodes.push({ node: n, depth, parent }));

  // Bounding box in SVG units
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(({ node, depth }) => {
    const pos = positions[node.id];
    if (!pos) return;
    const { w, h } = sizeOf(node, depth === 0);
    minX = Math.min(minX, pos.x - w / 2);
    minY = Math.min(minY, pos.y - h / 2);
    maxX = Math.max(maxX, pos.x + w / 2);
    maxY = Math.max(maxY, pos.y + h / 2);
  });
  const margin = 60;
  const svgW = Math.max(1, maxX - minX + margin * 2);
  const svgH = Math.max(1, maxY - minY + margin * 2);
  const ox = -minX + margin;
  const oy = -minY + margin;

  // 2. Prepare PDF with orientation + unit points
  const aspect = svgW / svgH;
  const landscape = aspect >= 1;
  const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Background
  pdf.setFillColor(3, 4, 10);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.setFillColor(10, 15, 36);
  pdf.rect(0, 0, pageW, pageH, "F");

  // ── Brand header (top-left) ──
  const headerH = 48;
  const logoDataUrl = await loadLogoDataUrl();
  try {
    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, "JPEG", 24, 14, 28, 28, undefined, "FAST");
    } else {
      // Fallback: draw a simple cyan M circle
      pdf.setDrawColor(0, 240, 255);
      pdf.setLineWidth(1.2);
      pdf.circle(38, 28, 14, "S");
      pdf.setTextColor(0, 240, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("M", 38, 33, { align: "center" });
    }
  } catch { /* ignore logo errors */ }
  pdf.setTextColor(230, 246, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Marvex Studio", 60, 26);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(140, 176, 215);
  pdf.text("marvex.app", 60, 39);

  // Map title on header right
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(230, 246, 255);
  pdf.text(map.title || "Untitled map", pageW - 24, 26, { align: "right" });
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  pdf.setFontSize(8);
  pdf.setTextColor(127, 232, 255);
  pdf.text(dateStr, pageW - 24, 39, { align: "right" });

  // Header divider
  pdf.setDrawColor(0, 240, 255);
  pdf.setLineWidth(0.4);
  pdf.line(24, headerH, pageW - 24, headerH);

  // ── Footer ──
  pdf.setFontSize(8);
  pdf.setTextColor(110, 148, 185);
  pdf.text("Made with marvex.app · The Ultimate Research Lab", pageW / 2, pageH - 14, { align: "center" });

  // 3. Map SVG coords → PDF coords (reserve room for header/footer)
  const pad = 24;
  const reservedTop = headerH + 12;
  const reservedBottom = 24;
  const availW = pageW - pad * 2;
  const availH = pageH - reservedTop - reservedBottom;
  const scale = Math.min(availW / svgW, availH / svgH);
  const drawW = svgW * scale;
  const drawH = svgH * scale;
  const offsetX = pad + (availW - drawW) / 2;
  const offsetY = reservedTop + (availH - drawH) / 2;
  const toPdfX = (x) => offsetX + (x + ox) * scale;
  const toPdfY = (y) => offsetY + (y + oy) * scale;
  const s = (v) => v * scale;

  // 4. Draw edges first (so nodes sit on top)
  const rgb = (hex) => {
    // "#RRGGBB" → [r,g,b]
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return [0, 240, 255];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  nodes.forEach(({ node, parent }) => {
    if (!parent) return;
    const a = positions[parent.id];
    const b = positions[node.id];
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const ux = dx / len;
    const uy = dy / len;
    const pad2 = 24;
    const x1 = toPdfX(a.x);
    const y1 = toPdfY(a.y);
    const x2 = toPdfX(b.x - ux * pad2);
    const y2 = toPdfY(b.y - uy * pad2);
    const es = node.edgeStyle || {};
    const [r, g, bl] = rgb(es.color || DEFAULT_EDGE_COLOR);
    pdf.setDrawColor(r, g, bl);
    pdf.setLineWidth(s(es.width || DEFAULT_EDGE_WIDTH));
    if (es.dashed) pdf.setLineDashPattern([4, 4], 0);
    else pdf.setLineDashPattern([], 0);
    pdf.line(x1, y1, x2, y2);
  });
  pdf.setLineDashPattern([], 0);

  // 5. Draw nodes
  nodes.forEach(({ node, depth }) => {
    const pos = positions[node.id];
    if (!pos) return;
    const isRoot = depth === 0;
    const shape = node.shape || (isRoot ? "rect" : "ellipse");
    const { w, h } = sizeOf(node, isRoot);
    const x = toPdfX(pos.x - w / 2);
    const y = toPdfY(pos.y - h / 2);
    const W = s(w);
    const H = s(h);
    const [fr, fg, fb] = rgb(isRoot ? "#03142a" : "#030e1c");
    const [sr, sg, sb] = rgb(node.stroke || (isRoot ? DEFAULT_ROOT_STROKE : DEFAULT_STROKE));
    pdf.setFillColor(fr, fg, fb);
    pdf.setDrawColor(sr, sg, sb);
    pdf.setLineWidth(s(isRoot ? 2 : 1.5));

    drawShape(pdf, shape, x, y, W, H);

    // Text
    const fontSize = (node.fontSize || (isRoot ? 16 : 13)) * scale;
    pdf.setTextColor(234, 246, 255);
    pdf.setFont("helvetica", isRoot ? "bold" : "normal");
    pdf.setFontSize(Math.max(6, fontSize));
    const label = isRoot ? (node.title || "").toUpperCase() : node.title || "";
    const lines = wrapTitle(label, w, fontSize / scale);
    const lineH = fontSize * 1.15;
    const totalH = lines.length * lineH;
    const startY = y + H / 2 - totalH / 2 + fontSize * 0.82;
    lines.forEach((ln, i) => {
      pdf.text(ln, x + W / 2, startY + i * lineH, { align: "center" });
    });

    // Hyperlink: jsPDF lets us register a clickable region. We hook the
    // entire bounding rect of the map element so the user can tap anywhere
    // on the pill, not just the text. The PDF renders the text in cyan
    // with an underline so it's *visually* clear the element is a link
    // (the click affordance alone is invisible in print).
    if (node.link) {
      pdf.link(x, y, W, H, { url: node.link });
      // Cyan underline beneath the bottom-most title line, sized to width.
      const underlineY = startY + (lines.length - 1) * lineH + fontSize * 0.18;
      const [lr, lg, lb] = rgb("#00f0ff");
      pdf.setDrawColor(lr, lg, lb);
      pdf.setLineWidth(Math.max(0.4, scale * 0.5));
      pdf.line(x + W * 0.2, underlineY, x + W * 0.8, underlineY);
    }
  });

  return pdf;
}

// ================== CLOUD SAVE BLOB BUILDERS ==================
// These return { blob, mimeType, filename } without triggering a download —
// used by CloudSaveMenu to upload exports straight to Google Drive.

export async function buildMapBlob(map, format) {
  const safeTitle = (map?.title || "mindmap").replace(/[^\w-]+/g, "_");
  switch (format) {
    case "png": {
      const blob = await buildMapPngBlob(map, 2);
      return { blob, mimeType: "image/png", filename: `${safeTitle}.png` };
    }
    case "png-4x": {
      const blob = await buildMapPngBlob(map, 4);
      return { blob, mimeType: "image/png", filename: `${safeTitle}@4x.png` };
    }
    case "svg": {
      const blob = new Blob([buildSvg(map)], { type: "image/svg+xml;charset=utf-8" });
      return { blob, mimeType: "image/svg+xml", filename: `${safeTitle}.svg` };
    }
    case "md": {
      const blob = new Blob([buildMarkdown(map)], { type: "text/markdown;charset=utf-8" });
      return { blob, mimeType: "text/markdown", filename: `${safeTitle}.md` };
    }
    case "pdf": {
      const blob = await buildMapPdfBlob(map);
      return { blob, mimeType: "application/pdf", filename: `${safeTitle}.pdf` };
    }
    case "json": {
      const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json;charset=utf-8" });
      return { blob, mimeType: "application/json", filename: `${safeTitle}.json` };
    }
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

// Draw one node shape on the PDF
function drawShape(pdf, shape, x, y, w, h) {
  if (shape === "ellipse") {
    pdf.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, "FD");
    return;
  }
  if (shape === "hex") {
    const pts = [
      [x + w * 0.12, y + h / 2],
      [x + w * 0.3,  y],
      [x + w * 0.7,  y],
      [x + w * 0.88, y + h / 2],
      [x + w * 0.7,  y + h],
      [x + w * 0.3,  y + h],
    ];
    drawPolygon(pdf, pts);
    return;
  }
  if (shape === "diamond") {
    drawPolygon(pdf, [
      [x + w / 2, y],
      [x + w,     y + h / 2],
      [x + w / 2, y + h],
      [x,         y + h / 2],
    ]);
    return;
  }
  if (shape === "document") {
    const foldX = x + w - 14;
    const foldY = y + 12;
    drawPolygon(pdf, [
      [x,           y],
      [foldX,       y],
      [x + w,       foldY],
      [x + w,       y + h],
      [x,           y + h],
    ]);
    return;
  }
  if (shape === "pill") {
    pdf.roundedRect(x, y, w, h, h / 2, h / 2, "FD");
    return;
  }
  if (shape === "parallelogram") {
    const slant = 14;
    drawPolygon(pdf, [
      [x + slant, y],
      [x + w,     y],
      [x + w - slant, y + h],
      [x,         y + h],
    ]);
    return;
  }
  if (shape === "cylinder") {
    const ry = Math.min(8, h / 4);
    // Body rectangle
    pdf.rect(x, y + ry, w, h - ry * 2, "FD");
    // Top ellipse cap
    pdf.ellipse(x + w / 2, y + ry, w / 2, ry, "FD");
    // Bottom arc (half ellipse only visible)
    pdf.ellipse(x + w / 2, y + h - ry, w / 2, ry, "FD");
    return;
  }
  if (shape === "cloud") {
    // Approximate with 4 overlapping ellipses + bottom rect
    pdf.ellipse(x + w * 0.3,  y + h * 0.55, w * 0.28, h * 0.3, "FD");
    pdf.ellipse(x + w * 0.55, y + h * 0.4,  w * 0.3,  h * 0.32, "FD");
    pdf.ellipse(x + w * 0.8,  y + h * 0.55, w * 0.22, h * 0.28, "FD");
    pdf.rect(x + w * 0.2, y + h * 0.55, w * 0.6, h * 0.35, "FD");
    return;
  }
  // rect (default — rounded)
  pdf.roundedRect(x, y, w, h, 6, 6, "FD");
}

function drawPolygon(pdf, pts) {
  const lines = pts.map((p, i) => (i === 0 ? null : [p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]])).filter(Boolean);
  pdf.lines(lines, pts[0][0], pts[0][1], [1, 1], "FD", true);
}

export async function captureScreenRegion(filename = "screenshot.png") {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture not supported in this browser");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { cursor: "never" },
    audio: false,
    preferCurrentTab: true,
  });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    await new Promise((r) => (video.onloadedmetadata = r));
    await video.play();
    // Give the browser a frame to render
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

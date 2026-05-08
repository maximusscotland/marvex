/**
 * imageCompress — downscale + re-encode user-uploaded images so they don't
 * blow past localStorage's ~5 MB budget. Returns a JPEG/PNG data URL.
 *
 * Why: annotations and custom backgrounds are Base64-encoded into localStorage.
 * A single 5 MB JPEG becomes ~6.7 MB once Base64-ified — enough to brick a map.
 *
 * Strategy:
 *   1. Decode the File into an <img>.
 *   2. Draw it onto a canvas, scaling so neither side exceeds `maxDim`.
 *   3. Re-encode as JPEG (or PNG if transparency matters) at `quality`.
 *   4. If the result is still huge, drop quality and retry until it fits `targetKb`.
 */

const DEFAULTS = {
  maxDim: 1600,       // px — comfortably sharp on 4K screens
  quality: 0.82,      // initial JPEG quality
  minQuality: 0.55,   // floor before we stop squeezing
  targetKb: 900,      // final file size target (pre-Base64) in KB
  mime: "image/jpeg", // JPEG reliably slashes size
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });

const dataUrlSizeKb = (dataUrl) => {
  // Base64 overhead: ~4/3 × raw bytes. Extract payload length × 0.75.
  const idx = dataUrl.indexOf(",");
  if (idx < 0) return Infinity;
  const payload = dataUrl.length - idx - 1;
  return (payload * 0.75) / 1024;
};

/**
 * Compress an image file.
 * @param {File} file
 * @param {Partial<typeof DEFAULTS>} opts
 * @returns {Promise<{ dataUrl: string, sizeKb: number, width: number, height: number }>}
 */
export async function compressImage(file, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  // SVG and GIF: just return as-is — re-encoding would break them.
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    const dataUrl = await readFileAsDataURL(file);
    return { dataUrl, sizeKb: dataUrlSizeKb(dataUrl), width: 0, height: 0 };
  }

  const originalDataUrl = await readFileAsDataURL(file);
  const img = await loadImage(originalDataUrl);

  // Scale so the long edge is at most maxDim.
  const long = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = long > cfg.maxDim ? cfg.maxDim / long : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // JPEG has no alpha — flatten against black to match the canvas backdrop.
  if (cfg.mime === "image/jpeg") {
    ctx.fillStyle = "#03121d";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  // Iteratively drop quality until it fits.
  let q = cfg.quality;
  let dataUrl = canvas.toDataURL(cfg.mime, q);
  let sizeKb = dataUrlSizeKb(dataUrl);
  while (sizeKb > cfg.targetKb && q > cfg.minQuality) {
    q = Math.max(cfg.minQuality, q - 0.1);
    dataUrl = canvas.toDataURL(cfg.mime, q);
    sizeKb = dataUrlSizeKb(dataUrl);
  }

  return { dataUrl, sizeKb, width: w, height: h };
}

/** Quick helper: compress only if the raw file is above `thresholdKb`. */
export async function compressIfLarge(file, thresholdKb = 200, opts = {}) {
  if (file.size / 1024 <= thresholdKb && !opts.force) {
    const dataUrl = await readFileAsDataURL(file);
    return { dataUrl, sizeKb: file.size / 1024, width: 0, height: 0 };
  }
  return compressImage(file, opts);
}

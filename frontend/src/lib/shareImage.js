/**
 * Render a 1200×630 cosmic-themed share image for an affiliate's link, drawn
 * entirely in <canvas> so we never hit a server (zero cost, instant).
 *
 * Output dimensions match the OpenGraph/Twitter Card 1.91:1 aspect ratio so
 * the image looks correct when pasted into X, LinkedIn, or any social preview.
 *
 * The function returns a data: URL the caller can either drop into an <img>
 * for in-page preview, or wire to an <a download> for export.
 */
export function renderAffiliateShareImage({ name, code, link, headline, accent }) {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // ---------- Background: cosmic gradient + starfield ----------
  const bg = ctx.createRadialGradient(W * 0.7, H * 0.3, 80, W * 0.5, H * 0.5, W * 0.9);
  bg.addColorStop(0, "#0c1a3d");
  bg.addColorStop(0.5, "#06091a");
  bg.addColorStop(1, "#03040a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Starfield — deterministic for a given code so the image is stable across
  // re-renders (looks weird if it shifts every time the user opens the page).
  let seed = 0;
  for (let i = 0; i < (code || "").length; i++) seed = (seed * 31 + code.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < 220; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = rng() * 1.4 + 0.2;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rng() * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft accent nebula glow (cyan or fuchsia depending on tier)
  const glow = ctx.createRadialGradient(W * 0.18, H * 0.78, 20, W * 0.18, H * 0.78, 420);
  glow.addColorStop(0, accent === "fuchsia" ? "rgba(255,106,213,0.4)" : "rgba(0,240,255,0.35)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---------- Top-left: brand mark ----------
  ctx.fillStyle = "rgba(0,240,255,0.85)";
  ctx.font = "600 17px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("⌬  MARVEX.COM", 60, 70);

  // Tier accent stripe under the brand
  ctx.fillStyle = accent === "fuchsia" ? "#ff6ad5" : "#00f0ff";
  ctx.fillRect(60, 80, 40, 2);

  // ---------- Headline (the user's pitch) ----------
  // Auto-wrap text manually — don't trust whatever font tooling the
  // browser uses; this is the lowest-risk way.
  const headlineText = (headline || "I just made a mind-map of my whole research backlog in 60 seconds.").trim();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 56px 'Sora', 'Helvetica Neue', sans-serif";
  ctx.textAlign = "left";
  const maxW = W - 120;
  const words = headlineText.split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    if (ctx.measureText(test).width <= maxW || !current) current = test;
    else { lines.push(current); current = w; }
    if (lines.length >= 4) break;
  }
  if (current && lines.length < 4) lines.push(current);
  let lineY = 200;
  for (const line of lines) {
    ctx.fillText(line, 60, lineY);
    lineY += 70;
  }

  // ---------- Sub: who's saying it ----------
  ctx.fillStyle = "rgba(207,218,243,0.85)";
  ctx.font = "400 26px 'Sora', sans-serif";
  ctx.fillText(`— ${(name || "A Marvex Studio member").trim()}`, 60, lineY + 18);

  // ---------- Bottom: CTA pill with the affiliate link ----------
  const pillX = 60;
  const pillY = H - 110;
  const pillH = 64;
  const pillText = `Try it · ${link.replace(/^https?:\/\//, "")}`;
  ctx.font = "600 22px 'JetBrains Mono', monospace";
  const pillW = Math.min(W - 120, ctx.measureText(pillText).width + 56);

  // Pill background
  const grd = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
  if (accent === "fuchsia") {
    grd.addColorStop(0, "#ff6ad5");
    grd.addColorStop(1, "#8a5bff");
  } else {
    grd.addColorStop(0, "#00f0ff");
    grd.addColorStop(1, "#0bb5ff");
  }
  ctx.fillStyle = grd;
  // Rounded rect (manual — wide browser support)
  const r = pillH / 2;
  ctx.beginPath();
  ctx.moveTo(pillX + r, pillY);
  ctx.lineTo(pillX + pillW - r, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
  ctx.lineTo(pillX + pillW, pillY + pillH - r);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
  ctx.lineTo(pillX + r, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
  ctx.lineTo(pillX, pillY + r);
  ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
  ctx.closePath();
  ctx.fill();

  // Pill text
  ctx.fillStyle = "#03060f";
  ctx.font = "600 22px 'JetBrains Mono', monospace";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, pillX + 28, pillY + pillH / 2 + 1);
  ctx.textBaseline = "alphabetic";

  // ---------- Bottom-right: 25% off badge ----------
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  const bx = W - 60 - 220;
  const by = H - 96;
  ctx.fillRect(bx, by, 220, 36);
  ctx.fillStyle = accent === "fuchsia" ? "#ffb1e5" : "#a8efff";
  ctx.font = "500 14px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("25% OFF FIRST INVOICE", bx + 110, by + 23);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}

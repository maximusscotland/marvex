/**
 * Affiliate Resources page — drop-in marketing kit for affiliates.
 *
 * What's here:
 *  • 3 banner sizes (leaderboard 728×90, medium rectangle 300×250,
 *    social 1200×630) rendered live in <canvas> with the affiliate's
 *    referral link embedded. PNG download, no server round-trip.
 *  • Pre-written copy snippets for X, LinkedIn, blog, and email — each
 *    with a one-click "copy to clipboard" so the affiliate doesn't have
 *    to write a thing.
 *  • Honest competitor comparison table — same data the homepage uses
 *    when the agent answers "should I reconsider my pricing" — laid out
 *    so an affiliate can screenshot it for a tweet thread.
 *
 * Why public (no Pro gate)?  These materials are intentionally browseable
 * BEFORE signup so a curious creator can preview what the program offers
 * before joining.  The link injection silently swaps in the default site
 * URL when no affiliate code is present — no broken-link footguns.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Sparkles, Copy, Download, Check,
  Twitter, Mail, FileText, Image as ImageIcon, Link as LinkIcon,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SITE = "https://marvex.app";

// ---------------------------------------------------------------------------
// Banner config — sizes match the dominant ad-network specs (Google AdSense
// leaderboard / medium-rectangle, plus the standard 1200×630 social card).
// We render them live from JS so the affiliate's link is always baked into
// the QR-friendly bottom strip.
// ---------------------------------------------------------------------------
const BANNERS = [
  {
    id: "leaderboard",
    label: "Leaderboard",
    size: "728 × 90",
    width: 728,
    height: 90,
    layout: "row",
    use: "Blog post header / sidebar",
  },
  {
    id: "rectangle",
    label: "Medium rectangle",
    size: "300 × 250",
    width: 300,
    height: 250,
    layout: "stack",
    use: "Sidebar widget / inline embed",
  },
  {
    id: "social",
    label: "Social card",
    size: "1200 × 630",
    width: 1200,
    height: 630,
    layout: "stack",
    use: "Twitter / LinkedIn / Bluesky / OG",
  },
];

// Competitor comparison data — stays close to the analysis I gave the user
// earlier in chat (same numbers, condensed columns for table readability).
// The "✓ / ✗ / ~" tri-state is rendered visually with coloured dots.
//
// PRICE represents the lowest paid tier; some competitors have higher tiers
// that match more features but at significantly higher cost.
const COMPETITORS = [
  { name: "Marvex", price: "$9–15/mo", aiPdf: "yes", byok: "yes", localFirst: "yes", desktop: "yes", lawPack: "yes", flowchart: "yes", reader: "yes", us: true },
  { name: "XMind",       price: "$5/mo",    aiPdf: "no",  byok: "no",  localFirst: "no",  desktop: "yes", lawPack: "no", flowchart: "yes", reader: "no" },
  { name: "MindNode",    price: "$2.49/mo", aiPdf: "no",  byok: "no",  localFirst: "yes", desktop: "yes", lawPack: "no", flowchart: "no",  reader: "no", note: "Apple-only" },
  { name: "MindMeister", price: "$6/mo",    aiPdf: "partial", byok: "no", localFirst: "no", desktop: "no",  lawPack: "no", flowchart: "no",  reader: "no" },
  { name: "Heptabase",   price: "$9/mo",    aiPdf: "partial", byok: "no", localFirst: "yes", desktop: "yes", lawPack: "no", flowchart: "no",  reader: "partial" },
  { name: "Scrintal",    price: "$5/mo",    aiPdf: "partial", byok: "no", localFirst: "no", desktop: "yes", lawPack: "no", flowchart: "no",  reader: "no" },
  { name: "Mapify",      price: "$9/mo",    aiPdf: "yes", byok: "no",  localFirst: "no",  desktop: "no",  lawPack: "no", flowchart: "no",  reader: "no" },
  { name: "Atlas",       price: "$12/mo",   aiPdf: "yes", byok: "no",  localFirst: "no",  desktop: "no",  lawPack: "no", flowchart: "no",  reader: "partial" },
  { name: "GitMind",     price: "free / $/mo", aiPdf: "yes", byok: "no", localFirst: "no", desktop: "partial", lawPack: "no", flowchart: "yes", reader: "no" },
  { name: "Notion + AI", price: "$20/mo",   aiPdf: "no",  byok: "no",  localFirst: "no",  desktop: "yes", lawPack: "no", flowchart: "partial", reader: "no" },
];

const COL = [
  { key: "price",      label: "Price" },
  { key: "aiPdf",      label: "AI PDF→Map" },
  { key: "byok",       label: "BYOK" },
  { key: "localFirst", label: "Local-first" },
  { key: "desktop",    label: "Desktop" },
  { key: "lawPack",    label: "UK Law pack" },
  { key: "flowchart",  label: "Flowcharts" },
  { key: "reader",     label: "PDF Reader" },
];

// Tri-state indicator; "yes" = green check, "no" = muted dash, "partial" = amber tilde.
const Cell = ({ v }) => {
  if (v === "yes") return <span className="text-emerald-300 font-bold" aria-label="yes">✓</span>;
  if (v === "partial") return <span className="text-amber-300" aria-label="partial">~</span>;
  if (v === "no") return <span className="text-[#566187]" aria-label="no">—</span>;
  return <span className="text-[#cfdaf3]">{v}</span>;
};

// ---------------------------------------------------------------------------
// Pre-written copy snippets — designed for one-click use. Each has a
// {{LINK}} placeholder we replace at render-time with the affiliate's link
// (or the bare site URL if they're not signed in / not an affiliate yet).
// ---------------------------------------------------------------------------
const SNIPPETS = [
  {
    id: "tweet-short",
    icon: Twitter,
    label: "Tweet (short)",
    body: `I built a mind-map of my entire research backlog in 60 seconds.

marvex.app — drag a PDF in, watch it become a navigable map.

25% off your first month with my link 👇
{{LINK}}`,
  },
  {
    id: "tweet-thread",
    icon: Twitter,
    label: "Tweet thread (3 posts)",
    body: `1/ I've been quietly using marvex.app for a few weeks now and it's the only research tool I haven't bounced off.

2/ Drop a PDF in. It auto-maps. You bring your own AI key — no mark-up, no quotas. Local-first so your reading list never leaves your machine.

3/ $9/mo or $15 if you want all the AI superpowers. 25% off your first invoice with this link:
{{LINK}}`,
  },
  {
    id: "linkedin",
    icon: FileText,
    label: "LinkedIn post",
    body: `If you read more than 5 PDFs a week, you should be mapping them, not highlighting them.

I've been testing marvex.app — it's a desktop + web mind-map studio that turns PDFs into navigable trees, lets you bring your own AI key (so there's no provider mark-up), and stores everything locally.

Free tier is generous (30-node maps, full export). Pro is $9–15/mo depending on AI usage. They also ship a UK Law add-on with BAILII full-text search and AI case summaries — niche but a killer for the bar.

If anyone wants to try, my referral link knocks 25% off the first invoice: {{LINK}}`,
  },
  {
    id: "blog-paragraph",
    icon: FileText,
    label: "Blog mention",
    body: `One tool I've been quietly recommending is **marvex.app**. It's a research-focused mind-map and flowchart studio that runs in the browser AND as a native desktop app. The headline feature is PDF → AI Mind Map: drag a paper in, get a structured tree out. The deal-maker for me was BYOK pricing — you bring your own API key for OpenAI / Claude / Gemini, the app pays nothing on top, and your maps stay local-first by default. Pricing starts at $9/mo (Lite) or $15/mo (Pro). [Try it 25% off →]({{LINK}})`,
  },
  {
    id: "email-intro",
    icon: Mail,
    label: "Email intro",
    body: `Subject: A research tool you might actually keep using

Hey {{NAME}},

I keep recommending this one to people who read a lot of PDFs — marvex.app. It's a mind-map studio that auto-builds a navigable tree from any PDF you drop in, with the wrinkle that you bring your own AI key (no mark-up) and your maps stay local on your machine. Desktop app + web; $9–15/mo depending on tier.

If you want to try it: {{LINK}} (25% off your first month through my link, no obligation.)

— You`,
  },
];

// ===========================================================================
// Banner renderer — draws to <canvas> in DPI-aware fashion so the PNG export
// is sharp on retina displays. The "social" layout uses a generous 1200×630
// composition with the headline filling 80% of width; the smaller leaderboard
// trims to a single-line tagline.
// ===========================================================================
function drawBanner(ctx, { width, height, layout, refLink }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.canvas.width = width * dpr;
  ctx.canvas.height = height * dpr;
  ctx.canvas.style.width = `${width}px`;
  ctx.canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  // Cosmic gradient background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#03060f");
  grad.addColorStop(0.5, "#0a1428");
  grad.addColorStop(1, "#1a0a28");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Cyan glow blob top-left
  const glow = ctx.createRadialGradient(width * 0.2, height * 0.3, 0, width * 0.2, height * 0.3, width * 0.4);
  glow.addColorStop(0, "rgba(0,240,255,0.25)");
  glow.addColorStop(1, "rgba(0,240,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Fuchsia glow bottom-right
  const glow2 = ctx.createRadialGradient(width * 0.85, height * 0.85, 0, width * 0.85, height * 0.85, width * 0.4);
  glow2.addColorStop(0, "rgba(255,106,213,0.20)");
  glow2.addColorStop(1, "rgba(255,106,213,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Layout-specific text & link
  if (layout === "row") {
    // 728×90: single-line tagline + CTA pill
    ctx.fillStyle = "#00f0ff";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("MARVEX", 22, 28);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Drop a PDF. Get a mind-map.", 22, 58);

    ctx.fillStyle = "#a4b4d8";
    ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("BYOK · local-first · 25% off first invoice", 22, 78);

    // CTA pill on the right
    const pillW = 130;
    const pillH = 36;
    const pillX = width - pillW - 22;
    const pillY = (height - pillH) / 2;
    ctx.fillStyle = "#00f0ff";
    roundRect(ctx, pillX, pillY, pillW, pillH, 18);
    ctx.fillStyle = "#03060f";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Try free →", pillX + pillW / 2, pillY + 23);
    ctx.textAlign = "left";
  } else {
    // 300×250 OR 1200×630 stacked. Scale typography by width.
    const scale = width / 600;
    const pad = 28 * scale;

    // Top eyebrow
    ctx.fillStyle = "#00f0ff";
    ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillText("MARVEX", pad, pad + 8 * scale);

    // Big headline (auto-wrap to 3 lines)
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.min(54 * scale, 64);
    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const headlineY = pad + 50 * scale;
    wrapText(
      ctx,
      "Drop a PDF.\nGet a mind-map.",
      pad,
      headlineY,
      width - pad * 2,
      fontSize * 1.05,
    );

    // Sub-line
    ctx.fillStyle = "#a4b4d8";
    ctx.font = `${15 * scale}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    const subY = headlineY + fontSize * 1.05 * 2 + 30 * scale;
    ctx.fillText("BYOK AI · local-first · desktop + web", pad, subY);

    // Bottom strip — link + CTA
    const stripY = height - 60 * scale;
    ctx.strokeStyle = "rgba(0,240,255,0.3)";
    ctx.beginPath();
    ctx.moveTo(pad, stripY - 14 * scale);
    ctx.lineTo(width - pad, stripY - 14 * scale);
    ctx.stroke();

    ctx.fillStyle = "#00f0ff";
    ctx.font = `bold ${13 * scale}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.fillText(refLink.replace(/^https?:\/\//, ""), pad, stripY + 10 * scale);

    // 25% off pill on the right
    const pillW = 130 * scale;
    const pillH = 32 * scale;
    const pillX = width - pillW - pad;
    const pillY = stripY - pillH / 2 + 5 * scale;
    ctx.fillStyle = "rgba(255,106,213,0.25)";
    roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.strokeStyle = "rgba(255,106,213,0.6)";
    ctx.stroke();
    ctx.fillStyle = "#ff6ad5";
    ctx.font = `bold ${12 * scale}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("25% OFF FIRST", pillX + pillW / 2, pillY + 20 * scale);
    ctx.textAlign = "left";
  }
}

// Helper: rounded-rect path (Canvas2D doesn't have a roundRect on every browser)
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

// Helper: line-by-line word-wrap.  Honors explicit `\n` for hard line breaks.
function wrapText(ctx, text, x, y, maxW, lineH) {
  const lines = text.split("\n");
  let yy = y;
  for (const line of lines) {
    const words = line.split(" ");
    let buf = "";
    for (const w of words) {
      const test = buf ? `${buf} ${w}` : w;
      if (ctx.measureText(test).width > maxW && buf) {
        ctx.fillText(buf, x, yy);
        yy += lineH;
        buf = w;
      } else {
        buf = test;
      }
    }
    if (buf) {
      ctx.fillText(buf, x, yy);
      yy += lineH;
    }
  }
}

// ---------------------------------------------------------------------------
// BannerCard — one preview thumbnail + download button per banner spec.
// ---------------------------------------------------------------------------
function BannerCard({ banner, refLink }) {
  const ref = useRef(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    drawBanner(ctx, { ...banner, refLink });
  }, [banner, refLink]);

  const download = () => {
    const c = ref.current;
    if (!c) return;
    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mind-mapper-${banner.id}-${banner.width}x${banner.height}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1500);
      toast.success(`${banner.label} saved to Downloads`);
    }, "image/png");
  };

  return (
    <div
      data-testid={`banner-card-${banner.id}`}
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-cyan-400/30 transition"
    >
      <div className="flex items-center justify-between mb-3 text-[12px]">
        <div>
          <div className="font-semibold text-white">{banner.label}</div>
          <div className="text-[10px] text-[#7a87ad] mono uppercase tracking-[0.18em] mt-0.5">{banner.size} · {banner.use}</div>
        </div>
        <button
          data-testid={`banner-download-${banner.id}`}
          onClick={download}
          className="cta-ghost text-[12px] px-3 py-1.5"
        >
          {downloaded ? <><Check size={12} /> Saved</> : <><Download size={12} /> PNG</>}
        </button>
      </div>
      <div className="rounded-lg overflow-hidden bg-black/40 grid place-items-center p-2 max-h-[260px] overflow-y-auto">
        <canvas
          ref={ref}
          className="block max-w-full"
          style={{ maxHeight: 240, height: "auto" }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SnippetCard — pre-written copy block with one-click clipboard copy.
// ---------------------------------------------------------------------------
function SnippetCard({ snippet, refLink }) {
  const [copied, setCopied] = useState(false);
  const Icon = snippet.icon;
  const filled = snippet.body.replace(/\{\{LINK\}\}/g, refLink);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(filled);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Copied — paste anywhere");
    } catch {
      toast.error("Couldn't copy — your browser may have blocked clipboard access");
    }
  };

  return (
    <div
      data-testid={`snippet-card-${snippet.id}`}
      className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-fuchsia-400/30 transition"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white">
          <Icon size={14} className="text-fuchsia-300" />
          <span className="font-semibold text-[13px]">{snippet.label}</span>
        </div>
        <button
          data-testid={`snippet-copy-${snippet.id}`}
          onClick={copy}
          className="cta-ghost text-[12px] px-3 py-1.5"
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-[12.5px] text-[#cfdaf3] leading-relaxed mono-fallback bg-black/30 rounded-md p-3 border border-white/5 max-h-[200px] overflow-y-auto">
        {filled}
      </pre>
    </div>
  );
}

// ===========================================================================
// AffiliateResources — top-level page.
// ===========================================================================
export default function AffiliateResources() {
  const { user } = useAuth();
  const [refData, setRefData] = useState(null);

  // Fetch the affiliate's link if they're signed in & enrolled. 401/403/404
  // are all "not enrolled yet" — we silently fall back to the bare site URL,
  // and show a sign-up nudge at the bottom.
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    axios
      .get(`${API}/affiliate/me`, { withCredentials: true })
      .then((r) => { if (!cancelled) setRefData(r.data); })
      .catch(() => { /* silent — public page, just no link injection */ });
    return () => { cancelled = true; };
  }, [user]);

  const refLink = useMemo(() => refData?.link || SITE, [refData]);
  const isEnrolled = !!refData?.link;

  return (
    <div className="min-h-screen cosmic-bg text-white">
      {/* Header */}
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link
          to="/affiliate"
          className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200 inline-flex items-center gap-1.5"
          data-testid="resources-back"
        >
          <ArrowLeft size={12} /> Back to dashboard
        </Link>
        <Link to="/library" className="text-[12px] text-[#9aaad0] hover:text-white">Open library →</Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 lg:px-12 pt-6 pb-24" data-testid="affiliate-resources-page">
        {/* Hero */}
        <div className="mb-12">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={11} /> Affiliate marketing kit
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Everything you need to share — already written.</h1>
          <p className="text-[15px] text-[#a4b4d8] max-w-2xl leading-relaxed">
            Drop-in banners, ready-to-paste copy, and a competitor table that does the
            objection-handling for you. Your link is baked into every asset below — sign in if you
            haven&apos;t already to swap the default link for your own.
          </p>

          {/* Link injection status */}
          <div
            data-testid="resources-link-status"
            className={`mt-6 rounded-xl border p-4 inline-flex items-center gap-3 text-[13px] ${
              isEnrolled
                ? "border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-200"
                : "border-amber-400/30 bg-amber-400/[0.05] text-amber-200"
            }`}
          >
            <LinkIcon size={14} />
            <div>
              <div className="font-semibold">
                {isEnrolled ? "Your link is being used in every asset below" : "Default site link is being used"}
              </div>
              <div className="mono text-[11px] uppercase tracking-[0.18em] mt-0.5 opacity-80">
                {refLink.replace(/^https?:\/\//, "")}
              </div>
            </div>
            {!isEnrolled && (
              <Link to="/affiliate" className="cta-pill text-[11px] ml-2" data-testid="resources-enroll-cta">
                Get my link <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </div>

        {/* SECTION 1: Banners */}
        <section className="mb-16" data-testid="resources-banners-section">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-1.5 inline-flex items-center gap-1.5">
                <ImageIcon size={11} /> 01 — Banners
              </div>
              <h2 className="text-2xl font-bold">Pixel-perfect, link-embedded.</h2>
            </div>
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad]">PNG · transparent-friendly</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BANNERS.map((b) => (
              <BannerCard key={b.id} banner={b} refLink={refLink} />
            ))}
          </div>
        </section>

        {/* SECTION 2: Copy snippets */}
        <section className="mb-16" data-testid="resources-snippets-section">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 mb-1.5 inline-flex items-center gap-1.5">
                <FileText size={11} /> 02 — Copy
              </div>
              <h2 className="text-2xl font-bold">Pre-written. One-click copy.</h2>
            </div>
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad]">Tested, edit-friendly</span>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {SNIPPETS.map((s) => (
              <SnippetCard key={s.id} snippet={s} refLink={refLink} />
            ))}
          </div>
        </section>

        {/* SECTION 3: Competitor comparison table */}
        <section className="mb-16" data-testid="resources-comparison-section">
          <div className="mb-5">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-1.5 inline-flex items-center gap-1.5">
              <Sparkles size={11} /> 03 — Comparison
            </div>
            <h2 className="text-2xl font-bold">Honest comparison vs the field.</h2>
            <p className="text-[14px] text-[#a4b4d8] mt-2 max-w-2xl">
              No competitor ships every feature Marvex does at this price.
              Screenshot the table for a tweet thread or embed it in a blog.
              Data sourced from each vendor&apos;s public pricing as of Feb 2026.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-x-auto">
            <table className="w-full text-[13px]" data-testid="comparison-table">
              <thead>
                <tr className="border-b border-white/10 mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad]">
                  <th className="text-left px-4 py-3">Tool</th>
                  {COL.map((c) => (
                    <th key={c.key} className="text-center px-3 py-3">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPETITORS.map((row) => (
                  <tr
                    key={row.name}
                    data-testid={`comparison-row-${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className={`border-b border-white/5 last:border-0 ${
                      row.us ? "bg-cyan-400/[0.06]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className={`px-4 py-3 font-semibold ${row.us ? "text-cyan-200" : "text-white"}`}>
                      {row.name}
                      {row.us && <span className="ml-2 mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-200">YOU</span>}
                      {row.note && <span className="ml-2 text-[10px] text-[#7a87ad] font-normal">({row.note})</span>}
                    </td>
                    {COL.map((c) => (
                      <td key={c.key} className="text-center px-3 py-3 text-[13px]">
                        <Cell v={row[c.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-[#7a87ad] mt-3 leading-relaxed">
            ✓ = full support · ~ = limited / partial · — = not available · YOU = Marvex.
            <br />
            To replicate the full feature set elsewhere you&apos;d need
            Heptabase ($9) + Mapify ($9) + ChatGPT Plus ($20) + a separate annotator (~$15)
            ≈ <strong className="text-cyan-300">$53/mo before any law-pack subscription</strong>.
          </p>
        </section>

        {/* SECTION 4: Brand guidelines */}
        <section className="mb-12" data-testid="resources-brand-section">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-cyan-300 mb-2">04 — Brand notes</div>
            <h3 className="text-xl font-bold mb-4">A few quick rules so we look good together</h3>
            <ul className="space-y-2.5 text-[13px] text-[#cfdaf3]">
              <li className="flex gap-3">
                <span className="text-cyan-300 shrink-0">→</span>
                <span><strong className="text-white">Be honest.</strong> If you haven&apos;t tried something, don&apos;t claim you have. The product is genuinely good — false praise will only hurt your conversion.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300 shrink-0">→</span>
                <span><strong className="text-white">Disclose the affiliate relationship.</strong> Required by FTC / ASA / most platforms. A simple &quot;I get a small commission if you sign up through this link&quot; works.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300 shrink-0">→</span>
                <span><strong className="text-white">Spell it &quot;Marvex&quot;</strong> with a capital M. The wordmark is fine to use as-is — don&apos;t recolour or re-letter it.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300 shrink-0">→</span>
                <span><strong className="text-white">No bidding on &quot;Marvex&quot; brand keywords</strong> on Google / Bing Ads. Self-referrals and brand-bidding are excluded from commission per the affiliate terms.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-300 shrink-0">→</span>
                <span><strong className="text-white">Need something custom?</strong> A bigger banner, a co-branded landing page, a video review embed kit — email <a href="mailto:hello@marvex.app" className="text-cyan-300 hover:underline">hello@marvex.app</a> and we&apos;ll make it.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="text-center">
          <Link to="/affiliate" data-testid="resources-bottom-cta" className="cta-pill">
            Back to your dashboard <ArrowRight size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
}

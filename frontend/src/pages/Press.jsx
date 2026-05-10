import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle2, AlertCircle, Loader2, Mic, Newspaper, Video, Rss, BookOpen, Copy, Quote } from "lucide-react";
import usePageMeta from "@/lib/usePageMeta";
import SiteLinksFooter from "@/components/SiteLinksFooter";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * /press — public press / reviewer / creator application.
 *
 * Auto-issues a single-use 14-day Pro access code and emails it to the
 * applicant within seconds. No admin gate — the per-email rate limit
 * (24h) and the requirement for a real publication URL filter out the
 * bulk of spam attempts. Fits well-trafficked launch windows where
 * manual triage would create a backlog.
 */

const ROLES = [
  { id: "Journalist",   icon: Newspaper, label: "Journalist / writer", desc: "Magazine, online publication, blog" },
  { id: "YouTuber",     icon: Video,     label: "YouTuber / streamer", desc: "Tech, productivity, study channels" },
  { id: "Podcaster",    icon: Mic,       label: "Podcaster",            desc: "Tech, indie maker, research shows" },
  { id: "Newsletter",   icon: Rss,       label: "Newsletter author",   desc: "Substack, ConvertKit, etc." },
  { id: "Educator",     icon: BookOpen,  label: "Educator / academic",  desc: "Teaching mind-mapping or study skills" },
];

export default function Press() {
  usePageMeta({
    title: "Press & Reviewers — 14 days of Marvex Studio Pro",
    description: "Journalists, YouTubers, podcasters, newsletter authors and educators: get instant 14-day Pro access to Marvex Studio for honest review.",
    type: "website",
    url: "https://marvex.app/press",
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    publication: "",
    role: "Journalist",
    link: "",
    why: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e?.preventDefault?.();
    setError(null);
    setResult(null);
    // Light client-side validation; server enforces same rules.
    if (form.why.trim().length < 10) {
      setError("Please share a quick line about how you'd use Marvex.");
      return;
    }
    if (!/^https?:\/\//i.test(form.link.trim())) {
      setError("Your link must start with https:// or http://");
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/press/apply`, form);
      setResult(r.data);
      toast.success(r.data?.auto_approved ? "Approved — check your inbox" : "Application received");
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Application failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid="press-page">
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link to="/" className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200 inline-flex items-center gap-1.5">
          <ArrowLeft size={12} /> marvex.app
        </Link>
        <Link to="/pricing" className="text-[12px] text-[#9aaad0] hover:text-white">See pricing →</Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-10 pb-24">
        <div className="text-center mb-10">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={11} /> Press · Reviewers · Creators
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4 leading-[1.05]">
            Cover Marvex Studio.<br/>
            <span className="gradient-text">14 days Pro on us.</span>
          </h1>
          <p className="text-[14px] sm:text-[15px] text-[#a4b4d8] leading-relaxed max-w-xl mx-auto">
            Journalists, YouTubers, podcasters, newsletter authors, educators —
            we want you to try the full Pro tier with zero friction.
            Instant approval. Email delivery. No card.
          </p>
        </div>

        {result ? (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/[0.06] p-7" data-testid="press-success">
            <CheckCircle2 size={36} className="text-emerald-300 mx-auto mb-3" />
            <h2 className="text-xl font-semibold text-white mb-2 text-center">
              {result.auto_approved ? "You're approved 🎉" : "Application received"}
            </h2>
            <p className="text-[13px] text-[#cfdaf3] leading-relaxed text-center mb-5">
              {result.message}
            </p>
            {result.auto_approved && result.code && (
              <div className="my-5 p-4 rounded-xl bg-[#0a1428] border border-dashed border-cyan-400/40 text-center">
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">Your code</div>
                <div data-testid="press-code-display" className="font-mono text-lg sm:text-xl tracking-[0.18em] text-cyan-200 mb-3">
                  {result.code}
                </div>
                <Link
                  to={`/redeem?code=${result.code}`}
                  data-testid="press-redeem-now"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-[#03060f] text-[12px] font-semibold transition"
                >
                  Redeem now <ArrowRight size={12} />
                </Link>
              </div>
            )}
            <p className="text-[11px] text-[#566187] text-center mt-3">
              Email not arrived in 2 minutes? Check spam, or copy the code above and paste it on /redeem.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.02] p-7 space-y-5" data-testid="press-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Your name" testid="press-name">
                <input
                  data-testid="press-name-input"
                  required value={form.name} onChange={update("name")}
                  placeholder="Sam Lee"
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-cyan-100 outline-none focus:border-cyan-400/60"
                />
              </Field>
              <Field label="Email" testid="press-email">
                <input
                  data-testid="press-email-input"
                  required type="email" value={form.email} onChange={update("email")}
                  placeholder="sam@publication.com"
                  className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-cyan-100 outline-none focus:border-cyan-400/60"
                />
              </Field>
            </div>

            <Field label="Publication / channel" testid="press-pub">
              <input
                data-testid="press-publication-input"
                required value={form.publication} onChange={update("publication")}
                placeholder="The Verge, Linus Tech Tips, your Substack…"
                className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-cyan-100 outline-none focus:border-cyan-400/60"
              />
            </Field>

            <Field label="Role" testid="press-role">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const active = form.role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-testid={`press-role-${r.id}`}
                      onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition ${
                        active
                          ? "border-cyan-400/60 bg-cyan-500/10"
                          : "border-white/10 bg-[#0a0f24] hover:border-white/20"
                      }`}
                    >
                      <Icon size={16} className={active ? "text-cyan-300 mt-0.5 shrink-0" : "text-[#7a87ad] mt-0.5 shrink-0"} />
                      <div>
                        <div className={`text-[13px] ${active ? "text-cyan-100" : "text-white"}`}>{r.label}</div>
                        <div className="text-[10.5px] text-[#7a87ad] leading-snug">{r.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Link to your work" testid="press-link" hint="Profile, channel, latest article — anything we can verify in 5 seconds.">
              <input
                data-testid="press-link-input"
                required value={form.link} onChange={update("link")}
                placeholder="https://your-publication.com/your-author-page"
                className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-cyan-100 outline-none focus:border-cyan-400/60"
              />
            </Field>

            <Field label="How you'd use it" testid="press-why" hint="One line is fine. e.g. 'Reviewing AI study tools for my back-to-school roundup.'">
              <textarea
                data-testid="press-why-input"
                required value={form.why} onChange={update("why")}
                placeholder="Quick context — what are you covering, when, and how Marvex fits in?"
                rows={3}
                maxLength={600}
                className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[14px] text-cyan-100 outline-none focus:border-cyan-400/60 resize-none"
              />
              <div className="text-[10px] text-[#566187] mt-1 text-right">{form.why.length}/600</div>
            </Field>

            {error && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 flex items-start gap-2" data-testid="press-error">
                <AlertCircle size={14} className="text-amber-300 mt-0.5 shrink-0" />
                <span className="text-[12px] text-amber-100">{error}</span>
              </div>
            )}

            <button
              data-testid="press-submit-btn"
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg text-[14px] font-semibold bg-fuchsia-500 hover:bg-fuchsia-400 text-[#03060f] disabled:opacity-50 transition"
            >
              {busy ? <><Loader2 size={14} className="animate-spin" /> Approving…</> : <>Get my code <ArrowRight size={14} /></>}
            </button>

            <p className="text-[11px] text-[#566187] text-center leading-relaxed">
              We'll email your code instantly. No spam, no follow-up sequences.
              By applying you agree to our <Link to="/terms" className="text-cyan-300/70 hover:underline">terms</Link> &amp; <Link to="/privacy" className="text-cyan-300/70 hover:underline">privacy policy</Link>.
            </p>
          </form>
        )}

        <div className="mt-12 text-center" data-testid="press-already-have">
          <span className="text-[12px] text-[#7a87ad]">Already have a code? </span>
          <Link to="/redeem" className="text-[12px] text-cyan-300 hover:underline">Redeem it →</Link>
        </div>

        {/* ---------- PRESS KIT ----------
            Below the form so applicants who scroll past get everything
            they need to write a piece without a follow-up email: a
            one-liner, a 50-word blurb, a 200-word boilerplate, founder
            quote, and screenshots. Each text block has a Copy button so
            writers can paste straight into a draft. Lifts published-
            piece conversion because writers are lazy — give them
            everything pre-cut. */}
        <PressKit />

      </main>
      <SiteLinksFooter />
    </div>
  );
}

// ============ PRESS KIT ============
const COPY_BLOCKS = {
  oneLiner:
    "Marvex Studio turns PDFs and ideas into living mind maps, flowcharts, and timelines — local-first, BYOK AI, browser + desktop.",
  blurb50:
    "Marvex Studio is a local-first mind-mapping and research tool. Drop a PDF, paste an article, or start from scratch — its AI assistant Mikey turns dense material into navigable mind maps, timelines, and flowcharts in under a minute. Browser-based with full desktop apps for Mac and Windows. BYOK means users pay $0 in AI fees.",
  boilerplate200:
    "Marvex Studio (marvex.app) is a local-first thinking tool that turns PDFs, web articles, and raw ideas into living mind maps, flowcharts, and timelines. Built around a friendly AI tutor named Mikey, the app extracts headings, generates supporting branches, and lets users drill deeper with their own LLM key — so user wallets pay for AI, not Marvex's. Maps live in the browser by default (Pro users opt in to cloud sync), keeping research private. Available on web, Windows, and Mac.\n\nThe app launched in February 2026 with three studios — Mind-Map, Flowchart, and Timeline (BETA) — and has been featured in independent productivity newsletters and student communities. Pricing is freemium: 30 free nodes per map, $9/mo Lite, $15/mo Pro, or a $200 one-time Founder lifetime tier. A press code grants 14 days of full Pro access at marvex.app/press.",
  founderQuote:
    "Most AI tools feel like a black box you talk to. Marvex is a thinking tool — it gives you a canvas your ideas can live on, with the AI as a tutor, not a replacement.",
  emailContact: "press@marvex.app",
};

const PressKit = () => {
  const [copied, setCopied] = useState(null);
  const copy = (key, text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const screenshots = [
    { src: "/teaser/book-to-map.webp", alt: "PDF transformed into a mind map", caption: "PDF → Mind map in 60 seconds" },
    { src: "/mikey/mikey-thinking-bubble.png", alt: "Mikey, the cosmic owl-professor research assistant", caption: "Mikey, the AI tutor" },
  ];

  return (
    <section data-testid="press-kit" className="mt-20 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="mono text-[10px] uppercase tracking-[0.28em] text-cyan-300/80 mb-2">
          Press Kit
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Everything you need to <span className="gradient-text">write the piece</span>.
        </h2>
        <p className="text-[13px] text-[#a4b4d8] mt-2">
          Pre-cut copy, screenshots, founder quote. Click any block to copy.
        </p>
      </div>

      <div className="space-y-3.5">
        <CopyBlock
          label="One-liner"
          tone="cyan"
          text={COPY_BLOCKS.oneLiner}
          isCopied={copied === "oneLiner"}
          onCopy={() => copy("oneLiner", COPY_BLOCKS.oneLiner)}
        />
        <CopyBlock
          label="50-word blurb"
          tone="violet"
          text={COPY_BLOCKS.blurb50}
          isCopied={copied === "blurb50"}
          onCopy={() => copy("blurb50", COPY_BLOCKS.blurb50)}
        />
        <CopyBlock
          label="Boilerplate · 200 words"
          tone="fuchsia"
          text={COPY_BLOCKS.boilerplate200}
          isCopied={copied === "boilerplate200"}
          onCopy={() => copy("boilerplate200", COPY_BLOCKS.boilerplate200)}
        />

        {/* Founder quote — pulled out for visual impact */}
        <div className="rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/[0.06] to-violet-500/[0.04] p-5">
          <div className="flex items-start gap-3">
            <Quote size={20} className="text-fuchsia-300 flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 mb-2 flex items-center justify-between gap-2">
                <span>Founder quote</span>
                <button
                  type="button"
                  onClick={() => copy("founderQuote", COPY_BLOCKS.founderQuote)}
                  data-testid="press-kit-copy-quote"
                  className="text-[#7a87ad] hover:text-fuchsia-200 transition flex items-center gap-1"
                >
                  {copied === "founderQuote" ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied === "founderQuote" ? "Copied" : "Copy"}
                </button>
              </div>
              <blockquote className="text-[15px] text-white italic leading-relaxed">
                "{COPY_BLOCKS.founderQuote}"
              </blockquote>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mt-2.5">
                — Founder, Marvex Studio
              </div>
            </div>
          </div>
        </div>

        {/* Screenshots */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3 flex items-center justify-between">
            <span>Screenshots & assets</span>
            <span className="text-[#566187] normal-case tracking-normal">Right-click → Save image</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {screenshots.map((s) => (
              <figure key={s.src} className="m-0">
                <img
                  src={s.src}
                  alt={s.alt}
                  className="w-full h-40 object-cover rounded-lg border border-white/10"
                />
                <figcaption className="text-[11px] text-[#7a87ad] mt-1.5">{s.caption}</figcaption>
              </figure>
            ))}
          </div>
          <p className="text-[11px] text-[#566187] mt-3 leading-relaxed">
            Need a higher-resolution asset, custom screenshot, logo SVG, or a 60-second screen recording? Email <a href="mailto:press@marvex.app" className="text-cyan-300 hover:text-cyan-200">press@marvex.app</a> — we'll send it within the day.
          </p>
        </div>

        {/* Quick facts */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3">
            Fast facts (for fact-check)
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-[12px]">
            {[
              ["Launched", "February 2026"],
              ["Platforms", "Web · Mac · Windows"],
              ["Pricing", "Free · $9/mo Lite · $15/mo Pro · $200 lifetime Founder"],
              ["AI model", "BYOK — user's own OpenAI / Anthropic / Gemini key"],
              ["Storage", "Local-first; cloud sync is opt-in (Pro)"],
              ["Founder contact", "press@marvex.app"],
              ["Domain", "marvex.app"],
              ["AI tutor name", "Mikey (cosmic owl-professor)"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-1 border-b border-white/[0.04]">
                <dt className="text-[#7a87ad] flex-shrink-0">{k}</dt>
                <dd className="text-[#cfdaf3] text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.06] to-violet-500/[0.04] p-5 text-center">
          <div className="text-[14px] text-white mb-2">
            Anything missing? Need a 5-min demo call?
          </div>
          <a
            href={`mailto:${COPY_BLOCKS.emailContact}?subject=Marvex%20Studio%20press%20enquiry`}
            data-testid="press-kit-email-link"
            className="cta-pill text-[13px]"
          >
            <Newspaper size={13} /> Email press@marvex.app
          </a>
        </div>
      </div>
    </section>
  );
};

const TONE_STYLES = {
  cyan:    { border: "rgba(0,240,255,0.30)",  label: "text-cyan-300" },
  violet:  { border: "rgba(160,140,255,0.35)", label: "text-violet-300" },
  fuchsia: { border: "rgba(255,106,213,0.35)", label: "text-fuchsia-300" },
};

const CopyBlock = ({ label, tone = "cyan", text, isCopied, onCopy }) => {
  const t = TONE_STYLES[tone] || TONE_STYLES.cyan;
  return (
    <div
      className="rounded-xl bg-white/[0.02] p-4"
      style={{ border: `1px solid ${t.border}` }}
    >
      <div className={`mono text-[10px] uppercase tracking-[0.22em] mb-2 flex items-center justify-between gap-2 ${t.label}`}>
        <span>{label}</span>
        <button
          type="button"
          onClick={onCopy}
          data-testid={`press-kit-copy-${label.toLowerCase().replace(/\W+/g, "-")}`}
          className={`flex items-center gap-1 transition ${isCopied ? "text-emerald-200" : "text-[#7a87ad] hover:" + t.label}`}
        >
          {isCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-[13px] text-[#e2eaff] leading-relaxed whitespace-pre-line">
        {text}
      </p>
    </div>
  );
};

const Field = ({ label, hint, testid, children }) => (
  <label className="block" data-testid={testid}>
    <span className="mono text-[10px] uppercase tracking-[0.2em] text-[#7a87ad] mb-2 block">{label}</span>
    {children}
    {hint && <p className="text-[11px] text-[#566187] mt-1.5 leading-relaxed">{hint}</p>}
  </label>
);

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  ScanSearch,
  ShieldCheck,
  CloudUpload,
  FileOutput,
  ArrowRight,
  Quote,
  BookOpen,
  Link2,
  CalendarDays,
  Bookmark,
} from "lucide-react";
import Logo from "@/components/Logo";
import CinematicTeaser from "@/components/CinematicTeaser";
import LandingMindMap from "@/components/LandingMindMap";
import PressTestimonials from "@/components/PressTestimonials";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LinksMenu from "@/components/LinksMenu";
import SocialProofStrip from "@/components/SocialProofStrip";
import ScrollReveal from "@/components/ScrollReveal";
import SEOContent from "@/components/SEOContent";
import AccessCodeBox from "@/components/AccessCodeBox";
import LandingFaq from "@/components/LandingFaq";
import ThemeToggle from "@/components/ThemeToggle";
import usePageMeta from "@/lib/usePageMeta";
import { PRESET_BACKGROUNDS } from "@/lib/backgrounds";

const TESTIMONIALS_API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/testimonials`;
const MIN_TESTIMONIALS_TO_SWAP = 3;

const FeatureCard = ({ icon: Icon, title, badge, body, badgeColor = "from-cyan-500/30 to-cyan-500/10" }) => (
  <div
    data-testid={`feature-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    className="glass-panel rounded-2xl p-7 transition-all hover:translate-y-[-3px] hover:border-[rgba(0,240,255,0.4)]"
    style={{ minHeight: 260 }}
  >
    <div className="flex items-start justify-between mb-5">
      <div
        className="w-12 h-12 rounded-xl grid place-items-center"
        style={{
          background: "linear-gradient(135deg, rgba(0,240,255,0.18), rgba(138,91,255,0.12))",
          border: "1px solid rgba(0,240,255,0.35)",
        }}
      >
        <Icon size={22} className="text-cyan-300" />
      </div>
      <span className={`text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-gradient-to-r ${badgeColor} text-cyan-100 border border-cyan-500/20`}>
        {badge}
      </span>
    </div>
    <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
    <p className="text-[15px] leading-relaxed text-[#9aaad0]">{body}</p>
  </div>
);

const Step = ({ n, title, body }) => (
  <div data-testid={`how-step-${n}`} className="text-left">
    <div
      className="w-12 h-12 rounded-full grid place-items-center mb-5 mono text-cyan-300 text-lg"
      style={{
        background: "rgba(0, 240, 255, 0.06)",
        border: "1px solid rgba(0,240,255,0.4)",
        boxShadow: "0 0 18px rgba(0,240,255,0.18)",
      }}
    >
      {String(n).padStart(2, "0")}
    </div>
    <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
    <p className="text-[15px] text-[#8794b8] leading-relaxed">{body}</p>
  </div>
);

export default function Landing() {
  const { t } = useTranslation();
  const [testimonials, setTestimonials] = useState([]);

  // SEO: every browser tab on `/` shows this title; sharing the link on
  // social platforms uses the Open-Graph variant from <head> in
  // index.html. Keep marketing-style title under ~60 chars so Google
  // doesn't truncate it in the SERP.
  usePageMeta({
    title: "Marvex Studio - PDF to Mind Map AI Generator",
    description:
      "AI mind map generator — turn any PDF into an interactive mind map in 60 seconds. Local-first, BYO-key, free tier. No login required.",
    type: "website",
  });

  useEffect(() => {
    fetch(TESTIMONIALS_API)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.testimonials)) {
          setTestimonials(data.testimonials);
        }
      })
      .catch(() => { /* silent — keeps personas as fallback */ });
  }, []);

  const showRealTestimonials = testimonials.length >= MIN_TESTIMONIALS_TO_SWAP;

  return (
    <div data-testid="landing-page" className="cosmic-bg min-h-screen text-white">
      {/* SEO H1 — visually hidden but read by Google + screen readers.
          Placing the keyword-rich H1 here (instead of replacing the
          cinematic hero copy) keeps the brand voice intact while giving
          search engines the exact-match title they want. There is exactly
          ONE <h1> on the page; every other heading is <h2> or below. */}
      <h1 className="sr-only">Turn Any PDF into an Interactive Mind Map</h1>

      {/* MAIN HEADER — sits at the very top: logo (left), CTA (right).
          Section links live further down, just above the cinematic teaser. */}
      <nav className="relative z-30 px-6 lg:px-12 pt-4 pb-3 flex items-center justify-between gap-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Logo size={42} />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-wide"><span className="gradient-text">Marvex Studio</span></div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#6c7aa3]">{t("common.tagline")}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Link to="/library" data-testid="nav-launch-btn" className="cta-ghost text-sm">
            {t("common.tryFree")} <ArrowRight size={14} />
          </Link>
          <ThemeToggle />
          <LinksMenu align="right" />
        </div>
      </nav>

      {/* TINY UTILITY BAR — language switcher centred under the header. */}
      <div className="relative z-30 px-6 lg:px-12 pt-3 pb-1 flex items-center justify-center" data-testid="lang-bar">
        <LanguageSwitcher compact />
      </div>

      {/* Access-code affordance — bare text link centred between the
          language switcher and the section nav. No surrounding pill so it
          reads as a discreet whisper for VIPs / press / friends-of-founder;
          anyone without a code keeps scrolling without noticing. */}
      <div className="relative z-30 px-6 lg:px-12 pt-1 pb-1 flex items-center justify-center" data-testid="access-code-bar">
        <Link
          to="/redeem"
          data-testid="nav-have-code-link"
          className="mono text-[11px] uppercase tracking-[0.22em] text-fuchsia-300/90 hover:text-fuchsia-200 transition"
        >
          Have an access code? Redeem →
        </Link>
      </div>

      {/* SECTION-LINK STRIP — sits directly above the cinematic teaser
          ("The Experience"), so visitors can jump into any section without
          competing with the brand mark + CTA above. */}
      <div
        className="relative z-30 px-6 lg:px-12 pt-2 pb-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
        data-testid="top-section-nav"
      >
        <a href="#features" data-testid="nav-features" className="nav-link text-[12px] text-[#cfdaf3] hover:text-cyan-300 transition">{t("nav.features")}</a>
        <a href="#how" data-testid="nav-how" className="nav-link text-[12px] text-[#cfdaf3] hover:text-cyan-300 transition">{t("nav.howItWorks")}</a>
        <a href="#faq" data-testid="nav-faq" className="nav-link text-[12px] text-[#cfdaf3] hover:text-cyan-300 transition">FAQ</a>
        <Link to="/learn" data-testid="nav-learn" className="nav-link text-[12px] text-[#cfdaf3] hover:text-cyan-300 transition">{t("nav.learn")}</Link>
        <Link to="/pricing" data-testid="nav-pricing" className="nav-link nav-link--accent text-[12px] text-[#cfdaf3] hover:text-fuchsia-300 transition">Pricing</Link>
      </div>

      {/* HERO — order: badge → title → intro → video → quote → buttons.
          Each slot is wrapped in <ScrollReveal> with a staggered delay so
          the page reads like a scroll-driven reveal rather than a SaaS dump. */}
      <section className="relative z-20 px-6 lg:px-12 pt-6 pb-20 lg:pt-8 lg:pb-24">
        <div className="max-w-6xl mx-auto text-center flex flex-col items-center">
          <ScrollReveal delay={0}>
            <div className="inline-flex items-center gap-2 mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 mb-4">
              <Sparkles size={12} /> {t("landing.heroBadge")}
            </div>
          </ScrollReveal>

          {/* Access-code affordance moved to the top utility bar (next to
              the language switcher) — keeps the hero focused on the H1 and
              the primary CTA. VIPs / friends-of-founder / press recipients
              click "Have a code?" up there and route to /redeem. */}

          <ScrollReveal as="h2" delay={120} className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[0.95] tracking-tight">
            {t("landing.heroTitleA")}
            <br />
            <span className="gradient-text">{t("landing.heroTitleB")}</span>
          </ScrollReveal>

          <ScrollReveal as="p" delay={240} className="mt-8 max-w-2xl text-lg text-[#a4b4d8] leading-relaxed">
            <span className="font-semibold tracking-wide"><span className="gradient-text">{t("landing.heroLeadBrand")}</span></span>{" "}
            {t("landing.heroLead")}
            {" "}
            <span className="text-xl sm:text-2xl font-bold text-white">{t("landing.heroZeroCloud")}</span>
          </ScrollReveal>

          {/* VIDEO / cinematic teaser — slot 4 */}
          <ScrollReveal delay={360} className="w-full mt-12">
            <CinematicTeaser />
          </ScrollReveal>

          {/* QUOTE — slot 5 */}
          <ScrollReveal delay={480} className="w-full mt-14 mb-2 max-w-4xl">
            <p className="text-xl md:text-2xl font-light leading-relaxed text-[#cfdaf3] italic">
              {(() => {
                // Bold + underline the brand mention inside the quote, and
                // wrap the whole text in proper curly quotes so the hero
                // reads like an editorial pull-quote, not body copy.
                const raw = t("landing.philosophyQuote") || "";
                const brand = "Marvex Studio";
                const idx = raw.indexOf(brand);
                if (idx === -1) return `“${raw}”`;
                return (
                  <>
                    {`“${raw.slice(0, idx)}`}
                    <strong className="font-bold underline underline-offset-4 decoration-cyan-400/70 not-italic text-white">
                      {brand}
                    </strong>
                    {`${raw.slice(idx + brand.length)}”`}
                  </>
                );
              })()}
            </p>
            <div className="mt-5 mono text-[11px] uppercase tracking-[0.22em] text-[#5e6a91]">
              {t("landing.philosophyAttribution")}
            </div>
          </ScrollReveal>

          {/* BUTTONS — slot 6.  Desktop download CTA removed from the
              public landing in favour of routing visitors at the web app
              first; the desktop installer is gated behind a paid plan
              from /download itself. Anyone wanting it from here can
              still reach it via the footer / pricing pages. */}
          <ScrollReveal delay={600} className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link to="/library" data-testid="hero-launch-btn" className="cta-pill text-[15px]">
              {t("common.tryFree")} <ArrowRight size={16} />
            </Link>
            <Link
              to="/app?example=guide"
              data-testid="hero-example-btn"
              className="cta-ghost text-[14px]"
            >
              Example map <ArrowRight size={14} />
            </Link>
            {/* Hero "Meet Mikey" CTA — top-of-funnel discoverability for
                the in-app tutor.  Visitors who don't know what the app
                does can have a 30-second conversation with Mikey before
                ever touching the studio. Custom event is dispatched so
                the floating MikeyChat singleton (mounted in App.js)
                pops open without prop-drilling. */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("marvex:openMikey"))}
              data-testid="hero-meet-mikey-btn"
              className="group flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full border border-violet-400/40 bg-[#0a0f24]/70 backdrop-blur-md text-white hover:border-fuchsia-300/60 hover:shadow-[0_8px_28px_rgba(255,106,213,0.35)] transition text-[14px]"
            >
              <span
                className="w-7 h-7 rounded-full overflow-hidden border border-violet-400/50 grid place-items-center bg-[#03040a] flex-shrink-0"
                style={{ boxShadow: "0 0 8px rgba(160,140,255,0.45)" }}
              >
                <img src="/mikey/mikey-headshot.png" alt="Mikey" className="w-full h-full object-cover" />
              </span>
              Meet Mikey
              <ArrowRight size={13} className="text-fuchsia-300 group-hover:translate-x-0.5 transition" />
            </button>
            <a href="#features" data-testid="hero-explore-btn" className="cta-ghost text-[14px]">
              {t("common.seeWhatItDoes")}
            </a>
          </ScrollReveal>
          <SocialProofStrip />
          <ScrollReveal delay={720} as="div" className="mono text-[11px] uppercase tracking-[0.18em] text-[#5e6a91] mt-5">
            {t("landing.heroFootnote")}
          </ScrollReveal>
        </div>
      </section>

      {/* BUILT-FOR PERSONAS — honest social proof via concrete use cases */}
      {!showRealTestimonials && (
      <section
        id="built-for"
        data-testid="landing-built-for"
        className="relative z-20 px-6 lg:px-12 py-24 border-b border-white/5"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">
              Built for
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Creative,&nbsp;Intuitive,&nbsp;
              <span className="gradient-text">Non-Linear Thinkers.</span>
            </h2>
            <p className="text-[#9aa7c7] mt-5 max-w-2xl mx-auto text-[15px] leading-relaxed">
              We&apos;re not chasing byte-size brain. Marvex is for people who
              still finish books — and want a tool that respects that.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                tag: "PhD &amp; Research",
                title: "Lit reviews that don't drown you",
                body: "Drop a stack of papers into Intake, watch each PDF become an editable heading tree, then route Research Assistant across them. Cross-reference papers without losing the citations. Memory layer remembers what you've already mapped so the model doesn't repeat itself.",
                accent: "from-cyan-400/30 to-cyan-500/10",
                useCases: ["Lit review", "Thesis chapters", "Conference paper synthesis"],
              },
              {
                tag: "Indie writers",
                slug: "indie-writers",
                title: "Outline an entire book in an afternoon",
                body: "Turn 60 pages of source material into a chapter outline before lunch. Drag headings around, ask the assistant to deepen any branch, push the whole map to Drive or Dropbox. The first map you build pays for the year.",
                accent: "from-violet-400/30 to-fuchsia-500/10",
                useCases: ["Non-fiction outlines", "Memoir scaffolding", "Newsletter research"],
              },
              {
                tag: "Knowledge workers",
                slug: "knowledge-workers",
                title: "One canvas for every report you read",
                body: "Quarterly review docs, competitor decks, internal RFCs — drop them in, get a sharable mind-map link. Cloud Save mirrors to Drive / Dropbox / Zotero so your team finds it where they already work. BYOK keeps your IP off our servers.",
                accent: "from-amber-400/30 to-rose-500/10",
                useCases: ["Strategy decks", "RFC synthesis", "Competitor mapping"],
              },
            ].map((p, idx) => (
              <ScrollReveal
                key={p.title}
                delay={idx * 120}
                data-testid={`landing-persona-${p.slug}`}
                className="glass-panel rounded-2xl p-6 transition-all hover:translate-y-[-3px] hover:border-[rgba(0,240,255,0.4)] flex flex-col"
                style={{ minHeight: 320, "--reveal-delay": `${idx * 120}ms` }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={`w-2 h-2 rounded-full bg-gradient-to-br ${p.accent} ring-2 ring-white/10`}
                    aria-hidden
                  />
                  <span
                    className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80"
                    dangerouslySetInnerHTML={{ __html: p.tag }}
                  />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 leading-tight">
                  {p.title}
                </h3>
                <p className="text-[14px] text-[#9aaad0] leading-relaxed mb-5">
                  {p.body}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {p.useCases.map((u) => (
                    <span
                      key={u}
                      className="mono text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[#8595bb]"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </ScrollReveal>
            ))}
          </div>

          <p className="text-[11px] text-[#566187] leading-relaxed text-center mt-10 max-w-2xl mx-auto">
            Real testimonials will replace these use cases as Marvex Studio gathers reviews from real users.
            Want a free month of Pro for honest feedback?&nbsp;
            <Link
              to="/feedback"
              className="text-cyan-300 hover:underline"
              data-testid="landing-feedback-cta"
            >
              Apply to be a reviewer
            </Link>.
          </p>
        </div>
      </section>
      )}

      {/* REAL TESTIMONIALS — auto-rendered when ≥3 published in /admin/testimonials */}
      {showRealTestimonials && (
        <section
          id="testimonials"
          data-testid="landing-testimonials"
          className="relative z-20 px-6 lg:px-12 py-24 border-b border-white/5"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">
                Loved by researchers
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                What people are <span className="gradient-text">saying.</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.slice(0, 9).map((t, i) => (
                <figure
                  key={t.id || i}
                  data-testid={`landing-testimonial-${i}`}
                  className="glass-panel rounded-2xl p-6 transition-all hover:translate-y-[-3px] hover:border-[rgba(0,240,255,0.4)] flex flex-col"
                  style={{ minHeight: 260 }}
                >
                  <Quote size={20} className="text-cyan-300/60 mb-3 shrink-0" aria-hidden />
                  <blockquote className="text-[15px] text-[#cfdaf3] leading-relaxed flex-1 italic">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 pt-4 border-t border-white/5">
                    <div className="text-[14px] text-white font-semibold">{t.name}</div>
                    {(t.role || t.organization) && (
                      <div className="text-[12px] text-[#9aaad0] mt-0.5">
                        {[t.role, t.organization].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ORBITAL VISUAL */}
      <section className="relative z-20 px-6 lg:px-12 pt-16 pb-24 hidden md:block">
        <div className="max-w-6xl mx-auto">
          <div className="relative h-[460px] lg:h-[560px] w-full">
            <OrbitVisual />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative z-20 px-6 lg:px-12 py-28">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">{t("landing.featuresEyebrow")}</div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-14">
            {t("landing.featuresTitleA")} <span className="gradient-text">{t("landing.featuresTitleB")}</span>
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {/* 1 — Flagship: PDF → Map */}
            <ScrollReveal delay={0}>
              <FeatureCard
                icon={Sparkles}
                title={t("landing.feature.magicMap.title")}
                badge={t("landing.feature.magicMap.badge")}
                body={t("landing.feature.magicMap.body")}
              />
            </ScrollReveal>
            {/* 2 — Inverse: Map → polished document */}
            <ScrollReveal delay={80}>
              <FeatureCard
                icon={FileOutput}
                title={t("landing.feature.compileToPdf.title")}
                badge={t("landing.feature.compileToPdf.badge")}
                body={t("landing.feature.compileToPdf.body")}
                badgeColor="from-amber-500/30 to-amber-500/10"
              />
            </ScrollReveal>
            {/* 3 — Global second-brain search */}
            <ScrollReveal delay={160}>
              <FeatureCard
                icon={ScanSearch}
                title={t("landing.feature.secondBrain.title")}
                badge={t("landing.feature.secondBrain.badge")}
                body={t("landing.feature.secondBrain.body")}
                badgeColor="from-violet-500/30 to-violet-500/10"
              />
            </ScrollReveal>
            {/* 4 — Privacy / BYOK */}
            <ScrollReveal delay={240}>
              <FeatureCard
                icon={ShieldCheck}
                title={t("landing.feature.localFirst.title")}
                badge={t("landing.feature.localFirst.badge")}
                body={t("landing.feature.localFirst.body")}
                badgeColor="from-emerald-500/30 to-emerald-500/10"
              />
            </ScrollReveal>
            {/* 5 — Built-in Reader (highlight → map) */}
            <ScrollReveal delay={320}>
              <FeatureCard
                icon={BookOpen}
                title={t("landing.feature.smartReader.title")}
                badge={t("landing.feature.smartReader.badge")}
                body={t("landing.feature.smartReader.body")}
                badgeColor="from-cyan-500/30 to-cyan-500/10"
              />
            </ScrollReveal>
            {/* 6 — Smart link routing */}
            <ScrollReveal delay={400}>
              <FeatureCard
                icon={Link2}
                title={t("landing.feature.openAnything.title")}
                badge={t("landing.feature.openAnything.badge")}
                body={t("landing.feature.openAnything.body")}
                badgeColor="from-sky-500/30 to-sky-500/10"
              />
            </ScrollReveal>
            {/* 7 — Calendar reminders */}
            <ScrollReveal delay={480}>
              <FeatureCard
                icon={CalendarDays}
                title={t("landing.feature.calendar.title")}
                badge={t("landing.feature.calendar.badge")}
                body={t("landing.feature.calendar.body")}
                badgeColor="from-rose-500/30 to-rose-500/10"
              />
            </ScrollReveal>
            {/* 8 — Bookmarks importer */}
            <ScrollReveal delay={560}>
              <FeatureCard
                icon={Bookmark}
                title={t("landing.feature.bookmarks.title")}
                badge={t("landing.feature.bookmarks.badge")}
                body={t("landing.feature.bookmarks.body")}
                badgeColor="from-yellow-500/30 to-yellow-500/10"
              />
            </ScrollReveal>
            {/* 9 — Cloud push */}
            <ScrollReveal delay={640}>
              <FeatureCard
                icon={CloudUpload}
                title={t("landing.feature.cloudPush.title")}
                badge={t("landing.feature.cloudPush.badge")}
                body={t("landing.feature.cloudPush.body")}
                badgeColor="from-fuchsia-500/30 to-fuchsia-500/10"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-20 px-6 lg:px-12 py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">{t("landing.howEyebrow")}</div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-14">
            {t("landing.howTitleA")} <span className="gradient-text">{t("landing.howTitleB")}</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-12 text-left max-w-5xl mx-auto">
            <Step n={1} title={t("landing.steps.one.title")} body={t("landing.steps.one.body")} />
            <Step n={2} title={t("landing.steps.two.title")} body={t("landing.steps.two.body")} />
            <Step n={3} title={t("landing.steps.three.title")} body={t("landing.steps.three.body")} />
          </div>
        </div>
      </section>

      {/* ACCESS CODE — removed at user's request. The discreet "Have a code? →"
          link in the top utility bar is sufficient — VIPs / friends-of-founder
          /press recipients can click through to /redeem from there. Removing
          the big mid-page banner keeps the landing focused on conversion
          (Try Free → Stripe) for the 99% of visitors who don't have a code. */}

      {/* DESKTOP CTA */}
      <section className="relative z-20 px-6 lg:px-12 py-28 border-t border-white/5">
        <div
          className="max-w-5xl mx-auto rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(180deg, rgba(0,240,255,0.05), rgba(138,91,255,0.07))",
            border: "1px solid rgba(0,240,255,0.18)",
          }}
        >
          <div className="mono text-[11px] uppercase tracking-[0.25em] text-cyan-300 mb-4">
            {t("landing.desktopEyebrow")}
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
            {t("landing.desktopTitleA")} <span className="gradient-text">{t("landing.desktopTitleB")}</span>{t("landing.desktopTitleC")}
          </h2>
          <p className="max-w-xl mx-auto text-[#a4b4d8] mb-10 text-lg">
            {t("landing.desktopLead")}
          </p>
          <Link to="/library" data-testid="cta-launch-bottom" className="cta-pill text-[15px] breathe">
            {t("common.openStudio")} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* SEO content — see /app/frontend/src/components/SEOContent.jsx for
          the rationale. Sits between the bottom CTA and the footer so it
          never gets in the way of the "Open Studio" decision but is fully
          discoverable to crawlers and curious readers. */}
      <SEOContent />

      {/* FAQ — categorised; sits after SEOContent so the page reads:
          hero → personas → features → how → access codes → desktop CTA →
          SEO copy → objection handling → footer. Pricing carries the
          canonical JSON-LD schema; this block is purely for human readers. */}
      <LandingFaq />

      {/* PRESS TESTIMONIALS — only renders when admin has curated at least one
          published quote. Sits after FAQ so visitors who've already vetted us
          via objection-handling get a final social-proof nudge before the
          footer + bottom CTAs land. */}
      <PressTestimonials limit={6} />

      {/* FROM OUR RESEARCH BLOG — top-3 /learn articles surfaced on
          Landing for two-fer SEO benefit: (a) every home-page visitor
          sees relevant educational content (often the highest-converting
          path is via an article → /pdf-to-mind-map), and (b) the home
          page distributes link-equity to the freshest /learn pieces,
          accelerating their Google indexing + ranking. Order matches
          the pillar page's "Related reads" — newest piece first. */}
      <section
        data-testid="landing-research-blog"
        className="relative z-20 px-6 lg:px-12 py-20 border-t border-white/5"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between mb-7 gap-4">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5">
                From the research blog
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
                Read before you <span className="gradient-text">map</span>.
              </h2>
            </div>
            <Link
              to="/learn"
              data-testid="landing-research-see-all"
              className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 hover:text-cyan-200 shrink-0"
            >
              See all →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                slug: "notion-alternative-for-mind-mapping-2026",
                kicker: "Comparison",
                title: "Notion alternative for mind mapping (2026)",
                blurb: "Notion's native mind-map options vs purpose-built tools — and why the smartest setup actually uses both.",
                mins: 8,
              },
              {
                slug: "best-pdf-mind-map-tools-2026",
                kicker: "Roundup",
                title: "Best PDF to mind map tools in 2026",
                blurb: "7 tools tested over 4 weeks across papers, reports, and legal cases. Honest picks, real pricing, what to avoid.",
                mins: 9,
              },
              {
                slug: "how-to-turn-pdf-into-mind-map",
                kicker: "Tutorial",
                title: "How to turn a PDF into a mind map",
                blurb: "The exact 5-step workflow we use to absorb a 40-page paper in under a minute. Free, no signup needed.",
                mins: 6,
              },
            ].map((a) => (
              <Link
                key={a.slug}
                to={`/learn/${a.slug}`}
                data-testid={`landing-research-${a.slug}`}
                className="group rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-400/40 transition p-5 flex flex-col"
              >
                <span className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
                  {a.kicker} · {a.mins} min
                </span>
                <h3 className="text-[15px] font-semibold text-white leading-snug mb-2 group-hover:text-cyan-200 transition">
                  {a.title}
                </h3>
                <p className="text-[12.5px] text-[#9aa7c7] leading-relaxed flex-1">
                  {a.blurb}
                </p>
                <span className="mt-3 mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] group-hover:text-cyan-300 inline-flex items-center gap-1">
                  Read article →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SITE-LINKS FOOTER — discreet 4-column text-link sitemap. Provides
          internal links from Landing to every important deep page (Learn
          articles, /vs comparisons, Press, Affiliate). Critical for SEO:
          every internal link spreads link-equity from the home page (which
          earns the most external backlinks) outward to the rest of the
          site. */}
      <SiteLinksFooter />

      {/* FOOTER */}
      <footer className="relative z-20 px-6 lg:px-12 py-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 items-center justify-center text-sm text-[#5e6a91] text-center">
          <div className="flex items-center gap-3 justify-center">
            <Logo size={28} glow={false} />
            <span>{t("landing.footer.copyright")}</span>
          </div>
          <div className="flex items-center gap-6 mono text-[11px] uppercase tracking-[0.2em] justify-center flex-wrap">
            <span>{t("landing.footer.localFirst")}</span>
            <span>·</span>
            <span>{t("landing.footer.offlineReady")}</span>
            <span>·</span>
            <span>{t("landing.footer.noTracking")}</span>
            <span>·</span>
            <Link
              to="/learn"
              data-testid="footer-learn-link"
              className="text-cyan-300/80 hover:text-cyan-200 transition-colors"
            >
              {t("nav.learn")}
            </Link>
            <span>·</span>
            <a
              href="/tools"
              data-testid="footer-tools-link"
              className="text-cyan-300/80 hover:text-cyan-200 transition-colors"
            >
              {t("landing.footer.toolsWeLove")}
            </a>
            <span>·</span>
            <Link
              to="/pricing"
              data-testid="footer-pricing-link"
              className="text-cyan-300/80 hover:text-cyan-200 transition-colors"
            >
              Pricing
            </Link>
            <span>·</span>
            <Link
              to="/privacy"
              data-testid="footer-privacy-link"
              className="text-cyan-300/80 hover:text-cyan-200 transition-colors"
            >
              Privacy
            </Link>
            <span>·</span>
            <Link
              to="/terms"
              data-testid="footer-terms-link"
              className="text-cyan-300/80 hover:text-cyan-200 transition-colors"
            >
              Terms
            </Link>
            <span>·</span>
            <Link
              to="/press"
              data-testid="footer-press-link"
              className="text-cyan-300/80 hover:text-cyan-200 transition-colors"
            >
              Press
            </Link>
          </div>
          <div
            data-testid="affiliate-disclosure"
            className="max-w-2xl text-[11px] text-[#4a5578] leading-relaxed pt-2 border-t border-white/5"
          >
            {t("landing.footer.affiliateDisclosure")}
          </div>
        </div>
      </footer>
    </div>
  );
}

const OrbitVisual = () => {
  const space = PRESET_BACKGROUNDS.find((p) => p.id === "space");
  return (
    <div
      data-testid="landing-core-concept-map"
      className="relative w-full h-full rounded-2xl overflow-hidden border border-cyan-400/20"
      style={{
        background: space?.css,
        backgroundSize: space?.size,
        boxShadow: "0 0 24px rgba(0,240,255,0.18) inset, 0 0 42px rgba(0,240,255,0.12)",
      }}
    >
      <LandingMindMap />
    </div>
  );
};

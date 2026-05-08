import React, { useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Clock, ListOrdered, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { TUTORIALS, getTutorial } from "@/lib/tutorials";
import HowToJsonLd from "@/components/HowToJsonLd";

const accentStyles = {
  cyan:    { grad: "from-cyan-500/30 to-cyan-500/0",     ring: "rgba(0,240,255,0.4)",   text: "text-cyan-300",    stripe: "bg-cyan-400" },
  violet:  { grad: "from-violet-500/30 to-violet-500/0", ring: "rgba(138,91,255,0.45)", text: "text-violet-300",  stripe: "bg-violet-400" },
  fuchsia: { grad: "from-fuchsia-500/30 to-fuchsia-500/0", ring: "rgba(255,120,200,0.45)", text: "text-fuchsia-300", stripe: "bg-fuchsia-400" },
  amber:   { grad: "from-amber-500/30 to-amber-500/0",   ring: "rgba(255,181,71,0.45)", text: "text-amber-300",   stripe: "bg-amber-400" },
};

export default function LearnTutorial() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams();
  const tutorial = useMemo(() => getTutorial(slug), [slug]);

  if (!tutorial) {
    return (
      <div className="cosmic-bg min-h-screen text-white grid place-items-center p-8">
        <div className="text-center">
          <p className="text-[#9aaad0] mb-5">Tutorial not found.</p>
          <Link to="/learn" className="cta-pill text-sm">
            {t("learn.index.backToIndex")}
          </Link>
        </div>
      </div>
    );
  }

  const k = tutorial.key;
  const Icon = tutorial.icon;
  const st = accentStyles[tutorial.accent] || accentStyles.cyan;
  const steps = Array.from({ length: tutorial.steps }, (_, i) => `step${i + 1}`);

  // schema.org HowTo payload — built from the same i18n keys the visible
  // tutorial uses, so the rich-results description always matches what the
  // user sees. Empty/missing translations are filtered out so we never ship
  // a HowToStep with blank text.
  const howToSteps = steps
    .map((s) => ({
      heading: t(`learn.tutorials.${k}.${s}.heading`, { defaultValue: "" }),
      body: t(`learn.tutorials.${k}.${s}.body`, { defaultValue: "" }),
    }))
    .filter((s) => s.heading && s.body);
  const howToMinutes = parseInt(t(`learn.tutorials.${k}.minutes`, { defaultValue: "0" }), 10) || null;

  // For next/prev navigation between tutorials
  const idx = TUTORIALS.findIndex((t2) => t2.slug === slug);
  const nextTut = TUTORIALS[idx + 1];
  const prevTut = TUTORIALS[idx - 1];

  return (
    <div data-testid="learn-tutorial-page" className="cosmic-bg min-h-screen text-white">
      <HowToJsonLd
        name={t(`learn.tutorials.${k}.title`)}
        description={t(`learn.tutorials.${k}.subtitle`)}
        minutes={howToMinutes}
        steps={howToSteps}
        lang={(i18n.language || "en").split(/[-_@]/)[0]}
      />
      {/* NAV */}
      <nav className="relative z-30 px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <Logo size={38} />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-wide">Marvex<span className="text-cyan-400"> Studio</span></div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#6c7aa3]">{t("common.tagline")}</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <Link to="/learn" data-testid="tutorial-back-index" className="cta-ghost text-xs">
            <ArrowLeft size={12} /> {t("learn.index.backToIndex")}
          </Link>
          <Link to="/library" data-testid="tutorial-open-app" className="cta-pill text-xs">
            {t("common.openStudio")} <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* HEADER */}
      <section className="relative z-20 px-6 lg:px-12 pt-10 pb-12">
        <div className="max-w-3xl mx-auto">
          <Link to="/learn" className="inline-flex items-center gap-1 text-[#7a87ad] hover:text-cyan-300 text-[11px] mono uppercase tracking-[0.18em] mb-5">
            <ArrowLeft size={11} /> {t("learn.index.eyebrow")}
          </Link>
          <div className={`inline-flex items-center gap-2 mono text-[11px] uppercase tracking-[0.22em] ${st.text} px-3 py-1.5 rounded-full border mb-6`} style={{ borderColor: st.ring }}>
            <Icon size={13} /> {t(`learn.tutorials.${k}.category`)}
          </div>
          <h1 data-testid="tutorial-title" className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
            {t(`learn.tutorials.${k}.title`)}
          </h1>
          <p className="text-lg text-[#a4b4d8] leading-relaxed mb-6">
            {t(`learn.tutorials.${k}.subtitle`)}
          </p>
          <div className="flex items-center gap-5 text-[#7a87ad] text-[11px] mono uppercase tracking-[0.18em]">
            <span className="flex items-center gap-1.5"><Clock size={11} /> {t("learn.index.minutes", { minutes: t(`learn.tutorials.${k}.minutes`) })}</span>
            <span className="flex items-center gap-1.5"><ListOrdered size={11} /> {t("learn.index.stepsCount", { count: tutorial.steps })}</span>
          </div>
        </div>
      </section>

      {/* INTRO + STEPS */}
      <section className="relative z-20 px-6 lg:px-12 pb-20">
        <div className="max-w-3xl mx-auto">
          <div
            className="glass-panel rounded-2xl p-7 mb-10 leading-relaxed text-[#c8d4ed]"
            style={{ borderColor: st.ring, background: "rgba(10,15,36,0.5)" }}
          >
            {t(`learn.tutorials.${k}.intro`)}
          </div>

          <ol className="space-y-8">
            {steps.map((s, i) => (
              <li
                key={s}
                data-testid={`tutorial-step-${i + 1}`}
                className="relative pl-8"
              >
                <div className={`absolute left-0 top-1.5 w-1 h-[calc(100%-12px)] ${st.stripe} opacity-50 rounded-full`} />
                <div
                  className={`absolute -left-3 top-0.5 w-8 h-8 rounded-full grid place-items-center mono text-[11px] text-[#03141f] font-bold`}
                  style={{ background: "linear-gradient(135deg, #36e6ff 0%, #8a5bff 100%)", boxShadow: `0 0 12px ${st.ring}` }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-[20px] font-semibold text-white mb-2 ml-2">
                  {t(`learn.tutorials.${k}.${s}.heading`)}
                </h3>
                <p className="text-[#a4b4d8] leading-relaxed ml-2">
                  {t(`learn.tutorials.${k}.${s}.body`)}
                </p>
              </li>
            ))}
          </ol>

          {/* TIP */}
          <div
            data-testid="tutorial-tip"
            className="mt-12 p-5 rounded-xl border flex items-start gap-3"
            style={{ borderColor: st.ring, background: "rgba(0,240,255,0.04)" }}
          >
            <Sparkles size={18} className={`${st.text} shrink-0 mt-0.5`} />
            <div className="text-[14px] leading-relaxed text-[#c8d4ed]">
              {t(`learn.tutorials.${k}.tip`)}
            </div>
          </div>

          {/* PREV/NEXT */}
          <div className="mt-14 pt-8 border-t border-white/5 flex items-center justify-between">
            <div>
              {prevTut && (
                <button
                  data-testid="tutorial-prev"
                  onClick={() => navigate(`/learn/${prevTut.slug}`)}
                  className="cta-ghost text-xs"
                >
                  <ArrowLeft size={12} /> {t(`learn.tutorials.${prevTut.key}.title`)}
                </button>
              )}
            </div>
            <div>
              {nextTut && (
                <button
                  data-testid="tutorial-next"
                  onClick={() => navigate(`/learn/${nextTut.slug}`)}
                  className="cta-pill text-xs"
                >
                  {t(`learn.tutorials.${nextTut.key}.title`)} <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-20 px-6 lg:px-12 py-10 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center text-sm text-[#5e6a91]">
          <div className="flex items-center gap-3 justify-center">
            <Logo size={28} glow={false} />
            <span>{t("landing.footer.copyright")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

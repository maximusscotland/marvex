import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ArrowLeft, Clock, ListOrdered, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { TUTORIALS } from "@/lib/tutorials";
import { ARTICLES } from "@/lib/articles";

const accentStyles = {
  cyan:    { glow: "rgba(0,240,255,0.25)",  ring: "rgba(0,240,255,0.4)",  text: "text-cyan-300"   },
  violet:  { glow: "rgba(138,91,255,0.3)",  ring: "rgba(138,91,255,0.45)", text: "text-violet-300" },
  fuchsia: { glow: "rgba(255,120,200,0.3)", ring: "rgba(255,120,200,0.45)", text: "text-fuchsia-300" },
  amber:   { glow: "rgba(255,181,71,0.28)", ring: "rgba(255,181,71,0.45)", text: "text-amber-300" },
};

const TutorialCard = ({ tutorial }) => {
  const { t } = useTranslation();
  const Icon = tutorial.icon;
  const k = tutorial.key;
  const st = accentStyles[tutorial.accent] || accentStyles.cyan;
  return (
    <Link
      to={`/learn/${tutorial.slug}`}
      data-testid={`learn-card-${tutorial.slug}`}
      className="glass-panel rounded-2xl p-7 transition-all hover:-translate-y-[3px] group"
      style={{ borderColor: st.ring, boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 12px 38px ${st.glow}` }}
    >
      <div className="flex items-start justify-between mb-5">
        <div
          className="w-12 h-12 rounded-xl grid place-items-center"
          style={{ background: `linear-gradient(135deg, ${st.glow}, rgba(0,0,0,0.15))`, border: `1px solid ${st.ring}` }}
        >
          <Icon size={22} className={st.text} />
        </div>
        <span className={`mono text-[10px] uppercase tracking-[0.18em] ${st.text}/80`}>
          {t(`learn.tutorials.${k}.category`)}
        </span>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2 group-hover:gradient-text">
        {t(`learn.tutorials.${k}.title`)}
      </h3>
      <p className="text-[14px] leading-relaxed text-[#9aaad0] mb-5">
        {t(`learn.tutorials.${k}.subtitle`)}
      </p>
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-4 text-[#7a87ad] text-[11px] mono uppercase tracking-[0.18em]">
          <span className="flex items-center gap-1.5"><Clock size={11} /> {t("learn.index.minutes", { minutes: t(`learn.tutorials.${k}.minutes`) })}</span>
          <span className="flex items-center gap-1.5"><ListOrdered size={11} /> {t("learn.index.stepsCount", { count: tutorial.steps })}</span>
        </div>
        <span className={`text-[12px] mono uppercase tracking-[0.2em] ${st.text} inline-flex items-center gap-1`}>
          {t("learn.index.startTutorial")} <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  );
};

export default function Learn() {
  const { t } = useTranslation();
  return (
    <div data-testid="learn-page" className="cosmic-bg min-h-screen text-white">
      <nav className="relative z-30 px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <Logo size={42} />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-wide">Marvex<span className="text-cyan-400"> Studio</span></div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#6c7aa3]">{t("common.tagline")}</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher compact />
          <Link to="/" data-testid="learn-back-landing" className="cta-ghost text-xs">
            <ArrowLeft size={12} /> {t("learn.index.backToLanding")}
          </Link>
          <Link to="/library" data-testid="learn-open-app" className="cta-pill text-xs">
            {t("common.openStudio")} <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <section className="relative z-20 px-6 lg:px-12 pt-14 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">
            {t("learn.index.eyebrow")}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5">
            {t("learn.index.title").split(" ").map((word, i, arr) =>
              i === arr.length - 1
                ? <span key={i} className="gradient-text">{word}</span>
                : <span key={i}>{word} </span>
            )}
          </h1>
          <p className="max-w-2xl text-lg text-[#a4b4d8] leading-relaxed mb-14">
            {t("learn.index.lead")}
          </p>

          <div className="grid md:grid-cols-3 gap-5">
            {TUTORIALS.map((tutorial) => (
              <TutorialCard key={tutorial.slug} tutorial={tutorial} />
            ))}
          </div>

          {/* SEO content cluster — long-form articles supporting /pdf-to-mind-map.
              Surfaced after the visual tutorial cards so the index page reads
              "interactive tutorials first, deep reads below". */}
          {ARTICLES.length > 0 && (
            <div className="mt-16" data-testid="learn-articles">
              <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-3">In-depth guides</div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-6">
                Read deeper.
              </h2>
              <div className="space-y-3">
                {ARTICLES.map((a) => (
                  <Link
                    key={a.slug}
                    to={`/learn/${a.slug}`}
                    data-testid={`learn-article-link-${a.slug}`}
                    className="group block rounded-2xl border border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04] transition p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] sm:text-[17px] font-semibold text-white group-hover:text-cyan-200 transition mb-1">
                          {a.title}
                        </h3>
                        <p className="text-[13px] text-[#9aaad0] leading-relaxed mb-2 line-clamp-2">
                          {a.description}
                        </p>
                        <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad]">
                          {a.minutesRead} min read · Updated {a.updatedAt}
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-[#566187] group-hover:text-cyan-300 mt-1 shrink-0 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Interactive tour CTA */}
          <div
            className="mt-10 glass-panel rounded-2xl p-7 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            style={{ borderColor: "rgba(138,91,255,0.4)", background: "linear-gradient(120deg, rgba(138,91,255,0.06), rgba(0,240,255,0.04))" }}
            data-testid="learn-tour-cta"
          >
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/90 mb-1">
                {t("learn.index.eyebrow")}
              </div>
              <h3 className="text-xl font-semibold text-white mb-1">
                {t("learn.index.takeInteractiveTour")}
              </h3>
              <p className="text-[14px] text-[#a4b4d8]">
                {t("learn.index.takeInteractiveTourHint")}
              </p>
            </div>
            <Link
              to="/app?tour=1"
              data-testid="learn-start-tour"
              className="cta-pill text-sm"
            >
              <Sparkles size={14} /> {t("learn.index.startTutorial")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-20 px-6 lg:px-12 py-10 border-t border-white/5 mt-10">
        <div className="max-w-5xl mx-auto text-center text-sm text-[#5e6a91]">
          <div className="flex items-center gap-3 justify-center mb-2">
            <Logo size={28} glow={false} />
            <span>{t("landing.footer.copyright")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

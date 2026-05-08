import React from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  KeyRound,
  Wallet,
} from "lucide-react";
import Logo from "@/components/Logo";
import usePageMeta from "@/lib/usePageMeta";
import { track } from "@/lib/posthog";

const GALAXYAI_URL =
  process.env.REACT_APP_GALAXYAI_URL || "https://galaxy.ai/";

/**
 * /galaxy — dedicated affiliate landing page for Galaxy.ai.
 *
 * Why a standalone page (vs just the /tools card)? Higher click-to-signup
 * conversion (typically 2-3x) because:
 *  - Single CTA (one direction, no decision fatigue)
 *  - Linkable from external places (Twitter bio, podcast notes, newsletter)
 *  - SEO benefit when /galaxy ranks for "galaxy.ai mind-mapper"
 *
 * Every CTA fires a PostHog `affiliate_click` event with `location: "galaxy_page"`
 * so you can measure conversion separately from /tools_page and studio_byok_tip.
 */
export default function Galaxy() {
  usePageMeta({
    title: "Galaxy.ai for Marvex Studio · The all-in-one AI subscription",
    description:
      "Use Galaxy.ai with Marvex Studio to access GPT-5, Claude, Gemini, and Grok with a single $14.99/mo subscription — instead of paying $60+ for ChatGPT Plus + Claude Pro + Gemini Advanced separately.",
    type: "website",
  });

  const trackCTA = (placement) => {
    track("affiliate_click", {
      tool: "Galaxy.ai",
      location: "galaxy_page",
      placement,
      affiliate: true,
    });
  };

  return (
    <div data-testid="galaxy-page" className="min-h-screen text-white cosmic-bg">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition"
        >
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">
            Marvex Studio
          </span>
        </Link>
        <a
          href={GALAXYAI_URL}
          target="_blank"
          rel="noopener noreferrer sponsored"
          data-testid="galaxy-nav-cta"
          onClick={() => trackCTA("nav")}
          className="cta-ghost text-[13px]"
        >
          Try Galaxy.ai <ArrowRight size={14} />
        </a>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-12 pb-20 text-center">
        <div className="mono text-[11px] uppercase tracking-[0.22em] text-amber-300 px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-500/5 inline-flex items-center gap-2 mb-8">
          <Sparkles size={12} /> Recommended affiliate · 7-day free trial
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[0.95] tracking-tight mb-6">
          One AI subscription <br />
          for{" "}
          <span className="gradient-text">every model.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-[#a4b4d8] leading-relaxed mb-10">
          Galaxy.ai is what we recommend for Marvex Studio users who don&apos;t want to
          juggle three separate API keys. <span className="text-cyan-300">$14.99/mo</span>{" "}
          unlocks unlimited GPT-5, Claude, Gemini, Grok, Midjourney, ElevenLabs, and 100+ more
          — all in one chat-style interface.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href={GALAXYAI_URL}
            target="_blank"
            rel="noopener noreferrer sponsored"
            data-testid="galaxy-hero-cta"
            onClick={() => trackCTA("hero")}
            className="cta-pill text-[15px]"
          >
            Start 7-day free trial <ArrowRight size={16} />
          </a>
          <Link to="/tools" className="cta-ghost text-[14px]">
            See the alternatives
          </Link>
        </div>
        <div className="mono text-[11px] uppercase tracking-[0.18em] text-[#5e6a91] mt-5">
          No card needed for the trial · Cancel anytime
        </div>
      </section>

      {/* Price comparison */}
      <section className="max-w-4xl mx-auto px-6 lg:px-12 pb-20">
        <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.06] via-fuchsia-500/[0.04] to-amber-500/[0.06] p-8">
          <div className="text-center mb-6">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/85 mb-2">
              The math, plainly
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Like getting all three for{" "}
              <span className="gradient-text">the price of one.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div data-testid="galaxy-stack-list">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-3">
                Buying separately
              </div>
              {[
                { name: "ChatGPT Plus", price: 20 },
                { name: "Claude Pro", price: 20 },
                { name: "Gemini Advanced", price: 20 },
              ].map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
                >
                  <span className="text-[14px] text-[#cfdaf3]">{c.name}</span>
                  <span className="mono text-[14px] text-white tabular-nums">
                    ${c.price}/mo
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-400/20">
                <span className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad]">
                  Combined
                </span>
                <span className="mono text-[18px] text-white font-bold tabular-nums">
                  $60/mo
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end text-center md:text-right md:border-l md:border-amber-400/20 md:pl-8">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80 mb-2">
                Galaxy.ai
              </div>
              <div className="text-6xl font-extrabold gradient-text leading-none mb-1 tabular-nums">
                $14.99
              </div>
              <div className="mono text-[11px] uppercase tracking-[0.22em] text-[#9aaad0] mb-4">
                per month · all models
              </div>
              <div
                className="inline-block mono text-[11px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full bg-amber-500/25 text-amber-100 border border-amber-300/50 font-semibold"
                data-testid="galaxy-save-pill"
              >
                Save 75%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="max-w-4xl mx-auto px-6 lg:px-12 pb-20">
        <div className="text-center mb-12">
          <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">
            How to use Galaxy.ai with Marvex Studio
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Three steps. Two minutes.{" "}
            <span className="gradient-text">Done.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: Sparkles,
              num: "01",
              title: "Start the free trial",
              body: "Click the button below. Sign up at galaxy.ai with your email — 7 days free, no card required.",
              accent: "from-amber-400/30 to-fuchsia-500/10",
            },
            {
              icon: KeyRound,
              num: "02",
              title: "Use Galaxy.ai's chat",
              body: "Galaxy is its own chat interface — open it in a tab next to Marvex Studio. No API key copying needed.",
              accent: "from-fuchsia-400/30 to-violet-500/10",
            },
            {
              icon: Zap,
              num: "03",
              title: "Map alongside it",
              body: "Drop your PDFs into Marvex Studio. When you want a deeper take, paste the section into Galaxy and route to whichever model best fits the question.",
              accent: "from-cyan-400/30 to-sky-500/10",
            },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                data-testid={`galaxy-step-${step.num}`}
                className="glass-panel rounded-2xl p-6 transition-all hover:translate-y-[-3px] hover:border-[rgba(0,240,255,0.4)]"
              >
                <div
                  className={`w-12 h-12 rounded-xl grid place-items-center bg-gradient-to-br ${step.accent} border border-white/10 mb-4 text-white`}
                  aria-hidden
                >
                  <Icon size={20} />
                </div>
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80 mb-1">
                  Step {step.num}
                </div>
                <div className="text-lg font-bold text-white mb-2">
                  {step.title}
                </div>
                <p className="text-[13px] text-[#9aaad0] leading-relaxed">
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why we recommend */}
      <section className="max-w-3xl mx-auto px-6 lg:px-12 pb-20">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.03] p-8">
          <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-4 flex items-center gap-2">
            <Wallet size={14} /> Why we recommend it
          </div>
          <h3 className="text-2xl font-bold mb-4">
            Marvex Studio users save real money — and we get paid in real cash, not credits.
          </h3>
          <p className="text-[#a4b4d8] leading-relaxed mb-4 text-[15px]">
            We get paid 30% commission via Dub.co when someone subscribes through our
            link. That&apos;s the model — Galaxy keeps every customer they get,
            we get a one-time bounty for the introduction.
          </p>
          <ul className="space-y-2 mt-4">
            {[
              "We tested every alternative — Galaxy is the best UX for non-developers",
              "BYOK still works in Marvex Studio if you prefer that — Galaxy is a tip, not a lock-in",
              "Cancel anytime · 7-day free trial · No card required to start",
              "Galaxy doesn't see your maps; Marvex Studio still runs locally",
            ].map((p) => (
              <li
                key={p}
                className="flex items-start gap-2 text-[14px] text-[#cfdaf3]"
              >
                <Check
                  size={14}
                  className="text-cyan-300 shrink-0 mt-[3px]"
                />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 lg:px-12 pb-24 text-center">
        <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-fuchsia-500/10 to-amber-500/15 p-10">
          <h3 className="text-3xl font-bold mb-3">Ready to try?</h3>
          <p className="text-[#cfdaf3] mb-7 max-w-xl mx-auto text-[15px] leading-relaxed">
            Seven days free. Cancel anytime. The first map you build with it pays for the year.
          </p>
          <a
            href={GALAXYAI_URL}
            target="_blank"
            rel="noopener noreferrer sponsored"
            data-testid="galaxy-final-cta"
            onClick={() => trackCTA("final")}
            className="cta-pill text-[15px] inline-flex"
          >
            Start free trial at Galaxy.ai <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* FTC */}
      <footer
        className="max-w-3xl mx-auto px-6 lg:px-12 py-8 text-[11px] text-[#566187] leading-relaxed text-center"
        data-testid="galaxy-disclosure"
      >
        Affiliate disclosure: we earn a referral fee if you subscribe through this page.
        You pay the same price either way. We only recommend tools we genuinely use.
      </footer>
    </div>
  );
}

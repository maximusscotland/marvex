import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight, ArrowLeft, Shield, Loader2 } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import FaqJsonLd from "@/components/FaqJsonLd";
import { FAQ_FLAT } from "@/lib/faqs";
import { useExperiment } from "@/lib/featureFlags";
import { track } from "@/lib/posthog";
import usePageMeta from "@/lib/usePageMeta";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { priceLabel, detectDefaultCurrency } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { getRef } from "@/lib/referral";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

// Plans expressed as amount-in-USD + suffix so the CurrencySwitcher
// can re-format them on the fly. The displayed price is approximate
// (FX baked in at /app/frontend/src/lib/currency.js); Stripe always
// charges the USD figure regardless of which currency the user is
// browsing in — clarified by the "Charged in USD" footnote.
const PLAN_DETAIL = {
  lite:     { usd: 9,   suffix: "/mo",  sub: "Cancel anytime · 7-day free trial",  badge: "ENTRY" },
  monthly:  { usd: 15,  suffix: "/mo",  sub: "Cancel anytime · 7-day free trial",  badge: null },
  annual:   { usd: 150, suffix: "/yr",  sub: "Save 17% · 7-day free trial",        badge: "POPULAR" },
  lifetime: { usd: 200, suffix: " once", sub: "Pay once, yours forever",           badge: "BEST VALUE" },
};

// Pro-only perks. Lite excludes Deep Research / Auto-deepen / Save-to-all /
// Flowchart Studio / Law Pack add-on, and caps at 200 nodes per map.
const PERKS_PRO = [
  "Bring your own AI key — zero quota limits",
  "Unlimited maps + unlimited mind-map size (free tier = 3 maps × 30 elements)",
  "Cloud Save to Google Drive · Dropbox · Zotero (mirror to all 3)",
  "Deep Research · Auto-deepen · Flowchart Studio",
  "Law Pack add-on available ($10 one-off · 1% to BAILII)",
  "Premium shapes, fonts & colour packs",
  "Custom affiliate IDs on outbound book links",
  "Priority email support",
];

const PERKS_LITE = [
  "Bring your own AI key — pay your provider directly",
  "Up to 200 map elements per map (free tier = 3 maps × 30 elements)",
  "Cloud Save to Drive OR Dropbox OR Zotero (one target per save)",
  "PDF Reader with persistent highlights & ink annotations",
  "Premium shapes, fonts & colour packs",
  "5% affiliate commission + 1 bonus month per referral",
];

const PERKS_BY_PLAN = {
  lite: PERKS_LITE,
  monthly: PERKS_PRO,
  annual: PERKS_PRO,
  lifetime: PERKS_PRO,
};

const PLAN_LABEL = {
  lite: "Pro Lite",
  monthly: "Pro Monthly",
  annual: "Pro Annual",
  lifetime: "Pro Lifetime",
};

const PLAN_CTA = {
  lite: "Start 7-day trial",
  monthly: "Start 7-day trial",
  annual: "Start 7-day trial",
  lifetime: "Lock in lifetime",
};

export default function Pricing() {
  usePageMeta({
    title: "Pricing — Marvex Studio (Free · Lite $9 · Pro $15 · Lifetime $200)",
    description: "Marvex Studio pricing: free tier, Lite at $9/mo, Pro at $15/mo (or $150/yr), Founder lifetime at $200. Bring your own AI key — no markup.",
    type: "website",
    url: "https://marvex.app/pricing",
  });
  // Top-of-funnel: who lands on /pricing. Fires once per mount.
  // Pairs with `pricing_cta_clicked` → `checkout_started` →
  // `checkout_completed` (Studio.jsx) so the PostHog funnel report
  // can compute conversion rates at each step.
  useEffect(() => {
    track("pricing_view", { ref: getRef() || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [founders] = useState({ limit: 50, taken: 0, remaining: 50 });
  // A/B experiment: should the Lite tier be visible? PostHog flag
  // `lite_tier_visible` controls bucketing; default TRUE so Lite ships
  // for the test variant without a flag set. Control group sees just
  // the existing Pro/Annual/Lifetime tiers — same UX as before Lite.
  const liteVisible = useExperiment("lite_tier_visible", true);

  // Currency code for display only — Stripe always charges in USD.
  // Initialised to the visitor's locale-guessed default so the page
  // renders sensible numbers on first paint without flicker.
  const [currency, setCurrencyCode] = useState(() => detectDefaultCurrency());

  // Founders state retained for future use; the visible countdown is
  // currently suppressed (see showFounder below) until real social
  // proof exists.
  void founders;

  // Stripe checkout — mirrors UpgradeDialog.startCheckout. Public
  // /pricing CTAs route paid plans (lite/monthly/annual/lifetime)
  // through this; the explicit "Free" tier still goes to /library
  // because there's no charge to authorise.
  const { user, signIn } = useAuth();
  const [busyPlan, setBusyPlan] = useState(null);

  const startCheckout = async (planId) => {
    track("pricing_cta_clicked", { plan: planId, lite_visible: liteVisible, auth: user ? "logged_in" : "guest" });
    setBusyPlan(planId);
    track("checkout_started", { plan: planId, source: "pricing_page", lite_visible: liteVisible });

    // Two paths:
    //   1. AUTHENTICATED — POST /api/billing/create-checkout (existing flow,
    //      attaches user_id, applies affiliate referrals).
    //   2. GUEST — POST /api/billing/create-guest-checkout (NO auth, Stripe
    //      collects email at checkout, webhook upserts user + emails magic
    //      link). Highest-conversion path because it skips OAuth entirely.
    const endpoint = user ? "/billing/create-checkout" : "/billing/create-guest-checkout";
    const body = user
      ? {
          plan: planId,
          origin_url: window.location.origin,
          ref_code: getRef() || "",
        }
      : {
          // Affiliate ref intentionally omitted on guest checkouts —
          // the backend doesn't currently track them server-side and
          // we don't want to half-implement the path.
          plan: planId,
          origin_url: window.location.origin,
        };

    try {
      const r = await axios.post(`${API}${endpoint}`, body, { withCredentials: true });
      if (r.data?.url) {
        // Hard redirect to Stripe Checkout. The success_url returns to
        // /app?upgraded=true&session_id=... where Studio's effect mirrors
        // the subscription state and pops the celebratory toast.
        window.location.href = r.data.url;
      } else {
        toast.error("Could not start checkout — please try again.");
        setBusyPlan(null);
      }
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Checkout failed — please try again.";
      track("checkout_failed", { plan: planId, source: "pricing_page", error: msg });
      toast.error(msg);
      setBusyPlan(null);
    }
  };

  // After OAuth round-trip, resume the pending checkout once the user is back.
  // Guest-checkout flows skip OAuth entirely so this only fires for users who
  // explicitly chose the Google sign-in path before checkout.
  useEffect(() => {
    if (!user) return;
    let pending;
    try { pending = sessionStorage.getItem("marvex_pending_plan"); } catch { pending = null; }
    if (pending && PLAN_DETAIL[pending]) {
      try { sessionStorage.removeItem("marvex_pending_plan"); } catch { /* ignore */ }
      startCheckout(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  return (
    <div data-testid="pricing-page" className="min-h-screen text-white cosmic-bg">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/library" data-testid="pricing-launch-app" className="cta-ghost text-[13px]">
            Launch app <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-12 pb-16 text-center">
        <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 inline-flex items-center gap-2 mb-8">
          <Sparkles size={12} /> Simple pricing. Zero AI cost from us.
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[0.95] tracking-tight mb-6">
          Pick the shape of your <span className="gradient-text">commitment.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-[#a4b4d8] leading-relaxed">
          Every plan ships every feature. The difference is the runway. You bring
          your own AI key — we never mark up inference. That&apos;s the deal.
          <span className="text-cyan-300"> For the price of a cup of coffee per week!</span>
        </p>
      </section>

      {/* Free-tier honest reframe — high-conversion strip placed BEFORE the plan
          cards so visitors immediately understand what's actually free. The
          30-element cap only counts structured tree-elements; everything else
          (stickies, clipart, lines, arrows, exports, cloud save, etc.) is
          unlimited even on free. */}
      <section
        data-testid="pricing-free-reframe"
        className="max-w-4xl mx-auto px-6 lg:px-12 pb-12"
      >
        <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.07] to-cyan-500/[0.04] p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full grid place-items-center bg-emerald-500/15 border border-emerald-400/30">
              <Check size={18} className="text-emerald-300" />
            </div>
            <div className="flex-1">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/90 mb-1.5">
                What&apos;s actually free
              </div>
              <p className="text-[14px] text-[#cfdaf3] leading-relaxed mb-3">
                Free includes <strong className="text-white">3 maps</strong>, plus unlimited stickies, clipart, lines, arrows, images, exports, and cloud save.
                Each map caps at 30 structured elements. Plenty of room to evaluate the full product across mind-map, flowchart, and timeline patterns.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Unlimited stickies",
                  "Unlimited clipart",
                  "Unlimited lines + arrows",
                  "PDF · PNG · SVG · MD export",
                  "Drive · Dropbox · Zotero",
                  "BYO AI key",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="mono text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[#9aaad0]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plan cards — 4 tiers when the `lite_tier_visible` experiment
          variant is ON, else 3 (control group). Layout grid drops to
          md:grid-cols-3 when Lite is hidden so the cards expand to fill
          the row instead of leaving an empty slot. */}
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pb-20">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad]">
            All plans · billed in USD
          </div>
          <CurrencySwitcher onChange={setCurrencyCode} />
        </div>
        <div
          className={`grid md:grid-cols-2 gap-4 ${liteVisible ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
          data-testid="pricing-cards"
          data-lite-visible={liteVisible ? "1" : "0"}
        >
          {Object.entries(PLAN_DETAIL)
            .filter(([id]) => liteVisible || id !== "lite")
            .map(([id, plan]) => {
            const isLifetime = id === "lifetime";
            // Founders countdown intentionally hidden — bring it back when
            // we have real social proof to anchor the urgency. Until then
            // showing "50/50 LEFT" reads like fake scarcity.
            const showFounder = false;
            const perks = PERKS_BY_PLAN[id] || PERKS_PRO;
            return (
              <div
                key={id}
                data-testid={`pricing-card-${id}`}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  id === "annual"
                    ? "border-cyan-400/50 bg-cyan-400/[0.04] shadow-[0_0_30px_rgba(0,240,255,0.12)]"
                    : id === "lite"
                    ? "border-emerald-400/30 bg-emerald-400/[0.03]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {showFounder ? (
                  <span className="absolute -top-3 right-5 mono text-[9px] uppercase tracking-[0.18em] px-2 py-[3px] rounded-full bg-amber-500/25 text-amber-100 border border-amber-400/50">
                    VIP · {founders.remaining}/{founders.limit} LEFT
                  </span>
                ) : plan.badge ? (
                  <span className={`absolute -top-3 right-5 mono text-[9px] uppercase tracking-[0.18em] px-2 py-[3px] rounded-full border ${
                    id === "lite"
                      ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/50"
                      : "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40"
                  }`}>
                    {plan.badge}
                  </span>
                ) : null}

                <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
                  {PLAN_LABEL[id]}
                </div>
                <div className="text-5xl font-extrabold mb-1" data-testid={`pricing-amount-${id}`}>
                  {priceLabel(plan.usd, currency)}<span className="text-lg text-[#9aaad0] font-normal">{plan.suffix}</span>
                </div>
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mb-5">
                  {plan.sub}
                </div>

                <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] -mt-3 mb-5">
                  Single-user license
                </div>

                {showFounder && (
                  <div className="text-[12px] text-amber-200/90 leading-snug mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    First 50 lifetime buyers get <strong>Founder status</strong> — permanent gold badge and early access to every new feature.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => startCheckout(id)}
                  disabled={busyPlan === id}
                  data-testid={`pricing-cta-${id}`}
                  className={`${id === "annual" ? "cta-pill" : "cta-ghost"} w-full justify-center mb-5 disabled:opacity-60 disabled:cursor-wait`}
                >
                  {busyPlan === id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Redirecting…
                    </>
                  ) : (
                    PLAN_CTA[id]
                  )}
                </button>

                <ul className="space-y-2 mt-auto">
                  {perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] text-[#cfdaf3]">
                      <Check size={14} className={`shrink-0 mt-[2px] ${id === "lite" ? "text-emerald-300" : "text-cyan-300"}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mt-8">
          Stripe handles billing · Cancel anytime · 7-day trial on every recurring plan
        </p>

        <div
          data-testid="pricing-team-contact"
          className="mt-10 mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center"
        >
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
            Teams · Classrooms · Firms
          </div>
          <p className="text-[14px] text-[#cfdaf3] leading-relaxed">
            Every plan above is a <strong>single-user license</strong>. Need to cover a team,
            classroom, law firm, research group — or want a custom contract or volume pricing?
          </p>
          <a
            href="mailto:press@marvex.app?subject=Multi-user%20license%20enquiry"
            data-testid="pricing-team-contact-email"
            className="inline-block mt-3 mono text-[11px] uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200 underline-offset-4 hover:underline"
          >
            press@marvex.app →
          </a>
        </div>
      </section>

      {/* UK Law Pack add-on — dedicated section.  The BAILII 1%-of-revenue
          pledge is the differentiator: no competitor in this space gives
          back to the data source.  We call it out prominently because
          (a) it's a genuine ethical position, not just marketing, and
          (b) it reframes the £10 one-off as "supports open legal data"
          rather than "costs money", which converts dramatically better
          for values-motivated buyers (lawyers, academics, civil society). */}
      <section
        data-testid="pricing-law-pack"
        className="max-w-5xl mx-auto px-6 lg:px-12 pb-20"
      >
        <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.06] via-amber-500/[0.02] to-transparent p-7 md:p-9">
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-8 items-start">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300 mb-2 inline-flex items-center gap-1.5">
                <Sparkles size={11} /> UK Law Pack · optional add-on
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                <span className="gradient-text">£10 one-off.</span> Unlocks the whole of English law.
              </h2>
              <p className="text-[15px] text-[#cfdaf3] leading-relaxed mb-5">
                BAILII full-text case-law search built into Marvex. AI-generated case summaries using your own key.
                Drop any judgment URL into a map and watch it become a navigable tree of ratio, obiter, and citations.
                Bolt it onto any paid plan — never expires, no renewal.
              </p>
              <ul className="space-y-2 mb-5" data-testid="law-pack-features">
                <li className="flex items-start gap-2 text-[13.5px] text-[#cfdaf3]">
                  <Check size={14} className="text-amber-300 shrink-0 mt-[3px]" />
                  <span>BAILII full-text search across all UK + Irish judgments</span>
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[#cfdaf3]">
                  <Check size={14} className="text-amber-300 shrink-0 mt-[3px]" />
                  <span>AI case summaries on demand (BYOK — your Claude/GPT key)</span>
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[#cfdaf3]">
                  <Check size={14} className="text-amber-300 shrink-0 mt-[3px]" />
                  <span>LexisNexis BYOK for paid-subscription research on top</span>
                </li>
                <li className="flex items-start gap-2 text-[13.5px] text-[#cfdaf3]">
                  <Check size={14} className="text-amber-300 shrink-0 mt-[3px]" />
                  <span>Ratio-extraction, citation maps, holdings trees</span>
                </li>
              </ul>
            </div>

            {/* BAILII 1% pledge — the ethical differentiator */}
            <div
              data-testid="bailii-pledge"
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.04] p-5"
            >
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-emerald-300 mb-3 inline-flex items-center gap-1.5">
                <Shield size={11} /> Our BAILII pledge
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                <span className="text-emerald-300">1%</span> of every Law Pack sale goes to <a href="https://www.bailii.org" target="_blank" rel="noopener noreferrer" className="text-emerald-200 hover:text-emerald-100 underline-offset-4 hover:underline">BAILII</a>.
              </h3>
              <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-3">
                BAILII is a registered charity that keeps UK case law <strong className="text-white">free for everyone</strong>.
                We&apos;re built on top of their work — so every time someone buys the Law Pack, 1% of the
                net revenue goes straight back to them, paid annually.
              </p>
              <p className="mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">
                No competitor does this. Now we&apos;re on record.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stack-replacement value proof */}
      <section
        data-testid="pricing-stack-replace"
        className="max-w-5xl mx-auto px-6 lg:px-12 pb-24"
      >
        <div className="text-center mb-10">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3">
            What you stop paying for
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            One subscription replaces <span className="gradient-text">your whole research stack.</span>
          </h2>
          <p className="text-[#9aa7c7] mt-4 max-w-2xl mx-auto text-[15px] leading-relaxed">
            Most of our users were paying for 3–4 separate tools to do what Marvex does in one place.
            The math is honest — here it is in plain numbers.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.06] via-violet-500/[0.04] to-fuchsia-500/[0.06] p-6 sm:p-8">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            {/* Stack of competitors */}
            <div data-testid="pricing-stack-list">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-3">
                Typical research stack
              </div>
              {[
                { name: "Heptabase", role: "Visual research notes", price: 14.99 },
                { name: "ChatGPT Plus", role: "AI for summarising & explaining", price: 20.00 },
                { name: "Readwise", role: "Highlight aggregation", price: 9.99 },
              ].map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-b-0"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-[14px] text-white font-semibold truncate">{s.name}</div>
                    <div className="text-[11px] text-[#7a87ad] truncate">{s.role}</div>
                  </div>
                  <div className="mono text-[13px] text-[#cfdaf3] tabular-nums shrink-0">
                    {priceLabel(s.price, currency)}
                    <span className="text-[#566187] text-[10px]">/mo</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-cyan-400/20">
                <span className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad]">
                  Combined total
                </span>
                <span className="mono text-[16px] text-white font-bold tabular-nums">
                  {priceLabel(44.98, currency)}<span className="text-[#566187] text-[11px]">/mo</span>
                </span>
              </div>
            </div>

            {/* Mind-mapper hero number */}
            <div className="flex flex-col items-center text-center md:items-end md:text-right md:border-l md:border-cyan-400/20 md:pl-8">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
                Marvex Pro
              </div>
              <div className="text-6xl font-extrabold gradient-text leading-none mb-1 tabular-nums">
                $15
              </div>
              <div className="mono text-[11px] uppercase tracking-[0.22em] text-[#9aaad0] mb-4">
                per month · everything included
              </div>
              <div
                data-testid="pricing-stack-save-pill"
                className="inline-block mono text-[11px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-100 border border-amber-300/50 font-semibold"
              >
                Save 67% · ~$30 every month
              </div>
              <Link
                to="/library"
                data-testid="pricing-stack-cta"
                className="cta-pill text-[13px] mt-5"
              >
                Start 7-day trial <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <p className="text-[11px] text-[#566187] leading-relaxed mt-6 pt-5 border-t border-white/5">
            Pricing as of Feb 2026, sourced from each provider&apos;s public pricing page.
            Your stack may differ — substitute Notion AI, MindMeister, Mem, or any other
            combination and the math still works in your favour. Marvex Pro replaces
            <span className="text-cyan-300"> mind-mapping + AI research + highlight capture + cloud sync </span>
            in one local-first app.
          </p>
        </div>
      </section>

      {/* FAQ — sourced from /lib/faqs.js (single source of truth shared with
          Landing). Native <details> gives us a zero-JS accordion that ships
          smaller than a Shadcn import; deep-link anchors (#faq-q-id) let
          support emails point straight at a specific answer. */}
      <section className="max-w-3xl mx-auto px-6 lg:px-12 pb-24" data-testid="pricing-faq">
        <FaqJsonLd />
        <h2 className="text-3xl font-bold mb-3 text-center">
          <span className="gradient-text">Frequently</span> asked
        </h2>
        <p className="text-center text-[#9aa7c7] text-[14px] mb-8 max-w-xl mx-auto">
          The honest answers to what most people ask before paying. Still on the fence?{" "}
          <a
            href="mailto:ceo@marvex.app?subject=Pre-purchase%20question"
            className="text-cyan-300 hover:underline"
            data-testid="pricing-faq-contact"
          >
            email me directly
          </a>.
        </p>
        <div className="space-y-3">
          {FAQ_FLAT.map((f) => (
            <details
              key={f.id}
              id={`faq-q-${f.id}`}
              data-testid={`pricing-faq-item-${f.id}`}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-cyan-400/30 transition group"
            >
              <summary className="cursor-pointer flex items-center justify-between gap-4 font-semibold text-white text-[15px]">
                <span>{f.q}</span>
                <span className="mono text-[14px] text-cyan-300/60 group-open:rotate-45 transition-transform shrink-0">+</span>
              </summary>
              <p className="text-[#a4b4d8] text-[14px] leading-relaxed mt-3 whitespace-pre-line">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-6 lg:px-12 pb-24 text-center">
        <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-violet-500/5 to-fuchsia-500/10 p-10">
          <h3 className="text-2xl font-bold mb-3">Still thinking?</h3>
          <p className="text-[#a4b4d8] mb-6 max-w-xl mx-auto">
            The free tier is real — map a PDF, see what it does, decide later. Every feature is accessible; Pro just removes the ceiling.
          </p>
          <Link to="/library" data-testid="pricing-free-cta" className="cta-pill text-[14px]">
            Try it free <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 lg:px-12 py-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#566187] mono text-[10px] uppercase tracking-[0.22em]">
        <div>© 2026 marvex.app · The Ultimate Research Lab</div>
        <div className="flex items-center gap-4">
          <Link to="/tools" className="hover:text-cyan-300">Tools</Link>
          <Link to="/learn" className="hover:text-cyan-300">Learn</Link>
          <Link to="/privacy" className="hover:text-cyan-300">Privacy</Link>
          <Link to="/terms" className="hover:text-cyan-300">Terms</Link>
          <Link to="/download" className="hover:text-cyan-300">Download</Link>
        </div>
      </footer>
      <SiteLinksFooter />
    </div>
  );
}

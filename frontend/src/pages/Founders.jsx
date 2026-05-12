import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Crown, Vote, Gift, Mail, Sparkles,
  Infinity as InfinityIcon, BadgeCheck, Lock, Stars,
  HelpCircle, ShieldCheck, Loader2,
} from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import usePageMeta from "@/lib/usePageMeta";
import { useAuth } from "@/lib/auth";
import { getRef } from "@/lib/referral";
import { track } from "@/lib/posthog";

const SITE = "https://marvex.app";
const CANONICAL = `${SITE}/founders`;
const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

/**
 * /founders — dedicated sales page for the Founder tier ($200 lifetime).
 *
 * Linked from the "Founder spots still available" badge in the landing
 * hero's SocialProofStrip.  Goal: convert curious browsers into the
 * first-50 lifetime cohort by laying out the four pillars they get that
 * no other plan does:
 *
 *   1. A real vote on roadmap priorities (direct, not advisory)
 *   2. Every future paid add-on (Law Pack / Image Pack / Team seats /
 *      whatever ships next) included free forever
 *   3. Surprises — physical hand-signed thank-you, mystery drops, swag
 *   4. Numbered #1–#50 Founder badge (in-Studio + on the "Founding 50"
 *      wall) — recognition, not just access
 *
 * Conversion path mirrors the Pricing page exactly: authenticated users
 * hit /api/billing/create-checkout, guests hit /api/billing/create-guest-
 * checkout so they never bounce through OAuth. Stripe handles the rest.
 */
const PILLARS = [
  {
    icon: Vote,
    kicker: "Pillar 01",
    title: "A real vote on what ships next.",
    body:
      "Every quarter you get a private roadmap ballot — the candidate features for the next release, voting open for 7 days, results binding (not advisory). Top three vote-getters ship in the next cycle. Founders shape what Marvex Studio becomes; everyone else gets to use what you decided.",
    detail: [
      "Quarterly private ballot — 7 days, ranked-choice, results binding",
      "Submit your own feature requests for inclusion on the next ballot",
      "Veto power against any feature that breaks the local-first principle",
    ],
  },
  {
    icon: InfinityIcon,
    kicker: "Pillar 02",
    title: "Every future paid add-on. Free. Forever.",
    body:
      "The base lifetime ($200) already gives you the full Pro toolkit forever. But Marvex Studio is a young product — there's more coming. The Law Pack ($10), the upcoming Image Pack, Team seats, anything we sell in the future as a paid add-on: included in your Founder license at zero extra cost. No grandfathering games, no \"sorry, that's the new pricing\" emails.",
    detail: [
      "Law Pack ($10 today) — included",
      "Image Pack (research images + watermark-free export) — included on release",
      "Team seats / collaborative editing — included on release",
      "Any future paid add-on we haven't dreamed up yet — included",
    ],
  },
  {
    icon: Gift,
    kicker: "Pillar 03",
    title: "Surprises, in the post.",
    body:
      "Real product launches deserve real-world artefacts. Every Founder gets a hand-signed thank-you note from me (yes, actual ink, actual envelope, posted to your address). And throughout the year there will be small mystery drops — a launch-day mug, an early-build sticker, the occasional limited-print poster of your own mind map's structure. Nothing announced in advance. That's the point.",
    detail: [
      "Hand-signed founder's thank-you note posted to your address",
      "Periodic mystery drops — small, useful, never spam",
      "First dibs on any limited-edition Marvex merch we make",
    ],
  },
  {
    icon: BadgeCheck,
    kicker: "Pillar 04",
    title: "Your name, numbered, on the wall.",
    body:
      "Each Founder is allocated a number from #1 to #50 in purchase order — and that number lives on. You get a numbered Founder badge that displays on your profile and inside Marvex Studio's sidebar (only your number, no email, no surname unless you opt in). The public \"Founding 50\" wall on marvex.app lists every Founder by chosen handle in order of joining. It's a permanent record that you got there first.",
    detail: [
      "Numbered Founder badge (#1–#50) on profile + in-Studio sidebar",
      "Listed publicly on the Founding 50 wall (optional — opt out anytime)",
      "Founder-only Discord channel access (once it opens)",
      "Founder-only early-access to beta builds, 7 days before public",
    ],
  },
];

const EXCLUSIVE_PERKS = [
  { icon: Crown,       label: "Numbered #1–#50 Founder badge — permanent" },
  { icon: Vote,        label: "Binding vote on quarterly roadmap ballots" },
  { icon: InfinityIcon, label: "All future paid add-ons included, forever" },
  { icon: Mail,        label: "Hand-signed thank-you note in the post" },
  { icon: Stars,       label: "Mystery drops throughout the year" },
  { icon: Lock,        label: "Founder-only Discord + 7-day early-access builds" },
  { icon: ShieldCheck, label: "Locked-in lifetime price — no upgrade ever required" },
  { icon: Sparkles,    label: "Founding 50 wall listing (optional)" },
];

const FAQ = [
  {
    q: "Why a Founder tier — what's the catch?",
    a: "No catch — it's recognition. Building Marvex Studio without VC money means the first 50 people who pay up front let me ship faster, hire freelance design help, and code-sign the desktop binaries. In return, those 50 get a permanent seat at the design table plus every future paid add-on free. Once #50 is sold, the tier closes forever.",
  },
  {
    q: "What does \"every future paid add-on, free, forever\" actually include?",
    a: "Anything we ship as a paid add-on for the rest of the product's life. Today that's the Law Pack ($10). On the roadmap: Image Pack (research images + watermark-free export), Team seats (collaborative editing), and the AI Voice Notes pack. Anything we invent next year, the year after, all of it — your license absorbs it. The only thing it doesn't cover is third-party AI costs (those go to OpenAI / Anthropic / Google via your own API key, same as every plan).",
  },
  {
    q: "How does the quarterly roadmap vote work?",
    a: "Each quarter I publish a shortlist of 8–10 candidate features (with rough scope estimates). Founders get a 7-day private ballot — ranked-choice. The top three ship in the next release cycle. You can also submit your own feature for inclusion on the next ballot via the Founders-only suggestion form. Voting is binding, not advisory.",
  },
  {
    q: "Is the badge visible to other users?",
    a: "Inside Marvex Studio it shows in your own sidebar (just your number, e.g. \"Founder #07\"). On the public Founding 50 wall it shows your chosen display handle next to your number — you can opt out of the public wall and stay anonymous if you prefer.",
  },
  {
    q: "What if I change my mind?",
    a: "14-day full refund on the Founder purchase, no questions asked. Just email ceo@marvex.app from the address you bought with. After day 14, your Founder slot is permanent.",
  },
  {
    q: "Can I transfer my Founder badge?",
    a: "No — the badge is tied to the original purchasing email and isn't transferable. It's recognition for trusting the project early, not a tradeable asset. If you ever lose access to the original email, contact ceo@marvex.app and we'll restore the badge to your new email.",
  },
  {
    q: "When does the Founder tier close?",
    a: "The moment #50 is sold. After that the page redirects to the standard $200 Lifetime tier (same software, no badge, no future-add-ons-free guarantee, no vote). There's no extension and no \"Founder 2.0\" round — the number is the number.",
  },
];

export default function Founders() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  usePageMeta({
    title: "Founders Edition — Marvex Studio",
    description:
      "Be one of the first 50 Founders of Marvex Studio. Lifetime access, every future paid add-on free, a binding vote on the roadmap, a numbered badge, and a hand-signed thank-you note in the post.",
    type: "website",
    url: CANONICAL,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Marvex Studio — Founders Edition",
        description:
          "Lifetime Founder license capped at 50 buyers. Includes every future paid add-on, a binding vote on the quarterly roadmap, a numbered #1–#50 badge, and a hand-signed thank-you note.",
        brand: { "@type": "Brand", name: "Marvex Studio" },
        offers: {
          "@type": "Offer",
          price: "200",
          priceCurrency: "USD",
          availability: "https://schema.org/LimitedAvailability",
          url: CANONICAL,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Marvex", item: SITE },
          { "@type": "ListItem", position: 2, name: "Founders", item: CANONICAL },
        ],
      },
    ],
  });

  const startCheckout = async () => {
    track("founders_cta_clicked", { auth: user ? "logged_in" : "guest" });
    setBusy(true);
    const endpoint = user ? "/billing/create-checkout" : "/billing/create-guest-checkout";
    const body = user
      ? { plan: "lifetime", origin_url: window.location.origin, ref_code: getRef() || "", source: "founders_page" }
      : { plan: "lifetime", origin_url: window.location.origin, source: "founders_page" };
    try {
      const r = await axios.post(`${API}${endpoint}`, body, { withCredentials: true });
      if (r.data?.url) {
        window.location.href = r.data.url;
      } else {
        toast.error("Could not start checkout — please try again.");
        setBusy(false);
      }
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Checkout failed — please try again.";
      track("founders_checkout_failed", { error: msg });
      toast.error(msg);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid="founders-page">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link
          to="/"
          data-testid="founders-home"
          className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition"
        >
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex / founders</span>
        </Link>
        <Link to="/pricing" data-testid="founders-to-pricing" className="cta-ghost text-[12px]">
          See all plans <ArrowRight size={12} />
        </Link>
      </header>

      {/* HERO */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-10 pb-16">
        <div
          data-testid="founders-availability-badge"
          className="mono text-[11px] uppercase tracking-[0.22em] text-amber-200 px-3 py-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 inline-flex items-center gap-2 mb-6"
        >
          <Crown size={12} className="text-amber-300" /> Limited spots available
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[0.98] tracking-tight mb-6">
          The Founding 50.<br />
          <span className="gradient-text">A seat at the table.</span>
        </h1>
        <p className="text-[17px] sm:text-[19px] text-[#a4b4d8] leading-relaxed max-w-3xl mb-8">
          Marvex Studio is built by one person, in public, without VC money. The first
          50 people who back it lifetime become <strong className="text-white">Founders</strong> —
          numbered #1 through #50, with a binding vote on the roadmap, every future paid add-on
          included free forever, a hand-signed thank-you in the post, and the occasional
          mystery drop. Once #50 is sold, the tier closes for good.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startCheckout}
            disabled={busy}
            data-testid="founders-cta-hero"
            className="cta-pill disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <><Loader2 className="animate-spin" size={14} /> Opening checkout…</>
            ) : (
              <>Claim your Founder seat — $200 <ArrowRight size={14} /></>
            )}
          </button>
          <Link to="/pricing" data-testid="founders-cta-compare" className="cta-ghost">
            Compare with other plans
          </Link>
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad]">
            Pay once · Yours forever · 14-day refund
          </span>
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px] text-[#9aa7c7]">
          {[
            { icon: Crown,        label: "Numbered #1–#50 badge" },
            { icon: Vote,         label: "Binding roadmap vote" },
            { icon: InfinityIcon, label: "All future add-ons free" },
            { icon: Mail,         label: "Signed thank-you in the post" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon size={14} className="text-amber-300/80 shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PILLARS */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-10 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3">
          What you actually get
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">
          Four things the other 250 million mind-map users will <span className="gradient-text">never have.</span>
        </h2>

        <div className="space-y-8">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <article
                key={p.kicker}
                data-testid={`founders-pillar-${i}`}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 grid sm:grid-cols-[88px_1fr] gap-6 hover:border-amber-300/30 transition"
              >
                <div className="shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/30 grid place-items-center">
                    <Icon size={26} className="text-amber-300" />
                  </div>
                  <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-200/80 mt-3">
                    {p.kicker}
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                    {p.title}
                  </h3>
                  <p className="text-[15px] text-[#a4b4d8] leading-relaxed mb-5">
                    {p.body}
                  </p>
                  <ul className="space-y-2">
                    {p.detail.map((d) => (
                      <li key={d} className="text-[13.5px] text-[#9aa7c7] leading-relaxed flex items-start gap-2.5">
                        <BadgeCheck size={14} className="text-amber-300/80 mt-1 shrink-0" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* EXCLUSIVES STRIP */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-3">
          Exclusively for Founders
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-10">
          The full list — every Founder-only perk in one place.
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {EXCLUSIVE_PERKS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={p.label}
                data-testid={`founders-perk-${i}`}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-3 hover:border-amber-300/30 transition"
              >
                <Icon size={16} className="text-amber-300 shrink-0" />
                <span className="text-[14px] text-[#cfdaf3]">{p.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* COMPARISON TO LIFETIME */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3">
          Founder vs Lifetime
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
          Same price. <span className="gradient-text">Different posture.</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">Standard Lifetime · $200</div>
            <h3 className="text-xl font-semibold mb-4">Full Pro toolkit, paid once.</h3>
            <ul className="space-y-2 text-[13.5px] text-[#a4b4d8]">
              <li>· Unlimited maps, unlimited size</li>
              <li>· Full PDF → Mind Map AI pipeline (BYOK)</li>
              <li>· Cloud sync to Drive / Dropbox / Zotero</li>
              <li>· Desktop apps for Mac / Win / Linux</li>
              <li>· All future <em>features</em> free (add-ons cost extra)</li>
              <li className="text-[#566187]">· No badge · No vote · No mystery drops</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-300/40 bg-amber-400/[0.04] p-6 shadow-[0_0_40px_rgba(252,211,77,0.08)]">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-200 mb-2">Founder Edition · $200 · capped at 50</div>
            <h3 className="text-xl font-semibold mb-4">Everything in Lifetime, plus:</h3>
            <ul className="space-y-2 text-[13.5px] text-[#cfdaf3]">
              <li className="flex items-start gap-2"><BadgeCheck size={14} className="text-amber-300 mt-1 shrink-0" /> Numbered #1–#50 Founder badge</li>
              <li className="flex items-start gap-2"><BadgeCheck size={14} className="text-amber-300 mt-1 shrink-0" /> Every future paid <em>add-on</em>, free, forever</li>
              <li className="flex items-start gap-2"><BadgeCheck size={14} className="text-amber-300 mt-1 shrink-0" /> Binding quarterly roadmap vote</li>
              <li className="flex items-start gap-2"><BadgeCheck size={14} className="text-amber-300 mt-1 shrink-0" /> Hand-signed thank-you in the post</li>
              <li className="flex items-start gap-2"><BadgeCheck size={14} className="text-amber-300 mt-1 shrink-0" /> Mystery drops + Founder-only Discord</li>
              <li className="flex items-start gap-2"><BadgeCheck size={14} className="text-amber-300 mt-1 shrink-0" /> Founding 50 wall listing (optional)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PRICE / CTA BLOCK */}
      <section className="max-w-3xl mx-auto px-6 lg:px-12 py-16 text-center border-t border-white/5">
        <Crown size={36} className="text-amber-300 mx-auto mb-4" />
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">
          $200. Once.
        </h2>
        <p className="text-[15px] text-[#a4b4d8] leading-relaxed mb-3">
          That's the entire ask. No subscription. No renewal email a year from now. No
          drip-fed paywalled add-ons. The license is yours, the number is yours, the vote
          is yours, every future surprise is yours — for one $200 payment.
        </p>
        <p className="text-[12px] text-[#7a87ad] mono uppercase tracking-[0.22em] mb-7">
          Limited spots available · 14-day refund · Charged in USD
        </p>
        <button
          type="button"
          onClick={startCheckout}
          disabled={busy}
          data-testid="founders-cta-main"
          className="cta-pill disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <><Loader2 className="animate-spin" size={14} /> Opening checkout…</>
          ) : (
            <>Claim your Founder seat <ArrowRight size={14} /></>
          )}
        </button>
        <div className="mt-6 text-[12px] text-[#7a87ad]">
          Questions first? <a href="mailto:ceo@marvex.app?subject=Founder%20question" className="text-cyan-300 hover:underline">Email me directly</a> — I'll reply same day.
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 lg:px-12 py-16 border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3 inline-flex items-center gap-2">
          <HelpCircle size={12} /> Founder FAQ
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
          The questions that actually matter.
        </h2>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <details
              key={i}
              data-testid={`founders-faq-${i}`}
              className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-amber-300/30 transition"
            >
              <summary className="cursor-pointer flex items-center justify-between gap-4 font-semibold text-white text-[15px] list-none">
                <h3 className="font-semibold text-white text-[15px] m-0">{f.q}</h3>
                <span className="mono text-[14px] text-amber-300/70 group-open:rotate-45 transition-transform shrink-0">+</span>
              </summary>
              <p className="text-[#a4b4d8] text-[14px] leading-relaxed mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 py-20 text-center border-t border-white/5">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-200/80 mb-3">
          One more time, in case you scrolled past it
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
          The first 50 <span className="gradient-text">decide what this becomes.</span>
        </h2>
        <p className="text-[15px] text-[#a4b4d8] leading-relaxed max-w-2xl mx-auto mb-8">
          Want to be one of them? Click the button. 14-day refund if it isn't for you.
          After #50 is gone, this page closes — and so does the chance.
        </p>
        <button
          type="button"
          onClick={startCheckout}
          disabled={busy}
          data-testid="founders-cta-bottom"
          className="cta-pill disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <><Loader2 className="animate-spin" size={14} /> Opening checkout…</>
          ) : (
            <>Become a Founder — $200 once <ArrowRight size={14} /></>
          )}
        </button>
      </section>

      <SiteLinksFooter />
    </div>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Mail, Bug, Newspaper, Briefcase, Users, MessageCircle,
} from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";

/**
 * /contact — channel router.
 *
 * Rather than a single generic form (which inevitably leads to "we got
 * your message we'll get back to you in 5 business days never"), this
 * page surfaces the exact right channel for each kind of enquiry. Bug
 * reports go to the existing /report-bug pipeline, press to /press,
 * affiliates to /affiliate, founder-level chat to ceo@marvex.app via
 * mailto. Everything else — sales, refunds, partnerships — also lands
 * on ceo@marvex.app because there's no point pretending we have a
 * sales team.
 *
 * Each card is a clickable surface (full-card click target — better
 * mobile UX than tiny "Contact" links). Cards link to internal SPA
 * routes via <Link>; mailto links open the user's default mail client.
 */

const CHANNELS = [
  {
    id: "bug",
    icon: Bug,
    title: "Report a bug",
    sub: "Something broken or weird?",
    detail: "Goes straight to tech@marvex.app with browser + page context auto-attached. Most fixes ship within a few days.",
    cta: "Open bug form",
    to: "/report-bug",
    accent: "from-rose-500/20 to-fuchsia-500/10 border-rose-400/30",
    iconColor: "text-rose-300",
  },
  {
    id: "press",
    icon: Newspaper,
    title: "Press & reviewers",
    sub: "Writing about Marvex?",
    detail: "Apply for instant 14-day Pro access — auto-approved if you've published anywhere with a real audience. Replies hit press@marvex.app.",
    cta: "Apply for press code",
    to: "/press",
    accent: "from-amber-500/20 to-orange-500/10 border-amber-400/30",
    iconColor: "text-amber-300",
  },
  {
    id: "affiliate",
    icon: Users,
    title: "Affiliate program",
    sub: "Want to earn 30% recurring?",
    detail: "Approved partners get a unique referral link, real-time dashboard, and monthly payouts via Stripe Connect.",
    cta: "Join affiliate program",
    to: "/affiliate",
    accent: "from-emerald-500/20 to-teal-500/10 border-emerald-400/30",
    iconColor: "text-emerald-300",
  },
  {
    id: "sales",
    icon: Briefcase,
    title: "Sales & partnerships",
    sub: "Bulk licenses · custom plans · integrations",
    detail: "Goes to my personal inbox. We've done deals from 5-seat student groups to mid-market law firms — drop a line and let's chat.",
    cta: "Email ceo@marvex.app",
    href: "mailto:ceo@marvex.app?subject=Marvex%20%E2%80%94%20Sales%20enquiry",
    accent: "from-cyan-500/20 to-sky-500/10 border-cyan-400/30",
    iconColor: "text-cyan-300",
  },
  {
    id: "founder",
    icon: MessageCircle,
    title: "Talk to the founder",
    sub: "Refunds · feedback · everything else",
    detail: "I read every email myself. Refund requests are honoured within 14 days, no questions asked — just send your order email.",
    cta: "Email ceo@marvex.app",
    href: "mailto:ceo@marvex.app?subject=Marvex%20%E2%80%94%20General%20question",
    accent: "from-fuchsia-500/20 to-purple-500/10 border-fuchsia-400/30",
    iconColor: "text-fuchsia-300",
  },
];

const ChannelCard = ({ ch }) => {
  const Icon = ch.icon;
  const Wrapper = ch.to ? Link : "a";
  const props = ch.to ? { to: ch.to } : { href: ch.href };
  return (
    <Wrapper
      {...props}
      data-testid={`contact-card-${ch.id}`}
      className={`group block rounded-2xl border bg-gradient-to-br ${ch.accent} p-6 hover:scale-[1.015] transition-all duration-300 hover:shadow-[0_0_40px_rgba(122,59,255,0.18)]`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center ${ch.iconColor}`}>
          <Icon size={20} />
        </div>
        <ArrowRight size={16} className="text-[#7a87ad] group-hover:text-white group-hover:translate-x-0.5 transition" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-1">{ch.title}</h2>
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] mb-3">{ch.sub}</div>
      <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-4">{ch.detail}</p>
      <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${ch.iconColor}`}>
        {ch.cta} <ArrowRight size={12} />
      </span>
    </Wrapper>
  );
};

export default function Contact() {
  usePageMeta({
    title: "Contact — Marvex Studio",
    description:
      "Get in touch with Marvex Studio: bug reports, press enquiries, affiliate program, sales, partnerships. Founder reads every email.",
    type: "website",
    url: `${SITE}/contact`,
    jsonLd: [{
      "@context": "https://schema.org",
      "@type": "ContactPage",
      url: `${SITE}/contact`,
      name: "Contact Marvex Studio",
      description: "Channel-routed contact page for Marvex Studio.",
    }, {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Marvex", item: SITE },
        { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE}/contact` },
      ],
    }],
  });

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid="contact-page">
      <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition" data-testid="contact-home">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex / contact</span>
        </Link>
        <Link to="/faq" data-testid="contact-to-faq" className="cta-ghost text-[12px]">
          FAQ <ArrowRight size={12} />
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/[0.06]">
          <Mail size={12} /> Get in touch
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-4">
          One human reads <span className="gradient-text">every single email.</span>
        </h1>
        <p className="text-[15px] sm:text-base text-[#a4b4d8] leading-relaxed mb-12 max-w-2xl">
          Marvex is built and run by a small team — this page picks the
          fastest path to the right inbox so you never get stuck in a support
          queue. Most replies land within 24 hours.
        </p>

        <div
          data-testid="contact-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {CHANNELS.map((ch) => (
            <ChannelCard key={ch.id} ch={ch} />
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-7 text-center">
          <h3 className="text-xl font-semibold mb-2">Still not sure where to start?</h3>
          <p className="text-[14px] text-[#a4b4d8] mb-5 max-w-xl mx-auto">
            Browse the FAQ — it answers most pre-purchase questions directly.
          </p>
          <Link to="/faq" data-testid="contact-cta-faq" className="cta-pill text-[13px]">
            Open FAQ <ArrowRight size={14} />
          </Link>
        </div>
      </main>

      <SiteLinksFooter />
    </div>
  );
}

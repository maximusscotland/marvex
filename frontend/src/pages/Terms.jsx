import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";

const SECTIONS = [
  {
    h: "1. Acceptance",
    body: (
      <p>
        By using marvex.app (the &ldquo;Service&rdquo;) you agree to these terms.
        If you don&apos;t agree, don&apos;t use the Service. Pretty simple.
      </p>
    ),
  },
  {
    h: "2. The Service",
    body: (
      <p>
        Marvex is a <strong>local-first mind-mapping and research tool</strong>. Your
        mind maps and PDFs are stored in your browser, not on our servers. AI features require
        you to bring your own API key (OpenAI, Anthropic, Google, or LLMGateway) — you pay the
        provider directly. We never mark up inference.
      </p>
    ),
  },
  {
    h: "3. Accounts",
    body: (
      <p>
        Sign in with Google. Keep your account secure — you&apos;re responsible for activity
        under your account. We may suspend accounts used for spam, abuse, or bypassing
        plan limits programmatically.
      </p>
    ),
  },
  {
    h: "4. Plans, pricing & VIP Founders",
    body: (
      <ul>
        <li><strong>Free</strong> — every feature accessible; map size capped at 30 nodes.</li>
        <li><strong>Pro Monthly</strong> ($15/mo) — uncapped node count, cloud sync, priority support.</li>
        <li><strong>Pro Annual</strong> ($150/yr) — same as Monthly, save ~17%.</li>
        <li><strong>Pro Lifetime</strong> ($200 once) — never billed again. Limited to the first 50 buyers as <em>VIP Founders</em>: gold badge, early access, never expires.</li>
        <li>Prices are in USD, billed by Stripe. Taxes (where applicable) are added at checkout.</li>
      </ul>
    ),
  },
  {
    h: "5. Cancellation & refunds",
    body: (
      <ul>
        <li>Monthly &amp; Annual: 7-day free trial — only charged if you continue. Cancel anytime; access continues until the end of your paid period.</li>
        <li>Lifetime: full refund within 14 days of purchase, no questions asked. After 14 days, lifetime is non-refundable.</li>
        <li><strong>Law Pack add-on ($10 one-off):</strong> refundable within 7 days <em>provided you haven&apos;t used the BAILII full-text search</em>. Once you&apos;ve run a search the add-on is non-refundable (we pay third-party costs the moment a search runs).</li>
        <li>Refund requests: email <a href="mailto:hello@marvex.app" className="text-cyan-300 hover:underline">hello@marvex.app</a> with your Stripe receipt.</li>
      </ul>
    ),
  },
  {
    h: "6. Your content",
    body: (
      <p>
        You own your maps, PDFs, and any text you put into the Service. We claim zero
        rights to your content. Because we don&apos;t store it, you&apos;re responsible for
        backups — use the Cloud Save feature (Drive / Dropbox / Zotero) regularly.
      </p>
    ),
  },
  {
    h: "7. Acceptable use",
    body: (
      <p>You agree not to: (a) reverse-engineer the Service for competitive copying;
      (b) use it to harass, defame, or violate someone&apos;s rights; (c) attempt to
      circumvent paid features programmatically; (d) feed it illegal content. Standard
      stuff.</p>
    ),
  },
  {
    h: "8. AI providers",
    body: (
      <p>
        AI features are provided by third parties using your own API key. Their terms apply
        to those round trips. We&apos;re not responsible for outages, content moderation,
        or billing on the provider side.
      </p>
    ),
  },
  {
    h: "9. Affiliate links",
    body: (
      <p>
        Some outbound links (book references, partner tools) carry affiliate codes — we may
        earn a small commission if you buy. You pay the same price either way. We only
        recommend tools we genuinely use and trust. Disclosed clearly on
        <Link to="/tools" className="text-cyan-300 hover:underline"> /tools</Link>.
      </p>
    ),
  },
  {
    h: "10. Disclaimer",
    body: (
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We
        do our best to keep it running, but we don&apos;t guarantee uptime, AI accuracy,
        or that your maps will always render exactly as you saved them. Your use, your
        risk.
      </p>
    ),
  },
  {
    h: "11. Liability",
    body: (
      <p>
        To the maximum extent permitted by law, our total liability is capped at the
        amount you paid us in the 12 months preceding the claim (Free users: capped at
        $0). We&apos;re not liable for indirect, consequential, or punitive damages.
      </p>
    ),
  },
  {
    h: "12. Changes & contact",
    body: (
      <p>
        We may update these terms; material changes get an email if you&apos;re registered.
        Questions? <a href="mailto:hello@marvex.app" className="text-cyan-300 hover:underline">hello@marvex.app</a>.
        Governing law: England &amp; Wales (subject to your local consumer rights).
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <div data-testid="terms-page" className="min-h-screen text-white cosmic-bg">
      <header className="max-w-3xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">Marvex Studio</span>
        </Link>
      </header>

      <article className="max-w-3xl mx-auto px-6 lg:px-12 pb-24">
        <div className="mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/80 mb-3">
          Effective: 1 February 2026
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-3 tracking-tight">
          Terms of <span className="gradient-text">Service</span>
        </h1>
        <p className="text-[#9aaad0] text-base leading-relaxed mb-12">
          Plain-English rules so you know what you&apos;re signing up for. Last
          reviewed February 2026.
        </p>

        <div className="prose-doc space-y-10 text-[#cfdaf3]">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-semibold text-white mb-3">{s.h}</h2>
              <div className="text-[15px] leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_a]:text-cyan-300">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </article>

      <footer className="max-w-3xl mx-auto px-6 lg:px-12 py-8 border-t border-white/5 flex items-center justify-between text-[#566187] mono text-[10px] uppercase tracking-[0.22em]">
        <div>© 2026 marvex.app</div>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-cyan-300">Privacy</Link>
          <Link to="/pricing" className="hover:text-cyan-300">Pricing</Link>
        </div>
      </footer>
    </div>
  );
}

import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import { ICO, icoLabel, ICO_REGISTERED, ENTITY, SUBPROCESSORS } from "@/lib/legal";

const SECTIONS = [
  {
    h: "1. The short version",
    body: (
      <>
        <p>
          marvex.app is a <strong>local-first</strong> research tool. Your mind maps,
          your highlights, and your AI keys live on <strong>your device</strong> — not on
          our servers. We can&apos;t read them, sell them, or hand them to anyone. We can&apos;t
          even back them up for you (that&apos;s on you).
        </p>
        <p>What we do collect: your email if you sign in, your subscription status, and
        anonymous product analytics so we know which features matter. That&apos;s it.</p>
      </>
    ),
  },
  {
    h: "2. What we collect (the long version)",
    body: (
      <ul>
        <li>
          <strong>Account data</strong>: when you sign in with Google we receive your
          email, name, and profile picture URL. Stored on our servers in MongoDB so we
          can identify you across sessions.
        </li>
        <li>
          <strong>Subscription data</strong>: your plan (Free / Monthly / Annual /
          Lifetime / Founder), trial dates, and a Stripe customer ID. We never see your
          card details — Stripe handles that.
        </li>
        <li>
          <strong>Waitlist email</strong>: if you joined the pre-launch waitlist, we
          store your email plus the UTM source you arrived from.
        </li>
        <li>
          <strong>Product analytics</strong>: page views and a small set of named events
          (e.g. <code>waitlist_joined</code>, <code>checkout_started</code>) via PostHog
          on the EU cloud. You can decline this with the cookie banner — the app works
          either way. We never send your map content, PDF text, or AI keys to PostHog.
        </li>
        <li>
          <strong>Server logs</strong>: standard request logs (timestamp, route, status
          code) retained for 30 days for debugging and abuse prevention.
        </li>
      </ul>
    ),
  },
  {
    h: "3. What we do NOT collect",
    body: (
      <ul>
        <li>The contents of your mind maps, PDFs, or highlights.</li>
        <li>Your AI provider API keys — they live in your browser&apos;s localStorage and are sent directly from your browser to the provider.</li>
        <li>Browsing history outside our app.</li>
        <li>Cross-site tracking. We don&apos;t use Google Analytics, Facebook Pixel, or any ad-tech.</li>
      </ul>
    ),
  },
  {
    h: "4. AI providers",
    body: (
      <p>
        When you use AI features, your text or PDF excerpt is sent <strong>directly from
        your browser</strong> to the provider you&apos;ve configured (OpenAI, Anthropic,
        Google, or LLMGateway). Their privacy policy applies for that round trip. We
        don&apos;t proxy, log, or persist these requests.
      </p>
    ),
  },
  {
    h: "5. Cookies & local storage",
    body: (
      <ul>
        <li><strong>Auth cookie</strong>: a session cookie (HttpOnly, Secure) so you stay signed in. Deleted on logout.</li>
        <li><strong>localStorage</strong>: your maps, settings, AI key (if entered), affiliate config, cookie-consent choice. All on your device.</li>
        <li><strong>PostHog cookie</strong>: anonymous device ID for funnel analytics. Disabled if you decline the cookie banner.</li>
      </ul>
    ),
  },
  {
    h: "6. Sharing",
    body: (
      <p>
        We share data with <strong>Stripe</strong> (payments), <strong>Google</strong> (sign-in),
        <strong> PostHog EU</strong> (analytics), and <strong>MongoDB Atlas</strong> (our database).
        That&apos;s it. We never sell your information, and we don&apos;t share with advertisers.
      </p>
    ),
  },
  {
    h: "7. Your rights",
    body: (
      <p>
        Email <a href="mailto:press@marvex.app" className="text-cyan-300 hover:underline">press@marvex.app</a>
        {" "} to access, export, or delete your data. We&apos;ll respond within 30 days. EU/UK users
        have GDPR rights; California users have CCPA rights — both are honoured.
      </p>
    ),
  },
  {
    h: "8. UK ICO registration & how to complain",
    body: (
      <>
        <p>
          Marvex Studio is the trading name for our UK-based business and we are registered
          with the UK <strong>Information Commissioner&apos;s Office (ICO)</strong> as a data
          controller under the Data Protection (Charges and Information) Regulations 2018.
        </p>
        <ul>
          <li>
            <strong>ICO registration:</strong>{" "}
            {ICO_REGISTERED ? (
              <>
                <code>{ICO.registrationNumber}</code> —{" "}
                <a
                  href={ICO.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="privacy-ico-verify"
                >
                  verify on the public register
                </a>.
              </>
            ) : (
              <>
                <em>{icoLabel()}</em>. Our registration is currently being
                processed by the ICO and the number will appear here once issued
                (typically 3–10 working days from application). Until then,
                you retain every right described below — registration is a
                regulatory formality, not a precondition for your rights.
              </>
            )}
          </li>
          <li>
            <strong>Right to complain:</strong> if you believe we&apos;ve mishandled your
            personal data you can complain directly to the ICO at{" "}
            <a
              href={ICO.complaintsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="privacy-ico-complaint"
            >
              ico.org.uk/concerns
            </a>{" "}
            (or call them on 0303 123 1113). We&apos;d obviously rather you mailed
            us at <a href="mailto:ceo@marvex.app">ceo@marvex.app</a> first so we can
            try to put it right — but the ICO route exists either way.
          </li>
        </ul>
      </>
    ),
  },
  {
    h: "9. Subprocessors",
    body: (
      <>
        <p>
          To run the Service we share specific, minimal data with the third parties
          listed below. Each one is contractually bound to GDPR-equivalent terms
          (under the EU SCCs / UK IDTA where data crosses borders) and we only ever
          send them the data they need to do their job.
        </p>
        <div className="overflow-x-auto -mx-2 my-3">
          <table className="w-full min-w-[640px] text-[13px] border border-white/10 rounded-lg overflow-hidden">
            <thead className="bg-white/[0.04] text-[#9aa7c7] mono text-[10px] uppercase tracking-[0.18em]">
              <tr>
                <th className="text-left p-2.5 font-normal">Subprocessor</th>
                <th className="text-left p-2.5 font-normal">What they do</th>
                <th className="text-left p-2.5 font-normal">Data</th>
                <th className="text-left p-2.5 font-normal">Hosted in</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((s) => (
                <tr
                  key={s.name}
                  data-testid={`subprocessor-row-${s.name.toLowerCase().replace(/\s+/g, "-")}`}
                  className="border-t border-white/5 align-top"
                >
                  <td className="p-2.5 font-medium text-white">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:underline"
                    >
                      {s.name}
                    </a>
                  </td>
                  <td className="p-2.5 text-[#cfdaf3]">{s.purpose}</td>
                  <td className="p-2.5 text-[#9aa7c7] text-[12px]">{s.data}</td>
                  <td className="p-2.5 text-[#9aa7c7] text-[12px] whitespace-nowrap">{s.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>BYOK AI providers (OpenAI / Anthropic / Google AI)</strong> are
          deliberately not in this list because Marvex is not the processor when
          you use AI features. Your browser sends the request directly to the
          provider using your own API key — our servers never see the request,
          the response, or your key. You have a direct contractual relationship
          with the AI provider, not via us.
        </p>
        <p className="text-[#9aa7c7] text-[13px]">
          We&apos;ll update this list and email subscribed users at least 30 days
          before adding any new subprocessor that handles personal data.
        </p>
      </>
    ),
  },
  {
    h: "10. Changes",
    body: (
      <p>
        We&apos;ll update this page with a new effective date if anything material changes,
        and email subscribed users when it does.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <div data-testid="privacy-page" className="min-h-screen text-white cosmic-bg">
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
          Privacy <span className="gradient-text">Policy</span>
        </h1>
        <p className="text-[#9aaad0] text-base leading-relaxed mb-12">
          We collect as little as we can, never sell your information, and try to make our
          choices honest enough that this page reads like English instead of
          legalese.
        </p>

        <div className="prose-doc space-y-10 text-[#cfdaf3]">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-semibold text-white mb-3">{s.h}</h2>
              <div className="text-[15px] leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_a]:text-cyan-300 [&_code]:font-mono [&_code]:text-cyan-300/80 [&_code]:text-sm">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </article>

      <footer className="max-w-3xl mx-auto px-6 lg:px-12 py-8 border-t border-white/5 flex items-center justify-between text-[#566187] mono text-[10px] uppercase tracking-[0.22em]">
        <div className="flex items-center gap-3 flex-wrap">
          <span>© 2026 marvex.app</span>
          {ICO_REGISTERED && (
            <span className="text-[#7a87ad]">· ICO {ICO.registrationNumber}</span>
          )}
        </div>
        <div className="flex gap-4">
          <Link to="/terms" className="hover:text-cyan-300">Terms</Link>
          <Link to="/pricing" className="hover:text-cyan-300">Pricing</Link>
        </div>
      </footer>
    </div>
  );
}

import React, { useState } from "react";
import { ChevronDown, Coins, Calendar, Cookie, ShieldCheck, AlertOctagon } from "lucide-react";

/**
 * AffiliateTermsPanel — collapsible terms section for the affiliate page.
 *
 * The terms encode the "fair, founder-led" affiliate program the user
 * shipped with: monthly payouts on the 28th, $50 minimum, 30-day hold for
 * refund/chargeback protection, 45-day last-touch cookie window, no
 * clawback (we eat the rare post-payout refund).
 *
 * Collapsed by default to keep the dashboard scannable; the affiliate
 * stats are the page's hero.  Expand-state isn't persisted on purpose —
 * any time we update the terms we want the next visit to start collapsed
 * so the affiliate sees the "Updated <date>" pill before the body, then
 * expands to read.
 */
export default function AffiliateTermsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section
      data-testid="affiliate-terms-section"
      className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
    >
      <button
        data-testid="affiliate-terms-toggle"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition group"
      >
        <div className="flex items-center gap-2 text-left">
          <ShieldCheck size={14} className="text-cyan-300/80" />
          <div>
            <div className="text-[14px] font-semibold text-white">Affiliate program terms</div>
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#566187]">
              Last updated · Feb 2026 · 4-min read
            </div>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-[#7a87ad] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          data-testid="affiliate-terms-body"
          className="border-t border-white/5 px-5 py-5 space-y-5 text-[13px] text-[#cfdaf3] leading-relaxed"
        >
          {/* Top stripe of the four key numbers — the "above the fold"
              summary so a busy affiliate can answer 90% of their questions
              without reading prose. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KeyStat icon={Coins} label="Min payout" value="$50" />
            <KeyStat icon={Calendar} label="Payout day" value="28th" />
            <KeyStat icon={ShieldCheck} label="Hold" value="30 days" />
            <KeyStat icon={Cookie} label="Cookie" value="45 days" />
          </div>

          <Block n="1" title="Commission rates">
            Free user: 5% on each invoice for the first 12 months.
            Pro Subscriber: 5%. Pro Lifetime: 17%. Founder: 25%. Annual and
            Lifetime referrals pay <strong className="text-white">once</strong> on the
            initial invoice. Monthly referrals pay on the first 12 invoices while the
            subscription stays active — if your friend cancels, future months stop
            accruing.
          </Block>

          <Block n="2" title="When you actually get the money (no 3-month wait)">
            Each commission has a <strong className="text-cyan-200">30-day hold period</strong>{" "}
            from the invoice date. This covers the refund window (7-14 days) plus most
            of the Stripe chargeback risk. After 30 days the commission flips from
            <em> Pending</em> to <em> Available</em>.
            <br /><br />
            On the <strong className="text-cyan-200">28th of each month</strong> we sweep
            all <em>Available</em> balances ≥ <strong className="text-cyan-200">$50</strong> and
            send them via Wise (preferred) or PayPal. Email{" "}
            <a className="text-cyan-300 hover:underline" href="mailto:hello@marvex.app">
              hello@marvex.app
            </a>{" "}
            with your preferred method before your first sweep — we&apos;ll ask before
            we pay anyway. Balances below $50 roll into the next month.
            <br /><br />
            Worked example: friend signs up Jan 5 → commission Available Feb 4 → paid
            on Feb 28. Worst-case wait is ~5 weeks, not 3 months.
          </Block>

          <Block n="3" title="Cookie / attribution window">
            Anyone who clicks your link gets a 45-day cookie. If they sign up and
            pay any time within that window, the commission is yours — even if they
            close the tab and come back later via Google. Last-touch attribution: if
            they click a different affiliate&apos;s link more recently, that affiliate
            gets the credit. Cookies are device-and-browser scoped (no cross-device
            magic).
          </Block>

          <Block n="4" title="Refunds &amp; chargebacks (no clawback for now)">
            If your referral refunds <em>during</em> the 30-day hold, the commission
            never becomes Available — it&apos;s removed from your <em>Pending</em> stack
            silently. If a refund somehow happens <em>after</em> we&apos;ve already paid
            you (rare, usually a chargeback dispute), <strong className="text-emerald-300">we eat the
            loss</strong> for the foreseeable future — no clawback from your next
            balance. We reserve the right to revisit this policy if abuse becomes a
            problem; we&apos;ll give 30-day notice before any change.
          </Block>

          <Block n="5" title="What you can&apos;t do">
            <ul className="list-disc list-outside pl-5 space-y-1.5 mt-1">
              <li><strong className="text-amber-200">No self-referrals.</strong> Buying through your own link voids the commission and may close your account.</li>
              <li><strong className="text-amber-200">No paid search bidding</strong> on our brand keywords ("Marvex Studio", "Marvex Studio studio", "mind mapper studio", combinations of these). You can bid on generic terms ("PDF mind map", "AI mind mapping").</li>
              <li><strong className="text-amber-200">No coupon-code sites or cashback farms.</strong> Affiliates must add value through content, not just intercept clicks.</li>
              <li><strong className="text-amber-200">No incentivised clicks.</strong> "Click here, get free X" arrangements aren&apos;t allowed.</li>
              <li><strong className="text-amber-200">FTC compliance.</strong> US-facing content must disclose the affiliate relationship clearly (e.g. "I get a small commission if you sign up — costs you nothing extra").</li>
              <li><strong className="text-amber-200">No coupon stacking.</strong> Affiliate links don&apos;t combine with other promotional codes.</li>
            </ul>
          </Block>

          <Block n="6" title="Termination">
            We can terminate any affiliate account for fraud, brand abuse, repeated
            policy breaches, or — in extreme cases — at our discretion. Pending
            commissions earned in good faith before termination still pay out per the
            normal hold + minimum schedule. Commissions tied to fraudulent activity
            are forfeited.
          </Block>

          <Block n="7" title="Changes to these terms">
            We&apos;ll email all active affiliates at least <strong className="text-white">30 days</strong>{" "}
            before any material change (rates, hold period, cookie window, payout cap).
            Minor wording cleanups happen silently with the &quot;Last updated&quot; date
            bumping at the top of this panel.
          </Block>

          <div className="mt-2 pt-3 border-t border-white/5 mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
            Questions →{" "}
            <a className="text-cyan-300 hover:underline" href="mailto:hello@marvex.app">
              hello@marvex.app
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

const KeyStat = ({ icon: Icon, label, value }) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5">
    <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#7a87ad] flex items-center gap-1.5">
      <Icon size={10} /> {label}
    </div>
    <div className="text-[15px] font-semibold text-white mt-0.5">{value}</div>
  </div>
);

const Block = ({ n, title, children }) => (
  <div>
    <div className="flex items-baseline gap-2 mb-1.5">
      <span className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">{n}</span>
      <h4 className="text-[13.5px] font-semibold text-white">{title}</h4>
    </div>
    <div className="text-[12.5px] text-[#9aaad0] leading-relaxed">{children}</div>
  </div>
);

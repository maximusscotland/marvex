import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Copy, ExternalLink, ArrowLeft, BarChart3, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * AdminMarketingDashboards — one-page launchpad for the PostHog
 * dashboard preset that ships with Marvex. Lets the founder:
 *   1. Download the JSON dashboard spec
 *   2. Copy it to clipboard for paste-into-PostHog
 *   3. See the exact PostHog import flow (3 clicks)
 *   4. Fall back to a manual insight-by-insight setup if the JSON
 *      import fails (PostHog versioning sometimes breaks imports).
 *
 * Lives behind /admin/marketing-dashboards so it's keyholder-only.
 */
export default function AdminMarketingDashboards() {
  const [copied, setCopied] = useState(false);
  const jsonUrl = "/marketing/posthog-dashboard.json";

  const copy = async () => {
    try {
      const res = await fetch(jsonUrl);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Dashboard JSON copied to clipboard");
      setTimeout(() => setCopied(false), 2400);
    } catch {
      toast.error("Copy failed — use the Download button instead");
    }
  };

  return (
    <div data-testid="admin-marketing-page" className="min-h-screen bg-[#03040a] text-white py-8 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/"
          data-testid="admin-marketing-back"
          className="mono text-[11px] uppercase tracking-[0.22em] text-[#7a87ad] hover:text-cyan-300 inline-flex items-center gap-1.5 mb-8"
        >
          <ArrowLeft size={12} /> Back to Marvex
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <BarChart3 size={22} className="text-cyan-300" />
          <h1 className="text-3xl font-semibold">Marketing dashboards</h1>
        </div>
        <p className="text-[#9aaad0] max-w-2xl mb-8">
          One-click PostHog dashboard preset. Imports a 6-tile board showing
          conversion funnel + revenue + drop-off, all split by{" "}
          <code className="text-cyan-200 bg-cyan-500/10 px-1.5 py-0.5 rounded">utm_source</code>{" "}
          so you immediately see which channel is paying off.
        </p>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-3 gap-3 mb-10">
          <a
            data-testid="admin-marketing-download"
            href={jsonUrl}
            download="marvex-posthog-dashboard.json"
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.15] hover:border-cyan-400/70 transition px-4 py-4 flex flex-col items-start gap-2"
          >
            <Download size={18} className="text-cyan-300" />
            <div>
              <div className="text-[14px] font-semibold text-white">Download JSON</div>
              <div className="text-[12px] text-[#9aaad0]">marvex-posthog-dashboard.json</div>
            </div>
          </a>
          <button
            type="button"
            data-testid="admin-marketing-copy"
            onClick={copy}
            className="rounded-xl border border-violet-400/40 bg-violet-500/[0.06] hover:bg-violet-500/[0.15] hover:border-violet-400/70 transition px-4 py-4 flex flex-col items-start gap-2 text-left"
          >
            {copied ? <Check size={18} className="text-emerald-300" /> : <Copy size={18} className="text-violet-300" />}
            <div>
              <div className="text-[14px] font-semibold text-white">{copied ? "Copied!" : "Copy to clipboard"}</div>
              <div className="text-[12px] text-[#9aaad0]">Paste straight into PostHog</div>
            </div>
          </button>
          <a
            data-testid="admin-marketing-posthog"
            href="https://app.posthog.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/25 transition px-4 py-4 flex flex-col items-start gap-2"
          >
            <ExternalLink size={18} className="text-cyan-300" />
            <div>
              <div className="text-[14px] font-semibold text-white">Open PostHog</div>
              <div className="text-[12px] text-[#9aaad0]">app.posthog.com/dashboard</div>
            </div>
          </a>
        </div>

        {/* Import steps */}
        <section
          data-testid="admin-marketing-steps"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-cyan-300" />
            <h2 className="text-[15px] font-semibold text-white">
              How to import (60 seconds)
            </h2>
          </div>
          <ol className="space-y-3 text-[14px] text-[#cfdaf3]">
            <Step n={1}>
              Click <strong className="text-cyan-300">Download JSON</strong> above (or copy to
              clipboard if your PostHog has a paste-in option).
            </Step>
            <Step n={2}>
              In PostHog, open <strong>Dashboards → New Dashboard</strong>. Pick{" "}
              <em>"Start from template"</em> → <em>"Import from JSON"</em> (some
              versions label this <em>"Restore from JSON"</em> under the ⋯ menu).
            </Step>
            <Step n={3}>
              Drop in the file (or paste the JSON). Save. The 6 tiles auto-build
              against your existing events — no manual SQL needed.
            </Step>
            <Step n={4}>
              Pin the dashboard to your sidebar. Done.
            </Step>
          </ol>
          <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-4 py-3 text-[12.5px] text-amber-100">
            <strong>If JSON import isn&apos;t available in your PostHog plan:</strong>{" "}
            scroll down to the <strong>Manual setup</strong> section — each tile
            is reproducible with one click in PostHog&apos;s insight builder.
          </div>
        </section>

        {/* What's inside */}
        <section
          data-testid="admin-marketing-tiles"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-8"
        >
          <h2 className="text-[15px] font-semibold text-white mb-4">What&apos;s inside the dashboard</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Tile title="① Acquisition Funnel — by Channel" desc="Stage drop-off split by utm_source. Steepest slope = biggest leak." />
            <Tile title="② Pricing Page Views — by Channel" desc="Top-of-funnel volume per channel. Spot high-traffic / low-convert channels." />
            <Tile title="③ Paid Conversions — by Channel" desc="checkout_completed grouped by utm_source. Your winners and losers." />
            <Tile title="④ Revenue Mix — by Plan" desc="Lite / Pro Monthly / Pro Annual / Lifetime share, weekly." />
            <Tile title="⑤ Drop-off Sniper" desc="Cancelled vs stuck vs failed — diagnose payment pipeline issues fast." />
            <Tile title="⑥ Upgrade Dialog Funnel" desc="In-app upgrade flow conversion. Separate from /pricing checkouts." />
          </div>
        </section>

        {/* Manual fallback */}
        <section
          data-testid="admin-marketing-manual"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
        >
          <h2 className="text-[15px] font-semibold text-white mb-4">
            Manual setup (fallback)
          </h2>
          <p className="text-[13px] text-[#9aaad0] mb-4">
            Rebuild each tile by hand in PostHog → New Insight → Funnel or
            Trends. Settings to use:
          </p>
          <div className="space-y-3 text-[13px]">
            <Manual
              label="Funnel — by channel"
              steps={["pricing_view", "pricing_cta_clicked", "checkout_started", "checkout_completed"]}
              breakdown="utm_source"
              window="7 days"
            />
            <Manual
              label="Upgrade dialog funnel"
              steps={["upgrade_dialog_view", "upgrade_plan_selected", "checkout_started", "checkout_completed"]}
              breakdown="lite_visible"
              window="3 days"
            />
            <Manual
              label="Revenue by plan"
              steps={["checkout_completed"]}
              breakdown="plan"
              chart="Bar / Line"
            />
            <Manual
              label="Drop-off sniper"
              steps={["checkout_cancelled", "checkout_stuck", "checkout_failed"]}
              chart="Line (overlay)"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

const Step = ({ n, children }) => (
  <li className="flex gap-3 items-start">
    <span className="mono text-[10px] uppercase tracking-[0.18em] w-6 h-6 rounded-full border border-cyan-400/40 bg-cyan-500/10 grid place-items-center text-cyan-300 shrink-0">
      {n}
    </span>
    <span>{children}</span>
  </li>
);

const Tile = ({ title, desc }) => (
  <div className="rounded-lg border border-white/10 bg-[#0a0f24] px-3.5 py-3">
    <div className="text-[13px] font-semibold text-white mb-1">{title}</div>
    <div className="text-[12px] text-[#9aaad0] leading-relaxed">{desc}</div>
  </div>
);

const Manual = ({ label, steps, breakdown, window, chart }) => (
  <div className="rounded-lg border border-white/10 bg-[#0a0f24] px-3.5 py-3">
    <div className="text-[13px] font-semibold text-white mb-1.5">{label}</div>
    <div className="flex flex-wrap gap-1.5 mb-1.5">
      {steps.map((s, i) => (
        <span key={s} className="mono text-[10.5px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-400/30 text-cyan-200">
          {i + 1}. {s}
        </span>
      ))}
    </div>
    <div className="text-[11.5px] text-[#7a87ad] flex flex-wrap gap-x-4">
      {breakdown && <span>Breakdown: <code className="text-cyan-200">{breakdown}</code></span>}
      {window && <span>Window: {window}</span>}
      {chart && <span>Chart: {chart}</span>}
    </div>
  </div>
);

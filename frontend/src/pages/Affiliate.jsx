import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Sparkles, TrendingUp, MousePointerClick, Coins, Calendar, CheckCircle2, Clock, ArrowLeft, AlertCircle, ImageDown, Twitter } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { renderAffiliateShareImage } from "@/lib/shareImage";
import AffiliateTermsPanel from "@/components/AffiliateTermsPanel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtUsd = (cents) => {
  if (typeof cents !== "number") return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
};

const TIER_META = {
  founder:    { label: "Founder",       rate: "25%", color: "#ffd166", glow: "rgba(255,209,102,0.45)" },
  lifetime:   { label: "Pro Lifetime",  rate: "17%", color: "#ff6ad5", glow: "rgba(255,106,213,0.45)" },
  subscriber: { label: "Pro Subscriber",rate:  "5%", color: "#00f0ff", glow: "rgba(0,240,255,0.45)" },
};

export default function Affiliate() {
  const { user, signIn } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Share-image studio state — open the modal, type a custom headline, render
  // a 1200×630 PNG with the affiliate's link baked in. Pure client-side.
  const [shareOpen, setShareOpen] = useState(false);
  const [headline, setHeadline] = useState(
    "I just made a mind-map of my whole research backlog in 60 seconds.",
  );
  const [imgUrl, setImgUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await axios.get(`${API}/affiliate/me`, { withCredentials: true });
        if (!cancelled) setData(r.data);
      } catch (e) {
        if (!cancelled) {
          const status = e?.response?.status;
          const msg = e?.response?.data?.detail || e.message || "Could not load";
          setError({ status, msg });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const copyLink = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success("Link copied — paste it anywhere");
    } catch {
      toast.error("Couldn't copy — select & copy manually");
    }
  };

  // Re-render the share image whenever the modal opens, the headline changes,
  // or the user/data finishes loading.
  useEffect(() => {
    if (!shareOpen || !data) return;
    try {
      const url = renderAffiliateShareImage({
        name: user?.name || "A Marvex Studio member",
        code: data.code,
        link: data.link,
        headline,
        accent: data.tier === "lifetime" ? "fuchsia" : "cyan",
      });
      setImgUrl(url);
    } catch (e) {
      console.error("share image render failed", e);
    }
  }, [shareOpen, headline, data, user?.name]);

  const downloadImage = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `mind-mapper-${data?.code || "share"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Image saved");
  };

  const tweetIt = () => {
    if (!data?.link) return;
    const text = `${headline}\n\nTry marvex.app — first invoice 25% off through my link:`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(data.link)}`;
    window.open(url, "_blank", "noopener,width=550,height=420");
  };

  return (
    <div className="min-h-screen cosmic-bg text-white">
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link to="/" className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200 inline-flex items-center gap-1.5" data-testid="affiliate-back">
          <ArrowLeft size={12} /> marvex.app
        </Link>
        <Link to="/library" className="text-[12px] text-[#9aaad0] hover:text-white">Open library →</Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-12 pt-6 pb-20" data-testid="affiliate-page">
        <div className="mb-10">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={11} /> Affiliate program
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Earn while you map.</h1>
          <p className="text-[15px] text-[#a4b4d8] max-w-2xl leading-relaxed">
            Share your link. Friends get 25% off their first invoice. You earn a commission on every Pro
            purchase that comes through it. We pay quarterly via Wise or PayPal — no minimum.
          </p>
        </div>

        {loading && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-[#9aaad0]" data-testid="affiliate-loading">Loading…</div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-8" data-testid="affiliate-gated">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-300 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">
                  {error.status === 401 ? "Sign in to view your affiliate link" : "Pro members only"}
                </h3>
                <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-4">
                  {error.status === 401
                    ? "The affiliate program lives behind your account so we can attribute commissions correctly."
                    : (error.msg || "Upgrade to Pro to unlock your referral link and start earning.")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {error.status === 401 ? (
                    <button
                      onClick={signIn}
                      data-testid="affiliate-signin-btn"
                      className="px-4 py-2 rounded-lg text-[13px] font-medium bg-white text-[#03060f] hover:bg-[#cfdaf3]"
                    >
                      Sign in with Google
                    </button>
                  ) : (
                    <Link
                      to="/pricing"
                      data-testid="affiliate-upgrade-btn"
                      className="px-4 py-2 rounded-lg text-[13px] font-medium bg-cyan-500 hover:bg-cyan-400 text-[#03060f]"
                    >
                      See Pro plans →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Tier banner + share link */}
            <div
              className="rounded-2xl border p-6 sm:p-7 mb-6"
              data-testid="affiliate-tier-card"
              style={{
                background: `linear-gradient(135deg, ${(TIER_META[data.tier] || TIER_META.subscriber).glow} 0%, transparent 60%)`,
                borderColor: (TIER_META[data.tier] || TIER_META.subscriber).color + "55",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <div className="mono text-[10px] uppercase tracking-[0.22em] text-white/70 mb-1">Your tier</div>
                  <div className="text-2xl font-semibold" style={{ color: (TIER_META[data.tier] || {}).color }}>
                    {(TIER_META[data.tier] || TIER_META.subscriber).label}
                  </div>
                  <div className="mono text-[11px] uppercase tracking-[0.18em] text-white/60 mt-1">
                    {(TIER_META[data.tier] || TIER_META.subscriber).rate} commission
                    {data.tier === "subscriber" && (
                      <> · +1 month/term per referral, capped at {data.rules.bonus_month_cap}/yr</>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono text-[10px] uppercase tracking-[0.22em] text-white/60 mb-1">Referee gets</div>
                  <div className="text-lg font-semibold text-white">25% off first invoice</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  data-testid="affiliate-link-input"
                  readOnly
                  value={data.link}
                  onClick={(e) => e.target.select()}
                  className="flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-cyan-200 outline-none focus:border-cyan-400/60 truncate font-mono"
                />
                <button
                  data-testid="affiliate-copy-btn"
                  onClick={copyLink}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-cyan-500 hover:bg-cyan-400 text-[#03060f] transition"
                >
                  <Copy size={13} /> Copy link
                </button>
                <button
                  data-testid="affiliate-share-image-btn"
                  onClick={() => setShareOpen(true)}
                  title="Generate a 1200×630 cosmic share image with your link baked in — perfect for X / LinkedIn drops"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium border border-fuchsia-400/40 text-fuchsia-200 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.15] hover:border-fuchsia-400/70 transition"
                >
                  <ImageDown size={13} /> Share image
                </button>
                <Link
                  data-testid="affiliate-resources-btn"
                  to="/affiliate/resources"
                  title="Drop-in banners, ready-to-paste copy, and a competitor comparison table — your full marketing kit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium border border-cyan-400/40 text-cyan-200 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.15] hover:border-cyan-400/70 transition"
                >
                  <Sparkles size={13} /> Marketing kit
                </Link>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <Stat icon={MousePointerClick} label="Clicks" value={data.stats.clicks.toLocaleString()} testid="affiliate-stat-clicks" />
              <Stat icon={TrendingUp} label="Referrals" value={data.stats.total_referrals.toLocaleString()} testid="affiliate-stat-refs" />
              <Stat icon={Coins} label="Pending" value={fmtUsd(data.stats.pending_commission_cents)} testid="affiliate-stat-pending" highlight />
              <Stat icon={CheckCircle2} label="Paid" value={fmtUsd(data.stats.paid_commission_cents)} testid="affiliate-stat-paid" />
            </div>

            {data.tier === "subscriber" && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-8 flex items-center gap-3" data-testid="affiliate-bonus-card">
                <Calendar size={16} className="text-cyan-300 shrink-0" />
                <div className="text-[13px] text-[#cfdaf3] flex-1">
                  <strong className="text-white">{data.stats.bonus_months_used}</strong> of{" "}
                  <strong className="text-white">{data.rules.bonus_month_cap}</strong> bonus months used in the last 12 months —{" "}
                  <strong className="text-cyan-300">{data.stats.bonus_months_remaining} remaining</strong>.
                  Each successful referral extends your subscription by 1 month, automatically.
                </div>
              </div>
            )}

            {/* Recent activity */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" data-testid="affiliate-activity">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Recent referrals</h3>
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/50">{data.recent.length} of last 50</span>
              </div>
              {data.recent.length === 0 ? (
                <div className="px-5 py-12 text-center text-[#7a87ad] text-[13px]" data-testid="affiliate-empty">
                  No referrals yet. Share your link — the cosmos awaits.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="bg-white/[0.02] text-[#7a87ad]">
                    <tr>
                      <th className="text-left font-normal mono text-[10px] uppercase tracking-[0.18em] px-5 py-2">Date</th>
                      <th className="text-left font-normal mono text-[10px] uppercase tracking-[0.18em] px-5 py-2">Friend</th>
                      <th className="text-left font-normal mono text-[10px] uppercase tracking-[0.18em] px-5 py-2">Plan</th>
                      <th className="text-left font-normal mono text-[10px] uppercase tracking-[0.18em] px-5 py-2">Inv #</th>
                      <th className="text-right font-normal mono text-[10px] uppercase tracking-[0.18em] px-5 py-2">Earned</th>
                      <th className="text-right font-normal mono text-[10px] uppercase tracking-[0.18em] px-5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((e, i) => (
                      <tr key={`${e.created_at}-${i}`} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="px-5 py-2.5 text-[#cfdaf3]">{fmtDate(e.created_at)}</td>
                        <td className="px-5 py-2.5 text-[#9aaad0] font-mono text-[12px]">{e.referee_email_masked}</td>
                        <td className="px-5 py-2.5 text-[#cfdaf3] capitalize">{e.referee_plan}</td>
                        <td className="px-5 py-2.5 text-[#7a87ad]">#{e.invoice_number}</td>
                        <td className="px-5 py-2.5 text-right text-cyan-200 font-medium">{fmtUsd(e.commission_cents)}</td>
                        <td className="px-5 py-2.5 text-right">
                          {e.payout_status === "paid" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300 text-[12px]"><CheckCircle2 size={11} /> Paid</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-300 text-[12px]"><Clock size={11} /> Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <p className="mt-6 text-[12px] text-[#7a87ad] leading-relaxed">
              Quick summary: payouts on the 28th, $50 minimum, 30-day hold for refund safety,
              45-day cookie window. Wise (preferred) or PayPal — email{" "}
              <a href="mailto:hello@marvex.app" className="text-cyan-300 hover:underline">
                hello@marvex.app
              </a>{" "}
              before your first sweep with your preferred method. Self-referrals don&apos;t
              count. Full terms below.
            </p>

            <div className="mt-6">
              <AffiliateTermsPanel />
            </div>
          </>
        )}
      </main>

      {/* Share-image generator modal — 1200×630 PNG built entirely in <canvas>,
          downloads instantly, no server round-trip.  Affiliate writes a custom
          headline; we bake their link into the image. */}
      {shareOpen && data && (
        <div
          data-testid="affiliate-share-modal"
          className="fixed inset-0 z-[70] grid place-items-center px-4 py-6"
          style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShareOpen(false); }}
        >
          <div
            className="w-full max-w-3xl glass-panel rounded-2xl p-6 fade-up"
            style={{ borderColor: "rgba(255,106,213,0.32)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-1 inline-flex items-center gap-1.5">
                  <ImageDown size={11} /> Share image studio
                </div>
                <h3 className="text-lg font-semibold text-white">Make a quote-graphic with your link</h3>
                <p className="text-[12px] text-[#7a87ad] mt-1">1200 × 630 — pastes cleanly into X, LinkedIn, Bluesky, Threads.</p>
              </div>
              <button
                data-testid="affiliate-share-close"
                onClick={() => setShareOpen(false)}
                className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
              >
                <ArrowLeft size={16} />
              </button>
            </div>

            <label className="block">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-[#7a87ad]">Your one-liner</span>
              <textarea
                data-testid="affiliate-share-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value.slice(0, 220))}
                rows={2}
                className="mt-1.5 w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-fuchsia-400/60 resize-none"
                placeholder="What did marvex.app unlock for you?"
              />
              <span className="mono text-[10px] text-[#566187]">{headline.length} / 220 — keep it under 90 chars for tightest layout</span>
            </label>

            <div
              className="mt-4 rounded-lg overflow-hidden border border-white/10 bg-[#03040a]"
              data-testid="affiliate-share-preview-wrap"
            >
              {imgUrl ? (
                <img
                  data-testid="affiliate-share-preview"
                  src={imgUrl}
                  alt="Marvex Studio affiliate share card — refer friends to the AI mind mapping app"
                  className="w-full h-auto block"
                  style={{ aspectRatio: "1200 / 630" }}
                />
              ) : (
                <div className="aspect-[1200/630] grid place-items-center text-[#7a87ad] text-[12px]">Rendering…</div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                data-testid="affiliate-share-download"
                onClick={downloadImage}
                disabled={!imgUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-fuchsia-500 hover:bg-fuchsia-400 text-[#03060f] disabled:opacity-50 transition"
              >
                <ImageDown size={13} /> Download PNG
              </button>
              <button
                data-testid="affiliate-share-tweet"
                onClick={tweetIt}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 hover:border-cyan-400/70 transition"
              >
                <Twitter size={13} /> Draft a post
              </button>
              <span className="ml-auto text-[11px] text-[#7a87ad]">Tip: post the image, paste your link as the first reply for max reach.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({ icon: Icon, label, value, testid, highlight }) => (
  <div
    data-testid={testid}
    className={`rounded-xl border p-4 ${highlight ? "border-cyan-400/30 bg-cyan-500/[0.04]" : "border-white/10 bg-white/[0.02]"}`}
  >
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon size={12} className={highlight ? "text-cyan-300" : "text-[#7a87ad]"} />
      <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad]">{label}</span>
    </div>
    <div className={`text-xl font-semibold ${highlight ? "text-cyan-200" : "text-white"}`}>{value}</div>
  </div>
);

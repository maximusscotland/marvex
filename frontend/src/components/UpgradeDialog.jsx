import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/posthog";
import { useExperiment } from "@/lib/featureFlags";
import { getRef } from "@/lib/referral";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PLANS = [
  {
    id: "lite",
    label: "Pro Lite",
    price: "$9",
    suffix: "/mo",
    sub: "200-node cap · single-target Cloud Save · 7-day trial",
    badge: "ENTRY",
  },
  {
    id: "monthly",
    label: "Pro Monthly",
    price: "$15",
    suffix: "/mo",
    sub: "Cancel anytime · 7-day free trial",
    badge: null,
  },
  {
    id: "annual",
    label: "Pro Annual",
    price: "$150",
    suffix: "/yr",
    sub: "Save 17% · 7-day free trial",
    badge: "POPULAR",
  },
  {
    id: "lifetime",
    label: "Pro Lifetime",
    price: "$200",
    suffix: " once",
    sub: "Pay once, yours forever",
    badge: "BEST VALUE",
  },
];

const PERKS = [
  "Bring your own AI key — zero quota limits",
  "Unlimited mind-map size (free users cap at 30 map elements)",
  "Cloud Save to Google Drive · Dropbox · Zotero",
  "Cross-device sync with Undo history",
  "Premium shapes, fonts & colour packs",
  "Custom affiliate IDs on outbound book links",
  "Priority email support",
];

export default function UpgradeDialog({ open, onClose }) {
  const { user, signIn } = useAuth();
  const [plan, setPlan] = useState("annual");
  const [busy, setBusy] = useState(false);
  const [availablePlans, setAvailablePlans] = useState(["monthly", "annual", "lifetime"]);
  const [founders, setFounders] = useState({ limit: 50, taken: 0, remaining: 50 });
  // A/B experiment shared with /pricing — same flag, same bucketing.
  // Default TRUE so Lite ships when the flag isn't yet defined in PostHog.
  const liteVisible = useExperiment("lite_tier_visible", true);

  // Close on Escape for a11y parity with native <dialog>.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Ask the backend which plans to surface. In live mode without a configured
  // Annual price ID, this will return ["monthly"] only.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    axios.get(`${API}/billing/plans`).then((r) => {
      if (cancelled) return;
      const avail = r.data?.available || ["monthly", "annual"];
      setAvailablePlans(avail);
      if (r.data?.founders) setFounders(r.data.founders);
      // If the currently-selected plan is not available, fall back to the
      // recommended tier ("annual" if available, otherwise first available).
      // We never auto-select Lite as the default — Annual is the conversion-
      // optimised choice and Lite should require an explicit click.
      if (!avail.includes(plan)) {
        const preferred = ["annual", "monthly", "lifetime", "lite"].find((id) => avail.includes(id));
        setPlan(preferred || avail[0] || "monthly");
      }
    }).catch(() => { /* keep defaults — checkout will surface errors if any */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const startCheckout = async () => {
    if (!user) {
      // Need to sign in first
      signIn();
      return;
    }
    setBusy(true);
    // `lite_visible` lands on every checkout_started event so the
    // experiment dashboard can compute conversion rates per variant.
    track("checkout_started", { plan, lite_visible: liteVisible });
    try {
      const r = await axios.post(
        `${API}/billing/create-checkout`,
        {
          plan,
          origin_url: window.location.origin,
          // Affiliate referral attribution — captured from ?ref= on landing
          // and persisted for 90 days. Backend validates the code and applies
          // a 25% first-invoice discount + records the referrer for payouts.
          ref_code: getRef() || "",
        },
        { withCredentials: true }
      );
      if (r.data?.url) {
        window.location.href = r.data.url;
      } else {
        toast.error("Could not start checkout");
        setBusy(false);
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || "Checkout failed";
      track("checkout_failed", { plan, error: typeof msg === "string" ? msg : "unknown" });
      toast.error(typeof msg === "string" ? msg : "Checkout failed");
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="upgrade-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-3xl glass-panel rounded-2xl p-7 fade-up"
        style={{ borderColor: "rgba(0,240,255,0.25)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">
              Upgrade
            </div>
            <h3 id="upgrade-dialog-title" className="text-2xl font-bold text-white">Unlock <span className="gradient-text">Pro</span></h3>
          </div>
          <button onClick={onClose} className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5" data-testid="upgrade-dialog-close">
            <X size={18} />
          </button>
        </div>

        {/* Plan selector — 4 tiers when the `lite_tier_visible` experiment
            variant is ON, else 3 (control group). Grid count adapts based
            on the FILTERED set, so the cards always fill the row instead
            of leaving an empty slot when Lite is suppressed. */}
        {(() => {
          const visible = PLANS.filter(
            (p) => availablePlans.includes(p.id) && (liteVisible || p.id !== "lite")
          );
          const cols = visible.length >= 4 ? "grid-cols-2 md:grid-cols-4"
                     : visible.length === 3 ? "grid-cols-1 md:grid-cols-3"
                     : visible.length === 2 ? "grid-cols-1 md:grid-cols-2"
                     : "grid-cols-1";
          return (
            <div
              className={`grid gap-3 mb-5 ${cols}`}
              data-testid="upgrade-plans"
              data-lite-visible={liteVisible ? "1" : "0"}
            >
              {visible.map((p) => {
                const selected = plan === p.id;
                const showFounder = p.id === "lifetime" && founders.remaining > 0;
                return (
              <button
                key={p.id}
                data-testid={`upgrade-plan-${p.id}`}
                onClick={() => setPlan(p.id)}
                className={`text-left rounded-xl border p-4 transition-all relative ${
                  selected
                    ? p.id === "lite"
                      ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_18px_rgba(16,185,129,0.25)]"
                      : "border-cyan-400 bg-cyan-400/10 shadow-[0_0_18px_rgba(0,240,255,0.25)]"
                    : "border-white/10 bg-white/[0.02] hover:border-cyan-400/40"
                }`}
              >
                {showFounder ? (
                  <span
                    data-testid="upgrade-founder-badge"
                    className="absolute -top-2 right-3 mono text-[9px] uppercase tracking-[0.18em] px-2 py-[3px] rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/50"
                  >
                    VIP · {founders.remaining}/{founders.limit} LEFT
                  </span>
                ) : p.badge && (
                  <span className={`absolute -top-2 right-3 mono text-[9px] uppercase tracking-[0.18em] px-2 py-[3px] rounded-full border ${
                    p.id === "lite"
                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/50"
                      : "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40"
                  }`}>
                    {p.badge}
                  </span>
                )}
                <div className="text-[12px] mono uppercase tracking-[0.22em] text-cyan-300/80 mb-1">{p.label}</div>
                <div className="text-3xl font-extrabold text-white">
                  {p.price}<span className="text-base text-[#9aaad0] font-normal">{p.suffix}</span>
                </div>
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mt-2">{p.sub}</div>
                {showFounder && (
                  <div className="mt-2 text-[11px] text-amber-200/90 leading-snug">
                    First 50 lifetime buyers get Founder status — permanent gold badge + early access to every new feature.
                  </div>
                )}
              </button>
            );
          })}
        </div>
          );
        })()}

        {/* Perks */}
        <ul className="space-y-2 mb-6">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5 text-[14px] text-[#cfdaf3]">
              <Check size={16} className="text-cyan-300 shrink-0 mt-[2px]" />
              {perk}
            </li>
          ))}
        </ul>

        {/* Referral discount badge — appears when the visitor arrived with
            ?ref=XYZ. Reassures them their friend's link will save them money. */}
        {getRef() && (
          <div
            data-testid="upgrade-ref-banner"
            className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/[0.08] px-4 py-2.5 mb-4 flex items-center gap-2.5"
          >
            <Sparkles size={14} className="text-fuchsia-300 shrink-0" />
            <div className="text-[12px] text-fuchsia-100 leading-snug">
              <strong>25% off your first invoice</strong> — applied at Stripe checkout. Thanks to whoever sent you here.
            </div>
          </div>
        )}

        <button
          data-testid="upgrade-checkout"
          onClick={startCheckout}
          disabled={busy}
          className="cta-pill w-full justify-center text-[15px] py-3"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {!user ? "Sign in to start trial" : busy ? "Opening checkout…" : "Start 7-day free trial"}
        </button>

        <div className="mt-3 text-center mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
          Stripe handles billing · Cancel anytime in Settings
        </div>
      </div>
    </div>
  );
}

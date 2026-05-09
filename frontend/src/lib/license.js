/**
 * useLicense — derives the active subscription state from the existing
 * useAuth() user object. No extra network call: /api/auth/me already
 * carries everything we need.
 *
 * The returned shape is:
 *   {
 *     tier:           'lifetime' | 'annual' | 'monthly' | 'free',
 *     active:         boolean,             // can use Pro features now
 *     expired:        boolean,             // had Pro, ran out
 *     founder:        boolean,
 *     founderNumber:  number | null,
 *     readOnly:       boolean,             // == expired (option b)
 *     blocksAction:   (kind: string) => boolean,
 *     addons:         { premium_uk_law: bool, ... },  // one-off unlocks
 *     hasAddon:       (key: string) => boolean,
 *   }
 */
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { isTesterUnlocked } from "@/lib/testerAccess";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Synthetic license object returned for the `?fam67` tester bypass.
// Mirrors what a fully-paid Pro / lifetime user would see so every
// downstream `license.active` / `license.isProOnly` check passes,
// without touching the real subscription state on the user record.
const TESTER_LICENSE = {
  loading: false,
  tier: "tester",
  active: true,
  expired: false,
  signedOut: false,
  isLite: false,
  isProOnly: true,
  nodeCap: Infinity,
  founder: false,
  founderNumber: null,
  readOnly: false,
  pastDue: false,
  daysUntilRenewal: null,
  renewsSoon: false,
  cancelAtPeriodEnd: false,
  periodEnd: "",
  addons: {},
  hasAddon: () => false,
  blocksAction: () => false,
};

export const useLicense = () => {
  const { user, loading } = useAuth();

  return useMemo(() => {
    // `?fam67` tester bypass — invisible full-access for family / testers.
    // Checked first so it overrides whatever subscription state the
    // (possibly logged-out) user actually has.
    if (isTesterUnlocked()) return TESTER_LICENSE;

    if (loading) {
      return {
        loading: true,
        tier: "free",
        active: false,
        expired: false,
        founder: false,
        founderNumber: null,
        readOnly: false,
        signedOut: false,
        isLite: false,
        isProOnly: false,
        nodeCap: 30,
        pastDue: false,
        daysUntilRenewal: null,
        renewsSoon: false,
        cancelAtPeriodEnd: false,
        periodEnd: "",
        addons: {},
        hasAddon: () => false,
        blocksAction: () => false,
      };
    }

    const signedOut = !user;
    const status = user?.subscription_status || "free";
    const planRaw = (user?.subscription_plan || "").toLowerCase();
    const lifetime = planRaw === "lifetime";
    const periodEnd = user?.current_period_end || "";
    let active = ACTIVE_STATUSES.has(status);
    if (active && !lifetime && periodEnd) {
      const end = new Date(periodEnd).getTime();
      if (Number.isFinite(end) && end < Date.now()) active = false;
    }
    const expired = !!periodEnd && !active && status !== "free";
    if (lifetime && status !== "canceled") active = true;

    // Stripe goes `active` → `past_due` while it retries a failed card
    // (~7 days of retries). Surfaced separately so the UI can nudge them
    // to update their card BEFORE Stripe marks the sub canceled.
    const pastDue = status === "past_due" || status === "unpaid";

    // Days until renewal. Only meaningful for recurring, active plans —
    // lifetime has no period_end. Returns null if not applicable.
    let daysUntilRenewal = null;
    if (active && !lifetime && periodEnd) {
      const end = new Date(periodEnd).getTime();
      if (Number.isFinite(end)) {
        const ms = end - Date.now();
        daysUntilRenewal = Math.max(0, Math.ceil(ms / 86_400_000));
      }
    }
    const renewsSoon = daysUntilRenewal !== null && daysUntilRenewal <= 3;

    // Users who set Stripe to "cancel at period end" still have `status=active`
    // until `current_period_end`, but `cancel_at_period_end=true`. Surface
    // so we can warn them the plan is about to lapse.
    const cancelAtPeriodEnd = !!user?.cancel_at_period_end;

    const tier = lifetime ? "lifetime" : (planRaw || "free");
    const readOnly = !active;

    // Lite tier ($9/mo) is paid but excluded from Pro-only features
    // (Flowchart Studio, Deep Research, Auto-deepen, Save-to-all-targets,
    // Law Pack add-on purchase, unlimited node cap).  `isLite` is true
    // only for paid Lite subscribers; expired Lite users fall through
    // to the readOnly state and are gated by `blocksAction` like any
    // other expired subscriber.
    const isLite = active && tier === "lite";
    const isProOnly = active && !isLite;
    // Effective node cap: free=30, lite=200, pro/lifetime/founder=Infinity.
    let nodeCap = 30;
    if (isLite) nodeCap = 200;
    else if (isProOnly) nodeCap = Infinity;

    // Addons map: { premium_uk_law: { active, purchased_at, purchased_tier, ... } }.
    // We derive a flat boolean lookup with TIER-AWARE expiry so call-sites
    // can do `hasAddon('premium_uk_law')` and get the same answer the
    // backend's addon_is_active() would return:
    //   - purchased_tier = lifetime → permanent
    //   - purchased_tier = pro plan → only while sub is active
    //   - purchased_tier = free → 365-day grace
    //   - no purchased_tier (legacy row) → treat as pro-tier rules
    const rawAddons = user?.addons || {};
    const addons = {};
    const isAddonStillValid = (v) => {
      if (!v || !v.active) return false;
      const pt = (v.purchased_tier || "").toLowerCase();
      if (pt === "lifetime") return true;
      if (pt === "free") {
        const purchasedAt = Date.parse(v.purchased_at || "");
        if (!Number.isFinite(purchasedAt)) return false;
        return (Date.now() - purchasedAt) < 365 * 86_400_000;
      }
      // Pro-tier or legacy → valid iff parent subscription is currently active.
      return active;
    };
    for (const [k, v] of Object.entries(rawAddons)) {
      addons[k] = isAddonStillValid(v);
    }
    const hasAddon = (key) => !!addons[key];

    const blocksAction = (kind) => {
      if (active) return false;
      return ["new-map", "ai", "cloud", "share", "compile"].includes(kind);
    };

    return {
      loading: false,
      tier,
      active,
      expired,
      signedOut,
      isLite,
      isProOnly,
      nodeCap,
      founder: !!user?.founder,
      founderNumber: user?.founder_number ?? null,
      readOnly,
      pastDue,
      daysUntilRenewal,
      renewsSoon,
      cancelAtPeriodEnd,
      periodEnd,
      addons,
      hasAddon,
      blocksAction,
    };
  }, [user, loading]);
};

/**
 * Standalone helper for non-React utilities (e.g. the keyboard-shortcut
 * dispatcher in MindMapCanvas). Reads the cached pro flag set by the
 * auth provider — same source that affiliates.js uses, so we avoid a
 * second source of truth.
 */
export const isLicenseActive = () => {
  try {
    if (isTesterUnlocked()) return true;
    return localStorage.getItem("mm.proStatus") === "1";
  } catch {
    return false;
  }
};

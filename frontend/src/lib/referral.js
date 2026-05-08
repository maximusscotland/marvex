/**
 * Affiliate referral capture — when a visitor lands on the site with `?ref=XYZ`,
 * we stamp the code into both localStorage AND a cookie so it survives across
 * page navigations and OAuth round-trips. The code is then read at checkout-
 * creation time and sent to the backend so the Stripe metadata picks up the
 * referrer.
 *
 * 90-day attribution window is industry-standard for affiliate programs and
 * roughly matches Stripe's own coupon-redemption tracking. After 90 days the
 * cookie naturally expires.
 */
const KEY = "mindmapper.ref.v1";
const COOKIE = "mm_ref";
const TTL_DAYS = 90;

const setCookie = (name, value, days) => {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    // SameSite=Lax so the cookie survives top-level OAuth redirects (Google
    // sign-in returns via 302 GET — Lax permits the cookie). Path=/ so it's
    // available on every subsequent navigation.
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
  } catch { /* SSR / disabled cookies — ignore */ }
};

const readCookie = (name) => {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
};

const clean = (s) =>
  (s || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);

/**
 * Read `?ref=XYZ` from current URL and persist it. Idempotent — first link wins
 * (we never overwrite an existing referral in localStorage). Call this on
 * mount of every public route (landing, pricing, etc.) to maximize coverage.
 *
 * Also fires a lightweight POST /api/affiliate/track-click so the affiliate
 * dashboard can show clicks-vs-conversions without depending on PostHog.
 */
export const captureRefFromUrl = async (apiBase) => {
  let url;
  try {
    url = new URL(window.location.href);
  } catch {
    return null;
  }
  const fromUrl = clean(url.searchParams.get("ref") || "");
  if (!fromUrl) return getRef();

  // First-touch attribution — don't overwrite an existing code.
  const existing = getRef();
  if (existing && existing !== fromUrl) {
    return existing;
  }
  try { localStorage.setItem(KEY, fromUrl); } catch { /* quota */ }
  setCookie(COOKIE, fromUrl, TTL_DAYS);

  // Beacon to the backend — fire-and-forget. Use fetch with keepalive so it
  // survives a page navigation right after capture (e.g. user clicks "Sign in"
  // immediately).
  if (apiBase && existing !== fromUrl) {
    try {
      await fetch(`${apiBase}/api/affiliate/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          code: fromUrl,
          path: url.pathname,
          referrer: document.referrer || "",
        }),
      });
    } catch { /* offline / blocked — ignore */ }
  }
  return fromUrl;
};

/** Read the currently-attributed referral code (if any). */
export const getRef = () => {
  try {
    const ls = clean(localStorage.getItem(KEY) || "");
    if (ls) return ls;
  } catch { /* ignore */ }
  return clean(readCookie(COOKIE));
};

/** Wipe the referral. Used on logout / explicit "thank you for signing up". */
export const clearRef = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  setCookie(COOKIE, "", -1);
};

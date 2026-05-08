/**
 * PostHog wrapper — single source of truth for product analytics.
 *
 * Why a wrapper, not direct posthog calls everywhere?
 *  - One env-var check (degrades silently if key missing — keeps tests / dev quiet)
 *  - Centralised event names so we don't end up with 'pdfUpload' / 'pdf_upload' / 'PDF Uploaded' chaos
 *  - Easy to swap providers later (Plausible, Mixpanel) without touching call sites
 *
 * Usage:
 *   import { initPosthog, track, identify } from "@/lib/posthog";
 *   initPosthog();                       // once at app boot
 *   track("waitlist_joined", { source: "landing" });
 *   identify(userId, { email });
 */

import posthog from "posthog-js";

const KEY = process.env.REACT_APP_POSTHOG_KEY || "";
const HOST = process.env.REACT_APP_POSTHOG_HOST || "https://eu.i.posthog.com";

let inited = false;

export const initPosthog = () => {
  if (inited || !KEY) return;
  try {
    posthog.init(KEY, {
      api_host: HOST,
      // Capture pageviews on route change (we'll hook RouterListener separately).
      capture_pageview: false,
      // Don't show the toolbar by default — it's distracting in production.
      disable_session_recording: true,
      persistence: "localStorage+cookie",
      // GDPR-friendly: only record what we explicitly send.
      autocapture: false,
    });
    inited = true;
  } catch {
    // Silent — if PostHog is blocked by adblockers we don't want to break the app.
  }
};

export const track = (event, props = {}) => {
  if (!inited) return;
  try { posthog.capture(event, props); } catch { /* swallow */ }
};

export const identify = (id, props = {}) => {
  if (!inited || !id) return;
  try { posthog.identify(id, props); } catch { /* swallow */ }
};

export const reset = () => {
  if (!inited) return;
  try { posthog.reset(); } catch { /* swallow */ }
};

export const trackPageview = (path) => {
  if (!inited) return;
  try { posthog.capture("$pageview", { $current_url: path || window.location.href }); } catch { /* swallow */ }
};

/**
 * Feature flag reader.  Returns the boolean / variant value PostHog
 * resolved for this user.  When PostHog isn't initialised (no key, ad-
 * blocker, etc.) we fall back to the supplied `defaultValue` so the app
 * always renders something sensible.
 *
 * Use for A/B tests where we want a stable, deterministic bucketing
 * keyed off the PostHog distinct_id.  Don't use this for security-
 * sensitive gating — feature flags are client-evaluable and can be
 * toggled by anyone with devtools.
 */
export const getFeatureFlag = (key, defaultValue = false) => {
  if (!inited) return defaultValue;
  try {
    const v = posthog.getFeatureFlag(key);
    return v === undefined ? defaultValue : v;
  } catch {
    return defaultValue;
  }
};

/**
 * Subscribe to feature-flag readiness.  PostHog loads flags
 * asynchronously after init; useFeatureFlag (in /lib/featureFlags.js)
 * uses this to re-render the consumer once flags arrive.
 */
export const onFeatureFlagsLoaded = (cb) => {
  if (!inited) { cb(); return () => {}; }
  try { return posthog.onFeatureFlags(cb); } catch { cb(); return () => {}; }
};

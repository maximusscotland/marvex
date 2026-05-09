/**
 * Tester access — invisible "fam67" full-access bypass for testers and family.
 *
 * URL trigger:  any URL with `?fam67` (case-insensitive on the param name,
 *               value optional). Examples that all activate:
 *                 /pricing?fam67
 *                 /app?Fam67=1
 *                 /timeline?FAM67=true
 * Revoke:       ?fam67=off  (or value=false / 0)
 * Expiry:       365 days from activation. Each fresh ?fam67 visit
 *               refreshes the timestamp.
 * Storage:      localStorage["marvex.tester.unlocked.v1"] = JSON({ ts })
 * Side effects: also sets `mindmapper.unlocked.v1 = "1"` so the existing
 *               AccessGate / MaintenanceMode splash screens auto-pass.
 *
 * Effect when active:
 *   - useLicense() returns active=true, isProOnly=true, tier='tester' so
 *     every Pro-gated UI surface (Timeline Studio, Desktop Download,
 *     unlimited node cap, share/compile, etc.) lets the tester through.
 *   - MaintenanceMode skips the splash.
 *
 * SECURITY NOTE: this is a CLIENT-SIDE bypass — anyone who reads the JS
 * bundle can find the trigger string. It is intended for low-stakes
 * "let my family / a beta tester poke around the live site without
 * paying" use, NOT for gating sensitive content. Real Stripe-paid users
 * are still authenticated server-side via the auth cookie.
 */
const STORAGE_KEY = "marvex.tester.unlocked.v1";
const LEGACY_GATE_KEY = "mindmapper.unlocked.v1"; // shared with AccessGate / MaintenanceMode
const EXPIRY_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
const TRIGGER = "fam67";

const safeRead = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.ts === "number" ? v : null;
  } catch {
    return null;
  }
};

const safeWrite = (obj) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch { /* ignore */ }
};

const safeClear = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
};

/**
 * Returns true iff the tester bypass is currently active.
 * Auto-clears the flag if it has expired.
 */
export const isTesterUnlocked = () => {
  const v = safeRead();
  if (!v) return false;
  if (Date.now() - v.ts > EXPIRY_MS) {
    safeClear();
    return false;
  }
  return true;
};

/**
 * Inspect the current URL for `?fam67` (case-insensitive key, optional
 * value). Activate / refresh / revoke accordingly, then strip the param
 * from the address bar so testers can reload or share the URL without
 * leaking the bypass trigger.
 *
 * Idempotent — safe to call multiple times. Designed to be invoked once
 * at boot from index.js BEFORE React renders, so by the time any gate
 * component reads localStorage the flag is already in place.
 */
export const initTesterAccess = () => {
  if (typeof window === "undefined") return;

  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }

  // Case-insensitive search for the trigger key.
  let foundKey = null;
  for (const k of params.keys()) {
    if (k.toLowerCase() === TRIGGER) {
      foundKey = k;
      break;
    }
  }
  if (!foundKey) return;

  const raw = (params.get(foundKey) || "").toLowerCase().trim();
  const wantsRevoke = raw === "off" || raw === "false" || raw === "0";

  if (wantsRevoke) {
    safeClear();
    // Don't auto-clear the legacy gate key — the user may have unlocked
    // it through the normal access-key flow as well, and we don't want
    // to log them out of that.
  } else {
    safeWrite({ ts: Date.now() });
    // Co-unlock the AccessGate / MaintenanceMode splash so testers can
    // navigate immediately on landing without seeing the password form.
    try { localStorage.setItem(LEGACY_GATE_KEY, "1"); } catch { /* ignore */ }
  }

  // Strip the param so a) the URL is clean for sharing, b) reloads
  // don't keep re-firing this side-effect.
  params.delete(foundKey);
  const qs = params.toString();
  const next =
    window.location.pathname +
    (qs ? `?${qs}` : "") +
    window.location.hash;
  try { window.history.replaceState({}, "", next); } catch { /* ignore */ }
};

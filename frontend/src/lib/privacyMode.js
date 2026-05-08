/**
 * Pure Local Mode — single-toggle privacy switch.
 *
 * When ON:
 *   • Every "leaves the device" UI affordance hides itself
 *     (Cloud Save menu, Share button, AI Analysis, Image Gen, Public Corpus, Waitlist nudges).
 *   • A `🔒 LOCAL ONLY` badge renders next to the brand in the header.
 *   • Maps are still local-first by default — this mode just removes the
 *     temptation / accidental click that would send anything online.
 *
 * Persisted in `localStorage.mm.privacyMode = "on"`.  Reading the value
 * is dirt-cheap (string comparison) so feel free to call `isPrivacyOn()`
 * inside render functions; we don't memoise.
 *
 * Notifies subscribers via the `mm:privacy-mode-changed` window event so
 * components mounted on disparate trees can re-render without prop-drilling
 * through a global Provider.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "mm.privacyMode";

export const isPrivacyOn = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
};

export const setPrivacyOn = (on) => {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, "on");
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* private mode / quota — non-fatal */ }
  // Fire on the window so any component that cares can subscribe via a
  // simple addEventListener — keeps this module dependency-free.
  try {
    window.dispatchEvent(new CustomEvent("mm:privacy-mode-changed", { detail: { on: !!on } }));
  } catch { /* ignore */ }
};

/**
 * React hook — returns the current state and re-renders the caller on
 * every toggle (including toggles from other tabs via the storage event).
 */
export const usePrivacyMode = () => {
  const [on, setOn] = useState(isPrivacyOn);
  useEffect(() => {
    const sync = () => setOn(isPrivacyOn());
    window.addEventListener("mm:privacy-mode-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mm:privacy-mode-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return on;
};

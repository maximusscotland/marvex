import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { captureRefFromUrl } from "@/lib/referral";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

/**
 * ReferralCapture — invisible component that runs once per route change to
 * capture `?ref=XYZ` from the URL, persist it to localStorage + cookie, and
 * fire a click-tracking beacon to the backend.
 *
 * Mounted globally (inside Router) so every public page contributes, even if
 * the user lands on /pricing instead of /. First-touch attribution: once a
 * code is captured, we don't overwrite it for 90 days.
 */
export default function ReferralCapture() {
  const loc = useLocation();
  useEffect(() => {
    // Fire-and-forget — captureRefFromUrl handles its own errors.
    captureRefFromUrl(API_BASE);
  }, [loc.pathname, loc.search]);
  return null;
}

/**
 * apiErrorMessage(e) — normalise any caught axios/fetch error into a
 * single human-readable string, safe to put into React state and
 * render directly.
 *
 * FastAPI's 422 responses return `detail` as an ARRAY of Pydantic
 * error objects (`{type, loc, msg, input, url}`).  Older "raise
 * HTTPException(detail=str|dict)" patterns return strings or dicts.
 * If any of those land in state and React tries to render them
 * directly we get the dreaded
 *   "Objects are not valid as a React child (found: object with
 *    keys {type, loc, msg, input, url})"
 * crash that has shown up in Sentry from `/redeem` (10 May 2026) —
 * and could show up anywhere we use the same `setError(detail)`
 * pattern.  This helper flattens every shape into a string so the
 * crash class is gone for good.
 *
 * Usage:
 *   import { apiErrorMessage } from "@/lib/apiError";
 *   try { … }
 *   catch (e) { setError(apiErrorMessage(e, "Something went wrong")); }
 */
export function apiErrorMessage(e, fallback = "Something went wrong") {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) => (typeof x === "string" ? x : x?.msg || x?.message || ""))
      .filter(Boolean)
      .join("; ") || fallback;
  }
  if (d && typeof d === "object") {
    return d.msg || d.message || JSON.stringify(d);
  }
  if (typeof e?.message === "string") return e.message;
  return fallback;
}

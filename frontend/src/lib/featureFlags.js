/**
 * Lightweight React hooks over the PostHog feature-flag API.
 *
 * `useFeatureFlag(key, default)` returns the current value of a flag and
 * re-renders the consumer when PostHog finishes loading the flag set
 * (which is async — first paint usually has the default value).
 *
 * `useExperiment(key, default)` is the same but also fires a single
 * `$feature_flag_called` event so the value lands in PostHog's
 * experiment-results table.  Use this for A/B variants you want to
 * measure conversion against.
 *
 * Why two hooks instead of one?  Some flags are pure feature toggles
 * (kill-switches, gradual rollouts) where we do NOT want every render
 * to count as an exposure.  Experiments need an explicit exposure
 * event keyed off the user's first encounter with the variant.
 */
import { useEffect, useState } from "react";
import { getFeatureFlag, onFeatureFlagsLoaded, track } from "@/lib/posthog";

export const useFeatureFlag = (key, defaultValue = false) => {
  const [value, setValue] = useState(() => getFeatureFlag(key, defaultValue));
  useEffect(() => {
    // PostHog populates flags asynchronously — re-read once they're in.
    const unsub = onFeatureFlagsLoaded(() => {
      setValue(getFeatureFlag(key, defaultValue));
    });
    return () => { try { unsub && unsub(); } catch { /* swallow */ } };
  }, [key, defaultValue]);
  return value;
};

export const useExperiment = (key, defaultValue = false) => {
  const value = useFeatureFlag(key, defaultValue);
  useEffect(() => {
    if (value === undefined) return;
    // One exposure event per (key, variant) per session — PostHog
    // de-dupes server-side anyway, but this keeps client traffic light.
    const stamp = `__exposed_${key}_${String(value)}`;
    if (typeof window !== "undefined" && !window[stamp]) {
      window[stamp] = true;
      track("$feature_flag_called", {
        $feature_flag: key,
        $feature_flag_response: value,
      });
    }
  }, [key, value]);
  return value;
};

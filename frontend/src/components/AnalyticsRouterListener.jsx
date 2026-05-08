import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { initPosthog, trackPageview } from "@/lib/posthog";

/**
 * AnalyticsRouterListener — initialises PostHog once and emits a `$pageview`
 * event on every route change. Mount once inside <Router>.
 */
export default function AnalyticsRouterListener() {
  const location = useLocation();
  const initedRef = useRef(false);

  useEffect(() => {
    if (!initedRef.current) {
      initPosthog();
      initedRef.current = true;
    }
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}

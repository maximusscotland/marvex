import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll to top of viewport on every route change.
 *
 * React Router's BrowserRouter deliberately preserves scroll position
 * across `<Link>` navigations (consistent with native HTML history),
 * which surprises users — they click "Press" in the footer, URL updates,
 * but they still see the bottom of the old page until they manually
 * scroll up. Fix: reset window scroll to (0, 0) on every pathname change.
 *
 * Mounted once inside <Router> in App.js. Renders nothing.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Use "instant" not "smooth" — users expect a hard reset on route change,
    // animated scroll feels like the page is broken.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

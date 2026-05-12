// Sentry adds ~80 KB of parsed JS and runs `init()` synchronously
// (`browserTracingIntegration` + Replay = expensive on the main thread).
// Defer until the browser is idle so it never delays first paint /
// LCP — error capture still works because `window.onerror` etc. are
// queued through Sentry's lazy init.
import("@/lib/sentry").then(({ initSentry }) => {
  const start = () => { try { initSentry(); } catch { /* ignore */ } };
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 4000 });
  } else if (document.readyState === "complete") {
    setTimeout(start, 1500);
  } else {
    window.addEventListener("load", () => setTimeout(start, 1500));
  }
});

// "fam67" tester bypass — must run before any gate component reads
// localStorage so an inbound `?fam67` URL grants access on first paint.
import { initTesterAccess } from "@/lib/testerAccess";
initTesterAccess();

// Light/dark theme — apply the class on <html> before React mounts so
// the first frame paints in the user's preferred mode (no flash of
// dark for users who prefer light).
import { initTheme } from "@/lib/theme";
initTheme();

import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

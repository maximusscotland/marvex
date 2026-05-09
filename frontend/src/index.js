// Sentry MUST be initialised before App imports so its instrumentation
// is in place by the time any component renders.
import { initSentry } from "@/lib/sentry";
initSentry();

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

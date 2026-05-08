// Sentry MUST be initialised before App imports so its instrumentation
// is in place by the time any component renders.
import { initSentry } from "@/lib/sentry";
initSentry();

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

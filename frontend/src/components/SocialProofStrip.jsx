import React, { useEffect, useState } from "react";
import { Users } from "lucide-react";

/**
 * Compact social-proof strip — sits below the hero CTA buttons.
 *
 * Pulls the real waitlist count from /api/waitlist/count (no fake numbers)
 * and surfaces it as "Joined by N researchers in private preview". When the
 * count is zero or the endpoint fails (e.g. backend cold start) we hide the
 * count gracefully and fall back to the static "Private preview" badge — never
 * a faked number, never an empty space.
 *
 * Stays small (single line on desktop) so it doesn't compete with the hero CTA.
 */
const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const formatCount = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
};

export default function SocialProofStrip() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/waitlist/count`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.count === "number") {
          setCount(data.count);
        }
      })
      .catch(() => { /* offline / cold start — fall through to badge */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      data-testid="landing-social-proof"
      className="fade-up flex items-center justify-center gap-3 mt-6 text-[12px] text-[#9aaad0]"
    >
      <div className="flex items-center -space-x-2">
        {/* Cosmic avatar dots — purely decorative, signals "people use this" */}
        {[
          "from-cyan-400 to-cyan-600",
          "from-violet-400 to-fuchsia-600",
          "from-amber-300 to-amber-500",
          "from-emerald-400 to-cyan-500",
        ].map((g, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-[#03040a] shadow-[0_0_8px_rgba(0,240,255,0.35)]`}
            aria-hidden
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Users size={13} className="text-cyan-300/80" />
        {count !== null && count > 0 ? (
          <span data-testid="landing-social-count">
            Joined by{" "}
            <span className="text-cyan-200 font-semibold tabular-nums">
              {formatCount(count)}
            </span>{" "}
            researchers in private preview
          </span>
        ) : (
          <span className="mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">
            Private preview · be among the first
          </span>
        )}
      </div>
    </div>
  );
}

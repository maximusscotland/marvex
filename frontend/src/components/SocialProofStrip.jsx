import React from "react";
import { Users } from "lucide-react";

/**
 * Compact social-proof strip — sits below the hero CTA buttons.
 *
 * Now renders a "Founder spots still available" badge to reinforce the
 * $200 lifetime tier and create gentle urgency without fake scarcity.
 * Decorative cosmic avatar dots signal "people use this" without
 * claiming a specific count.
 */

export default function SocialProofStrip() {
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
        <span className="mono text-[11px] uppercase tracking-[0.18em] text-cyan-300/80">
          Founder spots still available
        </span>
      </div>
    </div>
  );
}

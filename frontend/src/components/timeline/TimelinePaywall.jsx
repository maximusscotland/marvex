/* eslint-disable react/prop-types */
import React from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, Clock, ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";

/**
 * TimelinePaywall — full-page upgrade panel shown to non-Pro users
 * who try to access TimelineStudio. Same visual language as the
 * desktop-download paywall on /download for consistency.
 */
export default function TimelinePaywall({ tier }) {
  return (
    <div className="min-h-screen cosmic-bg text-white flex flex-col">
      <header className="px-5 py-3 border-b border-white/8 bg-[#03040a]/80 backdrop-blur-md flex items-center gap-3">
        <Link to="/library" className="text-[#9aa7c7] hover:text-cyan-300 transition" data-testid="tl-paywall-back">
          <ArrowLeft size={16} />
        </Link>
        <Logo size={24} />
        <span className="mono text-[10px] uppercase tracking-[0.22em] text-violet-300/90 flex items-center gap-1.5">
          <Clock size={11} /> Timeline · BETA
        </span>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div
          data-testid="timeline-paywall"
          className="max-w-xl w-full rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-500/[0.10] via-fuchsia-500/[0.05] to-cyan-500/[0.05] p-8 shadow-[0_0_60px_rgba(160,140,255,0.15)]"
        >
          <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-violet-300/90 mb-3">
            <Lock size={11} />
            <span>Pro plan required · Beta feature</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Timelines are reserved for Pro
          </h1>
          <p className="text-[14.5px] text-[#cfdaf3] leading-relaxed mb-5">
            Marvex Timelines (currently in <strong className="text-violet-300">public beta</strong>) let you build pannable
            interactive event timelines — from a 100-year history map to a one-month sprint planner — with full calendar
            integration. They unlock at the <strong className="text-cyan-200">Pro tier</strong> ($15/month) and above.
          </p>
          <ul className="space-y-2 text-[13.5px] text-[#cfdaf3] mb-6 pl-1">
            <li className="flex items-start gap-2">
              <Sparkles size={13} className="text-cyan-300 shrink-0 mt-0.5" />
              <span>Pannable canvas with auto-scaling tick marks (decade → year → month → week → day)</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles size={13} className="text-cyan-300 shrink-0 mt-0.5" />
              <span>Quick-add via slash commands (/event, /period, /milestone)</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles size={13} className="text-cyan-300 shrink-0 mt-0.5" />
              <span>Embed timelines on any mind map (16:9 cards)</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles size={13} className="text-cyan-300 shrink-0 mt-0.5" />
              <span>Two-way calendar sync — events appear on /calendar automatically</span>
            </li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/pricing" data-testid="tl-paywall-cta" className="cta-pill flex-1 justify-center text-[13px] py-3">
              <Sparkles size={13} /> Upgrade to Pro · unlock timelines
            </Link>
            <Link to="/library" className="mono text-[10px] uppercase tracking-[0.22em] flex-1 justify-center px-3 py-3 rounded-full border border-white/15 hover:border-cyan-300/60 text-[#cfdaf3] hover:text-cyan-200 transition flex items-center">
              Back to library
            </Link>
          </div>
          <div className="mt-4 mono text-[9px] uppercase tracking-[0.22em] text-[#566187] text-center">
            Your plan: {tier || "free"} · Beta means we're still polishing — feedback welcome at <a href="mailto:tech@marvex.app" className="underline hover:text-cyan-300">tech@marvex.app</a>
          </div>
        </div>
      </div>
    </div>
  );
}

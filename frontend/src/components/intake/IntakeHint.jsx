import React from "react";

/** Empty-state hint card on /intake. Clickable when `onClick` is provided. */
export const Hint = ({ icon, title, body, onClick, testid }) => (
  <div
    data-testid={testid}
    onClick={onClick}
    className={`rounded-xl border border-white/5 bg-white/[0.02] p-5 transition ${
      onClick ? "cursor-pointer hover:border-cyan-400/40 hover:bg-white/[0.04]" : ""
    }`}
  >
    <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/20 grid place-items-center text-cyan-200 mb-3">
      {icon}
    </div>
    <div className="font-semibold text-sm mb-1">{title}</div>
    <div className="text-[#9aa7c7] text-[13px] leading-relaxed">{body}</div>
  </div>
);

/** Pill-style toggle for batch output mode (one-per-PDF vs. super-map). */
export const ModeBtn = ({ active, onClick, children, icon, testid }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full mono text-[10px] uppercase tracking-[0.18em] flex items-center gap-1.5 transition ${
      active ? "bg-cyan-400 text-[#03131e] font-bold" : "text-[#9aa7c7] hover:text-cyan-200"
    }`}
  >
    {icon}
    {children}
  </button>
);

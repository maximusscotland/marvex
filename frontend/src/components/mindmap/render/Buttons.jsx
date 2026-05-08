import React from "react";
import { Lock } from "lucide-react";

/**
 * Shared, stateless toolbar/canvas buttons used by `MindMapCanvas` and its
 * sub-views. All four are pure renderers — no hooks, no refs — so they can
 * be moved between layouts without breaking React state ownership.
 *
 * Names + props are kept identical to the originals that lived inline in
 * `MindMapCanvas.jsx` so any tests / call-sites already pointed at them
 * keep working.
 */

export const CtrlBtn = ({ children, onClick, testid }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className="w-9 h-9 rounded-lg grid place-items-center bg-[#0a0f24]/80 backdrop-blur border border-white/10 text-[#9aaad0] hover:text-cyan-300 hover:border-cyan-400/60 hover:shadow-[0_0_14px_rgba(0,240,255,0.3)] transition"
  >
    {children}
  </button>
);

/**
 * Shape pill in the toolbar's shape-picker popover.
 * `locked` renders a Pro-lock badge; `active` highlights the currently-applied
 * shape on the selected map element.
 */
export const ShapeBtn = ({ shape, locked, active, onPick }) => (
  <button
    data-testid={`mm-tb-shape-${shape.value}`}
    onClick={() => onPick(shape.value)}
    className={`relative rounded-md py-1.5 text-[10px] mono uppercase tracking-[0.12em] border transition ${
      active
        ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
        : locked
          ? "border-white/10 bg-white/[0.02] text-[#7a6da0] hover:border-fuchsia-400/60"
          : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50"
    }`}
    title={locked ? `${shape.name} · Pro` : shape.name}
  >
    {shape.name.slice(0, 3)}
    {locked && (
      <Lock size={8} className="absolute top-[3px] right-[3px] text-fuchsia-300" />
    )}
  </button>
);

export const ToolbarBtn = ({ children, onClick, testid, label, disabled, active }) => (
  <button
    data-testid={testid}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className={`flex items-center px-2 py-1.5 rounded-md transition ${
      disabled
        ? "text-[#4a5576] opacity-50 cursor-not-allowed"
        : active
          ? "text-cyan-200 bg-cyan-400/10 border border-cyan-400/40"
          : "text-[#9aaad0] hover:text-cyan-200 hover:bg-cyan-400/10"
    }`}
  >
    {children}
  </button>
);

export const ToolbarDivider = ({ vertical = false }) =>
  vertical ? (
    <div className="h-px w-5 bg-white/10 my-1 self-center shrink-0" />
  ) : (
    <div className="w-px h-5 bg-white/10 mx-1 self-center shrink-0" />
  );

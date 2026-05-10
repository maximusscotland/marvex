import React, { useEffect, useRef } from "react";
import { Loader2, Sparkles, CheckCircle2, Zap, Share2 } from "lucide-react";

/**
 * Streaming-research overlay — cosmic "Mikey is thinking" HUD.
 * Shows the current phase + a live list of branches as they arrive.
 * Non-modal (doesn't trap focus) so users can still see the canvas animate.
 */
export default function ResearchProgressOverlay({ open, phase, branches, onCancel, onShare }) {
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [branches]);

  if (!open) return null;
  const done = phase?.phase === "done";

  return (
    <div
      data-testid="research-progress"
      className="fixed bottom-6 right-6 z-40 w-[360px] glass-panel rounded-2xl p-4 fade-up"
      style={{ borderColor: "rgba(130,90,255,0.35)" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="relative w-10 h-10 rounded-xl overflow-hidden border border-violet-400/40 grid place-items-center"
          style={{
            background: "radial-gradient(circle at 30% 30%, rgba(255,106,213,0.25), rgba(122,59,255,0.12) 60%, transparent)",
          }}
        >
          {/* Mikey — your cosmic owl-professor research assistant. The
              thinking-bubble portrait is the canonical Mikey avatar.
              Falls back to a generic loader if the asset is unavailable
              (offline / preview before image upload). */}
          <img
            src="/mikey/mikey-thinking-bubble.png"
            alt="Mikey"
            className={`w-full h-full object-cover ${done ? "" : "animate-pulse-slow"}`}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          {done && (
            <div className="absolute inset-0 grid place-items-center bg-emerald-500/30 backdrop-blur-[1px]">
              <CheckCircle2 size={16} className="text-emerald-200" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-violet-300/80">
            Mikey · Research Assistant
          </div>
          <div
            className="text-[13px] text-white truncate"
            data-testid="research-progress-message"
            title={phase?.message || "Working…"}
          >
            {phase?.message || "Working…"}
          </div>
        </div>
        {!done && onCancel && (
          <button
            onClick={onCancel}
            data-testid="research-progress-cancel"
            className="mono text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded text-[#9aa7c7] hover:text-red-300 hover:bg-red-500/10 transition"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Branch ticker */}
      <div
        ref={listRef}
        className="max-h-48 overflow-y-auto space-y-1.5 pr-1"
        data-testid="research-progress-branches"
      >
        {branches.length === 0 && !done && (
          <div className="flex items-center gap-2 text-[11.5px] text-[#7a87ad]">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: "120ms" }} />
              <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: "240ms" }} />
            </div>
            Waiting for the first branch…
          </div>
        )}
        {branches.map((b, i) => (
          <div
            key={`${i}-${b.title}`}
            data-testid="research-progress-branch"
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/5 animate-[fadeUp_0.35s_ease_both]"
          >
            <Sparkles size={11} className="text-fuchsia-300/90 shrink-0 mt-[3px]" />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] text-white truncate" title={b.title}>{b.title}</div>
              {b.children?.length > 0 && (
                <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#6c7aa3] mt-0.5">
                  +{b.children.length} sub-branch{b.children.length > 1 ? "es" : ""}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {done && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-emerald-300/80 flex items-center gap-1">
            <Zap size={9} /> {branches.length} branches · complete
          </div>
          {onShare && (
            <button
              onClick={onShare}
              data-testid="research-progress-share"
              className="mono text-[9px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-violet-400 text-[#03131e] font-bold hover:shadow-[0_0_14px_rgba(0,240,255,0.45)] transition flex items-center gap-1.5"
            >
              <Share2 size={10} /> Share card
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import React from "react";
import { createPortal } from "react-dom";
import { Lock, Sparkles, X, Star } from "lucide-react";
import { useLicense } from "@/lib/license";

/**
 * RenewWall — the modal that appears when a free / expired user tries
 * to use a Pro-only surface (new map, AI, cloud sync, share, compile).
 *
 * Three messaging variants:
 *   • "expired"  — they had Pro and it lapsed (warm tone, easy renew)
 *   • "free"     — never paid (hopeful tone, highlight Founders limit)
 *   • "signed_out" — not logged in (point them to Sign in)
 *
 * Mounted via portal so it works inside the canvas viewport's CSS
 * transform (same trick as CanvasContextMenu). Self-managing the
 * scroll-lock isn't necessary because the modal already covers the
 * full viewport with a backdrop.
 */
export default function RenewWall({ open, onClose, action, onUpgrade, onSignIn }) {
  const lic = useLicense();
  if (!open) return null;

  const variant = lic.signedOut ? "signed_out" : lic.expired ? "expired" : "free";

  const HEADLINE = {
    expired: "Your subscription ran out",
    free: "Marvex Studio Pro",
    signed_out: "Sign in to keep going",
  }[variant];

  const SUBLINE = {
    expired:
      "Your existing maps still open and export — but creating new maps, running AI, and cloud sync need an active plan.",
    free:
      "The free tier covers everything you've already built. New maps, AI compile, and cloud sync are part of Pro.",
    signed_out: "Your maps live in this browser already — sign in to enable AI and cloud sync, or just keep using locally.",
  }[variant];

  const ACTION_LABEL = {
    "new-map": "Create new mind-map",
    ai: "Use AI",
    cloud: "Cloud sync",
    share: "Share map",
    compile: "AI compile",
  }[action] || "Pro feature";

  return createPortal(
    <div
      data-testid="renew-wall"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] grid place-items-center px-4 fade-up"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(12px)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md glass-panel rounded-2xl p-7"
        style={{ borderColor: "rgba(245,158,11,0.35)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg grid place-items-center bg-amber-500/15 border border-amber-400/30 text-amber-300">
              <Lock size={18} />
            </div>
            <div>
              <div className="mono text-[9.5px] uppercase tracking-[0.22em] text-amber-300/80">
                {ACTION_LABEL} · Pro
              </div>
              <h3 className="text-xl font-bold tracking-tight">{HEADLINE}</h3>
            </div>
          </div>
          <button
            data-testid="renew-wall-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1 rounded hover:bg-white/5"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-5">
          {SUBLINE}
        </p>

        <ul className="space-y-2 mb-6 text-[12.5px] text-[#9aaad0]">
          <li className="flex items-center gap-2">
            <Sparkles size={11} className="text-cyan-300 flex-shrink-0" />
            Unlimited new maps + AI compile + cloud sync
          </li>
          <li className="flex items-center gap-2">
            <Sparkles size={11} className="text-cyan-300 flex-shrink-0" />
            Drive · Dropbox · Zotero export
          </li>
          <li className="flex items-center gap-2">
            <Star size={11} className="text-amber-300 flex-shrink-0" />
            Lifetime $200 — first 50 buyers get permanent Founder status &amp; 25% affiliate
          </li>
        </ul>

        <div className="flex items-center gap-2">
          {variant === "signed_out" ? (
            <button
              data-testid="renew-wall-signin"
              onClick={() => { onClose(); onSignIn?.(); }}
              className="flex-1 cta-pill text-[12px] py-2.5"
            >
              Sign in with Google
            </button>
          ) : (
            <button
              data-testid="renew-wall-upgrade"
              onClick={() => { onClose(); onUpgrade?.(); }}
              className="flex-1 cta-pill text-[12px] py-2.5"
            >
              <Sparkles size={11} />
              Choose a plan
            </button>
          )}
          <button
            data-testid="renew-wall-dismiss"
            onClick={onClose}
            className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2.5 rounded-full text-[#7a87ad] hover:text-white border border-white/10 hover:border-white/30"
          >
            Not now
          </button>
        </div>

        <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] mt-4 text-center">
          Existing maps stay readable forever — pinky promise
        </div>
      </div>
    </div>,
    document.body,
  );
}

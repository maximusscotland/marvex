/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { Sparkles, X, ArrowRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FREE_NODE_CAP } from "@/components/mindmap/constants";

/**
 * FreeCapNudge — inline upgrade prompt that floats over the mind-map
 * canvas as a free user approaches the 30-node limit.
 *
 * Why inline (not modal)?
 *   - Modals interrupt flow; users dismiss them muscle-memory-fast and
 *     the conversion lift dies. Inline cards preserve the work-in-
 *     progress context, which is exactly the moment the user feels
 *     the value of upgrading.
 *   - Industry data (Notion, Linear, Figma): inline conversion CTAs
 *     convert ~2-3× better than blocking modals at the same trigger.
 *
 * Visibility logic — three escalating tiers:
 *   1. Soft (24-29 nodes) → small hint pill in the corner, dismissable.
 *      Says "5 of 30 free nodes left".
 *   2. Hard (30 nodes — at the cap) → louder card with primary CTA,
 *      still dismissable but obviously the moment to act.
 *   3. After dismissal → never re-shown for THIS map session
 *      (sessionStorage). Re-appears when reopening the app.
 *
 * Rendered ONLY when:
 *   - User is on the FREE tier (nodeCap === FREE_NODE_CAP and !isPro)
 *   - Total node count >= FREE_NODE_CAP - 6 (24 nodes — gives them
 *     a 6-node runway to feel the squeeze before the wall hits)
 *
 * Pro / Lite / Founder users never see this — they have no cap or a
 * higher one, and the nudge would be noise.
 */
const DISMISS_KEY_PREFIX = "marvex.freenudge.dismissed.";

export default function FreeCapNudge({ nodeCap, nodeCount, mapId, isPro, onUpgrade }) {
  const navigate = useNavigate();
  // sessionStorage so a curious user who dismissed once can re-see it
  // after closing the tab & coming back tomorrow — not too pushy, not
  // too quiet. Tied to mapId so dismissing on one map doesn't suppress
  // the nudge on a different map.
  const dismissKey = mapId ? `${DISMISS_KEY_PREFIX}${mapId}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey) return false;
    try { return sessionStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  // Re-read dismissal state when the active map changes — otherwise
  // the nudge stays hidden after switching maps.
  useEffect(() => {
    if (!dismissKey) return;
    try { setDismissed(sessionStorage.getItem(dismissKey) === "1"); } catch { /* ignore */ }
  }, [dismissKey]);

  // Gate: only free-tier users with a 30-node cap.
  if (isPro) return null;
  if (!Number.isFinite(nodeCap) || nodeCap !== FREE_NODE_CAP) return null;
  if (dismissed) return null;
  // Show as soon as the user has 6 nodes left (24+) so they get
  // anticipation runway before hitting the wall at 30.
  const SHOW_AT = FREE_NODE_CAP - 6;
  if (nodeCount < SHOW_AT) return null;

  const remaining = Math.max(0, FREE_NODE_CAP - nodeCount);
  const atCap = nodeCount >= FREE_NODE_CAP;

  const dismiss = () => {
    if (dismissKey) { try { sessionStorage.setItem(dismissKey, "1"); } catch { /* ignore */ } }
    setDismissed(true);
  };

  const goUpgrade = () => {
    // Prefer the parent's onUpgrade hook (shows the in-app UpgradeDialog)
    // if provided — falls back to /pricing for a deep-link.
    if (onUpgrade) onUpgrade();
    else navigate("/pricing");
  };

  // ── AT-CAP variant ──────────────────────────────────────────────
  if (atCap) {
    return (
      <div
        data-testid="free-cap-nudge-hard"
        className="absolute top-20 right-5 z-30 w-[320px] rounded-xl border border-fuchsia-400/50 bg-gradient-to-br from-[#1a0d2e] via-[#1a0d2e] to-[#0e1632] p-4 shadow-[0_0_40px_rgba(255,106,213,0.35)] fade-up"
        style={{ backdropFilter: "blur(8px)" }}
      >
        <button
          onClick={dismiss}
          data-testid="free-cap-nudge-dismiss"
          className="absolute top-2 right-2 text-[#7a87ad] hover:text-white transition"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-fuchsia-300" />
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300">
            Free limit reached
          </div>
        </div>
        <div className="text-[14px] text-white font-semibold leading-snug mb-1.5">
          You&apos;ve filled your {FREE_NODE_CAP} free nodes.
        </div>
        <p className="text-[12px] text-[#b4c0e0] leading-relaxed mb-3.5">
          Keep going with <strong className="text-cyan-200">Lite</strong> ($9/mo · 200 nodes)
          {" "}or unlimited on <strong className="text-fuchsia-200">Pro</strong> ($15/mo).
        </p>
        <div className="flex gap-2">
          <button
            onClick={goUpgrade}
            data-testid="free-cap-nudge-upgrade-cta"
            className="flex-1 cta-pill text-[12px] justify-center"
          >
            Upgrade <ArrowRight size={12} />
          </button>
          <button
            onClick={dismiss}
            data-testid="free-cap-nudge-later"
            className="cta-ghost text-[11px]"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  // ── SOFT variant (24-29 nodes) ──────────────────────────────────
  return (
    <button
      data-testid="free-cap-nudge-soft"
      onClick={goUpgrade}
      className="absolute top-20 right-5 z-30 group flex items-center gap-2 px-3 py-2 rounded-full border border-cyan-400/40 bg-[#0a1428]/90 backdrop-blur-md text-cyan-200 hover:border-cyan-300/70 hover:bg-cyan-500/10 transition shadow-[0_0_18px_rgba(0,240,255,0.20)] fade-up"
    >
      <Sparkles size={12} className="text-cyan-300" />
      <span className="mono text-[10px] uppercase tracking-[0.22em]">
        {remaining} of {FREE_NODE_CAP} free nodes left
      </span>
      <span className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 group-hover:text-fuchsia-200 transition">
        Upgrade →
      </span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); dismiss(); } }}
        data-testid="free-cap-nudge-soft-dismiss"
        className="ml-1 -mr-1 w-4 h-4 rounded-full grid place-items-center text-[#7a87ad] hover:text-white hover:bg-white/10 transition"
        aria-label="Dismiss"
      >
        <X size={10} />
      </span>
    </button>
  );
}

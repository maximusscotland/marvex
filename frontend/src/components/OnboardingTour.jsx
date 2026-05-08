import React, { useState, useEffect, useCallback, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { X, ArrowLeft, ArrowRight, Check, Sparkles, Layers } from "lucide-react";

/**
 * OnboardingTour — a 5-step spotlight walk-through rendered on top of the
 * Studio. It dims the page with a full-viewport SVG mask that punches a
 * transparent "hole" around the target element (identified by data-testid),
 * plus a floating tooltip anchored near the target with Next / Back / Skip.
 *
 * Dismissal is persisted to localStorage under `mindmapper.onboarding.v1`
 * so a first-time visitor only sees it once. Retrigger via the `open` prop
 * (wired to a "Take the tour" button on /learn + a /app?tour=1 query param).
 */

const STORAGE_KEY = "mindmapper.onboarding.v1";

const STEPS = [
  { testid: null,                       i18n: "welcome",  place: "center" },
  { testid: "btn-new-map",              i18n: "sidebar",  place: "right"  },
  { testid: "map-title-input",          i18n: "canvas",   place: "bottom" },
  { testid: "mm-tb-export-png",         i18n: "toolbar",  place: "left"   },
  { testid: "studio-share-btn",         i18n: "share",    place: "bottom" },
  // Final "power moves" step — pure tooltip (no target). Surfaces the
  // Reorganise tutorial so first-time users have a one-click path to the
  // shift-click → group-as-branch flow that nobody discovers on their own.
  { testid: null,                       i18n: "powerMoves", place: "center" },
];

export const hasSeenTour = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
};

export const markTourSeen = () => {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
};

export const resetTour = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/** Measure the target element's viewport rect. Falls back to null if not found. */
const getRect = (testid) => {
  if (!testid) return null;
  const el = document.querySelector(`[data-testid="${testid}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const Tooltip = ({ rect, place, children }) => {
  // Compute tooltip position so it anchors near the target, staying on-screen.
  const W = typeof window !== "undefined" ? window.innerWidth : 1280;
  const H = typeof window !== "undefined" ? window.innerHeight : 800;
  const TIP_W = 340;
  const GAP = 18;
  let style = { width: TIP_W };

  if (!rect || place === "center") {
    style = { ...style, left: (W - TIP_W) / 2, top: Math.max(60, (H - 260) / 2) };
  } else {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (place === "right") {
      style.left = Math.min(W - TIP_W - 16, rect.x + rect.w + GAP);
      style.top = Math.max(16, Math.min(H - 260, cy - 80));
    } else if (place === "left") {
      style.left = Math.max(16, rect.x - TIP_W - GAP);
      style.top = Math.max(16, Math.min(H - 260, cy - 80));
    } else if (place === "bottom") {
      style.left = Math.max(16, Math.min(W - TIP_W - 16, cx - TIP_W / 2));
      style.top = Math.min(H - 260, rect.y + rect.h + GAP);
    } else {
      style.left = Math.max(16, Math.min(W - TIP_W - 16, cx - TIP_W / 2));
      style.top = Math.max(16, rect.y - 210);
    }
  }

  return (
    <div
      data-testid="tour-tooltip"
      className="fixed z-[10000] glass-panel rounded-2xl p-5 fade-up"
      style={{ ...style, borderColor: "rgba(0,240,255,0.4)", boxShadow: "0 22px 60px rgba(0,240,255,0.28)", pointerEvents: "auto" }}
    >
      {children}
    </div>
  );
};

const Spotlight = ({ rect }) => {
  // Render a dim overlay with a "cut-out" around the target via SVG mask.
  const W = window.innerWidth;
  const H = window.innerHeight;
  const hasTarget = !!rect;
  const pad = 10;
  const x = hasTarget ? Math.max(0, rect.x - pad) : W / 2;
  const y = hasTarget ? Math.max(0, rect.y - pad) : H / 2;
  const w = hasTarget ? rect.w + pad * 2 : 0;
  const h = hasTarget ? rect.h + pad * 2 : 0;
  const r = 14;
  return (
    <svg
      data-testid="tour-spotlight"
      className="fixed inset-0 z-[9999] pointer-events-none"
      width="100%"
      height="100%"
      style={{ background: "transparent" }}
    >
      <defs>
        <mask id="tour-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {hasTarget && (
            <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
          )}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(3,4,10,0.78)"
        mask="url(#tour-mask)"
      />
      {hasTarget && (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={r}
          ry={r}
          fill="none"
          stroke="#36e6ff"
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 14px rgba(0,240,255,0.6))" }}
        />
      )}
    </svg>
  );
};

export default function OnboardingTour({ open, onClose }) {
  const { t } = useTranslation();
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState(null);
  // "Don't show again" — checked by default so users who skip don't see it again.
  // Uncheck if you want to revisit the tour next load.
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const step = STEPS[stepIdx];

  // Re-measure the target rect whenever the step or window changes.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = () => setRect(getRect(step?.testid));
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, stepIdx, step?.testid]);

  // Fallback re-measure — some targets (e.g. sidebar on transition) animate in
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setRect(getRect(step?.testid)), 250);
    return () => clearTimeout(id);
  }, [open, stepIdx, step?.testid]);

  const next = useCallback(() => {
    setStepIdx((i) => {
      if (i < STEPS.length - 1) return i + 1;
      if (dontShowAgain) markTourSeen();
      onClose && onClose();
      return 0;
    });
  }, [onClose, dontShowAgain]);

  const back = useCallback(() => setStepIdx((i) => Math.max(0, i - 1)), []);

  const skip = useCallback(() => {
    if (dontShowAgain) markTourSeen();
    setStepIdx(0);
    onClose && onClose();
  }, [onClose, dontShowAgain]);

  // Escape key dismisses
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, back, skip]);

  if (!open) return null;

  const k = step.i18n;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div
      data-testid="tour-overlay"
      className="fixed inset-0"
      // pointer-events: none lets every click PASS THROUGH the wrapper so the
      // app underneath stays interactive. The Spotlight / Tooltip children
      // re-enable pointer-events: auto on themselves so the user can still
      // click the tour buttons. Without this, the entire studio was frozen
      // until the tour was dismissed.
      style={{ zIndex: 9998, pointerEvents: "none" }}
    >
      <Spotlight rect={rect} />
      <Tooltip rect={rect} place={step.place}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full grid place-items-center"
              style={{
                background: "linear-gradient(135deg, rgba(0,240,255,0.25), rgba(138,91,255,0.15))",
                border: "1px solid rgba(0,240,255,0.5)",
              }}
            >
              <Sparkles size={13} className="text-cyan-300" />
            </div>
            <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80">
              {t("learn.tour.stepCounter", { current: stepIdx + 1, total: STEPS.length })}
            </div>
          </div>
          <button
            data-testid="tour-close"
            onClick={skip}
            title={t("learn.tour.skip")}
            className="text-[#7a87ad] hover:text-white transition w-7 h-7 rounded-md grid place-items-center hover:bg-white/5"
          >
            <X size={14} />
          </button>
        </div>
        <h4 data-testid="tour-title" className="text-lg font-semibold text-white mb-1.5">
          {t(`learn.tour.${k}.title`)}
        </h4>
        <p className="text-[13px] leading-relaxed text-[#a4b4d8] mb-4">
          {t(`learn.tour.${k}.body`)}
        </p>
        {/* On the final "power moves" step, surface a direct link to the
            Reorganise tutorial. Opens in a new tab so the user keeps their
            studio session intact. */}
        {k === "powerMoves" && (
          <Link
            to="/learn/reorganise"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="tour-power-moves-link"
            onClick={() => { if (dontShowAgain) markTourSeen(); onClose && onClose(); }}
            className="flex items-center justify-between gap-2 mb-4 px-3 py-2.5 rounded-lg border border-amber-400/40 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] hover:border-amber-400/60 transition group"
          >
            <span className="flex items-center gap-2.5">
              <Layers size={15} className="text-amber-300" />
              <span className="text-[13px] text-amber-100 font-medium">Reorganise a sprawling map</span>
            </span>
            <ArrowRight size={13} className="text-amber-300 group-hover:translate-x-0.5 transition" />
          </Link>
        )}
        {/* "Don't show again" toggle — default on. Uncheck if you'd like to
            revisit the tour next time you open the app. */}
        <label
          className="flex items-center gap-2 mb-3 text-[11px] text-[#9aaad0] hover:text-cyan-200 cursor-pointer select-none"
          data-testid="tour-dont-show-again-label"
        >
          <input
            type="checkbox"
            data-testid="tour-dont-show-again"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-3.5 h-3.5 accent-cyan-400"
          />
          Don&apos;t show this again
        </label>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === stepIdx ? "bg-cyan-300" : i < stepIdx ? "bg-cyan-600" : "bg-white/15"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                data-testid="tour-back"
                onClick={back}
                className="mono text-[10px] uppercase tracking-[0.18em] text-[#9aaad0] hover:text-cyan-300 px-2 py-1.5 rounded transition"
              >
                <ArrowLeft size={11} className="inline mr-1" /> {t("learn.tour.back")}
              </button>
            )}
            <button
              data-testid="tour-skip"
              onClick={skip}
              className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] hover:text-white px-2 py-1.5 rounded transition"
            >
              {t("learn.tour.skip")}
            </button>
            <button
              data-testid={isLast ? "tour-done" : "tour-next"}
              onClick={next}
              className="cta-pill text-[11px] !px-3 !py-1.5"
            >
              {isLast
                ? (<><Check size={12} /> {t("learn.tour.done")}</>)
                : (<>{t("learn.tour.next")} <ArrowRight size={12} /></>)}
            </button>
          </div>
        </div>
      </Tooltip>
    </div>
  );
}

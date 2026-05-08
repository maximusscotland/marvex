import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Star, Share2, Sparkles, X } from "lucide-react";

/**
 * One-time congratulations modal that fires when a user FIRST becomes
 * a Founder.  Detection: when `user.founder` flips from false → true,
 * we mark `mm.founderCelebrated.<user_id>` in localStorage so the modal
 * never re-shows for that user (NOT a server flag — re-celebrating is
 * better than missing it once, and a tiny bit of duplicated joy never
 * hurt anyone).
 *
 * Confetti is pure CSS (50 absolutely-positioned dots, randomised hue
 * + drift via CSS custom props) so we don't ship a 30 KB confetti lib
 * for a once-per-user moment.  The dots clean themselves up after
 * the animation ends — no rAF loop, no memory pressure.
 *
 * Why portal? Same reason as RenewWall — the canvas viewport applies a
 * CSS transform that breaks position:fixed children.
 */

const CELEBRATED_KEY = (uid) => `mm.founderCelebrated.${uid}`;

export default function FounderWelcome({ user }) {
  const founder = !!user?.founder;
  const founderNumber = user?.founder_number;
  const userId = user?.user_id;

  // We open the modal in a useEffect so the celebration only triggers
  // AFTER the user object resolves (rather than flashing on every page
  // load even after dismissal).  The localStorage check guarantees
  // one-and-done.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!founder || !userId) return;
    try {
      if (localStorage.getItem(CELEBRATED_KEY(userId))) return;
    } catch { /* private mode — fall through */ }
    // 600 ms grace so the canvas renders behind us first; the modal
    // landing into a fully-painted scene feels significantly better
    // than landing onto a half-rendered loading state.
    const id = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(id);
  }, [founder, userId]);

  const close = () => {
    try { if (userId) localStorage.setItem(CELEBRATED_KEY(userId), String(Date.now())); } catch { /* noop */ }
    setOpen(false);
  };

  // 60 confetti pieces — randomised once when the modal first opens.
  // useMemo keyed off `open` so we get fresh confetti on each open
  // (only happens once per user but feels right).
  const confetti = useMemo(() => {
    if (!open) return [];
    const palette = ["#fde68a", "#f59e0b", "#fbbf24", "#00f0ff", "#ff6ad5", "#ffec3d"];
    return Array.from({ length: 60 }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.6 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 200,
      hue: palette[i % palette.length],
      size: 6 + Math.random() * 6,
      rotate: Math.random() * 360,
    }));
  }, [open]);

  if (!open || !founder) return null;

  const tweet = () => {
    const text = `I just became Founder #${founderNumber} on Marvex Studio — the mind-map tool that turns any PDF into a knowledge graph in 60 seconds 🧠✨`;
    const url = "https://marvex.app";
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, "_blank", "noopener,width=550,height=420");
  };

  return createPortal(
    <>
      <style>{`
        @keyframes founder-confetti-fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(var(--spin, 720deg)); opacity: 0.85; }
        }
        @keyframes founder-medal-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 24px rgba(245,158,11,0.55)); }
          50%      { transform: scale(1.06); filter: drop-shadow(0 0 36px rgba(245,158,11,0.85)); }
        }
      `}</style>

      <div
        data-testid="founder-welcome"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[70] grid place-items-center px-4 fade-up"
        style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(14px)" }}
        onMouseDown={close}
      >
        {/* Confetti layer — pointer-events none so clicks pass through to
            the modal underneath. */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confetti.map((c) => (
            <span
              key={c.key}
              className="absolute block rounded-sm"
              style={{
                left: `${c.left}%`,
                top: "-2vh",
                width: `${c.size}px`,
                height: `${c.size * 0.45}px`,
                background: c.hue,
                "--drift": `${c.drift}px`,
                "--spin": `${c.rotate + 720}deg`,
                animation: `founder-confetti-fall ${c.duration}s cubic-bezier(0.32, 0.72, 0.33, 1) ${c.delay}s forwards`,
                transform: `rotate(${c.rotate}deg)`,
              }}
            />
          ))}
        </div>

        <div
          className="relative w-full max-w-md glass-panel rounded-2xl p-7 text-center"
          style={{ borderColor: "rgba(245,158,11,0.55)", boxShadow: "0 0 60px rgba(245,158,11,0.35)" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            data-testid="founder-welcome-close"
            onClick={close}
            className="absolute top-3 right-3 text-[#7a87ad] hover:text-white p-1 rounded hover:bg-white/5"
          >
            <X size={16} />
          </button>

          <div
            className="w-20 h-20 mx-auto rounded-full grid place-items-center mb-4"
            style={{
              background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 50%, #d97706 100%)",
              animation: "founder-medal-pulse 2.4s ease-in-out infinite",
            }}
          >
            <Star size={32} className="text-amber-950" fill="currentColor" />
          </div>

          <div className="mono text-[10px] uppercase tracking-[0.28em] text-amber-300/80 mb-2">
            Welcome to the Founders
          </div>
          <h3 className="text-3xl font-bold tracking-tight mb-3">
            You&apos;re Founder #{founderNumber}
          </h3>
          <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-5 max-w-sm mx-auto">
            Lifetime access to every Pro feature, today and forever.
            Your name is etched into our credits page — only 50 of these ever exist,
            and you&apos;re one of them.
          </p>

          <ul className="text-left space-y-2 mb-6 mx-auto max-w-xs text-[12.5px] text-[#9aaad0]">
            <li className="flex items-center gap-2">
              <Sparkles size={11} className="text-amber-300 flex-shrink-0" />
              25% lifetime affiliate commission (vs 17% standard)
            </li>
            <li className="flex items-center gap-2">
              <Sparkles size={11} className="text-amber-300 flex-shrink-0" />
              Early access to every new feature
            </li>
            <li className="flex items-center gap-2">
              <Sparkles size={11} className="text-amber-300 flex-shrink-0" />
              Permanent ★ Founder pill on your profile
            </li>
          </ul>

          <div className="flex items-center gap-2">
            <button
              data-testid="founder-welcome-share"
              onClick={tweet}
              className="flex-1 inline-flex items-center justify-center gap-2 cta-pill text-[12px] py-2.5"
            >
              <Share2 size={12} />
              Share on X
            </button>
            <button
              data-testid="founder-welcome-dismiss"
              onClick={close}
              className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2.5 rounded-full text-[#7a87ad] hover:text-white border border-white/10 hover:border-white/30"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

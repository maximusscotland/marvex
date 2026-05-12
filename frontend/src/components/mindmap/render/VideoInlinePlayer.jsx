/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState } from "react";
import { X, ExternalLink, Minimize2, Maximize2 } from "lucide-react";

/**
 * VideoInlinePlayer — floating, draggable, resizable picture-in-picture
 * player for YouTube + Vimeo embeds inside the Mindmap Studio.
 *
 * Behaviour:
 *   • One global instance per studio.  Studio.jsx renders <VideoInlinePlayer
 *     embed={…} onClose={…} /> when a Pro user clicks a video-link badge.
 *   • Default size 480×270 (16:9).  Resize handle in the bottom-right
 *     corner.  Drag handle = the player header.
 *   • Position + size persist to sessionStorage so the player stays where
 *     the user dropped it as they swap maps within the same tab session.
 *   • Esc → close.  "Open in tab" button → opens originalUrl in new tab
 *     (matches the existing _blank behaviour for non-video links).
 *
 * Why an iframe (not a true `<video>`)? YouTube + Vimeo don't expose raw
 * MP4 streams; their official embed iframes are the supported integration
 * path.  We use the privacy-enhanced domains (youtube-nocookie.com,
 * player.vimeo.com?dnt=1) so we don't have to add a cookie-consent layer.
 */
const STORAGE_KEY = "marvex.videoPlayer.pos.v1";
const MIN_W = 320;
const MIN_H = 180;
const DEFAULT_W = 480;
const DEFAULT_H = 270;

const readPersisted = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (
        Number.isFinite(p?.x) && Number.isFinite(p?.y) &&
        Number.isFinite(p?.w) && Number.isFinite(p?.h)
      ) return p;
    }
  } catch { /* ignore */ }
  return null;
};

const defaultRect = () => {
  if (typeof window === "undefined") return { x: 24, y: 96, w: DEFAULT_W, h: DEFAULT_H };
  // Bottom-right by default — out of the way of the map's centre.
  return {
    x: Math.max(16, window.innerWidth - DEFAULT_W - 32),
    y: Math.max(80, window.innerHeight - DEFAULT_H - 96),
    w: DEFAULT_W,
    h: DEFAULT_H,
  };
};

const clamp = (r) => {
  if (typeof window === "undefined") return r;
  const maxW = Math.max(MIN_W, window.innerWidth - 16);
  const maxH = Math.max(MIN_H, window.innerHeight - 16);
  const w = Math.min(Math.max(MIN_W, r.w), maxW);
  const h = Math.min(Math.max(MIN_H, r.h), maxH);
  return {
    w,
    h,
    x: Math.max(8, Math.min(window.innerWidth  - w - 8, r.x)),
    y: Math.max(8, Math.min(window.innerHeight - h - 8, r.y)),
  };
};

export default function VideoInlinePlayer({ embed, onClose }) {
  // `embed` shape: { provider, videoId, embedUrl, originalUrl, label }
  const [rect, setRect] = useState(() => clamp(readPersisted() || defaultRect()));
  const [minimized, setMinimized] = useState(false);
  const dragRef = useRef({ mode: null, offX: 0, offY: 0, startX: 0, startY: 0, startW: 0, startH: 0 });

  // Persist on every change.
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rect)); } catch { /* ignore */ }
  }, [rect]);

  // Re-clamp on window resize so the player stays on-screen.
  useEffect(() => {
    const onResize = () => setRect((r) => clamp(r));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Esc to close — but ignore the key when the user is typing in
  // another input/textarea/contenteditable (e.g. node title rename or
  // the LinkDialog), so Escape there still cancels just that field
  // without nuking the player below it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
      onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const beginDrag = (mode, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      offX: e.clientX - rect.x,
      offY: e.clientY - rect.y,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.w,
      startH: rect.h,
    };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d.mode) return;
      if (d.mode === "move") {
        setRect((r) => clamp({ ...r, x: ev.clientX - d.offX, y: ev.clientY - d.offY }));
      } else if (d.mode === "resize") {
        setRect((r) => clamp({
          ...r,
          w: d.startW + (ev.clientX - d.startX),
          h: d.startH + (ev.clientY - d.startY),
        }));
      }
    };
    const onUp = () => {
      dragRef.current = { mode: null, offX: 0, offY: 0, startX: 0, startY: 0, startW: 0, startH: 0 };
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!embed) return null;

  const providerLabel = embed.provider === "youtube" ? "YouTube" : "Vimeo";

  return (
    <div
      data-testid="video-inline-player"
      role="dialog"
      aria-label={`${providerLabel} player`}
      className="fixed z-[60] rounded-xl border border-cyan-400/30 bg-[#03040a]/95 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_30px_rgba(0,240,255,0.18)] overflow-hidden flex flex-col"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: minimized ? 38 : rect.h,
        transition: minimized ? "height 0.16s ease" : "none",
      }}
    >
      {/* Header / drag handle.  Buttons inside use `onPointerDownCapture`
          to stop propagation *before* the parent's mousedown handler
          fires preventDefault — without this the click-after-mousedown
          on minimize / close gets eaten and the state doesn't toggle. */}
      <div
        data-testid="video-player-handle"
        onMouseDown={(e) => {
          // Only initiate drag if the press is on the bare handle, not
          // on a control button (those use stopPropagation already, but
          // belt-and-braces).
          if (e.target.closest("button")) return;
          beginDrag("move", e);
        }}
        className="flex items-center gap-2 px-2.5 h-[38px] border-b border-white/10 bg-[#0a0f24]/90 cursor-grab active:cursor-grabbing select-none"
      >
        <span
          className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"
          aria-hidden
        />
        <span className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90 truncate flex-1">
          {providerLabel}
          {embed.label ? <span className="text-[#8595bb] normal-case tracking-normal"> · {embed.label}</span> : null}
        </span>
        <button
          data-testid="video-player-open-external"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            window.open(embed.originalUrl, "_blank", "noopener,noreferrer");
          }}
          title="Open in new tab"
          className="w-7 h-7 rounded grid place-items-center text-[#7a87ad] hover:text-cyan-200 hover:bg-white/[0.06] transition"
        >
          <ExternalLink size={12} />
        </button>
        <button
          data-testid="video-player-minimize"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}
          title={minimized ? "Restore" : "Minimize"}
          className="w-7 h-7 rounded grid place-items-center text-[#7a87ad] hover:text-cyan-200 hover:bg-white/[0.06] transition"
        >
          {minimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
        </button>
        <button
          data-testid="video-player-close"
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          title="Close player"
          aria-label="Close player"
          className="w-7 h-7 rounded grid place-items-center text-[#7a87ad] hover:text-rose-200 hover:bg-rose-500/15 transition"
        >
          <X size={13} />
        </button>
      </div>

      {/* iframe + resize handle (hidden when minimized) */}
      {!minimized && (
        <>
          <div className="flex-1 bg-black relative">
            <iframe
              data-testid="video-player-iframe"
              src={embed.embedUrl}
              title={`${providerLabel} player`}
              allow="accelerometer; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
          <div
            data-testid="video-player-resize"
            onMouseDown={(e) => beginDrag("resize", e)}
            aria-hidden
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            style={{
              background:
                "linear-gradient(135deg, transparent 50%, rgba(0,240,255,0.7) 50%)",
            }}
          />
        </>
      )}
    </div>
  );
}

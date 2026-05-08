import React from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  ArrowRight,
  Minus,
  StickyNote,
  Image as ImageIcon,
  Sticker,
  MessageCircle,
  ScrollText,
  Smile,
  Square as SquareIcon,
} from "lucide-react";

/**
 * Canvas right-click "Insert here" menu.
 *
 * Portalled to document.body because the canvas viewport applies a CSS
 * transform that breaks position:fixed children. Self-contained — owns
 * its backdrop and dismissal, but every action is delegated to props so
 * the parent canvas remains the single source of truth for tree mutations.
 *
 * The menu adapts to the current selection:
 *   - 0/1 selection: shows "Insert here" + "Compile whole map".
 *   - 2+ selection : shows "Join", "Group as branch", and "Compile selection".
 * Clipboard buttons are always rendered (with disabled states) so
 * muscle-memory positions never shift between right-clicks.
 */
export default function CanvasContextMenu({
  menu,
  onClose,
  multiSelected,
  hasSelection,
  hasClipboard,
  cutSelection,
  copySelection,
  pasteFromClipboard,
  joinSelectedWithLine,
  groupSelectedAsBranch,
  openCompileDialog,
  addAnnotation,
  addConnector,
  pickImageFile,
  setClipartOpen,
}) {
  if (!menu) return null;
  const sel = multiSelected.size;

  return createPortal(
    <>
      <div
        data-testid="mm-canvas-ctx-backdrop"
        className="fixed inset-0"
        style={{ zIndex: 9990 }}
        onMouseDown={onClose}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        data-testid="mm-canvas-ctx-menu"
        className="fixed glass-panel rounded-lg p-1.5 fade-up"
        style={{
          zIndex: 9991,
          left: Math.min(menu.x, window.innerWidth - 220),
          top: Math.min(menu.y, window.innerHeight - 420),
          width: 210,
          borderColor: "rgba(0,240,255,0.3)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 px-2 py-1">
          Insert here
        </div>
        {/* Clipboard actions — always present so positions never shift. */}
        <div className="px-2 py-1 grid grid-cols-3 gap-1">
          <button
            data-testid="mm-canvas-ctx-cut"
            onClick={() => { cutSelection(); onClose(); }}
            disabled={!hasSelection()}
            title="Cut selection (Ctrl+X)"
            className="flex flex-col items-center gap-0.5 px-1 py-1 rounded text-[10px] text-cyan-200 hover:bg-cyan-500/15 disabled:text-[#566187] disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
          >
            <span className="text-[14px]">✂</span>
            Cut
          </button>
          <button
            data-testid="mm-canvas-ctx-copy"
            onClick={() => { copySelection(); onClose(); }}
            disabled={!hasSelection()}
            title="Copy selection (Ctrl+C)"
            className="flex flex-col items-center gap-0.5 px-1 py-1 rounded text-[10px] text-cyan-200 hover:bg-cyan-500/15 disabled:text-[#566187] disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
          >
            <span className="text-[14px]">⧉</span>
            Copy
          </button>
          <button
            data-testid="mm-canvas-ctx-paste"
            onClick={() => { pasteFromClipboard(); onClose(); }}
            disabled={!hasClipboard()}
            title="Paste at cursor (Ctrl+V)"
            className="flex flex-col items-center gap-0.5 px-1 py-1 rounded text-[10px] text-cyan-200 hover:bg-cyan-500/15 disabled:text-[#566187] disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
          >
            <span className="text-[14px]">⎘</span>
            Paste
          </button>
        </div>
        <div className="border-t border-white/5 my-1" />

        {sel >= 2 && (
          <>
            <button
              data-testid="mm-canvas-ctx-join-line"
              onClick={() => { joinSelectedWithLine(false); onClose(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-fuchsia-200 hover:bg-fuchsia-500/15 transition"
            >
              <Minus size={12} className="text-fuchsia-300" />
              Join {sel} with line
            </button>
            <button
              data-testid="mm-canvas-ctx-join-arrow"
              onClick={() => { joinSelectedWithLine(true); onClose(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-fuchsia-200 hover:bg-fuchsia-500/15 transition"
            >
              <ArrowRight size={12} className="text-fuchsia-300" />
              Join {sel} with arrow
            </button>
            <button
              data-testid="mm-canvas-ctx-group-branch"
              onClick={() => { groupSelectedAsBranch(); onClose(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-fuchsia-200 hover:bg-fuchsia-500/15 transition"
              title="Move the selected map elements under a new parent branch"
            >
              <Plus size={12} className="text-fuchsia-300" />
              Group {sel} as branch
            </button>
            <button
              data-testid="mm-canvas-ctx-compile-selection"
              onClick={() => { openCompileDialog("selection"); onClose(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-cyan-200 hover:bg-cyan-500/15 transition"
              title="AI compiles the selected map elements into a written document"
            >
              <ScrollText size={12} className="text-cyan-300" />
              Compile {sel} to document
            </button>
            <div className="h-px bg-white/5 my-1" />
          </>
        )}

        <button
          data-testid="mm-canvas-ctx-sticky"
          onClick={() => { addAnnotation({ type: "sticky" }); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-amber-500/15 hover:text-amber-100 transition"
        >
          <StickyNote size={12} style={{ color: "#ffec3d" }} />
          Sticky note
        </button>
        <button
          data-testid="mm-canvas-ctx-text"
          onClick={() => { addAnnotation({ type: "text" }); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
        >
          <span className="w-3 grid place-items-center text-cyan-300">T</span>
          Text box
        </button>
        <button
          data-testid="mm-canvas-ctx-shape"
          onClick={() => { addAnnotation({ type: "shape" }); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
          title="Floating shape with editable text — start a side-by-side mini-map or page heading"
        >
          <SquareIcon size={12} style={{ color: "#39E0FF" }} />
          Shape (free-floating)
        </button>
        <button
          data-testid="mm-canvas-ctx-image"
          onClick={() => { pickImageFile(); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
        >
          <ImageIcon size={12} className="text-cyan-300" />
          Image…
        </button>
        <button
          data-testid="mm-canvas-ctx-clipart"
          onClick={() => { setClipartOpen(true); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-fuchsia-500/15 hover:text-fuchsia-200 transition"
        >
          <Sticker size={12} style={{ color: "#ff6ad5" }} />
          Clipart…
        </button>
        <button
          data-testid="mm-canvas-ctx-comment"
          onClick={() => { addAnnotation({ type: "comment" }); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
        >
          <MessageCircle size={12} style={{ color: "#00f0ff" }} />
          Comment (speech bubble)
        </button>
        <div className="h-px bg-white/5 my-1" />
        <button
          data-testid="mm-canvas-ctx-line"
          onClick={() => { addConnector({ arrow: false, label: "Line added" }); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
        >
          <Minus size={12} className="text-cyan-300" />
          Line
        </button>
        <button
          data-testid="mm-canvas-ctx-arrow"
          onClick={() => { addConnector({ arrow: true, label: "Arrow added" }); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#cfdaf3] hover:bg-cyan-500/15 hover:text-cyan-100 transition"
        >
          <ArrowRight size={12} className="text-cyan-300" />
          Arrow
        </button>
        <div className="h-px bg-white/5 my-1" />
        <button
          data-testid="mm-canvas-ctx-icon"
          onClick={() => {
            // Drop a small placeholder sticky — the icon picker is reached
            // through the node-level menu, so this is a discoverability nudge.
            addAnnotation({ type: "sticky" });
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-[#9aaad0] hover:text-fuchsia-200 transition"
          title="Tip: drop a map element first, then right-click it for icons"
        >
          <Smile size={12} className="text-fuchsia-300" />
          Icon… (use node menu)
        </button>
        {sel < 2 && (
          <>
            <div className="h-px bg-white/5 my-1" />
            <button
              data-testid="mm-canvas-ctx-compile-map"
              onClick={() => { openCompileDialog("whole-map"); onClose(); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[12px] text-cyan-200 hover:bg-cyan-500/15 transition"
              title="AI compiles the whole map into a written document"
            >
              <ScrollText size={12} className="text-cyan-300" />
              Compile map to document…
            </button>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}

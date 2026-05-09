import React from "react";
import {
  Check,
  Undo2,
  Redo2,
  Shapes,
  StickyNote,
  Type as TypeIcon,
  Square as SquareIcon,
  Image as ImageIcon,
  Image as LucideImage,
  Sticker,
  Minus,
  ArrowRight,
  Link as LinkIcon,
  MessageCircle,
  ScrollText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ImagePlus,
  FileCode2,
  FileText as FileTextIcon,
  FileDown,
  Camera,
  Printer,
  Cloud,
  Palette,
  RotateCw,
  Clock,
} from "lucide-react";

import DraggablePanel from "@/components/DraggablePanel";
import CloudSaveMenu from "@/components/CloudSaveMenu";
import BackgroundPicker from "@/components/BackgroundPicker";
import { SHAPE_PALETTE } from "@/components/ContextMenu";
import { ToolbarBtn, ToolbarDivider, ShapeBtn } from "@/components/mindmap/render/Buttons";

/**
 * Floating top toolbar: undo/redo, shape picker, insert tools, zoom,
 * exports, cloud save, background picker.
 *
 * Pure presentation — every action is a callback the parent canvas owns.
 * Two toolbar-internal pieces of state (`shapePickerOpen`, `bgPickerOpen`,
 * `cloudSaveOpen`) are lifted to the parent so opening one menu can close
 * sibling menus without prop-drilling refs.
 *
 * Layout note: wrapped in `<DraggablePanel>` so the user can drag the
 * toolbar out of the way over very dense maps. Position persists in
 * localStorage under the `storageKey` below.
 */
export default function TopToolbar({
  justSaved,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedNode,
  isPro,
  isProOnly = false,
  shapePickerOpen,
  setShapePickerOpen,
  onPickShape,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onExportPng,
  onExportHighResPng,
  onExportSvg,
  onExportMarkdown,
  onExportPdf,
  onExportJson,
  onExportMmap,
  onScreenshot,
  currentBackground,
  bgPickerOpen,
  setBgPickerOpen,
  onPickBackground,
  onAddSticky,
  onAddText,
  onAddShape,
  onAddImage,
  onAddClipart,
  onAddLine,
  onAddArrow,
  onToggleConnect,
  connectMode,
  onAddComment,
  onAddTimeline,
  onCompile,
  map,
  onUpgrade,
  cloudSaveOpen,
  setCloudSaveOpen,
  // "h" | "v" — vertical lays the toolbar out as a slim column on the
  // left edge of the canvas, useful for very wide maps where the
  // horizontal toolbar would crowd the title.
  orientation = "h",
  onToggleOrientation,
  // When true (Pure Local Mode), every action that would send data to a
  // remote service is hidden.  Local exports (PNG, SVG, MD, JSON, .mmap)
  // remain available — they only ever touch the user's own device.
  privacyOn = false,
}) {
  const zoomPct = Math.round(zoom * 100);
  const currentShape = selectedNode?.shape || "rect";
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl";
  const isVertical = orientation === "v";

  return (
    <DraggablePanel
      testid="mm-top-toolbar-wrap"
      storageKey={isVertical ? "mm.topToolbarPos.v" : "mm.topToolbarPos"}
      defaultPos={isVertical ? { x: 245, y: 120 } : { x: 290, y: 145 }}
      label="Toolbar"
      zIndex={30}
      className={`rounded-2xl glass-panel fade-up ${isVertical ? "max-h-[calc(100vh-160px)]" : "max-w-[calc(100vw-300px)]"}`}
      style={{ borderColor: "rgba(0,240,255,0.22)" }}
    >
      <div
        data-testid="mm-top-toolbar"
        data-orient={orientation}
        className={`flex items-center gap-1 px-2 py-1.5 ${
          isVertical ? "flex-col overflow-y-auto max-h-[80vh]" : "flex-row overflow-x-auto"
        }`}
        style={{ pointerEvents: "auto" }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
      {/* Save status — compact for horizontal layout */}
      <div
        data-testid="mm-save-status"
        className={`flex items-center gap-1 px-1.5 py-1 rounded-md mono text-[8px] uppercase tracking-[0.18em] transition-colors shrink-0 ${
          justSaved ? "text-emerald-300" : "text-[#7a87ad]"
        }`}
        title="Auto-saved locally"
      >
        <Check size={12} className={justSaved ? "opacity-100" : "opacity-40"} />
        {justSaved ? "Saved" : "Auto"}
      </div>

      <ToolbarDivider vertical={isVertical} />

      {onToggleOrientation && (
        <ToolbarBtn
          testid="mm-tb-orient-toggle"
          label={isVertical ? "Switch toolbar to horizontal" : "Switch toolbar to vertical"}
          onClick={onToggleOrientation}
        >
          <RotateCw size={14} className={isVertical ? "" : "rotate-90"} />
        </ToolbarBtn>
      )}

      <ToolbarDivider vertical={isVertical} />

      <ToolbarBtn testid="mm-tb-undo" label={`Undo (${modKey}Z)`} onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        testid="mm-tb-redo"
        label={`Redo (${modKey}⇧Z)`}
        onClick={onRedo}
        disabled={!canRedo}
      >
        <Redo2 size={14} />
      </ToolbarBtn>

      <ToolbarDivider vertical={isVertical} />

      {/* Shape picker — when a map element is selected, lets the user change
          its shape. When nothing is selected, drops a free-floating shape on
          the canvas (same as the dedicated mm-tb-insert-shape button below
          but discoverable from this primary entry point too). */}
      <div className="relative">
        <ToolbarBtn
          testid="mm-tb-shapes"
          label={selectedNode
            ? "Change selected map element's shape"
            : "Insert free-floating shape · select a map element first to change its shape"}
          onClick={() => {
            if (selectedNode) {
              setShapePickerOpen((o) => !o);
            } else if (onAddShape) {
              onAddShape();
            }
          }}
          active={shapePickerOpen}
        >
          <Shapes size={14} />
        </ToolbarBtn>
        {shapePickerOpen && selectedNode && (
          <div
            data-testid="mm-tb-shape-menu"
            className={`absolute p-2.5 glass-panel rounded-xl fade-up z-50 ${
              isVertical ? "left-full top-0 ml-2" : "top-full left-0 mt-2"
            }`}
            style={{ borderColor: "rgba(0,240,255,0.28)", minWidth: 220 }}
          >
            <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5">
              Basic
            </div>
            <div className="grid grid-cols-4 gap-1 mb-2.5">
              {SHAPE_PALETTE.filter((s) => s.group === "basic").map((s) => {
                const locked = s.pro && !isPro;
                const active = currentShape === s.value;
                return (
                  <ShapeBtn key={s.value} shape={s} locked={locked} active={active} onPick={onPickShape} />
                );
              })}
            </div>
            <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5">
              Flowchart {!isPro && <span className="text-fuchsia-300/70 normal-case tracking-normal">· Pro</span>}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {SHAPE_PALETTE.filter((s) => s.group === "flowchart").map((s) => {
                const locked = s.pro && !isPro;
                const active = currentShape === s.value;
                return (
                  <ShapeBtn key={s.value} shape={s} locked={locked} active={active} onPick={onPickShape} />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ToolbarDivider vertical={isVertical} />

      {/* Insert — sticky / text / image / clipart / line / arrow */}
      <ToolbarBtn testid="mm-tb-insert-sticky" label="Insert sticky note (auto-saves to Reminders)" onClick={onAddSticky}>
        <StickyNote size={14} style={{ color: "#ffec3d" }} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-insert-text" label="Insert text box" onClick={onAddText}>
        <TypeIcon size={14} />
      </ToolbarBtn>
      {onAddShape && (
        <ToolbarBtn testid="mm-tb-insert-shape" label="Insert standalone shape with editable text (heading, side-by-side mini-map, divider)" onClick={onAddShape}>
          <SquareIcon size={14} style={{ color: "#39E0FF" }} />
        </ToolbarBtn>
      )}
      <ToolbarBtn testid="mm-tb-insert-image" label="Insert image" onClick={onAddImage}>
        <LucideImage size={14} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-insert-clipart" label="Insert clipart (decorative SVG icon)" onClick={onAddClipart}>
        <Sticker size={14} style={{ color: "#ff6ad5" }} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-insert-line" label="Insert editable line (drag endpoints to position)" onClick={onAddLine}>
        <Minus size={14} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-insert-arrow" label="Insert editable arrow (drag endpoints to position)" onClick={onAddArrow}>
        <ArrowRight size={14} />
      </ToolbarBtn>
      {onToggleConnect && (
        <ToolbarBtn
          testid="mm-tb-connect-mode"
          label={connectMode
            ? "Connection mode ON · click 2 map elements to connect them · Esc to exit"
            : "Click-to-connect: pick first map element, then second — instant labelled arrow"}
          active={connectMode}
          onClick={onToggleConnect}
        >
          <LinkIcon size={14} style={{ color: connectMode ? "#ff6ad5" : undefined }} />
        </ToolbarBtn>
      )}
      {onAddComment && (
        <ToolbarBtn testid="mm-tb-insert-comment" label="Insert comment (speech bubble) — collapses to icon, hover to preview" onClick={onAddComment}>
          <MessageCircle size={14} style={{ color: "#00f0ff" }} />
        </ToolbarBtn>
      )}
      {onAddTimeline && (
        <ToolbarBtn testid="mm-tb-insert-timeline" label="Insert timeline (16:9 card · click to open in Timeline Studio)" onClick={onAddTimeline}>
          <Clock size={14} style={{ color: "#a08cff" }} />
        </ToolbarBtn>
      )}
      {onCompile && (
        <ToolbarBtn testid="mm-tb-compile-doc" label="Compile map to a written document (AI)" onClick={() => onCompile()}>
          <ScrollText size={14} style={{ color: "#00f0ff" }} />
        </ToolbarBtn>
      )}

      <ToolbarDivider vertical={isVertical} />

      <ToolbarBtn testid="mm-tb-zoom-in" label="Zoom in" onClick={onZoomIn}>
        <ZoomIn size={14} />
      </ToolbarBtn>
      <div
        data-testid="mm-tb-zoom-level"
        className="mono text-[9px] uppercase tracking-[0.18em] text-[#9aaad0] text-center select-none py-0.5"
      >
        {zoomPct}%
      </div>
      <ToolbarBtn testid="mm-tb-zoom-out" label="Zoom out" onClick={onZoomOut}>
        <ZoomOut size={14} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-fit" label="Fit to view" onClick={onFit}>
        <Maximize2 size={14} />
      </ToolbarBtn>

      <ToolbarDivider vertical={isVertical} />

      <ToolbarBtn testid="mm-tb-export-png" label="Export as PNG (image)" onClick={onExportPng}>
        <ImageIcon size={14} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-export-png-4x" label="Export as high-res PNG (4×)" onClick={onExportHighResPng}>
        <ImagePlus size={14} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-export-svg" label="Export as SVG (vector)" onClick={onExportSvg}>
        <FileCode2 size={14} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-export-pdf" label="Export as PDF" onClick={onExportPdf}>
        <span className="mono text-[9px] font-semibold tracking-[0.05em]">PDF</span>
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-export-md" label="Export as Markdown" onClick={onExportMarkdown}>
        <FileTextIcon size={14} />
      </ToolbarBtn>
      <ToolbarBtn testid="mm-tb-export-json" label="Export as JSON (backup / import elsewhere)" onClick={onExportJson}>
        <FileDown size={14} />
      </ToolbarBtn>
      {onExportMmap && (
        <ToolbarBtn
          testid="mm-tb-export-mmap"
          label="Save as .mmap (Marvex Studio file — share with collaborators on the same software)"
          onClick={onExportMmap}
        >
          <span className="mono text-[8px] font-semibold tracking-[0.05em]">.MM</span>
        </ToolbarBtn>
      )}
      <ToolbarBtn
        testid="mm-tb-screenshot"
        label="Screen capture (select region)"
        onClick={onScreenshot}
      >
        <Camera size={14} />
      </ToolbarBtn>
      <ToolbarBtn
        testid="mm-tb-print"
        label="Print visible canvas (Ctrl/⌘ + P)"
        onClick={() => {
          // Add a transient class to <body> so our @media print CSS hides
          // the chrome and prints only the canvas. Removed after the print
          // dialog closes (afterprint event fires reliably in Chromium/Safari).
          document.body.classList.add("printing-canvas");
          const cleanup = () => {
            document.body.classList.remove("printing-canvas");
            window.removeEventListener("afterprint", cleanup);
          };
          window.addEventListener("afterprint", cleanup);
          // Slight tick so the DOM has applied the class before print snapshot.
          setTimeout(() => window.print(), 50);
        }}
      >
        <Printer size={14} />
      </ToolbarBtn>

      <ToolbarDivider vertical={isVertical} />

      {/* Cloud Save — opens to the LEFT of the toolbar */}
      {!privacyOn && (
      <div className="relative">
        <ToolbarBtn
          testid="mm-tb-cloud-save"
          label="Save to cloud (Drive / Dropbox)"
          onClick={() => {
            setCloudSaveOpen((o) => !o);
            setBgPickerOpen(false);
          }}
          active={cloudSaveOpen}
        >
          <Cloud size={14} />
        </ToolbarBtn>
        <CloudSaveMenu
          open={cloudSaveOpen}
          map={map}
          isPro={isPro}
          isProOnly={isProOnly}
          onUpgrade={onUpgrade}
          onClose={() => setCloudSaveOpen(false)}
        />
      </div>
      )}

      {!privacyOn && <ToolbarDivider vertical={isVertical} />}

      {/* Backdrop picker — opens to the LEFT */}
      <div className="relative">
        <ToolbarBtn
          testid="mm-tb-backdrop"
          label="Canvas background"
          onClick={() => {
            setBgPickerOpen((o) => !o);
            setCloudSaveOpen(false);
          }}
          active={bgPickerOpen}
        >
          <Palette size={14} />
        </ToolbarBtn>
        {bgPickerOpen && (
          <div className={`absolute z-50 ${isVertical ? "left-full top-0 ml-2" : "top-full right-0 mt-2"}`}>
            <BackgroundPicker
              current={currentBackground}
              onPick={(v) => onPickBackground(v)}
              onClose={() => setBgPickerOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
    </DraggablePanel>
  );
}

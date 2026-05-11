import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit3, Lock, Link as LinkIcon, ExternalLink, BookOpen, Bookmark, Sparkles, TreePine, Zap, Smile, Upload, Move, X, Minus, ArrowRight, ScrollText, Palette } from "lucide-react";
import { FLOWCHART_SHAPES } from "@/lib/flowchart";

export const SHAPE_PALETTE = [
  // Free / basic
  { name: "Rect",    value: "rect",    group: "basic" },
  { name: "Ellipse", value: "ellipse", group: "basic" },
  { name: "Round",   value: "round",   group: "basic" },
  // Pro — flowchart
  { name: "Hex",      value: "hex",           group: "flowchart", pro: true },
  { name: "Diamond",  value: "diamond",       group: "flowchart", pro: true },
  { name: "Document", value: "document",      group: "flowchart", pro: true },
  { name: "Pill",     value: "pill",          group: "flowchart", pro: true },
  { name: "Data",     value: "parallelogram", group: "flowchart", pro: true },
  { name: "Cylinder", value: "cylinder",      group: "flowchart", pro: true },
  { name: "Cloud",    value: "cloud",         group: "flowchart", pro: true },
  // Pro — fun shapes
  { name: "Star",     value: "star",          group: "fun", pro: true },
  { name: "Triangle", value: "triangle",      group: "fun", pro: true },
  { name: "Heart",    value: "heart",         group: "fun", pro: true },
  { name: "Speech",   value: "speech",        group: "fun", pro: true },
  { name: "Burst",    value: "burst",         group: "fun", pro: true },
];

export const COLOR_PALETTE = [
  { name: "Cyan",    fill: "rgba(3,20,36,0.85)",   stroke: "#00f0ff" },
  { name: "Violet",  fill: "rgba(24,14,56,0.85)",  stroke: "#8a5bff" },
  { name: "Pink",    fill: "rgba(50,10,40,0.85)",  stroke: "#ff6ad5" },
  { name: "Amber",   fill: "rgba(45,30,5,0.85)",   stroke: "#ffb547" },
  { name: "Emerald", fill: "rgba(6,40,28,0.85)",   stroke: "#3ddc84" },
  { name: "White",   fill: "rgba(30,40,60,0.85)",  stroke: "#cfe0ff" },
];

export const EDGE_COLORS = [
  "#00f0ff", "#8a5bff", "#ff6ad5", "#ffb547", "#3ddc84", "#cfe0ff",
];

// Font size as numeric points — easier to reason about than S/M/L labels.
// Two compact rows of 6 in the picker so all sizes fit at a glance.
export const FONT_SIZES = [
  { name: "10", value: 10 },
  { name: "11", value: 11 },
  { name: "12", value: 12 },
  { name: "13", value: 13 },
  { name: "14", value: 14 },
  { name: "16", value: 16 },
  { name: "18", value: 18 },
  { name: "20", value: 20 },
  { name: "24", value: 24 },
  { name: "28", value: 28 },
  { name: "32", value: 32 },
  { name: "40", value: 40 },
];

// 30 curated fonts from Google Fonts (loaded via index.html link rel).
// Mix of sans/serif/mono/display/handwritten so users can match the vibe of
// any map.  Keeps the surface tight — full Google Fonts picker comes later.
export const FONT_FAMILIES = [
  // Sans (free)
  { name: "Sora",         value: "'Sora', sans-serif" },
  { name: "Inter",        value: "'Inter', sans-serif" },
  { name: "Outfit",       value: "'Outfit', sans-serif" },
  { name: "Manrope",      value: "'Manrope', sans-serif" },
  // Serif
  { name: "Lora",         value: "'Lora', serif", pro: true },
  { name: "Playfair",     value: "'Playfair Display', serif", pro: true },
  { name: "Crimson",      value: "'Crimson Text', serif", pro: true },
  { name: "Cormorant",    value: "'Cormorant Garamond', serif", pro: true },
  { name: "Spectral",     value: "'Spectral', serif", pro: true },
  { name: "Georgia",      value: "Georgia, serif", pro: true },
  // Mono
  { name: "JetBrains",    value: "'JetBrains Mono', monospace", pro: true },
  { name: "Fira Code",    value: "'Fira Code', monospace", pro: true },
  { name: "IBM Plex Mono",value: "'IBM Plex Mono', monospace", pro: true },
  { name: "Space Mono",   value: "'Space Mono', monospace", pro: true },
  // Display / decorative
  { name: "Bebas",        value: "'Bebas Neue', sans-serif", pro: true },
  { name: "Space Grotesk",value: "'Space Grotesk', sans-serif", pro: true },
  { name: "Archivo",      value: "'Archivo Black', sans-serif", pro: true },
  { name: "Anton",        value: "'Anton', sans-serif", pro: true },
  { name: "Righteous",    value: "'Righteous', cursive", pro: true },
  { name: "Russo",        value: "'Russo One', sans-serif", pro: true },
  // Handwritten / casual
  { name: "Caveat",       value: "'Caveat', cursive", pro: true },
  { name: "Kalam",        value: "'Kalam', cursive", pro: true },
  { name: "Patrick Hand", value: "'Patrick Hand', cursive", pro: true },
  { name: "Indie Flower", value: "'Indie Flower', cursive", pro: true },
  { name: "Shadows",      value: "'Shadows Into Light', cursive", pro: true },
  // Modern / geometric
  { name: "Quicksand",    value: "'Quicksand', sans-serif", pro: true },
  { name: "Nunito",        value: "'Nunito', sans-serif", pro: true },
  { name: "Poppins",       value: "'Poppins', sans-serif", pro: true },
  { name: "DM Sans",       value: "'DM Sans', sans-serif", pro: true },
  { name: "Work Sans",     value: "'Work Sans', sans-serif", pro: true },
];

/**
 * Right-click context menu with per-target options.
 * Props:
 *  - menu: { type: 'node'|'edge', id, x, y }
 *  - node / edge: state objects (optional) — used to highlight current values
 *  - onClose()
 *  - onSetShape(shape)
 *  - onSetColor({fill, stroke})
 *  - onSetFontSize(size) / onSetFontFamily(family)
 *  - onAddChild() / onAiExpand() / onDeleteNode()
 *  - onSetEdgeColor(c) / onSetEdgeWidth(w) / onSetEdgeDashed(b) / onDeleteEdge()
 */
export default function ContextMenu({
  menu,
  node,
  edge,
  isPro = false,
  onUpgrade,
  onClose,
  onSetShape,
  onSetColor,
  onSetFontSize,
  onSetFontFamily,
  onAddChild,
  onAiExpand,
  onDeleteNode,
  onEditLink,
  onUploadLink,
  onInsertBookmark,
  onOpenLink,
  onPickIcon,
  onFindBook,
  onResearch,
  onDeepen,
  onDeepResearch,
  onAddSibling,
  joinCount = 0,
  onJoinLine,
  onJoinArrow,
  onGroupBranch,
  onApplyStyleToSelection,
  onCompile,
  onSetEdgeColor,
  onSetEdgeWidth,
  onSetEdgeDashed,
  onSetEdgeArrow,
  onSetEdgeLabel,
  onDeleteEdge,
  // Flowchart Studio extras — when flowchartMode is true the AddRow
  // shows a 9-shape palette instead of the generic Child/Sibling row.
  flowchartMode = false,
  onAddShapeChild,
  // When the active node is a flowchart "decision" shape we surface a
  // one-click "Branch Yes/No" button right above the shape grid. Caller
  // creates two child process nodes labelled Yes + No respectively.
  onBranchYesNo,
}) {
  const [pos, setPos] = useState(null);
  const dragRef = useRef(null);

  // Reset drag-position whenever a fresh menu is opened.
  useEffect(() => { setPos(null); }, [menu?.id, menu?.x, menu?.y]);

  if (!menu) return null;

  // Clamp to viewport. The menu uses overflow-y-auto inside, so even on
  // small screens nothing gets cut off — user can scroll within the panel
  // OR drag it by the header.
  const W = 280;
  const maxH = Math.max(360, window.innerHeight - 24);
  const initialX = Math.min(menu.x, window.innerWidth - W - 12);
  const initialY = Math.min(menu.y, Math.max(12, window.innerHeight - 200));
  const x = pos ? pos.x : initialX;
  const y = pos ? pos.y : initialY;

  const isNode = menu.type === "node";

  // Drag the panel by its header so the user can move it out of the way.
  const onHeaderMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const nx = Math.max(8, Math.min(window.innerWidth - W - 8, d.origX + (ev.clientX - d.startX)));
      const ny = Math.max(8, Math.min(window.innerHeight - 80, d.origY + (ev.clientY - d.startY)));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Wrap premium actions: trigger upgrade dialog for non-Pro users
  const gatedShape = (shape) => {
    const meta = SHAPE_PALETTE.find((s) => s.value === shape);
    if (meta?.pro && !isPro) { onUpgrade && onUpgrade(); return; }
    onSetShape(shape);
  };
  const gatedFont = (fontValue) => {
    const meta = FONT_FAMILIES.find((f) => f.value === fontValue);
    if (meta?.pro && !isPro) { onUpgrade && onUpgrade(); return; }
    onSetFontFamily(fontValue);
  };

  return createPortal((
    <>
      {/* backdrop to catch outside-clicks (no visual blocker so canvas stays visible) */}
      <div
        data-testid="ctx-backdrop"
        onMouseDown={onClose}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
        className="fixed inset-0"
        style={{ zIndex: 9990 }}
      />
      <div
        data-testid="mm-context-menu"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed glass-panel rounded-xl fade-up flex flex-col"
        style={{
          zIndex: 9991,
          left: x,
          top: y,
          width: W,
          maxHeight: maxH,
          borderColor: "rgba(0,240,255,0.25)",
        }}
      >
        {/* Drag handle header — keeps the menu reachable when the canvas is busy. */}
        <div
          data-testid="mm-ctx-drag-handle"
          onMouseDown={onHeaderMouseDown}
          className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5 cursor-move select-none rounded-t-xl"
          style={{ background: "rgba(0,240,255,0.05)" }}
        >
          <div className="flex items-center gap-1.5 text-cyan-200 mono text-[10px] uppercase tracking-[0.22em]">
            <Move size={11} className="opacity-70" /> {isNode ? "Map element properties" : "Edge properties"}
          </div>
          <button
            data-testid="mm-ctx-close"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-0.5 rounded transition"
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
        {/* Scrollable content — guarantees no info ever gets clipped. */}
        <div className="overflow-y-auto p-3" style={{ maxHeight: maxH - 44 }}>
        {isNode && node ? (
          <NodeMenu
            node={node}
            isPro={isPro}
            joinCount={joinCount}
            onJoinLine={onJoinLine}
            onJoinArrow={onJoinArrow}
            onGroupBranch={onGroupBranch}
            onApplyStyleToSelection={onApplyStyleToSelection}
            onCompile={onCompile}
            onSetShape={gatedShape}
            onSetColor={onSetColor}
            onSetFontSize={onSetFontSize}
            onSetFontFamily={gatedFont}
            onAddChild={onAddChild}
            onAddSibling={onAddSibling}
            flowchartMode={flowchartMode}
            onAddShapeChild={onAddShapeChild}
            onBranchYesNo={onBranchYesNo}
            onDeleteNode={onDeleteNode}
            onEditLink={onEditLink}
            onUploadLink={onUploadLink}
            onInsertBookmark={onInsertBookmark}
            onOpenLink={onOpenLink}
            onPickIcon={onPickIcon}
            onFindBook={onFindBook}
            onResearch={onResearch}
            onDeepen={onDeepen}
            onDeepResearch={onDeepResearch}
          />
        ) : (
          <EdgeMenu
            edge={edge || {}}
            onSetEdgeColor={onSetEdgeColor}
            onSetEdgeWidth={onSetEdgeWidth}
            onSetEdgeDashed={onSetEdgeDashed}
            onSetEdgeArrow={onSetEdgeArrow}
            onSetEdgeLabel={onSetEdgeLabel}
            onDeleteEdge={onDeleteEdge}
          />
        )}
        </div>
      </div>
    </>
  ), document.body);
}

const SectionTitle = ({ children }) => (
  <div className="mono text-[9px] uppercase tracking-[0.25em] text-cyan-300/80 mb-1.5 mt-1">
    {children}
  </div>
);

const NodeMenu = ({
  node,
  isPro,
  joinCount = 0,
  onJoinLine,
  onJoinArrow,
  onGroupBranch,
  onApplyStyleToSelection,
  onCompile,
  onSetShape,
  onSetColor,
  onSetFontSize,
  onSetFontFamily,
  onAddChild,
  onAddSibling,
  flowchartMode = false,
  onAddShapeChild,
  onBranchYesNo,
  onDeleteNode,
  onEditLink,
  onUploadLink,
  onInsertBookmark,
  onOpenLink,
  onPickIcon,
  onFindBook,
  onResearch,
  onDeepen,
  onDeepResearch,
}) => (
  <div className="space-y-2">
    {/* JOIN — only when 2+ items are multi-selected (Shift-click pool). Lets
        the user create line/arrow connectors between selected items in one
        click. Surfaced at the very top so it's the first thing they see. */}
    {joinCount >= 2 && (onJoinLine || onJoinArrow || onGroupBranch) && (
      <>
        <div className="flex flex-col gap-1">
          {onJoinLine && (
            <ActionRow
              icon={Minus}
              label={`Join ${joinCount} with line`}
              onClick={onJoinLine}
              testid="mm-ctx-join-line"
              iconClass="text-fuchsia-300"
            />
          )}
          {onJoinArrow && (
            <ActionRow
              icon={ArrowRight}
              label={`Join ${joinCount} with arrow`}
              onClick={onJoinArrow}
              testid="mm-ctx-join-arrow"
              iconClass="text-fuchsia-300"
            />
          )}
          {onGroupBranch && (
            <ActionRow
              icon={Plus}
              label={`Group ${joinCount} as branch`}
              onClick={onGroupBranch}
              testid="mm-ctx-group-branch"
              iconClass="text-fuchsia-300"
            />
          )}
          {onApplyStyleToSelection && (
            <ActionRow
              icon={Palette}
              label={`Apply this style to ${joinCount - 1} other${joinCount === 2 ? "" : "s"}`}
              onClick={onApplyStyleToSelection}
              testid="mm-ctx-bulk-style"
              iconClass="text-fuchsia-300"
            />
          )}
        </div>
        <div className="h-px bg-white/5 my-1" />
      </>
    )}
    {/* ACTIONS — top of the menu so the most-used items are always reachable
        even when the menu is positioned near the bottom edge of the screen. */}
    <div className="flex flex-col gap-1">
      {flowchartMode && onAddShapeChild ? (
        <FlowchartShapeRow
          node={node}
          onAddShapeChild={onAddShapeChild}
          onAddSibling={onAddSibling}
          onBranchYesNo={onBranchYesNo}
        />
      ) : (
        <AddChildSiblingRow onAddChild={onAddChild} onAddSibling={onAddSibling} />
      )}
      {onCompile && (
        <ActionRow
          icon={ScrollText}
          label="Compile to document"
          onClick={onCompile}
          testid="mm-ctx-compile-doc"
          iconClass="text-cyan-300"
        />
      )}
      {node.link && (
        <ActionRow
          icon={ExternalLink}
          label="Open link"
          onClick={onOpenLink}
          testid="mm-ctx-open-link"
          iconClass="text-emerald-300"
        />
      )}
      <ActionRow
        icon={LinkIcon}
        label={node.link ? "Edit link" : "Add link…"}
        onClick={onEditLink}
        testid="mm-ctx-link"
      />
      {onUploadLink && (
        <ActionRow
          icon={Upload}
          label="Upload file as link…"
          onClick={onUploadLink}
          testid="mm-ctx-upload-link"
          iconClass="text-cyan-300"
        />
      )}
      {onInsertBookmark && (
        <ActionRow
          icon={Bookmark}
          label="Insert imported bookmark…"
          onClick={onInsertBookmark}
          testid="mm-ctx-insert-bookmark"
          iconClass="text-amber-300"
        />
      )}
      {onPickIcon && (
        <ActionRow
          icon={Smile}
          label={node.icon ? "Change icon…" : "Add icon…"}
          onClick={onPickIcon}
          testid="mm-ctx-pick-icon"
          iconClass="text-fuchsia-300"
        />
      )}
      {onFindBook && (
        <ActionRow
          icon={BookOpen}
          label="Find this book / paper…"
          onClick={onFindBook}
          testid="mm-ctx-find-book"
          iconClass="text-amber-300"
        />
      )}
      {onResearch && (
        <ActionRow
          icon={Sparkles}
          label="Send to Research Assistant"
          onClick={onResearch}
          testid="mm-ctx-research"
          iconClass="text-violet-300"
        />
      )}
      {onDeepen && (
        <ActionRow
          icon={TreePine}
          label="Deepen this branch"
          onClick={onDeepen}
          testid="mm-ctx-deepen"
          iconClass="text-emerald-300"
        />
      )}
      {onDeepResearch && (
        <ActionRow
          icon={Zap}
          label="Deep Research · 2 levels"
          onClick={onDeepResearch}
          testid="mm-ctx-deep-research"
          iconClass="text-fuchsia-300"
        />
      )}
      <ActionRow icon={Trash2} label="Delete map element" onClick={onDeleteNode} testid="mm-ctx-delete" danger />
    </div>

    <div className="h-px bg-white/5 my-2" />

    <SectionTitle>Shape {!isPro && <span className="text-fuchsia-300/70 normal-case tracking-normal">· Pro locks</span>}</SectionTitle>
    <div className="grid grid-cols-5 gap-1.5">
      {SHAPE_PALETTE.filter((s) => s.group === "basic").map((s) => {
        const locked = s.pro && !isPro;
        return (
          <button
            key={s.value}
            data-testid={`mm-ctx-shape-${s.value}`}
            onClick={() => onSetShape(s.value)}
            className={`relative rounded-md py-1.5 text-[10px] mono uppercase tracking-[0.15em] border transition ${
              node.shape === s.value
                ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                : locked
                  ? "border-white/10 bg-white/[0.02] text-[#7a6da0] hover:border-fuchsia-400/60 hover:text-fuchsia-200"
                  : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50 hover:text-cyan-200"
            }`}
            title={locked ? `${s.name} · Pro` : s.name}
          >
            {s.name.slice(0, 3)}
            {locked && (
              <Lock
                size={8}
                className="absolute top-[3px] right-[3px] text-fuchsia-300"
                data-testid={`mm-ctx-shape-lock-${s.value}`}
              />
            )}
          </button>
        );
      })}
    </div>

    <SectionTitle>Flowchart {!isPro && <span className="text-fuchsia-300/70 normal-case tracking-normal">· Pro</span>}</SectionTitle>
    <div className="grid grid-cols-4 gap-1.5">
      {SHAPE_PALETTE.filter((s) => s.group === "flowchart").map((s) => {
        const locked = s.pro && !isPro;
        return (
          <button
            key={s.value}
            data-testid={`mm-ctx-shape-${s.value}`}
            onClick={() => onSetShape(s.value)}
            className={`relative rounded-md py-1.5 text-[10px] mono uppercase tracking-[0.15em] border transition ${
              node.shape === s.value
                ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                : locked
                  ? "border-white/10 bg-white/[0.02] text-[#7a6da0] hover:border-fuchsia-400/60 hover:text-fuchsia-200"
                  : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50 hover:text-cyan-200"
            }`}
            title={locked ? `${s.name} · Pro` : s.name}
          >
            {s.name.slice(0, 3)}
            {locked && (
              <Lock size={8} className="absolute top-[3px] right-[3px] text-fuchsia-300"
                data-testid={`mm-ctx-shape-lock-${s.value}`} />
            )}
          </button>
        );
      })}
    </div>

    <SectionTitle>Fun shapes {!isPro && <span className="text-fuchsia-300/70 normal-case tracking-normal">· Pro</span>}</SectionTitle>
    <div className="grid grid-cols-5 gap-1.5">
      {SHAPE_PALETTE.filter((s) => s.group === "fun").map((s) => {
        const locked = s.pro && !isPro;
        return (
          <button
            key={s.value}
            data-testid={`mm-ctx-shape-${s.value}`}
            onClick={() => onSetShape(s.value)}
            className={`relative rounded-md py-1.5 text-[10px] mono uppercase tracking-[0.12em] border transition ${
              node.shape === s.value
                ? "border-fuchsia-400 bg-fuchsia-400/10 text-fuchsia-100"
                : locked
                  ? "border-white/10 bg-white/[0.02] text-[#7a6da0] hover:border-fuchsia-400/60 hover:text-fuchsia-200"
                  : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-fuchsia-400/50 hover:text-fuchsia-200"
            }`}
            title={locked ? `${s.name} · Pro` : s.name}
          >
            {s.name.slice(0, 4)}
            {locked && (
              <Lock size={8} className="absolute top-[3px] right-[3px] text-fuchsia-300"
                data-testid={`mm-ctx-shape-lock-${s.value}`} />
            )}
          </button>
        );
      })}
    </div>

    <SectionTitle>Color</SectionTitle>
    <div className="grid grid-cols-6 gap-1.5">
      {COLOR_PALETTE.map((c, i) => (
        <button
          key={i}
          data-testid={`mm-ctx-color-${i}`}
          onClick={() => onSetColor(c)}
          className={`h-7 rounded-md border-2 transition ${
            node.stroke === c.stroke ? "ring-2 ring-offset-2 ring-offset-[#0a0f24] ring-cyan-400" : ""
          }`}
          style={{ background: c.fill, borderColor: c.stroke }}
          title={c.name}
        />
      ))}
    </div>

    <SectionTitle>Font size</SectionTitle>
    <div className="grid grid-cols-4 gap-1.5">
      {FONT_SIZES.map((f) => (
        <button
          key={f.value}
          data-testid={`mm-ctx-fontsize-${f.value}`}
          onClick={() => onSetFontSize(f.value)}
          className={`rounded-md py-1.5 text-[10px] mono tracking-[0.12em] border transition ${
            (node.fontSize || 13) === f.value
              ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50"
          }`}
        >
          {f.name}
        </button>
      ))}
    </div>

    <SectionTitle>Font family {!isPro && <span className="text-fuchsia-300/70 normal-case tracking-normal">· Pro locks</span>}</SectionTitle>
    <div className="grid grid-cols-3 gap-1.5">
      {FONT_FAMILIES.map((f) => {
        const locked = f.pro && !isPro;
        return (
          <button
            key={f.name}
            data-testid={`mm-ctx-fontfamily-${f.name.toLowerCase()}`}
            onClick={() => onSetFontFamily(f.value)}
            className={`relative rounded-md py-1.5 text-[10px] tracking-[0.08em] border transition ${
              (node.fontFamily || FONT_FAMILIES[0].value) === f.value
                ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                : locked
                  ? "border-white/10 bg-white/[0.02] text-[#7a6da0] hover:border-fuchsia-400/60 hover:text-fuchsia-200"
                  : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50"
            }`}
            style={{ fontFamily: f.value }}
            title={locked ? `${f.name} · Pro` : f.name}
          >
            {f.name}
            {locked && (
              <Lock
                size={8}
                className="absolute top-[3px] right-[3px] text-fuchsia-300"
                data-testid={`mm-ctx-font-lock-${f.name.toLowerCase()}`}
              />
            )}
          </button>
        );
      })}
    </div>

    <div className="h-px bg-white/5 my-2" />

    <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/60 text-center pt-0.5">
      Drag the header to move this menu
    </div>
  </div>
);

const EdgeMenu = ({
  edge,
  onSetEdgeColor,
  onSetEdgeWidth,
  onSetEdgeDashed,
  onSetEdgeArrow,
  onSetEdgeLabel,
  onDeleteEdge,
}) => {
  const [labelDraft, setLabelDraft] = React.useState(edge.label || "");
  React.useEffect(() => { setLabelDraft(edge.label || ""); }, [edge.label]);
  const arrowOn = edge.arrow !== false; // default true
  return (
  <div className="space-y-2">
    <SectionTitle>Line color</SectionTitle>
    <div className="grid grid-cols-6 gap-1.5">
      {EDGE_COLORS.map((c, i) => (
        <button
          key={c}
          data-testid={`mm-ctx-edge-color-${i}`}
          onClick={() => onSetEdgeColor(c)}
          className={`h-7 rounded-md border-2 ${
            edge.color === c ? "ring-2 ring-offset-2 ring-offset-[#0a0f24] ring-cyan-400" : ""
          }`}
          style={{ background: `${c}22`, borderColor: c }}
        />
      ))}
    </div>

    <SectionTitle>Thickness</SectionTitle>
    <div className="grid grid-cols-3 gap-1.5">
      {[
        { name: "Thin",  v: 1 },
        { name: "Med",   v: 2 },
        { name: "Thick", v: 3.5 },
      ].map((w) => (
        <button
          key={w.v}
          data-testid={`mm-ctx-edge-width-${w.v}`}
          onClick={() => onSetEdgeWidth(w.v)}
          className={`rounded-md py-1.5 text-[10px] mono tracking-[0.12em] border transition ${
            (edge.width || 1.1) === w.v
              ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50"
          }`}
        >
          {w.name}
        </button>
      ))}
    </div>

    <SectionTitle>Style</SectionTitle>
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { name: "Solid",  v: false },
        { name: "Dashed", v: true },
      ].map((s) => (
        <button
          key={s.name}
          data-testid={`mm-ctx-edge-style-${s.name.toLowerCase()}`}
          onClick={() => onSetEdgeDashed(s.v)}
          className={`rounded-md py-1.5 text-[10px] mono tracking-[0.12em] border transition ${
            !!edge.dashed === s.v
              ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50"
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>

    <SectionTitle>Arrow</SectionTitle>
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { name: "Line", v: false },
        { name: "Arrow", v: true },
      ].map((s) => (
        <button
          key={s.name}
          data-testid={`mm-ctx-edge-arrow-${s.name.toLowerCase()}`}
          onClick={() => onSetEdgeArrow(s.v)}
          className={`rounded-md py-1.5 text-[10px] mono tracking-[0.12em] border transition ${
            arrowOn === s.v
              ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/50"
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>

    <SectionTitle>Label</SectionTitle>
    <input
      data-testid="mm-ctx-edge-label"
      value={labelDraft}
      onChange={(e) => setLabelDraft(e.target.value)}
      onBlur={() => onSetEdgeLabel(labelDraft)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSetEdgeLabel(labelDraft); } }}
      placeholder="(no label)"
      className="w-full bg-[#0a0f24] border border-white/10 rounded-md px-2 py-1.5 text-[12px] text-white outline-none focus:border-cyan-400/60 placeholder-[#566187]"
    />

    {/* Quick verb chips — one-click semantic mapping. The verb sets the
        label AND switches the line to "arrow + dashed" so the relationship
        type is visible without requiring the user to inspect the label. */}
    <SectionTitle>Quick verb</SectionTitle>
    <div className="grid grid-cols-3 gap-1">
      {[
        { v: "causes",      arrow: true,  dashed: false, color: "#FF4F5E" },
        { v: "prevents",    arrow: true,  dashed: true,  color: "#3DDC84" },
        { v: "requires",    arrow: true,  dashed: false, color: "#FFB547" },
        { v: "supports",    arrow: true,  dashed: false, color: "#3DDC84" },
        { v: "contradicts", arrow: true,  dashed: true,  color: "#FF4F5E" },
        { v: "leads to",    arrow: true,  dashed: false, color: "#5fb6ff" },
        { v: "depends on",  arrow: true,  dashed: false, color: "#A78BFA" },
        { v: "is part of",  arrow: false, dashed: false, color: "#cfe0ff" },
        { v: "vs.",         arrow: false, dashed: true,  color: "#FFB547" },
      ].map((q) => (
        <button
          key={q.v}
          data-testid={`mm-ctx-edge-verb-${q.v.replace(/\s+/g, "-")}`}
          onClick={() => {
            setLabelDraft(q.v);
            onSetEdgeLabel(q.v);
            onSetEdgeColor(q.color);
            onSetEdgeArrow(q.arrow);
            onSetEdgeDashed(q.dashed);
          }}
          title={`Set label "${q.v}" and apply matching arrow / colour`}
          className="rounded-md py-1 text-[10px] mono tracking-[0.06em] border border-white/10 bg-white/[0.02] text-[#cfdaf3] hover:border-cyan-400/50 hover:text-cyan-200 transition"
        >
          {q.v}
        </button>
      ))}
    </div>

    <div className="h-px bg-white/5 my-2" />

    <ActionRow icon={Trash2} label="Delete line" onClick={onDeleteEdge} testid="mm-ctx-edge-delete" danger />
  </div>
  );
};

const ActionRow = ({ icon: Icon, label, onClick, testid, danger, iconClass = "text-cyan-300" }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] transition ${
      danger
        ? "text-red-300 hover:bg-red-500/10"
        : "text-[#cfdaf3] hover:bg-white/[0.04]"
    }`}
  >
    <Icon size={13} className={danger ? "text-red-300" : iconClass} />
    {label}
  </button>
);


/**
 * AddChildSiblingRow — single compact row in the context menu that lets the
 * user select a count (1-10) and add that many children OR siblings in one
 * click. Persists last-used count via localStorage so a user who likes 5 at
 * a time keeps that as their default for next session.
 */
const AddChildSiblingRow = ({ onAddChild, onAddSibling }) => {
  const [count, setCount] = React.useState(() => {
    try { return Math.max(1, Math.min(10, parseInt(localStorage.getItem("mm.addCount") || "1", 10))); }
    catch { return 1; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("mm.addCount", String(count)); } catch { /* ignore */ }
  }, [count]);
  const fire = (fn) => fn?.(count);
  return (
    <div className="flex items-stretch gap-1 px-1 py-0.5">
      <select
        data-testid="mm-ctx-add-count"
        value={count}
        onChange={(e) => setCount(parseInt(e.target.value, 10))}
        title="How many to insert"
        className="bg-white/[0.04] border border-white/10 hover:border-cyan-400/40 rounded-md text-[12px] text-cyan-200 mono px-1.5 py-1 outline-none focus:border-cyan-400 cursor-pointer"
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => (
          <option key={n} value={n}>{`${n}x`}</option>
        ))}
      </select>
      <button
        data-testid="mm-ctx-add"
        onClick={() => fire(onAddChild)}
        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-[#cfdaf3] hover:bg-white/[0.04] transition"
      >
        <Plus size={13} className="text-cyan-300" />
        Child
      </button>
      {onAddSibling && (
        <button
          data-testid="mm-ctx-add-sibling"
          onClick={() => fire(onAddSibling)}
          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[12px] text-[#cfdaf3] hover:bg-white/[0.04] transition"
        >
          <Plus size={13} className="text-cyan-300" />
          Sibling
        </button>
      )}
    </div>
  );
};


/**
 * FlowchartShapeRow — replaces AddChildSiblingRow when the host studio
 * sets `flowchartMode={true}`.  Shows a compact 3×3 grid of the BPMN
 * shapes (Process / Decision / Start-End / I/O / Subprocess / Document
 * / Database / Connector / Note) and one "Sibling" button so the user
 * can chain alongside the current node.  Each shape button calls
 * onAddShapeChild(shapeDef) — the canvas converts that to a new child
 * with the matching shape, fill, and stroke colour.
 */
const FlowchartShapeRow = ({ node, onAddShapeChild, onAddSibling, onBranchYesNo }) => {
  const isDecision = node?.flowchartShape === "decision";
  return (
    <div className="px-1 py-1">
      {/* "Branch Yes/No" — surfaced ONLY for decision-shape nodes since
          that's the universal flowchart pattern that benefits most from
          a one-click affordance. Two amber outline arrows hint at the
          two branches. Sits above the generic palette so power-users
          don't have to scan the grid for the common case. */}
      {isDecision && onBranchYesNo && (
        <button
          type="button"
          data-testid="mm-ctx-flow-branch-yesno"
          onClick={() => onBranchYesNo()}
          className="mb-2 w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-md text-[11.5px] font-semibold tracking-tight text-amber-100 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/40 hover:border-amber-300/70 transition"
          title="Adds two child Process shapes labelled Yes and No, fanning left + right"
        >
          <Plus size={11} className="text-amber-300" />
          Branch <span className="text-emerald-300">Yes</span> <span className="text-amber-300/60">/</span> <span className="text-rose-300">No</span>
        </button>
      )}
      <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 px-1 mb-1.5">
        Add child shape
      </div>
      <div className="grid grid-cols-3 gap-1">
        {FLOWCHART_SHAPES.map((s) => (
          <button
            key={s.id}
            data-testid={`mm-ctx-flow-add-${s.id}`}
            onClick={() => onAddShapeChild?.(s)}
            title={`${s.label} — ${s.sub}`}
            className="flex flex-col items-center gap-1 px-1 py-2 rounded-md text-[10px] text-[#cfdaf3] hover:bg-white/[0.05] hover:text-white transition border border-transparent hover:border-white/10"
          >
            <span
              aria-hidden="true"
              className="block w-7 h-5"
              style={{
                background: s.fill,
                border: `1.5px solid ${s.stroke}`,
                borderRadius:
                  s.shape === "pill" ? "999px" :
                  s.shape === "ellipse" ? "999px" :
                  s.shape === "rect" ? "3px" :
                  s.shape === "diamond" ? "0" :
                  "4px",
                clipPath:
                  s.shape === "diamond"
                    ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
                    : s.shape === "parallelogram"
                    ? "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)"
                    : s.shape === "hex"
                    ? "polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)"
                    : undefined,
              }}
            />
            <span className="text-[9.5px] tracking-tight leading-tight text-center">
              {s.label}
            </span>
          </button>
        ))}
      </div>
      {onAddSibling && (
        <button
          data-testid="mm-ctx-flow-add-sibling"
          onClick={() => onAddSibling(1)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-[#cfdaf3] hover:bg-white/[0.05] transition border border-white/10"
        >
          <Plus size={11} className="text-cyan-300" />
          Add sibling
        </button>
      )}
    </div>
  );
};

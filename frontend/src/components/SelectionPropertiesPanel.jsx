import React from "react";
import { Square, Circle, Hexagon, Cloud, Diamond, Type, Palette } from "lucide-react";
import { FONT_FAMILIES, FONT_SIZES } from "@/components/ContextMenu";
import DraggablePanel from "@/components/DraggablePanel";

// Tiny local helper used by the inspector — small uppercase section header.
// Inlined here to avoid coupling to the (unrelated) ContextMenu helper.
const SectionTitle = ({ children }) => (
  <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70 mb-1.5 px-1">
    {children}
  </div>
);

/**
 * Right-side selection-properties panel.
 *
 * Mirrors the colour / shape / font / font-size controls that live inside the
 * right-click context menu, but as a persistent side dock so the user
 * doesn't have to re-open a menu for each tweak. Only renders when there is
 * an active node selection — no point taking up screen real-estate when
 * nothing is selected.
 *
 * Currently scoped to NODE properties. Extending to annotations later is a
 * one-line wrap (annotations have their own colour/shape model).
 */
const COLORS = [
  { name: "Cyan",    fill: "#0a2740", stroke: "#39E0FF" },
  { name: "Fuchsia", fill: "#2a0a40", stroke: "#FF6AD5" },
  { name: "Amber",   fill: "#3a2a08", stroke: "#FFC857" },
  { name: "Emerald", fill: "#0e3024", stroke: "#3DDC84" },
  { name: "Rose",    fill: "#3a0a18", stroke: "#FF4F6E" },
  { name: "Violet",  fill: "#1f0a40", stroke: "#A78BFA" },
  { name: "Slate",   fill: "#1a1f2e", stroke: "#94A3B8" },
  { name: "White",   fill: "#0a0f24", stroke: "#FFFFFF" },
];

const SHAPES = [
  { name: "Pill",     value: "rect",     icon: Square },
  { name: "Ellipse",  value: "ellipse",  icon: Circle },
  { name: "Hex",      value: "hexagon",  icon: Hexagon },
  { name: "Cloud",    value: "cloud",    icon: Cloud },
  { name: "Diamond",  value: "diamond",  icon: Diamond },
];

export default function SelectionPropertiesPanel({
  visible,
  node,
  isPro,
  onUpgrade,
  onSetShape,
  onSetColor,
  onSetFontSize,
  onSetFontFamily,
  selectionType = "node",
  onSetConnector,
}) {
  if (!visible || !node) return null;

  // Connector / annotation selections show a much simpler inspector — line
  // colour, width, arrow-toggle. Anything fancier still happens through the
  // right-click menu so we don't double up the API surface.
  const isConnector = selectionType === "annotation" && node.type === "connector";

  if (isConnector) {
    return (
      <DraggablePanel
        testid="studio-selection-panel"
        storageKey="mm.selectionPanelPos"
        defaultPos={{ x: 12, y: 200 }}
        width={240}
        label="Line properties"
        zIndex={25}
        className="rounded-xl border border-fuchsia-400/25 bg-[#0a0f24]/90 backdrop-blur-md fade-up"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}
      >
        <div className="p-3">
          <SectionTitle>Stroke</SectionTitle>
          <div className="grid grid-cols-6 gap-1.5 mb-3">
            {["#00f0ff", "#8a5bff", "#ff6ad5", "#ffb547", "#3ddc84", "#cfe0ff"].map((c) => (
              <button
                key={c}
                data-testid={`studio-conn-color-${c.slice(1)}`}
                onClick={() => onSetConnector?.({ color: c })}
                className={`h-6 rounded-md border-2 transition ${node.color === c ? "border-white" : "border-white/10 hover:border-white/40"}`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <SectionTitle>Width</SectionTitle>
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[1, 1.6, 2.5, 4].map((w) => (
              <button
                key={w}
                data-testid={`studio-conn-width-${w}`}
                onClick={() => onSetConnector?.({ width: w })}
                className={`flex items-center justify-center rounded-md border py-2 transition ${node.width === w ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 hover:border-cyan-400/40"}`}
                title={`${w}px`}
              >
                <div style={{ width: 20, height: w, background: node.color || "#00f0ff" }} />
              </button>
            ))}
          </div>
          <SectionTitle>Arrow</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              data-testid="studio-conn-arrow-off"
              onClick={() => onSetConnector?.({ arrow: false })}
              className={`mono text-[10px] uppercase tracking-[0.18em] rounded-md border py-1.5 transition ${!node.arrow ? "border-cyan-400 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-[#9aaad0] hover:border-cyan-400/40"}`}
            >
              Line
            </button>
            <button
              data-testid="studio-conn-arrow-on"
              onClick={() => onSetConnector?.({ arrow: true })}
              className={`mono text-[10px] uppercase tracking-[0.18em] rounded-md border py-1.5 transition ${node.arrow ? "border-cyan-400 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-[#9aaad0] hover:border-cyan-400/40"}`}
            >
              → Arrow
            </button>
          </div>
        </div>
      </DraggablePanel>
    );
  }

  // Annotations (sticky / text / shape / image / clipart / comment) — show
  // colour-only inspector. Shape/font controls only apply to map nodes.
  if (selectionType === "annotation" && !isConnector) {
    return null; // annotation has its own right-click menu for now
  }

  const currentFontSize = node.fontSize ?? 14;
  const currentFontFamily = node.fontFamily || FONT_FAMILIES[0].value;
  const currentShape = node.shape || "ellipse";

  const proGate = (item, onApply) => {
    if (item.pro && !isPro) {
      onUpgrade?.();
      return;
    }
    onApply();
  };

  return (
    <DraggablePanel
      testid="studio-selection-panel"
      storageKey="mm.selectionPanelPos"
      defaultPos={{ x: 12, y: 200 }}
      width={260}
      label="Properties"
      zIndex={25}
      className="rounded-xl border border-fuchsia-400/25 bg-[#0a0f24]/90 backdrop-blur-md fade-up"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.45)" }}
    >
      <div className="p-3 max-h-[calc(100vh-260px)] overflow-y-auto">
      <div className="text-[12px] text-white truncate mb-3 px-1">
        {node.title || "(untitled map element)"}
      </div>

      {/* Colour */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2 px-1">
          <Palette size={10} /> Colour
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              data-testid={`selection-color-${c.name.toLowerCase()}`}
              onClick={() => onSetColor?.({ fill: c.fill, stroke: c.stroke })}
              title={c.name}
              className="aspect-square rounded-md border-2 transition hover:scale-105 active:scale-95"
              style={{
                background: c.fill,
                borderColor: c.stroke,
                boxShadow: `0 0 6px ${c.stroke}55`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Shape */}
      <div className="mb-4">
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2 px-1">
          Shape
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {SHAPES.map((s) => {
            const Icon = s.icon;
            const active = currentShape === s.value;
            return (
              <button
                key={s.value}
                type="button"
                data-testid={`selection-shape-${s.value}`}
                onClick={() => onSetShape?.(s.value)}
                title={s.name}
                className={`aspect-square rounded-md border flex items-center justify-center transition ${
                  active
                    ? "border-cyan-400/80 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.03] text-[#9aaad0] hover:border-cyan-400/40 hover:text-cyan-200"
                }`}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Font family */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2 px-1">
          <Type size={10} /> Font
        </div>
        <select
          data-testid="selection-font-family"
          value={currentFontFamily}
          onChange={(e) => {
            const item = FONT_FAMILIES.find((f) => f.value === e.target.value);
            if (item) proGate(item, () => onSetFontFamily?.(item.value));
          }}
          className="w-full bg-[#0a0f24] border border-white/10 rounded-md px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-cyan-400/60"
          style={{ fontFamily: currentFontFamily }}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.name} value={f.value} style={{ fontFamily: f.value }}>
              {f.name}{f.pro && !isPro ? " · Pro" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Font size — numeric grid */}
      <div className="mb-1">
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2 px-1">
          Size
        </div>
        <div className="grid grid-cols-6 gap-1">
          {FONT_SIZES.map((s) => {
            const active = currentFontSize === s.value;
            return (
              <button
                key={s.value}
                type="button"
                data-testid={`selection-font-size-${s.value}`}
                onClick={() => onSetFontSize?.(s.value)}
                className={`px-0 py-1 rounded text-[10px] mono border transition ${
                  active
                    ? "border-cyan-400/80 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/40 hover:text-cyan-200"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </div>
      </div>
    </DraggablePanel>
  );
}

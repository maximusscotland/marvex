import React, { useRef } from "react";
import { Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { PRESET_BACKGROUNDS } from "@/lib/backgrounds";
import { compressImage } from "@/lib/imageCompress";

/**
 * Popover picker: preset backgrounds + upload your own.
 * Props:
 *  - current: current map.background value
 *  - onPick(value): "cosmic" | "space" | … | "data:image/…"
 *  - onClose()
 */
export default function BackgroundPicker({ current, onPick, onClose }) {
  const fileInputRef = useRef(null);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large — max 10 MB");
      return;
    }
    const pending = toast.loading("Optimising background…");
    try {
      // Background needs a wider max-dim so it still fills a 4K canvas.
      const { dataUrl, sizeKb } = await compressImage(file, { maxDim: 2200, targetKb: 900 });
      toast.dismiss(pending);
      if (sizeKb > 1800) {
        toast.error("Image too large after compression — try a smaller picture");
        return;
      }
      onPick(dataUrl);
      toast.success(`Background updated (${sizeKb.toFixed(0)} KB)`);
    } catch {
      toast.dismiss(pending);
      toast.error("Could not read image");
    } finally {
      e.target.value = "";
    }
  };

  const isCustom = typeof current === "string" && current.startsWith("data:");

  return (
    <div
      data-testid="mm-backdrop-picker"
      className="p-3 glass-panel rounded-xl fade-up"
      style={{ borderColor: "rgba(0,240,255,0.28)", width: 320 }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2">
        Canvas background
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PRESET_BACKGROUNDS.map((p) => {
          const active = current === p.id;
          return (
            <button
              key={p.id}
              data-testid={`mm-backdrop-preset-${p.id}`}
              onClick={() => onPick(p.id)}
              className={`relative aspect-[4/3] rounded-lg border transition overflow-hidden ${
                active ? "border-cyan-400 ring-1 ring-cyan-400/50" : "border-white/10 hover:border-cyan-400/40"
              }`}
              style={{
                background: p.css,
                backgroundSize: p.size || undefined,
              }}
              title={p.name}
            >
              {active && (
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 text-[#03141f] grid place-items-center">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
              <span
                className={`absolute bottom-1 left-1.5 mono text-[8px] uppercase tracking-[0.18em] ${
                  p.light ? "text-[#3b2d10]" : "text-white/80"
                }`}
              >
                {p.name}
              </span>
            </button>
          );
        })}

        {/* Upload slot */}
        <button
          data-testid="mm-backdrop-upload"
          onClick={() => fileInputRef.current?.click()}
          className={`relative aspect-[4/3] rounded-lg border-2 border-dashed transition flex flex-col items-center justify-center gap-1 ${
            isCustom
              ? "border-cyan-400 bg-cyan-400/5 text-cyan-200"
              : "border-white/15 text-[#7a87ad] hover:border-cyan-400/50 hover:text-cyan-200"
          }`}
          style={
            isCustom
              ? {
                  backgroundImage: `url("${current}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
          title={isCustom ? "Current custom background" : "Upload your own"}
        >
          {!isCustom && (
            <>
              <Upload size={16} />
              <span className="mono text-[8px] uppercase tracking-[0.18em]">Upload</span>
            </>
          )}
          {isCustom && (
            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-400 text-[#03141f] grid place-items-center">
              <Check size={10} strokeWidth={3} />
            </div>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        data-testid="mm-backdrop-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        hidden
        onChange={onFileChange}
      />

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
        <button
          data-testid="mm-backdrop-clear"
          onClick={() => onPick(null)}
          className="mono text-[9px] uppercase tracking-[0.18em] text-[#7a87ad] hover:text-red-300 transition"
        >
          Reset to default
        </button>
        <button
          data-testid="mm-backdrop-close"
          onClick={onClose}
          className="mono text-[9px] uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200"
        >
          Done
        </button>
      </div>
    </div>
  );
}

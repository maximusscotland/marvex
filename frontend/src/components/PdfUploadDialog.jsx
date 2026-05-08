import React, { useState, useRef } from "react";
import { X, FileUp, Loader2, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { parsePdfHeuristic, generateMindMapFromPdf } from "@/lib/api";
import { getApiKey } from "@/lib/settings";

const MODES = [
  {
    id: "local",
    title: "Quick outline",
    icon: Zap,
    blurb: "Extract the PDF's bookmarks / headings. Instant. 100% local. $0.",
    badge: "FREE · LOCAL",
    badgeTone: "emerald",
  },
  {
    id: "ai",
    title: "AI analysis",
    icon: Sparkles,
    blurb: "Claude Sonnet 4.5 reads the full document and extracts every concept.",
    badge: "CLOUD AI",
    badgeTone: "violet",
  },
];

export default function PdfUploadDialog({ open, onOpenChange, onGenerated, user, onUpgrade }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("local");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  if (!open) return null;

  const userKey = getApiKey(); // null or {provider, key}
  const isPro = user && (user.subscription_status === "active" || user.subscription_status === "trialing");
  const freeRemaining = user ? Math.max(0, 3 - (user.free_conversions_used || 0)) : 0;
  const aiBlocked = mode === "ai" && !userKey && !isPro && (!user || freeRemaining <= 0);

  const reset = () => {
    setFile(null);
    setBusy(false);
    setDragOver(false);
  };

  const close = () => {
    if (busy) return;
    reset();
    onOpenChange(false);
  };

  const onPick = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF file");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("PDF must be under 25 MB");
      return;
    }
    setFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    onPick(e.dataTransfer.files?.[0]);
  };

  const onSubmit = async () => {
    if (!file || busy) return;
    if (aiBlocked) {
      onUpgrade?.();
      return;
    }
    setBusy(true);
    try {
      let data;
      if (mode === "local") {
        data = await parsePdfHeuristic(file);
      } else {
        data = await generateMindMapFromPdf(file, userKey);
      }
      onGenerated(data);
      reset();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Generation failed";
      let msg = typeof detail === "string" ? detail : "Generation failed";
      if (err?.response?.status === 402) {
        // Quota exhausted — open upgrade
        toast.error(msg);
        onUpgrade?.();
        setBusy(false);
        return;
      }
      if (err?.response?.status === 401) {
        msg = "Sign in to use AI mode";
      } else if (/budget|busy/i.test(msg) || err?.response?.status === 502) {
        msg = "AI is busy right now — please try again in a few seconds.";
      } else if (err?.code === "ECONNABORTED") {
        msg = "Timed out — try a smaller PDF.";
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="pdf-upload-dialog"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-xl glass-panel rounded-2xl p-7 fade-up"
        style={{ borderColor: "rgba(0,240,255,0.22)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">
              PDF Studio
            </div>
            <h3 className="text-xl font-semibold text-white">Convert a PDF into a mind map</h3>
          </div>
          <button
            onClick={close}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
            data-testid="pdf-dialog-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {MODES.map((m) => {
            const Icon = m.icon;
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                data-testid={`pdf-mode-${m.id}`}
                onClick={() => setMode(m.id)}
                disabled={busy}
                className={`text-left rounded-xl border p-3.5 transition-all duration-200 ${
                  selected
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-white/10 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Icon size={16} className={selected ? "text-cyan-300" : "text-[#9aaad0]"} />
                  <span
                    className={`mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-[3px] rounded ${
                      m.badgeTone === "emerald"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "bg-violet-500/15 text-violet-300 border border-violet-500/30"
                    }`}
                  >
                    {m.badge}
                  </span>
                </div>
                <div className="text-white font-semibold text-[13px] mb-1">{m.title}</div>
                <div className="text-[11px] text-[#8794b8] leading-snug">{m.blurb}</div>
              </button>
            );
          })}
        </div>

        {/* Key indicator (AI mode only) */}
        {mode === "ai" && (
          <div
            className="mb-4 px-3 py-2 rounded-lg border flex items-center gap-2 mono text-[10px] uppercase tracking-[0.18em]"
            style={{
              borderColor: userKey || isPro ? "rgba(52,211,153,0.35)" : aiBlocked ? "rgba(244,114,182,0.35)" : "rgba(250,204,21,0.25)",
              background: userKey || isPro ? "rgba(6,40,28,0.4)" : aiBlocked ? "rgba(60,15,40,0.4)" : "rgba(45,30,5,0.35)",
              color: userKey || isPro ? "#6ee7b7" : aiBlocked ? "#f9a8d4" : "#fde68a",
            }}
            data-testid="pdf-key-indicator"
          >
            <ShieldCheck size={13} />
            {!user
              ? "Sign in to use AI mode"
              : isPro
              ? `Pro · unlimited AI conversions`
              : userKey
              ? `Using your ${userKey.provider} key`
              : aiBlocked
              ? "Free trial used — upgrade or add your own key"
              : `${freeRemaining} free AI conversion${freeRemaining === 1 ? "" : "s"} left`}
          </div>
        )}

        {/* Dropzone */}
        <div
          data-testid="pdf-dropzone"
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            busy ? "opacity-70 cursor-not-allowed" : ""
          } ${dragOver ? "border-cyan-400 bg-cyan-500/5" : "border-white/10 hover:border-cyan-400/50 hover:bg-white/[0.02]"}`}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="text-cyan-300 animate-spin" size={28} />
              <div className="text-white font-medium">
                {mode === "local" ? "Parsing PDF outline…" : "Reading and mapping…"}
              </div>
              <div className="mono text-[11px] uppercase tracking-[0.22em] text-[#7a87ad]">
                {mode === "local" ? "pypdf · fully local" : "Claude Sonnet 4.5 · 30–90s"}
              </div>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="text-cyan-300" size={26} />
              <div className="text-white font-medium" data-testid="pdf-selected-name">{file.name}</div>
              <div className="mono text-[11px] uppercase tracking-[0.2em] text-[#7a87ad]">
                {(file.size / 1024 / 1024).toFixed(2)} MB · ready
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <FileUp className="text-cyan-300/80" size={28} />
              <div className="text-white font-medium">Drop a PDF here</div>
              <div className="mono text-[11px] uppercase tracking-[0.2em] text-[#7a87ad]">
                or click to browse · max 25 MB
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => onPick(e.target.files?.[0])}
            data-testid="pdf-file-input"
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
            {mode === "local"
              ? "No data leaves your machine"
              : "PDF text sent once to AI · never stored"}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              disabled={busy}
              className="cta-ghost text-sm"
              data-testid="pdf-dialog-cancel"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!file || busy}
              data-testid="pdf-dialog-generate"
              className={`cta-pill text-sm ${!file || busy ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {busy
                ? "Working…"
                : aiBlocked
                ? "Upgrade to use AI"
                : mode === "local"
                ? "Build Outline"
                : "Generate Map"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

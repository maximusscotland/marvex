import React from "react";
import { X, ExternalLink, Tablet, Printer, ArrowRight } from "lucide-react";

/**
 * KindleNotebookHowTo — a simple info modal that walks users through the
 * legitimate, Amazon-sanctioned way to pull their Kindle highlights into a
 * mind-map: export from read.amazon.com/notebook as a PDF. No DRM issues,
 * no DMCA concerns, works for both purchased Kindle books AND Kindle
 * Unlimited reads since highlights travel with the user's account.
 */
export default function KindleNotebookHowTo({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      data-testid="kindle-howto"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-2xl glass-panel rounded-2xl p-7 fade-up max-h-[85vh] overflow-y-auto"
        style={{ borderColor: "rgba(255,165,0,0.25)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-500/10 border border-amber-400/30 grid place-items-center text-amber-300">
              <Tablet size={18} />
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80">Kindle highlights</div>
              <h3 className="text-xl font-bold">Turn your notes into a mind-map</h3>
            </div>
          </div>
          <button
            data-testid="kindle-howto-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[13px] text-[#cfdaf3] leading-relaxed mb-5">
          Amazon lets you view every highlight and note you've ever made — across purchased books,
          Kindle Unlimited, and Prime Reading — at a dedicated notebook URL.
          Save that page as PDF, drop it into the Fixer, and Mikey turns it into a research map.
        </p>

        <div className="space-y-3 mb-6">
          <Step num="1" title="Open your Kindle notebook">
            Go to <a
              href="https://read.amazon.com/notebook"
              target="_blank"
              rel="noreferrer"
              data-testid="kindle-howto-link"
              className="text-amber-300 hover:text-amber-200 underline"
            >
              read.amazon.com/notebook
              <ExternalLink size={11} className="inline ml-1 -translate-y-[1px]" />
            </a>{" "}
            and sign in with the Amazon account you use for Kindle.
          </Step>
          <Step num="2" title="Pick one book at a time">
            Select the book whose highlights you want. Scroll through to confirm everything you need
            is loaded — the page is lazy-loaded on some titles.
          </Step>
          <Step num="3" title="Save as PDF" icon={<Printer size={13} />}>
            Press <kbd className="mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10">Ctrl/Cmd + P</kbd>,
            choose destination <span className="text-amber-200">Save as PDF</span>, untick headers / footers, save.
          </Step>
          <Step num="4" title="Drop into the PDF Studio" icon={<ArrowRight size={13} />}>
            Return here and drag-drop the PDF onto the intake zone. Tick
            <span className="mono text-[10px] uppercase tracking-[0.18em] px-1.5 py-[2px] ml-1 rounded bg-violet-500/20 text-violet-200 border border-violet-400/40">Enrich</span>
            {" "}(Pro or BYO-key) to turn flat highlights into full chapters of study.
          </Step>
        </div>

        <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3.5 mb-5">
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-amber-300/80 mb-1">Why this works</div>
          <p className="text-[12.5px] text-[#cfdaf3] leading-relaxed">
            Kindle highlights belong to <em>your</em> account — not to the book's DRM wrapper. Amazon
            exposes them in plain HTML specifically so readers can review and cite them. No
            protections are bypassed.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            data-testid="kindle-howto-open"
            onClick={() => {
              window.open("https://read.amazon.com/notebook", "_blank", "noopener,noreferrer");
            }}
            className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[#1a0a00] font-bold flex items-center gap-1.5 hover:shadow-[0_0_18px_rgba(255,165,0,0.55)] transition"
          >
            <ExternalLink size={12} /> Open my Kindle notebook
          </button>
        </div>
      </div>
    </div>
  );
}

const Step = ({ num, title, children, icon }) => (
  <div className="flex gap-3" data-testid={`kindle-step-${num}`}>
    <div className="w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 mono text-[11px] grid place-items-center shrink-0 font-bold">
      {num}
    </div>
    <div className="flex-1">
      <div className="text-[13px] font-semibold text-white mb-0.5 flex items-center gap-1.5">
        {icon} {title}
      </div>
      <div className="text-[12.5px] text-[#9aa7c7] leading-relaxed">{children}</div>
    </div>
  </div>
);

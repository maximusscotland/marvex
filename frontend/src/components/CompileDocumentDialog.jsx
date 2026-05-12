import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, FileText, Printer, Copy, Sparkles, Loader2, ScrollText, ListTree } from "lucide-react";
import { compileDocument } from "@/lib/api";
import { getApiKey, getResearchConfig } from "@/lib/settings";
import { apiErrorMessage } from "@/lib/apiError";

/**
 * CompileDocumentDialog — converts a (sub)tree from the studio into a
 * polished Markdown document via the LLM, then previews it for the user
 * with a "Save as PDF" action that fires the browser's native print dialog.
 *
 * Why no react-markdown dependency? We render the small subset of Markdown
 * that the LLM produces (headings, paragraphs, lists, inline emphasis) with
 * a tight in-component renderer. Smaller bundle, no version-skew worries.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - root: { title, summary, children } — the subtree to compile
 *  - mapTitle: string — the original mind-map's title (falls back to root.title)
 *  - source: "whole-map" | "subtree" | "selection" — drives the header label
 *  - selectionCount: number — for "selection" mode, e.g. "3 nodes selected"
 */
export default function CompileDocumentDialog({
  open,
  onClose,
  root,
  mapTitle = "",
  source = "subtree",
  selectionCount = 1,
}) {
  // ---- form state ----
  const [style, setStyle] = useState("essay"); // essay | briefing | outline
  const [lengthPreset, setLengthPreset] = useState("standard"); // brief|standard|deep|custom
  const [customWords, setCustomWords] = useState(900);
  // ---- result state ----
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markdown, setMarkdown] = useState("");
  const [meta, setMeta] = useState(null); // { word_count, model_used }
  const previewRef = useRef(null);

  // Reset on close so the next open is clean
  useEffect(() => {
    if (!open) {
      setMarkdown("");
      setMeta(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open || !root) return null;

  const sourceLabel = source === "whole-map"
    ? "Compiling the entire map"
    : source === "selection"
      ? `Compiling ${selectionCount} selected map element${selectionCount !== 1 ? "s" : ""}`
      : `Compiling “${root.title || "branch"}” + descendants`;

  const handleCompile = async () => {
    setLoading(true);
    setError(null);
    setMarkdown("");
    setMeta(null);
    const cfg = getResearchConfig();
    const userKey = getApiKey();
    try {
      const res = await compileDocument({
        root,
        mapTitle: mapTitle || root.title || "Untitled",
        style,
        lengthPreset,
        customWords: lengthPreset === "custom" ? customWords : null,
        persona: cfg.persona || "",
        audience: cfg.audience || "",
        userKey,
      });
      setMarkdown(res.markdown || "");
      setMeta({ word_count: res.word_count, model_used: res.model_used });
      toast.success(`Compiled (${res.word_count} words)`);
    } catch (e) {
      const msg = apiErrorMessage(e, "Compile failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---- print: open a clean print-only view by toggling a body class so
  //      our existing print CSS hides the studio chrome but the modal stays. ----
  const handlePrint = () => {
    document.body.classList.add("compile-printing");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("compile-printing"), 800);
    }, 80);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Markdown copied to clipboard");
    } catch {
      toast.error("Couldn't copy — select & copy manually");
    }
  };

  return (
    <div
      data-testid="compile-doc-dialog"
      className="fixed inset-0 z-[70] grid place-items-center px-4 py-6"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        id="compile-doc-modal"
        className="w-full max-w-4xl max-h-[92vh] glass-panel rounded-2xl flex flex-col fade-up"
        style={{ borderColor: "rgba(0,240,255,0.3)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-white/5 no-print">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1 flex items-center gap-2">
              <FileText size={11} />
              Compile to document
            </div>
            <h3 className="text-lg font-semibold text-white">{root.title || "Untitled"}</h3>
            <p className="text-[12px] text-[#7a87ad] mt-0.5">{sourceLabel}</p>
          </div>
          <button
            data-testid="compile-doc-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — split into config (left) + preview (right) when result exists */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Config panel — always visible */}
          {!markdown && (
            <div className="px-6 pt-5 pb-2 no-print">
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <Field label="Style">
                  <SegBtn active={style === "essay"} onClick={() => setStyle("essay")} testid="compile-style-essay">
                    <ScrollText size={12} /> Essay
                  </SegBtn>
                  <SegBtn active={style === "briefing"} onClick={() => setStyle("briefing")} testid="compile-style-briefing">
                    <FileText size={12} /> Briefing
                  </SegBtn>
                  <SegBtn active={style === "outline"} onClick={() => setStyle("outline")} testid="compile-style-outline">
                    <ListTree size={12} /> Outline
                  </SegBtn>
                </Field>
                <Field label="Length">
                  <select
                    data-testid="compile-length-preset"
                    value={lengthPreset}
                    onChange={(e) => setLengthPreset(e.target.value)}
                    className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/60"
                  >
                    <option value="brief">Brief — 1 page (~350 words)</option>
                    <option value="standard">Standard — 3 pages (~900 words)</option>
                    <option value="deep">Deep — 8–10 pages (~2,400 words)</option>
                    <option value="custom">Custom word count…</option>
                  </select>
                  {lengthPreset === "custom" && (
                    <input
                      data-testid="compile-custom-words"
                      type="number"
                      min={200}
                      max={6000}
                      step={100}
                      value={customWords}
                      onChange={(e) => setCustomWords(Math.max(200, Math.min(6000, Number(e.target.value) || 200)))}
                      placeholder="Words (200–6000)"
                      className="mt-2 w-full bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-400/60"
                    />
                  )}
                </Field>
              </div>
              <p className="text-[11px] text-[#7a87ad] leading-relaxed mb-4">
                Voice & audience come from your <span className="text-cyan-300">Research Assistant</span> settings — change them in the gear menu.
                AI runs against your BYOK provider — every node title in the selection will be reflected in the output.
              </p>
              <button
                data-testid="compile-doc-run"
                onClick={handleCompile}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-[13px] bg-cyan-500 hover:bg-cyan-400 text-[#03060f] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Compiling…</> : <><Sparkles size={14} /> Compile</>}
              </button>
              {error && (
                <div className="mt-3 px-3 py-2 rounded-md text-[12px] bg-red-500/10 border border-red-500/30 text-red-200" data-testid="compile-doc-error">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Preview pane — visible after a successful compile */}
          {markdown && (
            <>
              <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between gap-3 no-print">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/80">Ready</span>
                  {meta && (
                    <span className="text-[12px] text-[#9aaad0] truncate">
                      {meta.word_count} words · {meta.model_used}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    data-testid="compile-doc-copy"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-[#cfdaf3] hover:bg-white/5 border border-white/10 transition"
                  >
                    <Copy size={12} /> Copy MD
                  </button>
                  <button
                    data-testid="compile-doc-recompile"
                    onClick={() => { setMarkdown(""); setMeta(null); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] text-[#cfdaf3] hover:bg-white/5 border border-white/10 transition"
                  >
                    <Sparkles size={12} /> Recompile
                  </button>
                  <button
                    data-testid="compile-doc-print"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-cyan-500 hover:bg-cyan-400 text-[#03060f] transition"
                  >
                    <Printer size={12} /> Save as PDF
                  </button>
                </div>
              </div>
              <div
                ref={previewRef}
                data-testid="compile-doc-preview"
                className="flex-1 overflow-auto px-8 py-8 compile-doc-preview"
              >
                <MarkdownView md={markdown} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <div className="mono text-[10px] uppercase tracking-[0.2em] text-[#7a87ad] mb-1.5">{label}</div>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const SegBtn = ({ active, onClick, testid, children }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] border transition ${
      active
        ? "bg-cyan-500/15 border-cyan-400/60 text-cyan-100"
        : "bg-white/[0.02] border-white/10 text-[#9aaad0] hover:border-white/30 hover:text-white"
    }`}
  >
    {children}
  </button>
);

// ---------- Tiny Markdown renderer (just enough for our LLM output) ----------

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;")
   .replace(/</g, "&lt;")
   .replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;");

// Inline pass: **bold**, *italic*, `code`. Order matters — bold before italic.
const renderInline = (s) => {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+?)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
  // Trim residual spaces around list bullets at line ends
  return out;
};

const MarkdownView = ({ md }) => {
  const html = useMemo(() => {
    const lines = md.split(/\r?\n/);
    const out = [];
    let inUL = false;
    let inOL = false;
    let para = [];

    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${renderInline(para.join(" ").trim())}</p>`);
        para = [];
      }
    };
    const closeLists = () => {
      if (inUL) { out.push("</ul>"); inUL = false; }
      if (inOL) { out.push("</ol>"); inOL = false; }
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) {
        flushPara();
        closeLists();
        continue;
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        flushPara(); closeLists();
        const lvl = h[1].length;
        out.push(`<h${lvl}>${renderInline(h[2])}</h${lvl}>`);
        continue;
      }
      const ul = /^\s*[-*]\s+(.*)$/.exec(line);
      if (ul) {
        flushPara();
        if (!inUL) { closeLists(); out.push("<ul>"); inUL = true; }
        out.push(`<li>${renderInline(ul[1])}</li>`);
        continue;
      }
      const ol = /^\s*(\d+)\.\s+(.*)$/.exec(line);
      if (ol) {
        flushPara();
        if (!inOL) { closeLists(); out.push("<ol>"); inOL = true; }
        out.push(`<li>${renderInline(ol[2])}</li>`);
        continue;
      }
      const bq = /^>\s+(.*)$/.exec(line);
      if (bq) {
        flushPara(); closeLists();
        out.push(`<blockquote>${renderInline(bq[1])}</blockquote>`);
        continue;
      }
      // accumulate paragraph lines
      closeLists();
      para.push(line);
    }
    flushPara();
    closeLists();
    return out.join("\n");
  }, [md]);

  return (
    <article
      className="compile-doc-prose"
      // Renderer escapes everything; the only HTML it inserts comes from
      // our regex passes which it controls — safe for our LLM output.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

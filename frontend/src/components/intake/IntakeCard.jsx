import React from "react";
import {
  FileText,
  X,
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  Trash2,
  Plus,
  Sparkles,
  Zap,
  Lock,
} from "lucide-react";
import { STATUS, statusLabel } from "./intakeStatus";
import IntakeProgress from "./IntakeProgress";

/**
 * IntakeCard — one queue row for the PDF intake flow. Shows file name,
 * parse status, OCR fallback when failed, and expands into the Fixer panel
 * when the parse has produced a heading preview.
 */
export default function IntakeCard({
  item,
  expanded,
  onToggle,
  onRemove,
  onOcr,
  onUpdateHeadings,
  onUpdateTitle,
  onToggleEnrich,
  onToggleAutoDeepen,
  isPro = false,
  isProOnly = false,
  onUpgrade,
}) {
  const { status, error, ocrProgress, headings, parsedTitle, sourcePages, file } = item;
  const canExpand = status === STATUS.PREVIEW || status === STATUS.DONE;

  return (
    <div
      data-testid={`intake-card-${item.id}`}
      className="rounded-xl border border-white/10 bg-[#071422]/70 overflow-hidden"
    >
      <div
        role={canExpand ? "button" : undefined}
        tabIndex={canExpand ? 0 : -1}
        onClick={() => canExpand && onToggle()}
        onKeyDown={(e) => {
          if (canExpand && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`w-full flex items-center gap-4 px-4 py-3 text-left transition ${
          canExpand ? "hover:bg-white/[0.03] cursor-pointer" : "cursor-default"
        }`}
        data-testid={`intake-card-toggle-${item.id}`}
      >
        <StatusDot status={status} />
        <FileText size={16} className="text-[#7a87ad] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{parsedTitle || file?.name || "Untitled"}</div>
          <div className="mono text-[9px] uppercase tracking-[0.2em] text-[#566187] mt-0.5">
            {status === STATUS.PARSING && ocrProgress
              ? ocrProgress.msg
              : status === STATUS.PREVIEW
              ? `${headings.length} headings · ${sourcePages || 0} pages`
              : statusLabel[status]}
          </div>
          {status === STATUS.PARSING && ocrProgress && (
            <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                style={{
                  width: `${Math.round((ocrProgress.pct || 0) * 100)}%`,
                  transition: "width 250ms",
                }}
              />
            </div>
          )}
          <IntakeProgress
            status={status}
            enrich={!!item.enrich}
            autoDeepen={!!item.autoDeepen}
            runningAction={item.runningAction || null}
          />
        </div>
        <div className="flex items-center gap-1">
          {status === STATUS.FAILED && (
            <button
              data-testid={`intake-ocr-${item.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onOcr();
              }}
              title="Run OCR in browser"
              className="mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-400/40 text-violet-200 hover:bg-violet-500/25 transition flex items-center gap-1"
            >
              <ScanLine size={11} /> OCR
            </button>
          )}
          <button
            data-testid={`intake-remove-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-7 h-7 rounded grid place-items-center text-[#566187] hover:text-red-300 hover:bg-red-500/10 transition"
            title="Remove"
          >
            <X size={14} />
          </button>
          {canExpand &&
            (expanded ? (
              <ChevronDown size={14} className="text-[#7a87ad]" />
            ) : (
              <ChevronRight size={14} className="text-[#7a87ad]" />
            ))}
        </div>
      </div>

      {error && status === STATUS.FAILED && (
        <div className="px-4 pb-3 flex items-start gap-2 text-[12px] text-amber-300/80">
          <AlertTriangle size={14} className="shrink-0 mt-[2px]" />
          <div>{error}</div>
        </div>
      )}

      {expanded && canExpand && (
        <FixerPanel
          title={parsedTitle}
          onTitle={onUpdateTitle}
          headings={headings}
          onChange={onUpdateHeadings}
          enrich={!!item.enrich}
          onToggleEnrich={onToggleEnrich}
          autoDeepen={!!item.autoDeepen}
          onToggleAutoDeepen={onToggleAutoDeepen}
          isPro={isPro}
          isProOnly={isProOnly}
          onUpgrade={onUpgrade}
          hasOwnKey={!!item.hasOwnKey}
        />
      )}
    </div>
  );
}

/* ---------------- Small subviews kept close to where they're used ---------------- */

function StatusDot({ status }) {
  if (status === STATUS.PARSING)
    return <Loader2 size={14} className="text-cyan-300 animate-spin shrink-0" />;
  if (status === STATUS.DONE)
    return <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />;
  if (status === STATUS.FAILED)
    return <AlertTriangle size={14} className="text-amber-300 shrink-0" />;
  if (status === STATUS.PREVIEW)
    return (
      <div
        className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"
        style={{ boxShadow: "0 0 8px rgba(0,240,255,0.7)" }}
      />
    );
  return <div className="w-2 h-2 rounded-full bg-[#556181] shrink-0" />;
}

/**
 * FixerPanel — the manual heading editor ("The Fixer"). Pure controlled
 * component: parent holds the flat heading list; we mutate via onChange.
 */
function FixerPanel({ title, onTitle, headings, onChange, enrich, onToggleEnrich, autoDeepen, onToggleAutoDeepen, isPro, isProOnly, onUpgrade, hasOwnKey }) {
  const move = (idx, dir) => {
    const next = [...headings];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const indent = (idx, delta) => {
    const next = [...headings];
    const maxDepth = idx === 0 ? 0 : (next[idx - 1].depth + 1);
    next[idx] = {
      ...next[idx],
      depth: Math.max(0, Math.min(maxDepth, (next[idx].depth | 0) + delta)),
    };
    onChange(next);
  };
  const rename = (idx, newTitle) => {
    const next = [...headings];
    next[idx] = { ...next[idx], title: newTitle };
    onChange(next);
  };
  const remove = (idx) => onChange(headings.filter((_, i) => i !== idx));
  const addAt = (idx) => {
    const depth = idx >= 0 ? headings[idx]?.depth || 0 : 0;
    const next = [...headings];
    next.splice(idx + 1, 0, {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: "New heading",
      depth,
      summary: "",
    });
    onChange(next);
  };

  return (
    <div
      className="border-t border-white/5 bg-black/20 px-4 py-4 space-y-3"
      data-testid="intake-fixer-panel"
    >
      <div className="flex items-center gap-2">
        <span className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 shrink-0">
          Map title
        </span>
        <input
          data-testid="intake-fixer-title"
          value={title || ""}
          onChange={(e) => onTitle(e.target.value)}
          className="flex-1 bg-[#0a1428] border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-cyan-400/60"
        />
      </div>

      <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187]">
        The Fixer · rename, re-order, re-nest before mapping ({headings.length} headings)
      </div>

      <EnrichToggle
        enrich={enrich}
        onToggleEnrich={onToggleEnrich}
        isPro={isPro}
        hasOwnKey={hasOwnKey}
        onUpgrade={onUpgrade}
      />

      <AutoDeepenToggle
        autoDeepen={autoDeepen}
        onToggleAutoDeepen={onToggleAutoDeepen}
        isProOnly={isProOnly}
        onUpgrade={onUpgrade}
      />

      {headings.length === 0 ? (
        <div className="text-[13px] text-[#9aa7c7] italic py-3">
          No headings yet. Click <span className="text-cyan-200">+ Add heading</span> below to build the
          map manually.
        </div>
      ) : (
        <ul className="space-y-1.5" data-testid="intake-fixer-list">
          {headings.map((h, idx) => (
            <li
              key={h.id}
              className="flex items-center gap-1.5 group"
              style={{ paddingLeft: (h.depth || 0) * 18 }}
              data-testid={`intake-heading-${idx}`}
            >
              <span className="text-[#556181] mono text-[10px] w-5 text-right tabular-nums">
                {idx + 1}
              </span>
              <input
                value={h.title}
                onChange={(e) => rename(idx, e.target.value)}
                className="flex-1 bg-transparent border border-transparent hover:border-white/10 focus:border-cyan-400/50 rounded px-2 py-1 text-sm focus:outline-none"
                data-testid={`intake-heading-input-${idx}`}
              />
              {h.page != null && (
                <span className="mono text-[9px] text-[#556181] w-10 text-center">p.{h.page}</span>
              )}
              <div className="flex opacity-0 group-hover:opacity-100 transition">
                <TinyBtn title="Move up" onClick={() => move(idx, -1)}>↑</TinyBtn>
                <TinyBtn title="Move down" onClick={() => move(idx, +1)}>↓</TinyBtn>
                <TinyBtn title="Out-dent" onClick={() => indent(idx, -1)}>←</TinyBtn>
                <TinyBtn title="Indent" onClick={() => indent(idx, +1)}>→</TinyBtn>
                <TinyBtn title="Delete" onClick={() => remove(idx)} danger>
                  <Trash2 size={11} />
                </TinyBtn>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        data-testid="intake-add-heading"
        onClick={() => addAt(headings.length === 0 ? -1 : headings.length - 1)}
        className="mono text-[10px] uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5"
      >
        <Plus size={12} /> Add heading
      </button>
    </div>
  );
}

const TinyBtn = ({ children, onClick, title, danger }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-6 h-6 rounded grid place-items-center text-[11px] mono transition ${
      danger ? "text-red-300 hover:bg-red-500/15" : "text-[#7a87ad] hover:text-cyan-200 hover:bg-white/5"
    }`}
  >
    {children}
  </button>
);

/**
 * EnrichToggle — opt-in checkbox that routes this PDF's parsed outline
 * through the Research Assistant before the final map is saved. Pro-only,
 * or available to anyone with a BYO API key (same policy as /api/research).
 */
function EnrichToggle({ enrich, onToggleEnrich, isPro, hasOwnKey, onUpgrade }) {
  if (!onToggleEnrich) return null;
  const unlocked = isPro || hasOwnKey;
  const handleClick = () => {
    if (!unlocked) {
      if (onUpgrade) onUpgrade();
      return;
    }
    onToggleEnrich(!enrich);
  };
  return (
    <div
      data-testid="intake-enrich-toggle"
      role="checkbox"
      aria-checked={!!enrich}
      aria-disabled={!unlocked}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer select-none transition ${
        enrich
          ? "border-violet-400/50 bg-violet-500/10"
          : "border-white/10 bg-white/[0.02] hover:border-violet-400/30 hover:bg-violet-500/5"
      }`}
    >
      <div
        className={`mt-0.5 w-4 h-4 rounded-sm border shrink-0 grid place-items-center transition ${
          enrich ? "bg-violet-400 border-violet-400 text-[#140022]" : "border-white/25"
        }`}
      >
        {enrich && (
          <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M2.5 7.5L6 11l5.5-7.5" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <img
            src="/icons/enrich.webp"
            alt=""
            aria-hidden="true"
            className="w-4 h-4 rounded-sm shrink-0"
            style={{ objectFit: "cover" }}
          />
          <span className="text-[13px] font-medium text-white">
            Enrich with Research Assistant
          </span>
          {!unlocked && (
            <span className="mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-[2px] rounded bg-violet-500/20 text-violet-200 border border-violet-400/40 flex items-center gap-1">
              <Lock size={9} /> Pro
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-[#9aa7c7] leading-relaxed mt-0.5">
          Mikey adds 2–3 short leaves under each heading — explanations, examples, open questions — before the map is saved.
          {!unlocked && " Use your own API key (Settings) or upgrade to enable."}
        </div>
      </div>
    </div>
  );
}

/**
 * AutoDeepenToggle — opt-in checkbox that runs Deep Research (2 levels)
 * on the root node AFTER the map is created. Adds 8-12 research branches
 * in one go. **Pro-only** — Lite tier doesn't include AI superpowers
 * regardless of BYOK status (mirrors the gate in Studio.handleDeepResearch).
 */
function AutoDeepenToggle({ autoDeepen, onToggleAutoDeepen, isProOnly = false, onUpgrade }) {
  if (!onToggleAutoDeepen) return null;
  const unlocked = !!isProOnly;
  const handleClick = () => {
    if (!unlocked) { if (onUpgrade) onUpgrade(); return; }
    onToggleAutoDeepen(!autoDeepen);
  };
  return (
    <div
      data-testid="intake-autodeepen-toggle"
      role="checkbox"
      aria-checked={!!autoDeepen}
      aria-disabled={!unlocked}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer select-none transition ${
        autoDeepen
          ? "border-fuchsia-400/50 bg-fuchsia-500/10"
          : "border-white/10 bg-white/[0.02] hover:border-fuchsia-400/30 hover:bg-fuchsia-500/5"
      }`}
    >
      <div
        className={`mt-0.5 w-4 h-4 rounded-sm border shrink-0 grid place-items-center transition ${
          autoDeepen ? "bg-fuchsia-400 border-fuchsia-400 text-[#140022]" : "border-white/25"
        }`}
      >
        {autoDeepen && (
          <svg viewBox="0 0 14 14" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M2.5 7.5L6 11l5.5-7.5" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Zap size={14} className="text-fuchsia-300 shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-medium text-white">
            Auto-deepen after map creation
          </span>
          {!unlocked && (
            <span
              data-testid="intake-autodeepen-pro-badge"
              className="mono text-[9px] uppercase tracking-[0.18em] px-1.5 py-[2px] rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40 flex items-center gap-1"
            >
              <Lock size={9} /> Pro
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-[#9aa7c7] leading-relaxed mt-0.5">
          After the map is built, Mikey auto-runs Deep Research on the root — returns 8–12 extra branches (2 LLM levels).
          {!unlocked && " Pro tier only — upgrade from Lite to enable."}
        </div>
      </div>
    </div>
  );
}



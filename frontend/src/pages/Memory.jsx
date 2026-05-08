import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Brain, Download, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import usePageMeta from "@/lib/usePageMeta";
import {
  listResearchMemories,
  clearResearchMemory,
  deleteResearchMemory,
} from "@/lib/researchMemory";

/**
 * Research Memory browser — counterpart to the /highlights ledger.
 *
 * Shows every entry Mikey has stored in localStorage (the "RAG memory"
 * we ship to the backend as context on every Research call). Users can
 * search by keyword/focus, delete individual entries, or wipe everything.
 *
 * Per-entry row = focus title, source map, branch preview (up to 3
 * branch titles), persona/depth chips, timestamp, 🗑 delete button.
 */
export default function Memory() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  usePageMeta({
    title: "Research memory · Marvex Studio",
    description: "Browse every research note Mikey has stored locally. Each new research call cross-references past work so follow-ups build on — not rehash — what you already learned.",
    type: "website",
  });
  // Force re-render after mutations without the ceremony of lifting state up.
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  const all = useMemo(() => listResearchMemories(), [tick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) => {
      if ((e.focusTitle || "").toLowerCase().includes(q)) return true;
      if ((e.mapTitle  || "").toLowerCase().includes(q)) return true;
      for (const b of e.branches || []) {
        if ((b.title || "").toLowerCase().includes(q)) return true;
        for (const c of b.children || []) {
          if ((c.title || "").toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [all, query]);

  const onDelete = (id) => {
    if (!window.confirm("Delete this memory? Mikey will no longer use it as context.")) return;
    deleteResearchMemory(id);
    bump();
    toast.success("Memory deleted");
  };

  const onClearAll = () => {
    if (!window.confirm(`Forget all ${all.length} research notes? Mikey will start fresh.`)) return;
    clearResearchMemory();
    bump();
    toast.success("Research memory cleared");
  };

  const exportMarkdown = () => {
    if (!filtered.length) return;
    const today = new Date().toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric",
    });
    const lines = [
      `# My research memory · ${today}`,
      "",
      `*${filtered.length} research note${filtered.length === 1 ? "" : "s"} exported from marvex.app*`,
      "",
    ];
    for (const e of filtered) {
      lines.push(`## ${e.focusTitle || "Untitled focus"}`);
      const meta = [];
      if (e.mapTitle) meta.push(`from **${e.mapTitle}**`);
      if (e.depth)    meta.push(`depth: *${e.depth}*`);
      if (e.ts)       meta.push(new Date(e.ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
      if (meta.length) lines.push(`*${meta.join(" · ")}*`);
      lines.push("");
      for (const b of e.branches || []) {
        if (!b.title) continue;
        lines.push(`- **${b.title}**${b.summary ? ` — ${b.summary}` : ""}`);
        for (const c of b.children || []) {
          if (!c.title) continue;
          lines.push(`  - ${c.title}${c.summary ? ` — ${c.summary}` : ""}`);
        }
      }
      lines.push("");
    }
    lines.push("---", "", "*Local-only knowledge ring · marvex.app*");

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-memory-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} note${filtered.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="min-h-screen bg-[#04060d] text-white" data-testid="memory-page">
      {/* Header */}
      <header className="px-6 md:px-10 h-16 flex items-center gap-4 border-b border-white/10 bg-[#04060d] sticky top-0 z-10">
        <button
          onClick={() => navigate("/app")}
          data-testid="memory-back"
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 flex items-center gap-1.5"
        >
          <ArrowLeft size={12} /> Studio
        </button>
        <div className="h-6 w-px bg-white/10" />
        <Logo size={28} />
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">Marvex Studio</div>
          <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187]">research memory</div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-10 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-violet-300 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/5 mb-5">
            <Brain size={12} /> Mikey&apos;s memory · {all.length} note{all.length === 1 ? "" : "s"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-3">
            Every thread{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300">
              you&apos;ve pulled
            </span>
          </h1>
          <p className="text-[#a4b4d8] text-base leading-relaxed max-w-2xl">
            Every time you run research, Mikey stores a compact note locally. The top-3 most
            related notes are sent as context with every new call — so follow-ups build on past
            work instead of rehashing it.
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="px-6 md:px-10 pb-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566187]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search focus, map, or branches…"
              data-testid="memory-search"
              className="w-full bg-[#0a0f24] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#566187] focus:outline-none focus:border-cyan-400/50"
            />
          </div>
          <button
            onClick={exportMarkdown}
            disabled={!filtered.length}
            data-testid="memory-export-md"
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2.5 rounded-lg border border-white/10 text-[#9aa7c7] hover:text-cyan-300 hover:border-cyan-400/50 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} /> Export · Markdown
          </button>
          {all.length > 0 && (
            <button
              onClick={onClearAll}
              data-testid="memory-clear-all"
              className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2.5 rounded-lg border border-red-400/30 text-red-300/90 hover:text-red-200 hover:border-red-400/60 transition flex items-center gap-1.5"
            >
              <Trash2 size={12} /> Clear all
            </button>
          )}
        </div>
      </section>

      {/* Entries */}
      <section className="px-6 md:px-10 pb-24">
        <div className="max-w-5xl mx-auto">
          {all.length === 0 && (
            <div
              className="border border-dashed border-white/10 rounded-2xl p-10 text-center"
              data-testid="memory-empty"
            >
              <Brain size={32} className="mx-auto text-violet-300/60 mb-4" />
              <div className="text-lg font-semibold mb-1">Mikey has no memory yet</div>
              <p className="text-sm text-[#7a87ad] max-w-md mx-auto">
                Open a map, click <span className="text-cyan-300">✨ Research</span> or{" "}
                <span className="text-cyan-300">Deepen</span>, and your first note will land here
                — along with a copy sent to Mikey for every future research call.
              </p>
            </div>
          )}

          {all.length > 0 && filtered.length === 0 && (
            <div className="border border-white/10 rounded-2xl p-8 text-center">
              <AlertTriangle size={24} className="mx-auto text-[#9aa7c7] mb-3" />
              <div className="text-sm text-[#9aa7c7]">
                No notes match &ldquo;{query}&rdquo;. Try a shorter keyword.
              </div>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((e) => (
              <MemoryRow key={e.id} entry={e} onDelete={() => onDelete(e.id)} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const fmtAgo = (ts) => {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const MemoryRow = ({ entry, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const branches = entry.branches || [];
  const visible = expanded ? branches : branches.slice(0, 3);
  return (
    <div
      className="rounded-xl border border-white/10 bg-white/[0.015] hover:bg-white/[0.03] transition p-4"
      data-testid={`memory-row-${entry.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-base font-semibold truncate">{entry.focusTitle}</h3>
          </div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-3">
            {entry.mapTitle && <span className="mr-3">from {entry.mapTitle}</span>}
            {entry.depth && <span className="mr-3 text-violet-300/70">{entry.depth}</span>}
            {entry.ts && <span>{fmtAgo(entry.ts)}</span>}
          </div>
          {branches.length > 0 && (
            <ul className="space-y-1.5 text-[13px] text-[#cfdaf3]">
              {visible.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-violet-300/60 mt-0.5">•</span>
                  <span className="flex-1">
                    <span className="font-medium">{b.title}</span>
                    {b.summary && <span className="text-[#9aa7c7]"> — {b.summary}</span>}
                    {b.children && b.children.length > 0 && (
                      <ul className="mt-1 ml-4 space-y-0.5 text-[12px] text-[#9aa7c7]">
                        {b.children.slice(0, expanded ? undefined : 2).map((c, j) => (
                          <li key={j}>◦ {c.title}</li>
                        ))}
                      </ul>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {branches.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              data-testid={`memory-row-expand-${entry.id}`}
              className="mt-2 mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 hover:text-cyan-200"
            >
              {expanded ? "Collapse" : `+ ${branches.length - 3} more`}
            </button>
          )}
        </div>
        <button
          onClick={onDelete}
          data-testid={`memory-row-delete-${entry.id}`}
          className="text-[#566187] hover:text-red-300 transition p-1.5 rounded"
          title="Delete this memory"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

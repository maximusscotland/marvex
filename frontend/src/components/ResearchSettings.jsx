import React, { useEffect, useState } from "react";
import { Sparkles, Info, Brain, Trash2 } from "lucide-react";
import { getResearchConfig, setResearchConfig } from "@/lib/settings";
import { countResearchMemories, clearResearchMemory } from "@/lib/researchMemory";

const DEPTHS = [
  { id: "concise",  label: "Concise",  sub: "~4 branches" },
  { id: "balanced", label: "Balanced", sub: "~6 branches" },
  { id: "deep",     label: "Deep",     sub: "7–8 branches" },
];

export default function ResearchSettings() {
  const [cfg, setCfg] = useState(() => getResearchConfig());
  const [memoryCount, setMemoryCount] = useState(() => countResearchMemories());
  const update = (patch) => setCfg(setResearchConfig(patch));

  // Refresh memory count whenever the settings panel re-mounts or the
  // page regains focus (so clearing from elsewhere still reflects here).
  useEffect(() => {
    const tick = () => setMemoryCount(countResearchMemories());
    window.addEventListener("focus", tick);
    window.addEventListener("storage", tick);
    return () => {
      window.removeEventListener("focus", tick);
      window.removeEventListener("storage", tick);
    };
  }, []);

  const onClearMemory = () => {
    if (!window.confirm("Clear all research memory? Future research calls will start fresh.")) return;
    clearResearchMemory();
    setMemoryCount(0);
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4" data-testid="research-settings">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1 flex items-center gap-1.5">
            <Sparkles size={11} /> Research Assistant
          </div>
          <div className="text-[13px] text-[#cfdaf3] font-medium">
            Configure the agent that expands a node into a full sub-map
          </div>
        </div>
      </div>

      <p className="text-[12px] text-[#7a87ad] leading-relaxed mb-3 flex items-start gap-1.5">
        <Info size={12} className="mt-[2px] shrink-0" />
        <span>
          Right-click any node and choose <span className="text-cyan-200">Send to Research Assistant</span>.
          The agent returns a fresh mind-map focused on that node — saved to your <span className="text-cyan-200">Library</span>.
        </span>
      </p>

      <div className="space-y-3">
        <div>
          <label className="mono text-[10px] uppercase tracking-[0.2em] text-[#9aa7c7] block mb-1.5">
            Assistant persona (optional)
          </label>
          <textarea
            data-testid="research-persona"
            value={cfg.persona}
            onChange={(e) => update({ persona: e.target.value })}
            placeholder="e.g. 'Write like a seasoned PhD supervisor. Emphasise causal chains and open debates.'"
            rows={3}
            className="w-full bg-[#0a0f24] border border-white/10 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-cyan-400/60 resize-none"
          />
        </div>

        <div>
          <label className="mono text-[10px] uppercase tracking-[0.2em] text-[#9aa7c7] block mb-1.5">
            Target audience
          </label>
          <input
            data-testid="research-audience"
            value={cfg.audience}
            onChange={(e) => update({ audience: e.target.value })}
            placeholder="curious generalist"
            className="w-full bg-[#0a0f24] border border-white/10 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-cyan-400/60"
          />
        </div>

        <div>
          <label className="mono text-[10px] uppercase tracking-[0.2em] text-[#9aa7c7] block mb-2">
            Depth
          </label>
          <div className="flex gap-2 flex-wrap">
            {DEPTHS.map((d) => (
              <button
                key={d.id}
                data-testid={`research-depth-${d.id}`}
                onClick={() => update({ depth: d.id })}
                className={`mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border transition ${
                  cfg.depth === d.id
                    ? "bg-cyan-400 text-[#03131e] border-cyan-400 font-bold"
                    : "text-[#9aa7c7] border-white/10 hover:border-cyan-400/50"
                }`}
                title={d.sub}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* RAG memory panel */}
        <div
          className="mt-1 rounded-lg border border-violet-400/20 bg-violet-500/5 p-3"
          data-testid="research-memory-panel"
        >
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-md bg-violet-500/15 border border-violet-400/30 flex items-center justify-center shrink-0">
              <Brain size={13} className="text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-violet-300/80 mb-0.5">
                Research memory
              </div>
              <div className="text-[12px] text-[#cfdaf3] leading-relaxed">
                Mikey remembers your past research and uses the{" "}
                <span className="text-violet-200">top 3 most related notes</span> as
                context for every new call — so follow-ups cross-reference prior work
                instead of starting from scratch.
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className="mono text-[10px] uppercase tracking-[0.22em] text-violet-200/90 px-2 py-0.5 rounded bg-violet-500/15 border border-violet-400/25"
                  data-testid="research-memory-count"
                >
                  {memoryCount} note{memoryCount === 1 ? "" : "s"} stored
                </span>
                {memoryCount > 0 && (
                  <button
                    onClick={onClearMemory}
                    data-testid="research-memory-clear"
                    className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] hover:text-red-300 flex items-center gap-1"
                    title="Forget all past research"
                  >
                    <Trash2 size={10} /> Clear
                  </button>
                )}
              </div>
              <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] mt-2">
                Local-only · never leaves your browser unless used as context
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

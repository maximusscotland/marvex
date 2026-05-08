import React, { useEffect, useMemo, useRef, useState } from "react";
import { Command, CornerDownLeft, ArrowUp, ArrowDown, FileText, Circle } from "lucide-react";

/**
 * Universal command palette — fuzzy-jump to any map OR node.
 *
 * Props:
 *  - open: boolean
 *  - maps: [{id, title, children?}]
 *  - onClose()
 *  - onPickMap(mapId)
 *  - onPickNode(mapId, nodeId)
 */
export default function CommandPalette({ open, maps, onClose, onPickMap, onPickNode }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Build a flat list of all searchable entries: each map + every node within it
  const entries = useMemo(() => {
    const out = [];
    maps.forEach((m) => {
      out.push({ kind: "map", mapId: m.id, title: m.title || "Untitled", subtitle: `${(m.children || []).length} branches` });
      const walk = (node, pathTitles) => {
        if (node.id !== m.id) {
          out.push({
            kind: "node",
            mapId: m.id,
            nodeId: node.id,
            title: node.title || "Untitled map element",
            subtitle: `${m.title || "Untitled"} › ${pathTitles.join(" › ") || "root"}`,
          });
        }
        (node.children || []).forEach((c) =>
          walk(c, [...pathTitles, node.title || "…"])
        );
      };
      walk(m, []);
    });
    return out;
  }, [maps]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = entries.map((e) => {
      const t = (e.title || "").toLowerCase();
      let score = 0;
      if (!q) {
        score = e.kind === "map" ? 5 : 1;
      } else if (t === q) score = 100;
      else if (t.startsWith(q)) score = 80;
      else if (t.includes(q)) score = 60;
      else {
        let i = 0;
        for (const ch of t) {
          if (ch === q[i]) i++;
          if (i >= q.length) break;
        }
        score = i === q.length ? 25 : 0;
      }
      // Light boost for map-kind so "core" prefers map over node with same name
      if (e.kind === "map") score += 2;
      return score > 0 ? { ...e, score } : null;
    });
    return scored
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [entries, query]);

  useEffect(() => {
    if (activeIdx >= results.length) setActiveIdx(Math.max(0, results.length - 1));
  }, [results.length, activeIdx]);

  const pick = (entry) => {
    if (!entry) return;
    if (entry.kind === "map") onPickMap(entry.mapId);
    else onPickNode(entry.mapId, entry.nodeId);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[activeIdx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-50 flex justify-center items-start pt-[14vh] px-4"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl glass-panel rounded-2xl fade-up overflow-hidden"
        style={{ borderColor: "rgba(0,240,255,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Command size={16} className="text-cyan-300/80 shrink-0" />
          <input
            ref={inputRef}
            data-testid="palette-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKey}
            placeholder="Jump to map or map element…"
            className="flex-1 bg-transparent text-[15px] text-white outline-none placeholder-[#566187]"
          />
          <kbd className="mono text-[10px] px-1.5 py-0.5 rounded bg-[#0a0f24] border border-white/15 text-cyan-200">
            Esc
          </kbd>
        </div>

        <div ref={listRef} data-testid="palette-results" className="max-h-[52vh] overflow-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#7a87ad] text-sm">
              {query ? "No matches." : "Start typing to jump to a map or map element."}
            </div>
          ) : (
            results.map((entry, i) => {
              const isActive = i === activeIdx;
              const isMap = entry.kind === "map";
              const testid = isMap ? `palette-row-map-${entry.mapId}` : `palette-row-node-${entry.nodeId}`;
              return (
                <button
                  key={`${entry.kind}-${entry.nodeId || entry.mapId}-${i}`}
                  data-testid={testid}
                  data-idx={i}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => pick(entry)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                    isActive ? "bg-cyan-400/10 text-cyan-100" : "text-[#cfdaf3] hover:bg-white/[0.03]"
                  }`}
                >
                  <div
                    className={`shrink-0 w-6 h-6 rounded-md grid place-items-center border ${
                      isMap
                        ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                        : "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200"
                    }`}
                    title={isMap ? "Map" : "Map element"}
                  >
                    {isMap ? <FileText size={12} /> : <Circle size={9} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium truncate">{entry.title}</div>
                    <div className="mono text-[9px] uppercase tracking-[0.2em] text-[#566187] mt-0.5 truncate">
                      {entry.subtitle}
                    </div>
                  </div>
                  {isActive && <CornerDownLeft size={13} className="text-cyan-300 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-white/5 bg-[#040812]">
          <div className="flex items-center gap-3 mono text-[9px] uppercase tracking-[0.2em] text-[#566187]">
            <span className="flex items-center gap-1">
              <ArrowUp size={10} /> <ArrowDown size={10} /> nav
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft size={10} /> open
            </span>
          </div>
          <div className="mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">
            Command palette
          </div>
        </div>
      </div>
    </div>
  );
}

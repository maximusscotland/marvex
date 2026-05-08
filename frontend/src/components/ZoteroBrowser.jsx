import React, { useEffect, useMemo, useState } from "react";
import { X, BookOpen, Loader2, ExternalLink, Check, Search, Library, Download, KeyRound, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  getZoteroCreds,
  setZoteroCreds,
  clearZoteroCreds,
  maskZoteroKey,
  verifyCreds,
  listGroups,
  listItems,
  listPdfAttachments,
  downloadAttachmentFile,
} from "@/lib/zotero";

/**
 * ZoteroBrowser — the full Zotero import flow. It opens as a modal from the
 * Intake Studio. Three phases:
 *   1. CONNECT — user pastes API key + userID, we verify via /keys/current
 *   2. BROWSE  — pick library (personal / group), search + paginate items
 *   3. IMPORT  — selected items are fetched as PDF Files and handed back
 *                to the caller so they land in the intake queue.
 */

const PAGE_SIZE = 50;

export default function ZoteroBrowser({ open, onClose, onImport, isPro }) {
  const [phase, setPhase] = useState("connect"); // connect | browse
  const [creds, setCreds] = useState(() => getZoteroCreds());
  const [busy, setBusy] = useState(false);

  // connect form
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [connectError, setConnectError] = useState("");

  // browse
  const [libraries, setLibraries] = useState([]); // [{id, name, type}]
  const [activeLib, setActiveLib] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [start, setStart] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!open) return;
    // If creds already stored, skip straight to browse
    if (creds?.apiKey && creds?.userId) {
      setPhase("browse");
    } else {
      setPhase("connect");
    }
  }, [open, creds]);

  // Load libraries when entering browse phase
  useEffect(() => {
    if (phase !== "browse" || !creds) return;
    let cancelled = false;
    (async () => {
      const personal = { id: creds.userId, name: "My Library", type: "user" };
      try {
        const groups = await listGroups({ apiKey: creds.apiKey, userId: creds.userId });
        if (cancelled) return;
        const libs = [personal, ...groups.map((g) => ({ id: g.id, name: g.name, type: "group" }))];
        setLibraries(libs);
        setActiveLib(libs[0]);
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message || "Could not load Zotero groups");
          setLibraries([personal]);
          setActiveLib(personal);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [phase, creds]);

  // Load items when library, search or pagination changes
  useEffect(() => {
    if (phase !== "browse" || !creds || !activeLib) return;
    let cancelled = false;
    setFetching(true);
    listItems({
      apiKey: creds.apiKey,
      libraryType: activeLib.type,
      libraryId: activeLib.id,
      start,
      limit: PAGE_SIZE,
      search,
    })
      .then(({ items: list, total: t }) => {
        if (cancelled) return;
        setItems(list);
        setTotal(t);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message || "Could not load items");
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => { cancelled = true; };
  }, [phase, creds, activeLib, start, search]);

  if (!open) return null;

  /* ------------------- Connect phase ------------------- */

  const handleConnect = async () => {
    setConnectError("");
    const apiKey = apiKeyInput.trim();
    const userId = userIdInput.trim();
    if (!apiKey || !userId) {
      setConnectError("Both API key and user ID are required");
      return;
    }
    if (!/^\d+$/.test(userId)) {
      setConnectError("User ID must be numeric (find it at zotero.org/settings/keys)");
      return;
    }
    setBusy(true);
    const res = await verifyCreds({ apiKey, userId });
    setBusy(false);
    if (!res.ok) {
      setConnectError(res.error || "Could not verify — check the key and user ID");
      return;
    }
    try {
      const saved = setZoteroCreds({ apiKey, userId });
      setCreds(saved);
      toast.success(`Connected as @${res.username || "Zotero user"}`);
      setPhase("browse");
    } catch (err) {
      setConnectError(err.message || "Could not save credentials");
    }
  };

  const handleDisconnect = () => {
    clearZoteroCreds();
    setCreds(null);
    setLibraries([]);
    setActiveLib(null);
    setItems([]);
    setSelected(new Set());
    setApiKeyInput("");
    setUserIdInput("");
    setPhase("connect");
    toast("Zotero disconnected");
  };

  /* ------------------- Browse / select ------------------- */

  const toggleSelect = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const onPickLibrary = (lib) => {
    setActiveLib(lib);
    setStart(0);
    setSelected(new Set());
    setSearch("");
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    if (!isPro && selected.size > 1) {
      toast.error("Free tier is limited to 1 PDF — upgrade to import multiple");
      return;
    }
    setBusy(true);
    const chosen = items.filter((it) => selected.has(it.key));
    const pending = toast.loading(`Fetching ${chosen.length} PDF${chosen.length > 1 ? "s" : ""} from Zotero…`);
    const files = [];
    let failed = 0;
    for (const it of chosen) {
      try {
        const atts = await listPdfAttachments({
          apiKey: creds.apiKey,
          libraryType: it.libraryType,
          libraryId: it.libraryId,
          parentKey: it.key,
        });
        if (!atts.length) { failed++; continue; }
        // Take the first PDF attachment only — usually the full-text.
        const a = atts[0];
        const file = await downloadAttachmentFile({
          apiKey: creds.apiKey,
          libraryType: it.libraryType,
          libraryId: it.libraryId,
          attachmentKey: a.key,
          filename: a.filename,
        });
        files.push(file);
      } catch (err) {
        failed++;
        // Keep going — partial success is still useful
        console.error("Zotero fetch failed:", err);
      }
    }
    toast.dismiss(pending);
    setBusy(false);
    if (!files.length) {
      toast.error(
        failed > 0
          ? "None of the selected items had a reachable PDF attachment"
          : "Nothing imported"
      );
      return;
    }
    toast.success(
      `Imported ${files.length} PDF${files.length > 1 ? "s" : ""}${failed ? ` · ${failed} skipped` : ""}`
    );
    onImport && onImport(files);
    onClose && onClose();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIdx = Math.floor(start / PAGE_SIZE);

  /* ------------------- Render ------------------- */

  return (
    <div
      data-testid="zotero-browser"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="w-full max-w-3xl glass-panel rounded-2xl p-7 fade-up max-h-[85vh] flex flex-col"
        style={{ borderColor: "rgba(0,240,255,0.25)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-400/30 grid place-items-center text-red-300">
              <BookOpen size={18} />
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">Import from</div>
              <h3 className="text-xl font-bold">Zotero library</h3>
            </div>
          </div>
          <button
            data-testid="zotero-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {phase === "connect" ? (
          <div className="space-y-4" data-testid="zotero-connect-form">
            <p className="text-[13px] text-[#9aa7c7] leading-relaxed">
              Paste your personal Zotero API key and numeric user ID. Both are created at{" "}
              <a
                href="https://www.zotero.org/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 hover:text-cyan-200 underline"
              >
                zotero.org/settings/keys
                <ExternalLink size={11} className="inline ml-1 -translate-y-[1px]" />
              </a>
              . Both values live only on this device — we never send them to our servers.
            </p>

            <div>
              <label className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] flex items-center gap-1.5 mb-1.5">
                <KeyRound size={11} /> API key
              </label>
              <input
                data-testid="zotero-input-key"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="P9NiFoyLeZu2bZNvvuQPDWsd"
                className="w-full bg-[#0a1428] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400/60"
              />
            </div>

            <div>
              <label className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] mb-1.5 block">
                Numeric user ID
              </label>
              <input
                data-testid="zotero-input-userid"
                type="text"
                inputMode="numeric"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="1234567"
                className="w-full bg-[#0a1428] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400/60"
              />
            </div>

            {connectError && (
              <div
                data-testid="zotero-connect-error"
                className="flex items-start gap-2 text-[12px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2"
              >
                <AlertTriangle size={13} className="shrink-0 mt-[1px]" />
                <span>{connectError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                data-testid="zotero-cancel"
                onClick={onClose}
                className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full text-[#9aa7c7] hover:text-white transition"
              >
                Cancel
              </button>
              <button
                data-testid="zotero-connect"
                onClick={handleConnect}
                disabled={busy}
                className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e] font-bold disabled:opacity-50 flex items-center gap-1.5 hover:shadow-[0_0_16px_rgba(0,240,255,0.5)] transition"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {busy ? "Verifying…" : "Connect"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4" data-testid="zotero-browse">
            {/* Library + search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-[#0a1428] border border-white/10 rounded-full p-1 overflow-x-auto max-w-full">
                {libraries.map((lib) => {
                  const active = activeLib?.id === lib.id && activeLib?.type === lib.type;
                  return (
                    <button
                      key={`${lib.type}-${lib.id}`}
                      data-testid={`zotero-lib-${lib.type}-${lib.id}`}
                      onClick={() => onPickLibrary(lib)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full mono text-[10px] uppercase tracking-[0.18em] whitespace-nowrap transition ${
                        active ? "bg-cyan-400 text-[#03131e] font-bold" : "text-[#9aa7c7] hover:text-cyan-200"
                      }`}
                    >
                      <Library size={11} /> {lib.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex-1 min-w-[200px] relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566187]" />
                <input
                  data-testid="zotero-search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setStart(0); }}
                  placeholder="Search titles, creators, tags…"
                  className="w-full bg-[#0a1428] border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-[13px] placeholder:text-[#566187] focus:outline-none focus:border-cyan-400/60"
                />
              </div>
              <button
                data-testid="zotero-disconnect"
                onClick={handleDisconnect}
                title="Disconnect Zotero"
                className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] hover:text-red-300 transition px-2"
              >
                Disconnect · {maskZoteroKey(creds?.apiKey)}
              </button>
            </div>

            {/* Item list */}
            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
              {fetching ? (
                <div className="p-10 text-center text-[#7a87ad]">
                  <Loader2 size={20} className="animate-spin mx-auto mb-2 text-cyan-300" />
                  <div className="mono text-[10px] uppercase tracking-[0.22em]">Loading library…</div>
                </div>
              ) : items.length === 0 ? (
                <div className="p-10 text-center text-[#7a87ad]">
                  <div className="mono text-[10px] uppercase tracking-[0.22em]">No items found</div>
                </div>
              ) : (
                <ul className="divide-y divide-white/5" data-testid="zotero-item-list">
                  {items.map((it) => {
                    const isSel = selected.has(it.key);
                    const hasPdf = it.numChildren > 0;
                    return (
                      <li
                        key={it.key}
                        data-testid={`zotero-item-${it.key}`}
                        onClick={() => hasPdf && toggleSelect(it.key)}
                        className={`flex items-start gap-3 px-4 py-3 transition ${
                          hasPdf ? "cursor-pointer hover:bg-white/[0.03]" : "opacity-50 cursor-not-allowed"
                        } ${isSel ? "bg-cyan-500/5" : ""}`}
                      >
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-sm border flex-shrink-0 grid place-items-center transition ${
                            isSel
                              ? "bg-cyan-400 border-cyan-400 text-[#03131e]"
                              : "border-white/20"
                          }`}
                        >
                          {isSel && <Check size={11} strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{it.title}</div>
                          <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] mt-0.5 flex items-center gap-2">
                            {it.creators.length > 0 && <span>{it.creators.slice(0, 2).join(", ")}{it.creators.length > 2 ? " et al." : ""}</span>}
                            {it.year && <span>· {it.year}</span>}
                            <span>· {it.itemType}</span>
                            {!hasPdf && <span className="text-amber-400/80">· no PDF</span>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Pagination + import */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
                {total} items · page {pageIdx + 1} of {totalPages}
                {selected.size > 0 && <span className="ml-3 text-cyan-300">{selected.size} selected</span>}
              </div>
              <div className="flex items-center gap-1">
                <PagerBtn onClick={() => setStart(Math.max(0, start - PAGE_SIZE))} disabled={start === 0 || fetching}>
                  ← Prev
                </PagerBtn>
                <PagerBtn onClick={() => setStart(start + PAGE_SIZE)} disabled={pageIdx + 1 >= totalPages || fetching}>
                  Next →
                </PagerBtn>
                <div className="w-2" />
                <button
                  data-testid="zotero-import"
                  onClick={handleImport}
                  disabled={selected.size === 0 || busy}
                  className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e] font-bold disabled:opacity-30 flex items-center gap-1.5 hover:shadow-[0_0_16px_rgba(0,240,255,0.5)] transition"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Import {selected.size > 0 ? `${selected.size}` : ""}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PagerBtn = ({ children, ...rest }) => (
  <button
    {...rest}
    className="mono text-[10px] uppercase tracking-[0.18em] text-[#9aa7c7] hover:text-cyan-200 disabled:opacity-30 disabled:pointer-events-none px-3 py-2 rounded-full hover:bg-white/5 transition"
  >
    {children}
  </button>
);

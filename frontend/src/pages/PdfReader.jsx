import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  Plus,
  Loader2,
  Highlighter,
  FileText,
  Trash2,
  Copy,
  X,
  Bookmark,
  FilePlus2,
  Pencil,
  Eraser,
  Library,
  Sparkles,
  ScrollText,
  Check,
  Printer,
} from "lucide-react";
import { listMaps, getMap, saveMap, newId, addToRecents } from "@/lib/storage";
import { loadPdfJs } from "@/lib/pdfReaderLoader";
import { loadInk, saveInk, INK_WIDTHS, INK_COLORS } from "@/lib/inkStorage";
import InkLayer from "@/components/InkLayer";
import MobileNav from "@/components/MobileNav";

/** Stable per-file identity — survives across browser sessions. */
const fileKeyFor = (file) => `${file.name}::${file.size}::${file.lastModified || 0}`;
const sessionId = () => `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * Collect every persisted highlight across ALL maps whose readerMeta.highlights
 * references this fileKey. Returns sorted newest-first.
 */
const collectPersistedHighlights = (fileKey) => {
  const all = [];
  for (const m of listMaps()) {
    const highs = m.readerMeta?.highlights || [];
    for (const h of highs) {
      if (h.fileKey === fileKey) {
        all.push({ ...h, mapId: m.id, mapTitle: m.title });
      }
    }
  }
  return all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
};

/**
 * Pushes a new highlight into the target map's readerMeta.highlights and
 * persists via saveMap. Returns the saved map so callers can refresh state.
 */
const persistHighlightOnMap = (mapId, highlight) => {
  const m = getMap(mapId);
  if (!m) return null;
  const readerMeta = m.readerMeta || { createdAt: Date.now() };
  readerMeta.highlights = [...(readerMeta.highlights || []), highlight];
  const next = { ...m, readerMeta };
  saveMap(next);
  return next;
};

export default function PdfReader() {
  const navigate = useNavigate();
  const location = useLocation();
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Multi-PDF tab sessions. Each: { id, file, fileKey, pdfDoc, numPages, loading, fresh, persisted }
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selection, setSelection] = useState(null); // {text, rect, pageNumber}
  const [maps, setMaps] = useState(() => listMaps());
  const [targetMapId, setTargetMapId] = useState(() => {
    const prefer = qs.get("map");
    const ms = listMaps();
    if (prefer && ms.some((m) => m.id === prefer)) return prefer;
    return ms[0]?.id || "";
  });

  // ---- Ink / freehand drawing state ----
  const [drawMode, setDrawMode] = useState(false);
  const [inkTool, setInkTool] = useState("pen");     // "pen" | "eraser"
  const [inkColor, setInkColor] = useState("cyan");
  const [inkWidth, setInkWidth] = useState(INK_WIDTHS.med);

  // Add a stroke to active session's ink map for the given page, and persist.
  const addStroke = useCallback((pageNumber, stroke) => {
    if (!activeSessionId) return;
    setSessions((prev) => prev.map((s) => {
      if (s.id !== activeSessionId) return s;
      const next = { ...(s.ink || {}) };
      next[pageNumber] = [...(next[pageNumber] || []), stroke];
      saveInk(s.fileKey, next);
      return { ...s, ink: next };
    }));
  }, [activeSessionId]);

  const eraseStroke = useCallback((pageNumber, strokeId) => {
    if (!activeSessionId) return;
    setSessions((prev) => prev.map((s) => {
      if (s.id !== activeSessionId) return s;
      const curr = (s.ink || {})[pageNumber] || [];
      const filtered = curr.filter((x) => x.id !== strokeId);
      const next = { ...(s.ink || {}) };
      if (filtered.length) next[pageNumber] = filtered;
      else delete next[pageNumber];
      saveInk(s.fileKey, next);
      return { ...s, ink: next };
    }));
  }, [activeSessionId]);

  const clearPageInk = useCallback((pageNumber) => {
    if (!activeSessionId) return;
    setSessions((prev) => prev.map((s) => {
      if (s.id !== activeSessionId) return s;
      const next = { ...(s.ink || {}) };
      delete next[pageNumber];
      saveInk(s.fileKey, next);
      return { ...s, ink: next };
    }));
  }, [activeSessionId]);

  const pagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pageRefs = useRef({});
  // Track which session IDs we've already dispatched a load for, so the
  // load effect below doesn't infinite-loop when we patch the session to
  // store pdfDoc/numPages.
  const loadedOnceRef = useRef(new Set());

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  // Update a specific session by id (immutable partial update).
  const patchSession = useCallback((id, patch) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // ---- Load the active PDF's document once per session id ----
  useEffect(() => {
    if (!activeSessionId) return undefined;
    if (loadedOnceRef.current.has(activeSessionId)) return undefined;
    // Find the session via the setter (no stale closure) — we only need the file.
    const s = sessions.find((x) => x.id === activeSessionId);
    if (!s || s.pdfDoc) return undefined;
    loadedOnceRef.current.add(activeSessionId);
    let cancelled = false;
    patchSession(activeSessionId, { loading: true });
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const buf = await s.file.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled) return;
        patchSession(activeSessionId, { pdfDoc: doc, numPages: doc.numPages, loading: false });
      } catch (err) {
        if (cancelled) return;
        patchSession(activeSessionId, { loading: false });
        loadedOnceRef.current.delete(activeSessionId); // let the user retry by switching tabs
        toast.error(`Could not open PDF: ${err.message || err}`);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // ---- Track text selection to show the floating toolbar ----
  useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setSelection(null); return; }
      const text = sel.toString().trim();
      if (text.length < 3) { setSelection(null); return; }
      const anchorNode = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
      if (!anchorNode || !pagesContainerRef.current?.contains(anchorNode)) {
        setSelection(null);
        return;
      }
      // Climb the DOM to find the PdfPage wrapper and read its data-page number.
      let pageEl = anchorNode;
      while (pageEl && pageEl.dataset?.pageNumber === undefined) pageEl = pageEl.parentElement;
      const pageNumber = pageEl ? parseInt(pageEl.dataset.pageNumber, 10) : null;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelection({ text: text.slice(0, 1000), rect, pageNumber });
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
    };
  }, []);

  // ---- File handlers ----
  const handleFilesPicked = (files) => {
    const list = Array.from(files || []).filter(
      (f) => f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
    );
    if (!list.length) { toast.error("Only PDF files are supported"); return; }
    const newSessions = list.map((f) => {
      const fk = fileKeyFor(f);
      return {
        id: sessionId(),
        file: f,
        fileKey: fk,
        // Display title is renamable independently of the file's actual name.
        // Defaults to the bare filename without `.pdf`. Persisted across the
        // session (closes when the tab closes).  Saved to localStorage so a
        // re-opened file remembers its custom title.
        displayTitle: (() => {
          try {
            const cached = localStorage.getItem(`mindmapper.reader.title.${fk}`);
            if (cached) return cached;
          } catch { /* ignore */ }
          return (f.name || "PDF").replace(/\.pdf$/i, "");
        })(),
        pdfDoc: null,
        numPages: 0,
        loading: false,
        fresh: [],
        persisted: collectPersistedHighlights(fk),
        ink: loadInk(fk),  // {pageNumber: Stroke[]}
      };
    });
    setSessions((prev) => [...prev, ...newSessions]);
    setActiveSessionId(newSessions[0].id);
  };

  // Backwards-compat alias used by the dropzone view.
  const handleFilePicked = (f) => handleFilesPicked(f ? [f] : []);

  // ---- Deep-link: open a PDF passed in via ?src=<url> ----
  // The mind-map node's "Open link" action routes PDFs here so users get
  // highlights, ink, and "send selection to map" instead of the OS default
  // PDF viewer. Supports http(s) URLs and `data:application/pdf;base64,...`.
  //
  // StrictMode-safe: we only mark a src as "consumed" AFTER the file has been
  // handed to handleFilesPicked. The first mount in StrictMode might be
  // cancelled before completing, so we must NOT pre-stamp the ref.
  const openedSrcRef = useRef(new Set());
  useEffect(() => {
    const src = qs.get("src");
    if (!src) return undefined;
    if (openedSrcRef.current.has(src)) return undefined;
    const titleHint = qs.get("title");
    let cancelled = false;

    const inferredFilename = (() => {
      if (titleHint) return /\.pdf$/i.test(titleHint) ? titleHint : `${titleHint}.pdf`;
      try {
        const u = new URL(src, window.location.origin);
        const last = u.pathname.split("/").filter(Boolean).pop();
        if (last && /\.pdf$/i.test(last)) return decodeURIComponent(last);
      } catch { /* data: URL etc. — fine */ }
      return "linked.pdf";
    })();

    // Fast path for data: URLs — decode synchronously, no network round-trip.
    // This sidesteps CORS entirely for inline-uploaded PDFs.
    if (/^data:application\/pdf/i.test(src)) {
      try {
        const m = src.match(/^data:([^;,]+)(?:;[^,]*)?,(.*)$/);
        const isB64 = /;base64/i.test(src.slice(0, 200));
        const body = m ? m[2] : "";
        const bytes = isB64
          ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
          : new TextEncoder().encode(decodeURIComponent(body));
        const file = new File([bytes], inferredFilename, { type: "application/pdf" });
        openedSrcRef.current.add(src);
        handleFilesPicked([file]);
      } catch (err) {
        toast.error(`Could not decode linked PDF: ${err.message || err}`);
      }
      return undefined;
    }

    // Network path for http(s) URLs.
    (async () => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const file = new File([blob], inferredFilename, { type: "application/pdf" });
        openedSrcRef.current.add(src);
        handleFilesPicked([file]);
      } catch (err) {
        if (cancelled) return;
        // CORS / network failure — fall back to opening externally so the
        // user still sees the PDF (browser's built-in viewer or the OS app).
        toast.error(`Could not load PDF inline (${err.message || err}). Opening in a new tab.`);
        try { window.open(src, "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const closeSession = (id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (id === activeSessionId) setActiveSessionId(next[0]?.id || null);
      return next;
    });
  };

  // ---- Target-map helpers ----
  const renameActiveSession = useCallback((newTitle) => {
    if (!activeSessionId) return;
    const trimmed = (newTitle || "").trim();
    if (!trimmed) return;
    setSessions((prev) => prev.map((s) => {
      if (s.id !== activeSessionId) return s;
      try { localStorage.setItem(`mindmapper.reader.title.${s.fileKey}`, trimmed); } catch { /* ignore */ }
      return { ...s, displayTitle: trimmed };
    }));
    toast.success("Renamed");
  }, [activeSessionId]);

  const refreshMaps = useCallback(() => {
    const ms = listMaps();
    setMaps(ms);
    if (!ms.some((m) => m.id === targetMapId)) {
      setTargetMapId(ms[0]?.id || "");
    }
  }, [targetMapId]);

  const createNewMapFromPdf = () => {
    if (!activeSession) return;
    const title = (activeSession.file.name || "PDF Notes").replace(/\.pdf$/i, "");
    const m = {
      id: newId(),
      title: title.slice(0, 80),
      summary: "",
      shape: "rect",
      fill: "rgba(3,20,36,0.85)",
      stroke: "#00f0ff",
      fontSize: 16,
      children: [],
      source: "reader",
      readerMeta: {
        fileName: activeSession.file.name,
        fileKey: activeSession.fileKey,
        createdAt: Date.now(),
        highlights: [],
      },
    };
    try {
      saveMap(m);
      addToRecents(m.id);
      setMaps(listMaps());
      setTargetMapId(m.id);
      toast.success(`Created "${m.title}"`);
    } catch (err) {
      toast.error(err?.message || "Could not create map");
    }
  };

  const addAsNode = () => {
    if (!selection || !activeSession) return;
    if (!targetMapId) { toast.error("Pick a target map first"); return; }
    const map = getMap(targetMapId);
    if (!map) { toast.error("Target map not found"); return; }
    const text = selection.text;
    const title = text.slice(0, 140);
    const nodeId = `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const newChild = {
      id: nodeId,
      title,
      shape: "ellipse",
      summary: text.length > 140 ? text : "",
      children: [],
    };
    const withChild = { ...map, children: [...(map.children || []), newChild] };
    try {
      saveMap(withChild);
      // Persist the highlight on the map doc so it survives reloads.
      persistHighlightOnMap(targetMapId, {
        text,
        nodeId,
        fileKey: activeSession.fileKey,
        fileName: activeSession.file.name,
        pageNumber: selection.pageNumber || null,
        ts: Date.now(),
      });
      // Update active session's fresh list + refresh persisted list for all
      // sessions pointing to the same file.
      patchSession(activeSession.id, {
        fresh: [
          { id: nodeId, text, mapId: map.id, mapTitle: map.title, pageNumber: selection.pageNumber, ts: Date.now() },
          ...activeSession.fresh,
        ],
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.fileKey === activeSession.fileKey
            ? { ...s, persisted: collectPersistedHighlights(s.fileKey) }
            : s
        )
      );
      setMaps(listMaps());
      toast.success(`Added to "${map.title}"`);
    } catch (err) {
      toast.error(err?.message || "Could not save to map");
      return;
    }
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const goToMap = () => {
    if (!targetMapId) return;
    addToRecents(targetMapId);
    navigate(`/app?map=${targetMapId}`);
  };

  // ---------- Dropzone view (no sessions yet) ----------
  if (!activeSession) {
    return (
      <div className="min-h-screen bg-[#03040a] text-[#cfdaf3]">
        <MobileNav />
        <HeaderBar navigate={navigate} title="PDF Reader" />
        <main className="px-6 md:px-10 py-14 max-w-3xl mx-auto" data-testid="reader-dropzone-page">
          <section
            data-testid="reader-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFilesPicked(e.dataTransfer?.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed px-8 py-16 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-cyan-400 bg-cyan-500/10"
                : "border-cyan-400/30 bg-white/[0.02] hover:border-cyan-400/60 hover:bg-cyan-500/5"
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/10 border border-cyan-400/40 grid place-items-center mx-auto mb-5">
              <Upload size={26} className="text-cyan-200" />
            </div>
            <div className="text-2xl font-bold text-white mb-2">Open a PDF to read &amp; highlight</div>
            <div className="text-[13px] text-[#9aa7c7] max-w-md mx-auto">
              Drag a PDF here or click to browse. Select passages → they turn into nodes on your mind map.
            </div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mt-5">
              PDF · Max 50 MB · 100% local
            </div>
          </section>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            data-testid="reader-file-input"
            onChange={(e) => handleFilesPicked(e.target.files)}
          />
        </main>
      </div>
    );
  }

  // ---------- Reader view (file loaded) ----------
  const fileInputAdd = () => fileInputRef.current?.click();
  return (
    <div translate="no" className="notranslate min-h-screen bg-[#03040a] text-[#cfdaf3]">
      <MobileNav />
      <ReaderHeader
        navigate={navigate}
        file={activeSession.file}
        displayTitle={activeSession.displayTitle}
        onRename={renameActiveSession}
        highlightCount={(activeSession.fresh || []).length + (activeSession.persisted || []).length}
        maps={maps}
        targetMapId={targetMapId}
        onTargetChange={setTargetMapId}
        onCreateNewMap={createNewMapFromPdf}
        onRefreshMaps={refreshMaps}
        onReset={() => closeSession(activeSession.id)}
        onGoToMap={goToMap}
      />

      {/* Multi-PDF tab bar */}
      <div
        className="flex items-center gap-1 px-4 py-1.5 border-b border-white/10 bg-[#05070f] overflow-x-auto"
        data-testid="reader-tabbar"
      >
        {sessions.map((s) => {
          const active = s.id === activeSessionId;
          return (
            <div
              key={s.id}
              data-testid={`reader-tab-${s.id}`}
              data-active={active ? "true" : "false"}
              onClick={() => setActiveSessionId(s.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer whitespace-nowrap transition max-w-[240px] ${
                active
                  ? "bg-white/[0.06] text-white border-t border-l border-r border-cyan-400/30"
                  : "text-[#9aa7c7] hover:text-white hover:bg-white/[0.03]"
              }`}
              title={s.file.name}
            >
              <FileText size={11} className={active ? "text-cyan-300" : "text-[#566187]"} />
              <span className="text-[12px] truncate">{s.file.name}</span>
              {s.persisted?.length > 0 && (
                <span className="mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/70 px-1.5 py-[1px] rounded bg-cyan-400/10 shrink-0">
                  {s.persisted.length}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                className="ml-1 opacity-0 group-hover:opacity-100 text-[#566187] hover:text-red-300 transition"
                data-testid={`reader-tab-close-${s.id}`}
                aria-label={`Close ${s.file.name}`}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
        <button
          onClick={fileInputAdd}
          data-testid="reader-tab-add"
          className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 hover:text-white px-3 py-1.5 rounded-t-lg flex items-center gap-1 shrink-0"
          title="Open another PDF"
        >
          <FilePlus2 size={11} /> Add
        </button>
      </div>

      {/* Quick instructions — banner that fades after the user has added 3+
          highlights. Tells the user the 3-step workflow in plain English. */}
      {(activeSession.fresh.length + activeSession.persisted.length) < 3 && (
        <div
          data-testid="reader-howto-strip"
          className="px-6 md:px-10 py-2.5 border-b border-cyan-400/15 bg-cyan-500/[0.04] text-[12px] flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5"
        >
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90">How it works</span>
          <span className="flex items-center gap-1.5 text-[#cfdaf3]">
            <span className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400/40 grid place-items-center mono text-[9px] text-cyan-200">1</span>
            <span>Select text or highlight passages</span>
          </span>
          <span className="text-[#3a4870]">→</span>
          <span className="flex items-center gap-1.5 text-[#cfdaf3]">
            <span className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-400/40 grid place-items-center mono text-[9px] text-cyan-200">2</span>
            <span>Choose your nodes — they save into the map you picked above</span>
          </span>
          <span className="text-[#3a4870]">→</span>
          <span className="flex items-center gap-1.5 text-fuchsia-200">
            <span className="w-4 h-4 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 grid place-items-center mono text-[9px] text-fuchsia-200">3</span>
            <span><strong>Generate map</strong> button (top right)</span>
          </span>
        </div>
      )}

      {/* Ink / freehand drawing toolbar */}
      <DrawToolbar
        drawMode={drawMode}
        onToggle={() => setDrawMode((v) => !v)}
        tool={inkTool}
        onToolChange={setInkTool}
        color={inkColor}
        onColorChange={setInkColor}
        width={inkWidth}
        onWidthChange={setInkWidth}
      />

      <main className="flex gap-0 min-h-[calc(100vh-108px)]">
        {/* Pages */}
        <section
          ref={pagesContainerRef}
          className="flex-1 overflow-y-auto px-6 py-8 space-y-6"
          data-testid="reader-pages"
        >
          {activeSession.loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-cyan-300 mr-2" size={20} />
              <span className="text-[#9aa7c7]">Rendering PDF…</span>
            </div>
          )}
          {activeSession.pdfDoc &&
            Array.from({ length: activeSession.numPages }).map((_, i) => (
              <PdfPage
                key={`${activeSession.id}-${i}`}
                pdfDoc={activeSession.pdfDoc}
                pageNumber={i + 1}
                registerRef={(el) => { pageRefs.current[i + 1] = el; }}
                inkStrokes={activeSession.ink?.[i + 1] || []}
                drawMode={drawMode}
                inkTool={inkTool}
                inkColor={inkColor}
                inkWidth={inkWidth}
                onAddStroke={(stroke) => addStroke(i + 1, stroke)}
                onEraseStroke={(sid) => eraseStroke(i + 1, sid)}
                onClearPage={() => clearPageInk(i + 1)}
              />
            ))}
        </section>

        {/* Highlights sidebar */}
        <HighlightsSidebar
          fresh={activeSession.fresh}
          persisted={activeSession.persisted}
          targetMapTitle={maps.find((m) => m.id === targetMapId)?.title}
          onJumpToMap={(mapId) => { addToRecents(mapId); navigate(`/app?map=${mapId}`); }}
        />
      </main>

      {/* Bottom horizontal nav strip — quick links to the rest of the app
          without scrolling back to the top. Sticky so it follows the user
          down very long PDFs. */}
      <nav
        data-testid="reader-bottom-nav"
        className="sticky bottom-0 z-30 border-t border-white/10 bg-[#04060d]/95 backdrop-blur px-6 md:px-10 py-2.5 flex flex-wrap items-center justify-center gap-x-1 gap-y-1"
      >
        <Link
          to="/library"
          data-testid="reader-bottom-library"
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 px-3 py-1.5 rounded transition flex items-center gap-1.5"
        >
          <Library size={11} /> Library
        </Link>
        <span className="text-[#1f2740]">|</span>
        <Link
          to={targetMapId ? `/app?map=${targetMapId}` : "/app"}
          data-testid="reader-bottom-studio"
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 px-3 py-1.5 rounded transition flex items-center gap-1.5"
        >
          <Sparkles size={11} /> Map studio
        </Link>
        <span className="text-[#1f2740]">|</span>
        <Link
          to="/output"
          data-testid="reader-bottom-output"
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 px-3 py-1.5 rounded transition flex items-center gap-1.5"
        >
          <ScrollText size={11} /> Requested Assets
        </Link>
        <span className="text-[#1f2740]">|</span>
        <Link
          to="/highlights"
          data-testid="reader-bottom-highlights"
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 px-3 py-1.5 rounded transition flex items-center gap-1.5"
        >
          <Highlighter size={11} /> Highlights
        </Link>
        <span className="text-[#1f2740]">|</span>
        <Link
          to="/learn"
          data-testid="reader-bottom-learn"
          className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 px-3 py-1.5 rounded transition flex items-center gap-1.5"
        >
          <Bookmark size={11} /> Tutorials
        </Link>
      </nav>

      {/* Floating selection toolbar */}
      {selection && (
        <FloatingToolbar selection={selection} onAdd={addAsNode} onDismiss={() => setSelection(null)} />
      )}

      {/* Hidden file input (also wired by dropzone) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFilesPicked(e.target.files)}
      />
    </div>
  );
}

/* ====================== Sub-components ====================== */

const HeaderBar = ({ navigate, title }) => (
  <header className="px-6 md:px-10 h-16 flex items-center gap-4 border-b border-white/10 bg-[#04060d]">
    <button
      onClick={() => navigate(-1)}
      className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 flex items-center gap-1.5"
      data-testid="reader-back"
    >
      <ArrowLeft size={12} /> Back
    </button>
    <div className="h-6 w-px bg-white/10" />
    <div className="flex items-center gap-2">
      <FileText size={16} className="text-cyan-300" />
      <div className="text-[15px] font-semibold text-white">{title}</div>
    </div>
  </header>
);

const ReaderHeader = ({
  navigate, file, displayTitle, onRename, highlightCount = 0,
  maps, targetMapId, onTargetChange,
  onCreateNewMap, onRefreshMaps, onReset, onGoToMap,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayTitle || file?.name || "PDF");
  useEffect(() => { setDraft(displayTitle || file?.name || "PDF"); }, [displayTitle, file?.name]);
  const commit = () => {
    setEditing(false);
    if (draft && draft.trim() !== (displayTitle || "").trim()) onRename?.(draft.trim());
  };
  const hasHighlights = highlightCount > 0;
  return (
    <header className="px-6 md:px-10 h-16 flex items-center gap-4 border-b border-white/10 bg-[#04060d] sticky top-0 z-30">
      <button
        onClick={() => navigate(-1)}
        className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 flex items-center gap-1.5"
        data-testid="reader-back"
      >
        <ArrowLeft size={12} /> Back
      </button>
      <div className="h-6 w-px bg-white/10" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FileText size={16} className="text-cyan-300 shrink-0" />
        {editing ? (
          <input
            data-testid="reader-title-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(displayTitle || file?.name || ""); setEditing(false); }
            }}
            className="bg-[#0a0f24] border border-cyan-400/40 rounded-md px-2.5 py-1 text-[14px] text-white max-w-[420px] focus:outline-none focus:border-cyan-400/80"
          />
        ) : (
          <button
            data-testid="reader-title"
            onClick={() => setEditing(true)}
            title="Click to rename — your saved copy will use this title"
            className="text-[14px] font-medium text-white truncate text-left hover:text-cyan-200 transition flex items-center gap-1.5 min-w-0"
          >
            <span className="truncate">{displayTitle || file?.name || "PDF"}</span>
            <Pencil size={11} className="text-[#566187] shrink-0" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <label className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7]">→</label>
        <select
          data-testid="reader-target-map"
          value={targetMapId}
          onClick={onRefreshMaps}
          onChange={(e) => onTargetChange(e.target.value)}
          className="bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-1.5 text-[12px] text-white max-w-[200px] focus:outline-none focus:border-cyan-400/60"
        >
          {maps.length === 0 && <option value="">No maps</option>}
          {maps.map((m) => (
            <option key={m.id} value={m.id}>{m.title}</option>
          ))}
        </select>
        <button
          onClick={onCreateNewMap}
          data-testid="reader-new-map"
          className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10 flex items-center gap-1.5"
        >
          <Plus size={11} /> New
        </button>
        <button
          onClick={onGoToMap}
          disabled={!targetMapId}
          data-testid="reader-go-to-map"
          title={hasHighlights
            ? `Open the map with your ${highlightCount} highlighted map element${highlightCount === 1 ? "" : "s"}`
            : "Highlight passages first, then open the map to see them as map elements"}
          className={`mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full font-bold disabled:opacity-50 flex items-center gap-1.5 transition ${
            hasHighlights
              ? "bg-gradient-to-br from-fuchsia-400 to-amber-300 text-[#03131e] shadow-[0_0_18px_rgba(255,106,213,0.4)] hover:shadow-[0_0_24px_rgba(255,106,213,0.55)]"
              : "bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e]"
          }`}
        >
          {hasHighlights ? (<><Sparkles size={11} /> Generate map ({highlightCount})</>) : "Build Map"}
        </button>
        <button
          onClick={() => {
            // Add a transient body class so any reader-specific print CSS can
            // hide chrome; then trigger the native print dialog. Cleanup on
            // afterprint so subsequent prints stay clean.
            document.body.classList.add("printing-canvas");
            const cleanup = () => {
              document.body.classList.remove("printing-canvas");
              window.removeEventListener("afterprint", cleanup);
            };
            window.addEventListener("afterprint", cleanup);
            setTimeout(() => window.print(), 50);
          }}
          data-testid="reader-print"
          title="Print the visible PDF page (Ctrl/⌘ + P)"
          className="ml-1 p-1.5 rounded-md text-[#566187] hover:text-cyan-300 hover:bg-cyan-400/10 transition"
        >
          <Printer size={14} />
        </button>
        <button
          onClick={onReset}
          className="ml-1 p-1.5 rounded-md text-[#566187] hover:text-red-300 hover:bg-red-500/10"
          data-testid="reader-reset"
          title="Close this PDF"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};

const FloatingToolbar = ({ selection, onAdd, onDismiss }) => {
  const top = Math.max(selection.rect.top - 48, 12);
  const left = Math.min(
    Math.max(selection.rect.left + selection.rect.width / 2 - 72, 12),
    window.innerWidth - 156
  );
  return (
    <div
      data-testid="reader-selection-toolbar"
      className="fixed z-50 flex items-center gap-1 glass-panel rounded-full px-1.5 py-1 fade-up"
      style={{ top, left, borderColor: "rgba(0,240,255,0.4)" }}
      onMouseDown={(e) => e.preventDefault() /* don't clear selection */}
    >
      <button
        onClick={onAdd}
        data-testid="reader-add-node"
        className="mono text-[11px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e] font-bold flex items-center gap-1.5 hover:shadow-[0_0_14px_rgba(0,240,255,0.5)] transition"
      >
        <Plus size={11} /> Node
      </button>
      <button
        onClick={() => { navigator.clipboard?.writeText(selection.text); toast("Copied"); }}
        className="p-1.5 rounded-full text-[#cfdaf3] hover:bg-white/10"
        data-testid="reader-copy"
        title="Copy"
      >
        <Copy size={12} />
      </button>
      <button
        onClick={onDismiss}
        className="p-1.5 rounded-full text-[#7a87ad] hover:bg-white/10"
        data-testid="reader-dismiss-selection"
        title="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
};

/**
 * Renders one PDF page: canvas (rasterised graphics) + absolutely-positioned
 * text layer so the user's selection hits real DOM text.
 */
const PdfPage = ({
  pdfDoc, pageNumber, registerRef,
  inkStrokes, drawMode, inkTool, inkColor, inkWidth,
  onAddStroke, onEraseStroke, onClearPage,
}) => {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pdfDoc || !canvasRef.current) return;
      const pdfjs = await loadPdfJs();
      const page = await pdfDoc.getPage(pageNumber);
      // Fit roughly 800px wide — scale accordingly.
      const baseViewport = page.getViewport({ scale: 1 });
      const targetWidth = Math.min(900, window.innerWidth - 400);
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      try {
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        /* ignore abort on fast reloads */
      }

      // Text layer
      const textContent = await page.getTextContent();
      const textLayer = textLayerRef.current;
      if (!textLayer || cancelled) return;
      textLayer.innerHTML = "";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      // pdf.js v5 reads `--scale-factor` from the host element to size each
      // span's font correctly. Without it the spans collapse and clicks snap
      // to the wrong line. (See pdf_viewer.css in the pdfjs-dist package.)
      textLayer.style.setProperty("--scale-factor", `${scale}`);
      textLayer.style.setProperty("--total-scale-factor", `${scale}`);

      if (pdfjs.TextLayer) {
        try {
          const layer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textLayer,
            viewport,
          });
          await layer.render();
        } catch (err) {
          // Fallback silently; user can still see rasterised page.
          console.warn("TextLayer render failed", err);
        }
      } else if (pdfjs.renderTextLayer) {
        // Legacy pdf.js — kept as a belt-and-braces fallback.
        try {
          await pdfjs.renderTextLayer({
            textContentSource: textContent,
            container: textLayer,
            viewport,
            textDivs: [],
          }).promise;
        } catch (err) {
          console.warn("renderTextLayer (legacy) failed", err);
        }
      }

      if (!cancelled) {
        setVp({ w: Math.floor(viewport.width), h: Math.floor(viewport.height) });
        setRendered(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber]);

  return (
    <div
      ref={(el) => { wrapRef.current = el; registerRef && registerRef(el); }}
      className="relative mx-auto rounded-xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/5 bg-white group"
      data-testid={`reader-page-${pageNumber}`}
      data-page-number={pageNumber}
      style={{ width: "fit-content" }}
    >
      <canvas ref={canvasRef} />
      <div
        ref={textLayerRef}
        className="pdf-text-layer textLayer"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 1,
          lineHeight: 1,
          pointerEvents: rendered && !drawMode ? "auto" : "none",
          userSelect: "text",
          WebkitUserSelect: "text",
          zIndex: 2,
        }}
      />
      {vp.w > 0 && (
        <InkLayer
          strokes={inkStrokes || []}
          drawMode={!!drawMode}
          tool={inkTool}
          color={inkColor}
          width={inkWidth}
          pageW={vp.w}
          pageH={vp.h}
          onStroke={onAddStroke}
          onEraseStroke={onEraseStroke}
        />
      )}
      {drawMode && (inkStrokes || []).length > 0 && (
        <button
          onClick={onClearPage}
          data-testid={`reader-ink-clear-${pageNumber}`}
          className="absolute top-2 right-2 mono text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded bg-[#03040a]/90 border border-red-400/40 text-red-300 hover:bg-red-500/20 transition"
          style={{ zIndex: 4 }}
        >
          Clear page
        </button>
      )}
    </div>
  );
};

/**
 * Sidebar showing (a) freshly-added highlights from this tab session and
 * (b) previously-persisted highlights loaded from map docs with the same
 * fileKey — so users who re-open a PDF immediately see their history.
 */
const HighlightsSidebar = ({ fresh, persisted, targetMapTitle, onJumpToMap }) => {
  return (
    <aside
      className="w-80 shrink-0 border-l border-white/10 bg-[#060815] overflow-y-auto"
      data-testid="reader-highlights-panel"
    >
      {/* Fresh session */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">
          This session
        </div>
        <div className="text-sm text-[#cfdaf3]" data-testid="reader-highlights-session-count">
          {fresh.length} sent to {targetMapTitle || "—"}
        </div>
      </div>
      {fresh.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Highlighter size={28} className="text-cyan-400/30 mx-auto mb-3" />
          <div className="text-[13px] text-[#7a87ad] leading-relaxed">
            Select text in the PDF, then click <span className="text-cyan-300">+ Node</span>.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {fresh.map((h) => (
            <li key={h.id} className="px-5 py-3" data-testid="reader-highlight-item">
              <div className="text-[13px] text-[#cfdaf3] line-clamp-3 leading-relaxed">{h.text}</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/70">
                  → {h.mapTitle}
                </span>
                {h.pageNumber != null && (
                  <span className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187]">
                    p. {h.pageNumber}
                  </span>
                )}
                <button
                  onClick={() => { navigator.clipboard?.writeText(h.text); toast("Copied"); }}
                  className="text-[#566187] hover:text-cyan-300 ml-auto"
                  data-testid="reader-highlight-copy"
                >
                  <Copy size={11} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Persisted history */}
      {persisted && persisted.length > 0 && (
        <div data-testid="reader-highlights-history">
          <div className="px-5 py-4 border-b border-t border-white/10 bg-white/[0.015]">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-violet-300/80 mb-1 flex items-center gap-1">
              <Bookmark size={10} /> Previously mapped from this PDF
            </div>
            <div className="text-[12px] text-[#9aa7c7]">
              {persisted.length} highlight{persisted.length === 1 ? "" : "s"} across{" "}
              {new Set(persisted.map((h) => h.mapId)).size} map{new Set(persisted.map((h) => h.mapId)).size === 1 ? "" : "s"}
            </div>
          </div>
          <ul className="divide-y divide-white/5">
            {persisted.map((h) => (
              <li
                key={h.nodeId}
                className="px-5 py-3 hover:bg-white/[0.02] cursor-pointer"
                onClick={() => onJumpToMap?.(h.mapId)}
                data-testid="reader-history-item"
              >
                <div className="text-[13px] text-[#cfdaf3] line-clamp-2 leading-relaxed">{h.text}</div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="mono text-[9px] uppercase tracking-[0.18em] text-violet-300/70 truncate max-w-[140px]">
                    → {h.mapTitle}
                  </span>
                  {h.pageNumber != null && (
                    <span className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187]">
                      p. {h.pageNumber}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};

/**
 * Compact ink / freehand drawing toolbar. Lives below the tab bar.
 * Collapsed to a single "Draw" pill when draw mode is off; expands to show
 * Pen/Eraser + color swatches + width pills + exit when active.
 */
const DrawToolbar = ({
  drawMode, onToggle,
  tool, onToolChange,
  color, onColorChange,
  width, onWidthChange,
}) => {
  const colors = [
    { key: "cyan",    label: "Cyan" },
    { key: "fuchsia", label: "Fuchsia" },
    { key: "yellow",  label: "Yellow" },
  ];
  const widths = [
    { key: INK_WIDTHS.fine,  label: "Fine" },
    { key: INK_WIDTHS.med,   label: "Med"  },
    { key: INK_WIDTHS.thick, label: "Thick" },
  ];
  return (
    <div
      className="flex items-center gap-2 px-6 md:px-10 py-2 border-b border-white/5 bg-[#04060d]"
      data-testid="reader-ink-toolbar"
      data-draw-mode={drawMode ? "true" : "false"}
    >
      <button
        onClick={onToggle}
        data-testid="reader-ink-toggle"
        className={`mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition ${
          drawMode
            ? "bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-[#03131e] font-bold"
            : "border border-white/15 text-[#9aa7c7] hover:text-cyan-300 hover:border-cyan-400/50"
        }`}
        title={drawMode ? "Exit draw mode" : "Draw on the PDF"}
      >
        <Pencil size={11} /> {drawMode ? "Drawing" : "Draw"}
      </button>

      {drawMode && (
        <>
          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Pen vs Eraser */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onToolChange("pen")}
              data-testid="reader-ink-tool-pen"
              className={`p-1.5 rounded-md transition ${
                tool === "pen" ? "bg-cyan-400/20 text-cyan-200" : "text-[#7a87ad] hover:text-white"
              }`}
              title="Pen"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onToolChange("eraser")}
              data-testid="reader-ink-tool-eraser"
              className={`p-1.5 rounded-md transition ${
                tool === "eraser" ? "bg-fuchsia-400/20 text-fuchsia-200" : "text-[#7a87ad] hover:text-white"
              }`}
              title="Eraser"
            >
              <Eraser size={13} />
            </button>
          </div>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Colors (only meaningful for pen) */}
          <div className="flex items-center gap-1.5" data-testid="reader-ink-colors">
            {colors.map((c) => (
              <button
                key={c.key}
                onClick={() => onColorChange(c.key)}
                data-testid={`reader-ink-color-${c.key}`}
                className={`w-5 h-5 rounded-full transition ring-offset-2 ring-offset-[#04060d] ${
                  color === c.key ? "ring-2 ring-white scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: INK_COLORS[c.key] }}
                title={c.label}
                aria-label={c.label}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Width */}
          <div className="flex items-center gap-1" data-testid="reader-ink-widths">
            {widths.map((w) => (
              <button
                key={w.key}
                onClick={() => onWidthChange(w.key)}
                data-testid={`reader-ink-width-${w.label.toLowerCase()}`}
                className={`mono text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded transition ${
                  width === w.key
                    ? "bg-white/10 text-white"
                    : "text-[#7a87ad] hover:text-white"
                }`}
                title={`${w.label} · ${w.key}px`}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div className="ml-auto mono text-[9px] uppercase tracking-[0.22em] text-[#566187] hidden md:block">
            Strokes save automatically · Per-PDF, local-only
          </div>
        </>
      )}
    </div>
  );
};

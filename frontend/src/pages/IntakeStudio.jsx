import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Upload,
  FileText,
  ScanLine,
  Sparkles,
  ListTree,
  Layers,
  BookOpen,
  Cloud,
  HardDrive,
  Globe2,
  Tablet,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { parsePdfHeuristic, enrichOutline } from "@/lib/api";
import { saveMap } from "@/lib/storage";
import {
  flattenHeadings,
  treeFromFlat,
  buildMapFromParse,
  buildSuperMap,
  ocrPdfToHeadings,
} from "@/lib/intake";
import { useAuth } from "@/lib/auth";
import { getApiKey } from "@/lib/settings";
import { saveIntakeQueue, loadIntakeQueue, clearIntakeQueue } from "@/lib/intakeResume";
import { runDeepResearch } from "@/lib/deepResearch";
import UpgradeDialog from "@/components/UpgradeDialog";
import Logo from "@/components/Logo";
import AssetsSidebar from "@/components/AssetsSidebar";
import MobileNav from "@/components/MobileNav";
import ZoteroBrowser from "@/components/ZoteroBrowser";
import PublicCorpusBrowser from "@/components/PublicCorpusBrowser";
import KindleNotebookHowTo from "@/components/KindleNotebookHowTo";
import { pickFromDropbox, fetchDropboxFile, isConfigured as isDropboxConfigured } from "@/lib/dropbox";
import { pickFromDrive, fetchDriveFile, isConfigured as isDriveConfigured } from "@/lib/googleDrive";
import { STATUS } from "@/components/intake/intakeStatus";
import IntakeCard from "@/components/intake/IntakeCard";
import { Hint, ModeBtn } from "@/components/intake/IntakeHint";
import { parseClipParam, clipToIntakeItem } from "@/lib/clipPayload";

export default function IntakeStudio() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isPro = user && (user.subscription_status === "active" || user.subscription_status === "trialing");
  // Pro-only entitlements (Lite excluded). Used to gate Auto-deepen.
  const isProOnly = isPro && (user?.subscription_plan || "").toLowerCase() !== "lite";

  const [items, setItems] = useState([]); // { id, file, status, headings, error, ocrProgress }
  const [mode, setMode] = useState("individual"); // "individual" | "merged"
  const [packName, setPackName] = useState("Research Pack");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [zoteroOpen, setZoteroOpen] = useState(false);
  const [corpusOpen, setCorpusOpen] = useState(false);
  const [kindleOpen, setKindleOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [expandedId, setExpandedId] = useState(null);
  const [resumeCandidate, setResumeCandidate] = useState(null);
  // Dedupe guard for the ?clip= effect — StrictMode (dev) mounts twice.
  const clipConsumedRef = useRef(false);

  // On mount, look for a persisted queue from a previous session.
  useEffect(() => {
    const saved = loadIntakeQueue();
    if (saved && saved.items && saved.items.length) {
      setResumeCandidate(saved);
    }
  }, []);

  // On mount, accept a ?clip=<base64-payload> param posted by the Chrome
  // extension. Synthesises a PREVIEW-state item (no file), expands it so
  // the user lands directly in the Fixer ready to rename / reorder.
  // We strip the query after consuming so refreshing the page doesn't
  // double-queue the same clip.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("clip");
    if (!raw) return;
    if (clipConsumedRef.current) return;
    clipConsumedRef.current = true;
    const clip = parseClipParam(raw);
    if (!clip) {
      // Defer the toast past mount so <Toaster /> has subscribed.
      setTimeout(() => toast.error("Could not read clip from extension"), 0);
    } else {
      const item = clipToIntakeItem(clip);
      setItems((prev) => [...prev, item]);
      setExpandedId(item.id);
      setTimeout(() => toast.success(
        clip.article && clip.article.sections && clip.article.sections.length
          ? `Clip received — ${clip.article.sections.length} section${clip.article.sections.length === 1 ? "" : "s"} extracted`
          : clip.selection
          ? `Clip received — ${clip.selection.length} chars ready to map`
          : `Clip received — "${clip.title}"`
      ), 0);
    }
    // Strip ONLY the clip param — preserve ?unlock=… and anything else so
    // the gate doesn't re-activate on the next refresh.
    params.delete("clip");
    const remaining = params.toString();
    const nextUrl = remaining ? `${location.pathname}?${remaining}` : location.pathname;
    window.history.replaceState({}, "", nextUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-save whenever PREVIEW-state items change.
  useEffect(() => {
    const t = setTimeout(() => {
      saveIntakeQueue(items);
    }, 500);
    return () => clearTimeout(t);
  }, [items]);

  const addFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []).filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (!files.length) {
        toast.error("Only PDF files are supported");
        return;
      }
      // Pro-gating: free tier capped at 1 PDF per session
      const existingCount = items.length;
      const totalAfter = existingCount + files.length;
      if (!isPro && totalAfter > 1) {
        setUpgradeOpen(true);
        toast.error("Batch intake is a Pro feature");
        return;
      }
      const queued = files.map((file) => ({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        file,
        status: STATUS.QUEUED,
        headings: [],
        error: null,
        ocrProgress: null,
        parsedTitle: "",
        sourcePages: 0,
        enrich: false,
        autoDeepen: false,
      }));
      setItems((prev) => [...prev, ...queued]);
      queued.forEach((it) => void runParse(it.id, it.file));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, isPro]
  );

  const runParse = async (id, file) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: STATUS.PARSING, error: null } : it)));
    try {
      const data = await parsePdfHeuristic(file);
      const flat = flattenHeadings(data.children || []);
      // Prefer a real PDF title; fall back to the filename if the parser
      // could only determine the literal sentinel "untitled".
      const rawTitle = (data.title || "").trim();
      const fileBase = file.name.replace(/\.pdf$/i, "");
      const cleanTitle =
        rawTitle && rawTitle.toLowerCase() !== "untitled" ? rawTitle : fileBase;
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                status: STATUS.PREVIEW,
                headings: flat,
                parsedTitle: cleanTitle,
                sourcePages: data.source_pages || 0,
              }
            : it
        )
      );
      if (!expandedId) setExpandedId(id);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Could not parse PDF";
      const is422 = err?.response?.status === 422;
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                status: is422 ? STATUS.FAILED : STATUS.FAILED,
                error: is422
                  ? "No headings detected — this looks like a scanned PDF. Try OCR."
                  : msg,
              }
            : it
        )
      );
    }
  };

  const runOcr = async (id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: STATUS.PARSING, ocrProgress: { msg: "Starting OCR…", pct: 0 } } : x)));
    try {
      const headings = await ocrPdfToHeadings(it.file, (msg, pct) => {
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ocrProgress: { msg, pct } } : x)));
      });
      const flat = flattenHeadings(headings);
      if (!flat.length) {
        toast.error("OCR completed but found no heading-like lines. Add headings manually below.");
      }
      setItems((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status: STATUS.PREVIEW,
                headings: flat,
                parsedTitle: it.file.name.replace(/\.pdf$/i, ""),
                ocrProgress: null,
                error: null,
              }
            : x
        )
      );
      setExpandedId(id);
    } catch (err) {
      toast.error(err?.message || "OCR failed");
      setItems((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, status: STATUS.FAILED, ocrProgress: null, error: err?.message || "OCR failed" } : x
        )
      );
    }
  };

  const updateHeadings = (id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const resumeSaved = () => {
    if (!resumeCandidate) return;
    const restored = (resumeCandidate.items || []).map((row) => ({
      // Minimal File placeholder — parsing can't re-run without a real blob,
      // but the Fixer doesn't need one once headings are loaded.
      id: row.id || `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      file: { name: row.fileName || "resumed.pdf", size: 0 },
      status: STATUS.PREVIEW,
      headings: row.headings || [],
      error: null,
      ocrProgress: null,
      parsedTitle: row.parsedTitle || row.fileName || "Untitled",
      sourcePages: row.sourcePages || 0,
      enrich: !!row.enrich,
      autoDeepen: !!row.autoDeepen,
    }));
    setItems(restored);
    setResumeCandidate(null);
    if (restored.length) setExpandedId(restored[0].id);
    toast.success(`Restored ${restored.length} PDF${restored.length > 1 ? "s" : ""} from your last session`);
  };

  const discardSaved = () => {
    clearIntakeQueue();
    setResumeCandidate(null);
    toast("Previous session cleared");
  };

  const handleDropboxImport = async () => {
    if (!isDropboxConfigured()) {
      toast.error("Dropbox isn't wired up yet — add an app key to .env");
      return;
    }
    try {
      const picks = await pickFromDropbox({ multiselect: isPro });
      if (!picks.length) return;
      if (!isPro && picks.length > 1) {
        setUpgradeOpen(true);
        toast.error("Batch import is a Pro feature");
        return;
      }
      const pending = toast.loading(`Fetching ${picks.length} file${picks.length > 1 ? "s" : ""} from Dropbox…`);
      const files = [];
      let failed = 0;
      for (const p of picks) {
        try {
          files.push(await fetchDropboxFile({ link: p.link, name: p.name }));
        } catch (err) {
          failed++;
          console.error("Dropbox fetch failed:", err);
        }
      }
      toast.dismiss(pending);
      if (!files.length) {
        toast.error("Could not download from Dropbox");
        return;
      }
      toast.success(`Imported ${files.length} from Dropbox${failed ? ` · ${failed} failed` : ""}`);
      addFiles(files);
    } catch (err) {
      toast.error(err?.message || "Dropbox import failed");
    }
  };

  const handleDriveImport = async () => {
    if (!isDriveConfigured()) {
      toast.error("Google Drive isn't wired up yet — add CLIENT_ID / API_KEY / APP_ID to .env");
      return;
    }
    try {
      const picks = await pickFromDrive({ multiselect: isPro });
      if (!picks.length) return;
      if (!isPro && picks.length > 1) {
        setUpgradeOpen(true);
        toast.error("Batch import is a Pro feature");
        return;
      }
      const pending = toast.loading(`Fetching ${picks.length} file${picks.length > 1 ? "s" : ""} from Drive…`);
      const files = [];
      let failed = 0;
      for (const p of picks) {
        try {
          files.push(await fetchDriveFile(p));
        } catch (err) {
          failed++;
          console.error("Drive fetch failed:", err);
        }
      }
      toast.dismiss(pending);
      if (!files.length) {
        toast.error("Could not download from Google Drive");
        return;
      }
      toast.success(`Imported ${files.length} from Drive${failed ? ` · ${failed} failed` : ""}`);
      addFiles(files);
    } catch (err) {
      toast.error(err?.message || "Drive import failed");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const createMaps = async () => {
    const ready = items.filter((it) => it.status === STATUS.PREVIEW && it.headings.length > 0);
    if (!ready.length) {
      toast.error("Nothing to convert — fix at least one PDF first");
      return;
    }

    // Run enrichment for any card that opted in. Each call is independent;
    // a failure on one card falls back to the plain tree.
    const userKey = getApiKey();
    const enrichJobs = ready.filter((it) => it.enrich);
    let enrichedTreesById = {};
    // Helper: update a subset of items' runningAction in one setState.
    const setAction = (ids, action) => {
      if (!ids || !ids.length) return;
      const set = new Set(ids);
      setItems((prev) => prev.map((it) => (set.has(it.id) ? { ...it, runningAction: action } : it)));
    };

    if (enrichJobs.length) {
      setAction(enrichJobs.map((j) => j.id), "enriching");
      const pending = toast.loading(
        `Enriching ${enrichJobs.length} outline${enrichJobs.length > 1 ? "s" : ""} with Mikey…`
      );
      await Promise.all(
        enrichJobs.map(async (it) => {
          try {
            const res = await enrichOutline({
              title: it.parsedTitle || it.file.name,
              headings: it.headings.map((h) => ({
                title: h.title || "",
                depth: h.depth | 0,
              })),
              userKey,
            });
            if (Array.isArray(res.children) && res.children.length > 0) {
              enrichedTreesById[it.id] = res.children;
            }
          } catch (err) {
            const status = err?.response?.status;
            const detail = err?.response?.data?.detail;
            if (status === 402) {
              toast.error(detail || "Free AI limit reached — add your own API key");
            } else if (status === 401 || status === 403) {
              toast.error("Sign in to use enrichment");
            } else {
              toast.error(`Enrich failed for "${it.parsedTitle || it.file.name}" — using plain outline`);
            }
          }
        })
      );
      toast.dismiss(pending);
      setAction(enrichJobs.map((j) => j.id), null);
    }

    const treeFor = (it) => enrichedTreesById[it.id] || treeFromFlat(it.headings);

    // Convert a File → base64 data URL for attaching as the root node's link.
    // Skip files >3 MB (most lit-review papers fit; large books don't).
    const PDF_LINK_CAP_BYTES = 3 * 1024 * 1024;
    const attachmentFor = async (file) => {
      if (!file || file.size > PDF_LINK_CAP_BYTES) return null;
      try {
        const link = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        return { link, linkLabel: file.name, icon: "pdf" };
      } catch {
        return null;
      }
    };

    // ---- Auto-deepen runner (shared between merged + per-PDF modes) ----
    const deepenJobs = ready.filter((it) => it.autoDeepen);
    const runAutoDeepenBatch = async (savedMaps) => {
      // savedMaps: [{ map, sourceItemId }]
      if (!deepenJobs.length || !savedMaps.length) return 0;
      const pending = toast.loading(
        `Auto-deepening ${savedMaps.length} map${savedMaps.length > 1 ? "s" : ""} — Deep Research running…`
      );
      let totalBranches = 0;
      await Promise.all(
        savedMaps.map(async (entry) => {
          if (entry.sourceItemId) setAction([entry.sourceItemId], "deepening");
          try {
            const { map: updated, added } = await runDeepResearch({
              map: entry.map,
              focusNode: entry.map, // root node is the map itself
            });
            if (added > 0) {
              updated.source = "enriched";
              saveMap(updated);
              totalBranches += added;
            }
          } catch (err) {
            const status = err?.response?.status;
            if (status === 402) {
              toast.error("Free AI limit reached during auto-deepen — add your own API key");
            } else if (status !== 401 && status !== 403) {
              toast.error(`Auto-deepen failed for "${entry.map.title}" — map saved without extra branches`);
            }
          } finally {
            if (entry.sourceItemId) setAction([entry.sourceItemId], null);
          }
        })
      );
      toast.dismiss(pending);
      return totalBranches;
    };

    try {
      if (mode === "merged") {
        setAction(ready.map((it) => it.id), "mapping");
        // Merged super-map: all PDFs become branches of a Research Pack
        const parsedList = ready.map((it) => ({
          title: it.parsedTitle || it.file.name,
          summary: `${it.sourcePages || 0} pages`,
          source_pages: it.sourcePages,
          children: treeFor(it),
        }));
        const superMap = buildSuperMap(parsedList, packName || "Research Pack");
        saveMap(superMap);
        const enrichedCount = Object.keys(enrichedTreesById).length;
        toast.success(
          `Super-map created with ${ready.length} PDFs${enrichedCount ? ` · ${enrichedCount} enriched` : ""}`
        );
        setItems((prev) =>
          prev.map((it) =>
            ready.find((r) => r.id === it.id) ? { ...it, status: STATUS.DONE, runningAction: null } : it
          )
        );
        // Auto-deepen the super-map's root if ANY source item opted in.
        if (deepenJobs.length) {
          const added = await runAutoDeepenBatch([{ map: superMap, sourceItemId: null }]);
          if (added > 0) toast.success(`Auto-deepened · +${added} extra branches`);
        }
        clearIntakeQueue();
        navigate("/app");
      } else {
        // One map per PDF
        setAction(ready.map((it) => it.id), "mapping");
        const createdMaps = [];
        let lastId = null;
        for (const it of ready) {
          const attachment = await attachmentFor(it.file);
          const m = buildMapFromParse(
            { title: it.parsedTitle, children: treeFor(it), source_pages: it.sourcePages },
            it.file.name,
            attachment,
          );
          if (enrichedTreesById[it.id]) m.source = "enriched";
          saveMap(m);
          lastId = m.id;
          if (it.autoDeepen) createdMaps.push({ map: m, sourceItemId: it.id });
        }
        const enrichedCount = Object.keys(enrichedTreesById).length;
        toast.success(
          `${ready.length} map${ready.length > 1 ? "s" : ""} created${enrichedCount ? ` · ${enrichedCount} enriched` : ""}`
        );
        setItems((prev) =>
          prev.map((it) =>
            ready.find((r) => r.id === it.id) ? { ...it, status: STATUS.DONE, runningAction: null } : it
          )
        );
        if (createdMaps.length) {
          const added = await runAutoDeepenBatch(createdMaps);
          if (added > 0) toast.success(`Auto-deepened · +${added} extra branches`);
        }
        clearIntakeQueue();
        if (lastId) navigate("/app");
      }
    } catch (err) {
      toast.error(err?.message || "Could not save maps");
    }
  };

  const readyCount = items.filter((it) => it.status === STATUS.PREVIEW && it.headings.length > 0).length;
  const parsingCount = items.filter((it) => it.status === STATUS.PARSING).length;

  return (
    <div
      data-testid="intake-studio"
      className="min-h-screen text-white flex"
      style={{
        background:
          "radial-gradient(1200px 800px at 15% -10%, rgba(122,59,255,0.18), transparent 60%)," +
          "radial-gradient(1000px 700px at 95% 110%, rgba(0,240,255,0.12), transparent 60%)," +
          "#03101c",
      }}
    >
      {/* SIDEBAR */}
      <aside
        data-testid="intake-sidebar"
        className="flex-shrink-0 flex-col border-r border-white/5 overflow-hidden hidden md:flex"
        style={{
          background: "linear-gradient(180deg, #060a1c 0%, #04060f 100%)",
          width: 260,
        }}
      >
        <div className="px-5 py-6 flex items-center gap-3 border-b border-white/5">
          <Logo size={48} />
          <div className="leading-tight">
            <div className="text-[12px] mono uppercase tracking-[0.2em] text-cyan-300/80">Marvex Studio</div>
            <div className="text-[10px] mono uppercase tracking-[0.22em] text-[#566187]">PDF Studio</div>
          </div>
        </div>
        <AssetsSidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
      <MobileNav />
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/5 backdrop-blur">
        <div className="flex items-center gap-2 pl-12 md:pl-0">
          <div>
            <div className="font-semibold text-[15px] tracking-tight">PDF Studio</div>
            <div className="mono text-[9px] uppercase tracking-[0.25em] text-cyan-300/70">
              Intake · Filter · Map
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="intake-zotero-btn"
            onClick={() => setZoteroOpen(true)}
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-red-400/50 text-red-200 hover:bg-red-500/10 hover:border-red-400 transition flex items-center gap-1.5"
            title="Import PDFs from your Zotero library"
          >
            <BookOpen size={11} /> Zotero
          </button>
          <button
            data-testid="intake-dropbox-btn"
            onClick={handleDropboxImport}
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-sky-400/50 text-sky-200 hover:bg-sky-500/10 hover:border-sky-400 transition flex items-center gap-1.5"
            title={isDropboxConfigured() ? "Import PDFs from Dropbox" : "Dropbox import — app key not yet configured"}
          >
            <Cloud size={11} /> Dropbox
          </button>
          <button
            data-testid="intake-drive-btn"
            onClick={handleDriveImport}
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-400 transition flex items-center gap-1.5"
            title={isDriveConfigured() ? "Import PDFs from Google Drive" : "Google Drive — keys not yet configured"}
          >
            <HardDrive size={11} /> Drive
          </button>
          <button
            data-testid="intake-corpus-btn"
            onClick={() => setCorpusOpen(true)}
            className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-teal-400/50 text-teal-200 hover:bg-teal-500/10 hover:border-teal-400 transition flex items-center gap-1.5"
            title="arXiv + Project Gutenberg — public-domain imports"
          >
            <Globe2 size={11} /> Public domain
          </button>
          {!isPro && (
            <button
              data-testid="intake-upgrade-btn"
              onClick={() => setUpgradeOpen(true)}
              className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-violet-400/60 text-violet-200 hover:bg-violet-500/10 transition"
            >
              Upgrade to batch
            </button>
          )}
          <button
            data-testid="intake-create-maps"
            disabled={readyCount === 0}
            onClick={createMaps}
            className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e] font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_18px_rgba(0,240,255,0.55)] transition"
          >
            Create {readyCount > 0 ? `${readyCount} map${readyCount > 1 ? "s" : ""}` : "maps"}
          </button>
        </div>
      </header>

      <main className="px-6 md:px-10 py-10 max-w-6xl mx-auto">
        {/* Resume banner — only shows if a previous Fixer session was preserved */}
        {resumeCandidate && items.length === 0 && (
          <section
            data-testid="intake-resume-banner"
            className="mb-6 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 to-violet-500/5 px-5 py-4 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-400/15 border border-cyan-400/40 grid place-items-center text-cyan-200 shrink-0">
              <RotateCcw size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                Resume your last session
              </div>
              <div className="text-[12px] text-[#9aa7c7] mt-0.5">
                {resumeCandidate.items.length} PDF{resumeCandidate.items.length > 1 ? "s" : ""} left in the Fixer.
                Files can't be re-parsed, but your edited headings are intact.
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                data-testid="intake-resume-discard"
                onClick={discardSaved}
                className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full text-[#9aa7c7] hover:text-red-300 hover:bg-red-500/10 transition"
              >
                Discard
              </button>
              <button
                data-testid="intake-resume-accept"
                onClick={resumeSaved}
                className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-1.5 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e] font-bold flex items-center gap-1.5 hover:shadow-[0_0_14px_rgba(0,240,255,0.5)] transition"
              >
                <RotateCcw size={11} /> Resume
              </button>
            </div>
          </section>
        )}

        {/* Hero / dropzone */}
        <section
          data-testid="intake-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 md:p-16 text-center ${
            dragOver
              ? "border-cyan-300 bg-cyan-500/5 shadow-[0_0_40px_rgba(0,240,255,0.25)]"
              : "border-white/10 hover:border-cyan-400/50 hover:bg-white/[0.02]"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 border border-cyan-400/30 grid place-items-center">
              <Upload size={22} className="text-cyan-200" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Drop PDFs to map them
              </h1>
              <p className="text-[#9aa7c7] text-sm mt-2 max-w-md mx-auto">
                {isPro
                  ? "Drag a folder of research. Mikey queues, parses, and lets you filter each doc before it lands on your canvas."
                  : "Drag one PDF to try it free. Upgrade to batch-process entire chapters at once."}
              </p>
            </div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
              PDF · max 25 MB each · 100% local heuristic
            </div>
          </div>
          <input
            ref={fileInputRef}
            data-testid="intake-file-input"
            type="file"
            accept="application/pdf"
            multiple={isPro}
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </section>

        {/* Batch mode selector (only when 2+ items) */}
        {items.length > 1 && (
          <section className="mt-8 flex flex-wrap items-center gap-4" data-testid="intake-batch-mode">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">Batch output</div>
            <div className="flex bg-[#0a1428] border border-white/10 rounded-full p-1">
              <ModeBtn active={mode === "individual"} onClick={() => setMode("individual")} icon={<ListTree size={13} />} testid="intake-mode-individual">
                One map per PDF
              </ModeBtn>
              <ModeBtn active={mode === "merged"} onClick={() => setMode("merged")} icon={<Layers size={13} />} testid="intake-mode-merged">
                Merge into super-map
              </ModeBtn>
            </div>
            {mode === "merged" && (
              <input
                data-testid="intake-pack-name"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="Research Pack name"
                className="bg-[#0a1428] border border-white/10 rounded-full px-3 py-1.5 text-[12px] mono uppercase tracking-[0.18em] placeholder:text-[#566187] focus:outline-none focus:border-cyan-400/60"
              />
            )}
          </section>
        )}

        {/* Queue */}
        {items.length > 0 && (
          <section className="mt-8 space-y-3" data-testid="intake-queue">
            <div className="flex items-center justify-between">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
                Queue · {items.length} file{items.length > 1 ? "s" : ""}
                {parsingCount > 0 && (
                  <span className="ml-3 text-cyan-300">
                    {parsingCount} processing…
                  </span>
                )}
              </div>
            </div>

            {items.map((it) => (
              <IntakeCard
                key={it.id}
                item={{ ...it, hasOwnKey: !!getApiKey() }}
                expanded={expandedId === it.id}
                onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
                onRemove={() => removeItem(it.id)}
                onOcr={() => runOcr(it.id)}
                onUpdateHeadings={(headings) => updateHeadings(it.id, { headings })}
                onUpdateTitle={(t) => updateHeadings(it.id, { parsedTitle: t })}
                onToggleEnrich={(v) => updateHeadings(it.id, { enrich: v })}
                onToggleAutoDeepen={(v) => updateHeadings(it.id, { autoDeepen: v })}
                isPro={isPro}
                isProOnly={isProOnly}
                onUpgrade={() => setUpgradeOpen(true)}
              />
            ))}
          </section>
        )}

        {items.length === 0 && (
          <section className="mt-12 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4" data-testid="intake-hints">
            <Hint icon={<FileText size={18} />} title="Direct upload" body="Drag & drop from your computer. PDF only." />
            <Hint
              icon={<BookOpen size={18} />}
              title="Zotero"
              body="Connect your research library with one click and pull in any item's PDF."
              onClick={() => setZoteroOpen(true)}
              testid="intake-hint-zotero"
            />
            <Hint
              icon={<Cloud size={18} />}
              title="Dropbox"
              body="Drop in from a Dropbox folder. One-click picker, batch-friendly."
              onClick={handleDropboxImport}
              testid="intake-hint-dropbox"
            />
            <Hint
              icon={<HardDrive size={18} />}
              title="Google Drive"
              body="Pick PDFs straight from Drive. Signs into Google in a popup — no permanent access."
              onClick={handleDriveImport}
              testid="intake-hint-drive"
            />
            <Hint
              icon={<Globe2 size={18} />}
              title="Public domain"
              body="Search arXiv papers & Project Gutenberg books — totally free, no account needed."
              onClick={() => setCorpusOpen(true)}
              testid="intake-hint-corpus"
            />
            <Hint
              icon={<Tablet size={18} />}
              title="Kindle highlights"
              body="Export your Kindle notes & highlights as PDF from Amazon and map them here."
              onClick={() => setKindleOpen(true)}
              testid="intake-hint-kindle"
            />
            <Hint icon={<Sparkles size={18} />} title="The Fixer" body="Preview and edit the heading tree before the map is built. Rename, re-order, re-nest." />
            <Hint icon={<ScanLine size={18} />} title="OCR fallback" body="Scanned or image-only PDF? One click runs OCR in your browser — zero cloud cost." />
          </section>
        )}
      </main>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      <ZoteroBrowser
        open={zoteroOpen}
        onClose={() => setZoteroOpen(false)}
        isPro={isPro}
        onImport={(files) => {
          // Re-use the same drop pipeline: Zotero files enter the queue just
          // like user-dragged uploads (including Pro-gating for multi-file).
          if (!files || !files.length) return;
          addFiles(files);
        }}
      />
      <PublicCorpusBrowser
        open={corpusOpen}
        onClose={() => setCorpusOpen(false)}
        isPro={isPro}
        onImport={(files) => {
          if (!files || !files.length) return;
          addFiles(files);
        }}
      />
      <KindleNotebookHowTo open={kindleOpen} onClose={() => setKindleOpen(false)} />
      </div>
    </div>
  );
}


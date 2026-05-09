import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { Sparkles, Search, Trash2, ExternalLink, Calendar, Target, LayoutGrid, BookOpen, Lock, Unlock, Download, Upload, Home } from "lucide-react";
import { toast } from "sonner";
import { listMaps, deleteMap, addToRecents } from "@/lib/storage";
import { buildMapThumbnail } from "@/lib/exportPng";
import { seedExamplesIfFirstRun, removeRetiredAttentionDemo } from "@/lib/seedExamples";
import Logo from "@/components/Logo";
import AssetsSidebar from "@/components/AssetsSidebar";
import MobileNav from "@/components/MobileNav";
import BookshelfView from "@/components/BookshelfView";
import CategoryMiniMap from "@/components/CategoryMiniMap";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import { usePrivacyMode, setPrivacyOn } from "@/lib/privacyMode";
import { downloadLibraryArchive, importLibraryArchive } from "@/lib/mapLibraryArchive";
import { listCategories, filterMapsByCategory, toggleMapCategory } from "@/lib/categories";
import { isFlowchartMap } from "@/lib/flowchart";
import { saveMap } from "@/lib/storage";
import { listTimelines, deleteTimeline } from "@/lib/timelineStorage";
import { Workflow, Clock as ClockIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getRef } from "@/lib/referral";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

// Whitelist of plans we'll auto-resume into Stripe Checkout. Keeps a
// rogue sessionStorage value from causing a 400 on the backend or
// (worse) being interpreted as a free-tier downgrade.
const RESUMABLE_PLANS = new Set(["lite", "monthly", "annual", "lifetime"]);

/**
 * /library — lists maps whose `source === "research"` plus any pre-seeded
 * `example` maps (Welcome / Research guide). On first visit we seed two demo
 * maps so the Library is never empty for a brand-new user.
 */
export default function Library() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  // "cards" (thumbnail grid) or "shelf" (BookshelfView spines).
  // Bookshelf is the more delightful default — the spines metaphor matches
  // the app's "research lab" aesthetic and the categorical browse pattern
  // most users want first. Persisted so once a user explicitly switches to
  // "cards" we honour that.
  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem("mm.libraryView");
      return saved === "cards" ? "cards" : "shelf";
    } catch { return "shelf"; }
  });
  useEffect(() => {
    try { localStorage.setItem("mm.libraryView", view); } catch {}
  }, [view]);
  const privacyOn = usePrivacyMode();
  const fileInputRef = useRef(null);
  // Selected category id, persisted so a researcher who lives inside
  // "Study" doesn't have to reselect on every visit.
  const [category, setCategory] = useState(() => {
    try { return localStorage.getItem("mm.libraryCategory") || "all"; } catch { return "all"; }
  });
  useEffect(() => {
    try { localStorage.setItem("mm.libraryCategory", category); } catch {}
  }, [category]);

  // Type filter — 'all' (default) | 'mindmap' | 'flowchart'.  Persisted
  // separately from category so a user who lives in flowcharts keeps
  // that across sessions while still being able to switch categories.
  const [typeFilter, setTypeFilter] = useState(() => {
    try { return localStorage.getItem("mm.libraryType") || "all"; } catch { return "all"; }
  });
  useEffect(() => {
    try { localStorage.setItem("mm.libraryType", typeFilter); } catch {}
  }, [typeFilter]);

  const handleExportLibrary = async () => {
    try {
      await downloadLibraryArchive();
      toast.success("Library exported · keep the .mmlib safe");
    } catch (err) {
      toast.error(`Export failed: ${err?.message || "unknown"}`);
    }
  };
  const handleImportLibrary = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";        // allow re-picking the same file
    if (!file) return;
    try {
      const summary = await importLibraryArchive(file);
      toast.success(
        `Library imported · ${summary.mapsAdded} added, ${summary.mapsOverwritten} updated`,
      );
      setTick((n) => n + 1);
    } catch (err) {
      toast.error(`Import failed: ${err?.message || "unknown"}`);
    }
  };
  // Open a single .mmap file (typically from a collaborator who shared
  // their work-in-progress map by email / messenger / disk).
  const handleOpenMmap = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { readMmapFile } = await import("@/lib/mapFile");
      const { saveMap } = await import("@/lib/storage");
      const map = await readMmapFile(file);
      // Bump updatedAt so it floats to the top of the user's recents.
      map.updatedAt = Date.now();
      saveMap(map);
      toast.success(`Opened "${map.title || "Untitled"}"`);
      navigate(`/app?map=${encodeURIComponent(map.id)}`);
    } catch (err) {
      toast.error(err?.message || "Couldn't open .mmap file");
    }
  };
  const mmapInputRef = useRef(null);

  // Self-heal an empty library, plus run the one-time "remove retired Attention demo" migration.
  useEffect(() => {
    try { removeRetiredAttentionDemo(); } catch { /* ignore */ }
    const added = seedExamplesIfFirstRun();
    if (added > 0) setTick((t) => t + 1);
  }, []);

  // ────────────────────────────────────────────────────────────
  // Pricing → OAuth → Library checkout RESUME.
  //
  // When a logged-out visitor clicks a paid CTA on /pricing we stash
  // the chosen plan in sessionStorage, sign them in via Google, and
  // /auth/callback now lands them here on /library. This effect picks
  // up the stashed plan and immediately POSTs to /api/billing/create-
  // checkout so they hit Stripe Checkout without an extra click.
  //
  // Belt-and-braces: we whitelist the plan, clear the key BEFORE the
  // network call (so a network failure doesn't loop on retry), and
  // toast a friendly error if Stripe rejects the request. If the user
  // is somehow not yet authenticated (e.g. cookies blocked) we silently
  // bail — the rest of the Library still loads normally.
  // ────────────────────────────────────────────────────────────
  const { user } = useAuth();
  const resumeFiredRef = useRef(false);
  useEffect(() => {
    if (!user || resumeFiredRef.current) return;
    let pending;
    try { pending = sessionStorage.getItem("marvex_pending_plan"); } catch { pending = null; }
    if (!pending || !RESUMABLE_PLANS.has(pending)) return;
    resumeFiredRef.current = true;
    try { sessionStorage.removeItem("marvex_pending_plan"); } catch { /* ignore */ }
    toast("Resuming your checkout…");
    axios.post(
      `${API}/billing/create-checkout`,
      {
        plan: pending,
        origin_url: window.location.origin,
        ref_code: getRef() || "",
      },
      { withCredentials: true },
    ).then((r) => {
      if (r.data?.url) {
        window.location.href = r.data.url;
      } else {
        toast.error("We couldn't reopen Stripe — please try the upgrade button again.");
      }
    }).catch((err) => {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Checkout failed — please try again from /pricing.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const items = useMemo(() => {
    void tick;
    // Library shows ALL persisted maps — research-derived, example seeds, and
    // any custom map the user has created. The earlier filter (only research
    // / example) was hiding plain user maps.
    return listMaps();
  }, [tick]);

  const filtered = useMemo(() => {
    let pool = filterMapsByCategory(items, category);
    if (typeFilter === "flowchart") pool = pool.filter(isFlowchartMap);
    else if (typeFilter === "mindmap") pool = pool.filter((m) => !isFlowchartMap(m));
    const needle = q.trim().toLowerCase();
    if (!needle) return pool;
    return pool.filter((m) => {
      const hay = [
        m.title || "",
        m.summary || "",
        m.researchMeta?.sourceNodeTitle || "",
        m.researchMeta?.sourceMapTitle || "",
        m.researchMeta?.audience || "",
      ].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q, category, typeFilter]);

  // Type-aware counts for the filter pills — re-runs when items change.
  const typeCounts = useMemo(() => {
    const flow = items.filter(isFlowchartMap).length;
    return { all: items.length, mindmap: items.length - flow, flowchart: flow };
  }, [items]);

  const open = (id) => {
    addToRecents(id);
    // Flowchart-flagged maps deep-link into Flowchart Studio so the
    // user lands on the right shape palette in the right-click menu;
    // everything else goes to the standard Marvex Studio.
    const m = items.find((x) => x.id === id);
    const path = isFlowchartMap(m) ? `/flowchart?map=${id}` : `/app?map=${id}`;
    navigate(path);
  };

  const remove = (id) => {
    deleteMap(id);
    setTick((t) => t + 1);
    toast("Research map deleted");
  };

  return (
    <div
      data-testid="library-page"
      className="min-h-screen text-white flex"
      style={{
        background:
          "radial-gradient(1200px 800px at 15% -10%, rgba(122,59,255,0.18), transparent 60%)," +
          "radial-gradient(1000px 700px at 95% 110%, rgba(0,240,255,0.12), transparent 60%)," +
          "#03101c",
      }}
    >
      {/* SIDEBAR — matches Studio's aesthetic so users always have a way out */}
      <aside
        data-testid="library-sidebar"
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
            <div className="text-[10px] mono uppercase tracking-[0.22em] text-[#566187]">Library</div>
          </div>
        </div>
        <AssetsSidebar />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
      <MobileNav />
      <SubscriptionBanner />
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/5 backdrop-blur">
        <div className="flex items-center gap-3 pl-12 md:pl-0">
          <Link
            to="/"
            data-testid="library-home-btn"
            title="Back to landing"
            className="hidden md:inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] hover:text-cyan-200 transition px-2.5 py-1 rounded-full border border-white/10 hover:border-cyan-400/40"
          >
            <Home size={11} /> Home
          </Link>
          <div>
            <div className="font-semibold text-[15px] tracking-tight">Library</div>
            <div className="mono text-[9px] uppercase tracking-[0.25em] text-cyan-300/70">
              Research Assistant output
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Privacy + library backup controls */}
          <div className="hidden md:flex items-center gap-1" data-testid="library-privacy-controls">
            <button
              data-testid="library-privacy-toggle"
              onClick={() => {
                const next = !privacyOn;
                setPrivacyOn(next);
                toast.success(
                  next
                    ? "Pure Local Mode ON · cloud actions hidden"
                    : "Pure Local Mode OFF · cloud actions visible again",
                );
              }}
              title={
                privacyOn
                  ? "Pure Local Mode ON — click to allow online actions again"
                  : "Pure Local Mode OFF — click to hide every cloud / share / AI action"
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] border transition ${
                privacyOn
                  ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-200"
                  : "bg-[#0a1428] border-white/10 text-[#7a87ad] hover:text-cyan-200 hover:border-cyan-400/40"
              }`}
            >
              {privacyOn ? <Lock size={11} /> : <Unlock size={11} />}
              {privacyOn ? "Local only" : "Local mode"}
            </button>
            <button
              data-testid="library-export-mmlib"
              onClick={handleExportLibrary}
              title="Export EVERYTHING to a .mmlib file (single zip — maps, settings, reminders, ink). Save it to a USB stick to take your library with you."
              className="flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] bg-[#0a1428] border border-white/10 text-[#7a87ad] hover:text-cyan-200 hover:border-cyan-400/40 transition"
            >
              <Download size={11} /> Backup
            </button>
            <button
              data-testid="library-import-mmlib"
              onClick={() => fileInputRef.current?.click()}
              title="Import a .mmlib file. Maps with the same id will be overwritten."
              className="flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] bg-[#0a1428] border border-white/10 text-[#7a87ad] hover:text-cyan-200 hover:border-cyan-400/40 transition"
            >
              <Upload size={11} /> Restore
            </button>
            <button
              data-testid="library-open-mmap"
              onClick={() => mmapInputRef.current?.click()}
              title="Open a single .mmap file (e.g., one shared by a collaborator)"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] bg-[#0a1428] border border-cyan-400/25 text-cyan-200/90 hover:bg-cyan-400/10 hover:border-cyan-400/60 transition"
            >
              <Upload size={11} /> Open .mmap
            </button>
            <input
              ref={mmapInputRef}
              data-testid="library-open-mmap-file"
              type="file"
              accept=".mmap,application/octet-stream"
              className="hidden"
              onChange={handleOpenMmap}
            />
            <input
              ref={fileInputRef}
              data-testid="library-import-file"
              type="file"
              accept=".mmlib,application/zip"
              className="hidden"
              onChange={handleImportLibrary}
            />
          </div>
          <div className="flex items-center gap-1 bg-[#0a1428] border border-white/10 rounded-full p-0.5" data-testid="library-type-filter">
            <button
              data-testid="library-type-all"
              onClick={() => setTypeFilter("all")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] transition ${
                typeFilter === "all" ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/40" : "text-[#7a87ad] hover:text-cyan-200"
              }`}
              title="Show every map regardless of type"
            >
              All · {typeCounts.all}
            </button>
            <button
              data-testid="library-type-mindmap"
              onClick={() => setTypeFilter("mindmap")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] transition ${
                typeFilter === "mindmap" ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/40" : "text-[#7a87ad] hover:text-cyan-200"
              }`}
              title="Mind-maps only"
            >
              <Sparkles size={10} /> Maps · {typeCounts.mindmap}
            </button>
            <button
              data-testid="library-type-flowchart"
              onClick={() => setTypeFilter("flowchart")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] transition ${
                typeFilter === "flowchart" ? "bg-fuchsia-400/15 text-fuchsia-200 border border-fuchsia-400/40" : "text-[#7a87ad] hover:text-fuchsia-200"
              }`}
              title="Flowcharts only"
            >
              <Workflow size={10} /> Flowcharts · {typeCounts.flowchart}
            </button>
          </div>
          <div className="flex items-center gap-1 bg-[#0a1428] border border-white/10 rounded-full p-0.5" data-testid="library-view-toggle">
            <button
              data-testid="library-view-cards"
              onClick={() => setView("cards")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] transition ${
                view === "cards" ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/40" : "text-[#7a87ad] hover:text-cyan-200"
              }`}
              title="Card view"
            >
              <LayoutGrid size={11} /> Cards
            </button>
            <button
              data-testid="library-view-shelf"
              onClick={() => setView("shelf")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full mono text-[10px] uppercase tracking-[0.18em] transition ${
                view === "shelf" ? "bg-cyan-400/15 text-cyan-200 border border-cyan-400/40" : "text-[#7a87ad] hover:text-cyan-200"
              }`}
              title="Bookshelf view — hover for details"
            >
              <BookOpen size={11} /> Shelf
            </button>
          </div>
          <div className="relative w-72 max-w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566187]" />
            <input
              data-testid="library-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search research notes…"
              className="w-full bg-[#0a1428] border border-white/10 rounded-full pl-8 pr-3 py-1.5 text-[13px] placeholder:text-[#566187] focus:outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>
      </header>

      <main className="px-6 md:px-10 py-10 max-w-6xl mx-auto w-full">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Quick-create toolbar — surfaces the two studio entry points
                (mind-map vs flowchart) since users coming from Library were
                missing the sidebar Workflow link. */}
            <section
              data-testid="library-create-toolbar"
              className="flex flex-wrap items-center gap-2 mb-5 mt-1"
            >
              <span className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] mr-1">
                Create new
              </span>
              <button
                data-testid="library-new-mindmap"
                onClick={() => navigate("/app?example=welcome")}
                title="Open Marvex Studio with a fresh starter map"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mono text-[10px] uppercase tracking-[0.18em] bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/40 text-cyan-200 transition"
              >
                <Sparkles size={11} /> Mind-Map
              </button>
              <button
                data-testid="library-new-flowchart"
                onClick={() => navigate("/flowchart")}
                title="Open Flowchart Studio with a BPMN starter (Start + shapes + End)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full mono text-[10px] uppercase tracking-[0.18em] bg-fuchsia-400/10 hover:bg-fuchsia-400/20 border border-fuchsia-400/40 text-fuchsia-200 transition"
              >
                <Workflow size={11} /> Flowchart
              </button>
              <button
                data-testid="library-new-timeline"
                onClick={() => navigate("/timeline/new")}
                title="Build a pannable timeline — Pro feature, currently in beta"
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full mono text-[10px] uppercase tracking-[0.18em] bg-violet-400/10 hover:bg-violet-400/20 border border-violet-400/40 text-violet-200 transition"
              >
                <ClockIcon size={11} /> Timeline
                <span className="mono text-[8px] font-bold px-1 rounded-full bg-fuchsia-500 text-white" style={{ letterSpacing: "0.05em" }}>β</span>
              </button>
            </section>
            {/* Timelines section — separate row above the maps grid since
                timelines are a different document class (no thumbnail
                preview yet, no shape geometry, no AI key state). */}
            <TimelinesRow navigate={navigate} tick={tick} bumpTick={() => setTick((t) => t + 1)} />
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-[#7a87ad]">
                <div className="mono text-[10px] uppercase tracking-[0.22em]">No matches</div>
              </div>
            ) : view === "shelf" ? (
              <BookshelfView maps={filtered} onOpen={open} onDelete={remove} />
            ) : (
              <section
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                data-testid="library-grid"
              >
                {filtered.map((m) => (
                  <LibraryCard key={m.id} map={m} onOpen={() => open(m.id)} onDelete={() => remove(m.id)} onTagsChanged={() => setTick((t) => t + 1)} />
                ))}
              </section>
            )}

            {/* Category mini-map — moved BELOW the bookshelf and rendered
                at half size (compact prop) so the spines remain the visual
                hero of the page and the categorical filter is a secondary
                affordance the user reaches when they want to drill down.
                Extra mt-16 (vs the previous mt-12) gives a clean visual
                gap so the bookshelf reads as the hero and the categories
                clearly belong to a separate "filter shelf" below. */}
            <section
              className="mt-16 pt-10 border-t border-white/5"
              data-testid="library-categories-section"
            >
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mb-3 text-center">
                Filter by category
              </div>
              <CategoryMiniMap
                compact
                selected={category}
                onSelect={setCategory}
                mapCounts={(() => {
                  const counts = { all: items.length };
                  for (const c of listCategories()) {
                    counts[c.id] = items.filter((m) => Array.isArray(m.categories) && m.categories.includes(c.id)).length;
                  }
                  return counts;
                })()}
              />
            </section>
          </>
        )}
      </main>
      </div>
    </div>
  );
}

const EmptyState = () => (
  <section className="text-center py-20" data-testid="library-empty">
    <img
      src="/icons/research-assistant.webp"
      alt=""
      aria-hidden="true"
      className="w-20 h-20 rounded-2xl mx-auto mb-5"
      style={{
        objectFit: "cover",
        boxShadow: "0 0 24px rgba(122,59,255,0.4), 0 0 12px rgba(0,240,255,0.25)",
      }}
    />
    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
      Your research library starts here
    </h1>
    <p className="text-[#9aa7c7] text-sm max-w-md mx-auto mb-5">
      In the Studio, right-click any mind-map node and pick{" "}
      <span className="text-cyan-200">Send to Research Assistant</span>. Expanded maps land here.
    </p>
    <button
      data-testid="library-restore-examples"
      onClick={() => {
        try {
          // Clear the seed flag so the next mount re-seeds the starter set.
          // Same recovery path used by the Studio "Reset demo data" action,
          // minus the wipe-everything part.
          localStorage.removeItem("mindmapper.examples.seeded.v3");
        } catch { /* ignore */ }
        window.location.reload();
      }}
      className="cta-pill text-[12px] py-2 mb-4"
    >
      Restore example maps
    </button>
    <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] flex items-center gap-2 justify-center">
      <Sparkles size={12} className="text-violet-300" /> Powered by your API key · zero platform cost
    </div>
  </section>
);

function LibraryCard({ map, onOpen, onDelete, onTagsChanged }) {
  const thumbnail = React.useMemo(() => {
    try { return buildMapThumbnail(map); } catch { return null; }
  }, [map]);
  const meta = map.researchMeta || {};
  const created = new Date(meta.createdAt || map.updatedAt || Date.now());
  const branches = (map.children || []).length;
  // Inline category-tag picker. We mirror `map.categories` into local
  // state so a click flips the chip *immediately* — the parent Library
  // only re-renders on `tick`, which is bumped by other paths (delete,
  // import). Without this mirror the optimistic UI was a coin-flip
  // depending on whether the parent had already re-rendered.
  const cats = listCategories();
  const [tagged, setTagged] = useState(() =>
    Array.isArray(map.categories) ? map.categories : []
  );
  const [tagOpen, setTagOpen] = useState(false);
  const handleToggleCat = (id) => {
    const next = toggleMapCategory({ ...map, categories: tagged }, id);
    setTagged(next);
    saveMap({ ...map, categories: next, updatedAt: Date.now() });
    onTagsChanged?.();
  };

  return (
    <div
      data-testid={`library-card-${map.id}`}
      onClick={onOpen}
      className="group relative rounded-xl border border-white/10 hover:border-cyan-400/50 transition overflow-hidden cursor-pointer bg-[rgba(4,8,20,0.6)] hover:shadow-[0_0_16px_rgba(0,240,255,0.18)]"
    >
      <div
        className="aspect-[16/10] bg-[#03040a] relative"
        style={{
          backgroundImage: thumbnail ? `url("${thumbnail}")` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!thumbnail && (
          <div className="absolute inset-0 grid place-items-center text-[#566187] text-xs mono uppercase tracking-[0.2em]">
            no preview
          </div>
        )}
        {isFlowchartMap(map) ? (
          <div
            data-testid={`library-card-flowchart-badge-${map.id}`}
            className="absolute top-2 left-2 mono text-[9px] uppercase tracking-[0.22em] px-2 py-[3px] rounded-full bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/40 flex items-center gap-1"
            title="Flowchart — opens in Flowchart Studio"
          >
            <Workflow size={9} /> Flowchart
          </div>
        ) : map.example ? (
          <div className="absolute top-2 left-2 mono text-[9px] uppercase tracking-[0.22em] px-2 py-[3px] rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 flex items-center gap-1">
            <Sparkles size={9} /> Example
          </div>
        ) : (
          <div className="absolute top-2 left-2 mono text-[9px] uppercase tracking-[0.22em] px-2 py-[3px] rounded-full bg-violet-500/20 text-violet-200 border border-violet-400/40 flex items-center gap-1">
            <Sparkles size={9} /> Research
          </div>
        )}

        <button
          data-testid={`library-card-delete-${map.id}`}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 w-7 h-7 rounded grid place-items-center bg-black/40 text-[#7a87ad] hover:text-red-300 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="p-3.5 space-y-1.5">
        <div className="text-sm font-medium truncate">{map.title || "Untitled research"}</div>
        {meta.sourceNodeTitle && (
          <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] flex items-center gap-1 truncate">
            <Target size={9} className="shrink-0 text-cyan-300/80" />
            <span className="truncate">
              From "{meta.sourceNodeTitle}" in {meta.sourceMapTitle || "a map"}
            </span>
          </div>
        )}
        <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] flex items-center gap-1.5">
          <Calendar size={9} /> {created.toLocaleDateString()} · {branches} branch{branches === 1 ? "" : "es"}
          {meta.depth && <span className="ml-1 px-1.5 py-[1px] rounded bg-white/5">{meta.depth}</span>}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {tagged.slice(0, 3).map((cid) => {
            const c = cats.find((cc) => cc.id === cid);
            if (!c) return null;
            return (
              <span
                key={cid}
                data-testid={`library-card-tag-${map.id}-${cid}`}
                className="mono text-[8.5px] uppercase tracking-[0.18em] px-1.5 py-[2px] rounded-full"
                style={{ background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}55` }}
              >
                {c.name}
              </span>
            );
          })}
          {tagged.length > 3 && (
            <span className="mono text-[8.5px] uppercase text-[#566187]">+{tagged.length - 3}</span>
          )}
          <button
            data-testid={`library-card-tag-edit-${map.id}`}
            onClick={(e) => { e.stopPropagation(); setTagOpen((o) => !o); }}
            className="mono text-[8.5px] uppercase tracking-[0.18em] px-1.5 py-[2px] rounded-full text-[#566187] hover:text-cyan-300 border border-white/10 hover:border-cyan-400/40 transition"
            title="Tag with categories"
          >
            {tagged.length === 0 ? "+ tag" : "edit"}
          </button>
        </div>
        {tagOpen && (
          <div
            className="mt-2 p-2 rounded-lg bg-[#0a1428] border border-white/10 grid grid-cols-2 gap-1"
            onClick={(e) => e.stopPropagation()}
            data-testid={`library-card-tag-tray-${map.id}`}
          >
            {cats.map((c) => {
              const on = tagged.includes(c.id);
              return (
                <button
                  key={c.id}
                  data-testid={`library-card-tag-toggle-${map.id}-${c.id}`}
                  onClick={() => handleToggleCat(c.id)}
                  className={`mono text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded-full text-left transition ${
                    on ? "" : "opacity-50 hover:opacity-100"
                  }`}
                  style={{
                    border: `1px solid ${on ? c.color : "rgba(255,255,255,0.15)"}`,
                    background: on ? `${c.color}22` : "transparent",
                    color: on ? c.color : "#9aaad0",
                  }}
                >
                  {on ? "✓ " : "+ "}{c.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
        <ExternalLink size={12} className="text-cyan-300" />
      </div>
    </div>
  );
}

/**
 * TimelinesRow — horizontal strip of timeline cards above the maps
 * grid. Stays hidden when the user has zero timelines so it doesn't
 * waste vertical space. Click a card to open `/timeline/:id`.
 */
function TimelinesRow({ navigate, tick, bumpTick }) {
  const [items, setItems] = useState(() => listTimelines());
  useEffect(() => { setItems(listTimelines()); }, [tick]);
  if (!items.length) return null;
  const remove = (id, title) => {
    if (!window.confirm(`Delete timeline "${title}"?`)) return;
    deleteTimeline(id);
    bumpTick();
    toast.success("Timeline deleted");
  };
  return (
    <section className="mb-7" data-testid="library-timelines-row">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="mono text-[11px] uppercase tracking-[0.22em] text-violet-300/90 flex items-center gap-1.5">
          <ClockIcon size={11} /> Timelines · {items.length}
          <span className="mono text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-fuchsia-500 text-white ml-1" style={{ letterSpacing: "0.08em" }}>BETA</span>
          <span className="mono text-[8px] uppercase text-fuchsia-300 normal-case tracking-normal">· Pro feature</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((t) => (
          <div
            key={t.id}
            data-testid={`library-timeline-card-${t.id}`}
            onClick={() => navigate(`/timeline/${t.id}`)}
            className="group cursor-pointer rounded-xl border border-violet-400/25 bg-gradient-to-br from-violet-500/[0.08] via-fuchsia-500/[0.04] to-cyan-500/[0.05] hover:border-violet-300/60 transition p-4 relative"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="mono text-[9px] uppercase tracking-[0.22em] text-violet-300/90 mb-1 flex items-center gap-1">
                  <ClockIcon size={9} /> Timeline
                </div>
                <h3 className="font-semibold text-white truncate">{t.title}</h3>
                <div className="mono text-[10px] text-[#7a87ad] mt-1">
                  {new Date(t.scope.startISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                  {t.scope.endISO ? ` → ${new Date(t.scope.endISO).toLocaleDateString(undefined, { year: "numeric", month: "short" })}` : " → ∞"}
                </div>
                <div className="text-[11px] text-[#9aa7c7] mt-2">
                  {(t.events || []).length} event{(t.events || []).length === 1 ? "" : "s"} · {(t.categories || []).length} categor{(t.categories || []).length === 1 ? "y" : "ies"}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); remove(t.id, t.title); }}
                data-testid={`library-timeline-del-${t.id}`}
                className="opacity-0 group-hover:opacity-100 transition text-[#7a87ad] hover:text-red-400"
                title="Delete timeline"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
              <ExternalLink size={12} className="text-violet-300" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

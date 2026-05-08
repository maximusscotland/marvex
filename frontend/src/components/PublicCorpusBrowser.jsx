import React, { useCallback, useEffect, useState } from "react";
import { X, Search, Loader2, Check, Download, BookOpen, FlaskConical, Scale, Globe2, Info, Sparkles, Lock, Brain } from "lucide-react";
import { toast } from "sonner";
import { searchCorpus, fetchCorpusFile, searchBailii, summariseCase, startPremiumUkLawCheckout } from "@/lib/corpus";
import { useLicense } from "@/lib/license";
import { getApiKey } from "@/lib/settings";

/**
 * Public-domain corpus picker. Three tabs: arXiv (research papers),
 * Project Gutenberg (books), and UK Law (statutes + court judgments).
 * Selected items are fetched as PDFs through our backend proxy and handed
 * to the caller for intake-queue insertion.
 *
 * Suggested-search chips: arXiv has 1M+ papers, Gutenberg 70k+ books, and
 * the UK law sources cover the entire UK statute book and ~80,000+
 * official court judgments. Without a starting prompt, users tend to type
 * one keyword and bounce — the chips give them a click-to-explore
 * on-ramp instead of a blank input.
 *
 * Why UK law? UK law students are a high-intent audience whose paid
 * options (LexisNexis, Westlaw) cost thousands a year through their
 * institution. legislation.gov.uk + the National Archives Find Case Law
 * service publish the same primary sources for free under the Open
 * Government / Open Justice licences — exactly the BYOK-friendly,
 * zero-ongoing-cost vibe that fits Marvex Studio.
 */

// Curated quick-search seeds. Picked to look diverse (so the user
// understands the breadth of each corpus) and to return reliably non-zero
// results when the upstream is up.
const SUGGEST = {
  arxiv: ["transformer attention", "quantum computing", "climate change", "protein folding", "diffusion models", "graph neural networks"],
  gutenberg: ["Pride and Prejudice", "Frankenstein", "Sherlock Holmes", "Moby Dick", "Walden", "Dracula"],
  // UK law: a deliberate mix of (a) named statutes most LLB syllabi cover,
  // (b) common-law doctrines tested in tort/criminal/contract papers, and
  // (c) rights-language because those queries return decisions across
  // every court tier — easy to demonstrate breadth.
  "law-uk": ["Equality Act 2010", "Human Rights Act", "negligence duty of care", "criminal mens rea", "contract consideration", "GDPR data protection"],
};

// Bigger curated pool (12 each) used by the weekly-featured rotation.
// Picks rotate every Mon based on ISO week number so all users see the
// same shortlist within a given week — gives the page a "the editors made
// you a list" feel without any ongoing curation cost.
const FEATURED_POOL = {
  arxiv: [
    { q: "large language models", display: "Large language models" },
    { q: "transformer architecture", display: "Transformer architecture" },
    { q: "graph neural networks", display: "Graph neural networks" },
    { q: "reinforcement learning", display: "Reinforcement learning" },
    { q: "protein structure prediction", display: "Protein structure prediction" },
    { q: "quantum error correction", display: "Quantum error correction" },
    { q: "diffusion models", display: "Diffusion models" },
    { q: "neural radiance fields", display: "Neural radiance fields (NeRF)" },
    { q: "self-supervised learning", display: "Self-supervised learning" },
    { q: "climate model uncertainty", display: "Climate model uncertainty" },
    { q: "mechanistic interpretability", display: "Mechanistic interpretability" },
    { q: "exoplanet detection", display: "Exoplanet detection" },
  ],
  gutenberg: [
    { q: "Jane Austen", display: "Jane Austen" },
    { q: "Charles Dickens", display: "Charles Dickens" },
    { q: "Mark Twain", display: "Mark Twain" },
    { q: "Sherlock Holmes", display: "Sherlock Holmes" },
    { q: "H.G. Wells", display: "H.G. Wells" },
    { q: "Mary Shelley", display: "Mary Shelley" },
    { q: "Edgar Allan Poe", display: "Edgar Allan Poe" },
    { q: "Walt Whitman", display: "Walt Whitman" },
    { q: "Emily Dickinson", display: "Emily Dickinson" },
    { q: "Bram Stoker", display: "Bram Stoker" },
    { q: "Plato", display: "Plato — dialogues" },
    { q: "Tolstoy", display: "Leo Tolstoy" },
  ],
  "law-uk": [
    { q: "Human Rights Act 1998", display: "Human Rights Act 1998" },
    { q: "Equality Act 2010", display: "Equality Act 2010" },
    { q: "Sale of Goods Act", display: "Sale of Goods Act" },
    { q: "Data Protection Act 2018", display: "Data Protection Act 2018" },
    { q: "duty of care negligence", display: "Duty of care · negligence" },
    { q: "consideration contract law", display: "Consideration · contract" },
    { q: "mens rea criminal", display: "Mens rea · criminal" },
    { q: "judicial review", display: "Judicial review" },
    { q: "Companies Act 2006", display: "Companies Act 2006" },
    { q: "Theft Act 1968", display: "Theft Act 1968" },
    { q: "trust beneficiary equity", display: "Trusts · beneficiaries" },
    { q: "Supreme Court", display: "Latest Supreme Court rulings" },
  ],
};

/**
 * Stable ISO-week key (e.g. "2026-W18"). Same value for every user
 * during a calendar week, changes deterministically on Monday — perfect
 * seed for our weekly rotation without needing a backend cron.
 */
const isoWeekKey = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Move to Thursday of the same ISO week so getYear() lands in the right year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

/** Hash a string → 32-bit integer (deterministic across browsers). */
const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h >>> 0;
};

/**
 * Pick `count` items from `pool` deterministically for the given week.
 * Same `weekKey` + same pool → same picks. Different weeks → different
 * picks (rotation).
 */
const pickFeatured = (pool, count, weekKey) => {
  // Seeded LCG: enough randomness for visual variety, fully deterministic.
  let seed = hashStr(weekKey);
  const lcg = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
  const candidates = [...pool];
  const out = [];
  while (out.length < count && candidates.length) {
    const idx = lcg() % candidates.length;
    out.push(candidates.splice(idx, 1)[0]);
  }
  return out;
};

export default function PublicCorpusBrowser({ open, onClose, onImport, isPro }) {
  const [tab, setTab] = useState("arxiv"); // arxiv | gutenberg | law-uk
  // Sub-source for the law-uk tab. 'official' = the free
  // legislation.gov.uk + Find Case Law backend; 'bailii' = the
  // Premium UK Law BAILII full-text search (gated by add-on).
  const [lawSource, setLawSource] = useState("official");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const license = useLicense();
  const ownsPremiumUkLaw = license.hasAddon("premium_uk_law");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  // AI case-summary state. Keyed by item id so multiple summaries can
  // expand inline without clobbering each other.
  const [summaries, setSummaries] = useState({});
  const [summaryBusy, setSummaryBusy] = useState({});

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setSelected(new Set());
    setQ("");
    // If user lost the addon (refunded etc) reset the sub-source.
    if (lawSource === "bailii" && !ownsPremiumUkLaw) setLawSource("official");
  }, [open, tab, lawSource, ownsPremiumUkLaw]);

  const runSearch = useCallback(async (overrideQuery) => {
    if (busy) return;
    const query = (overrideQuery ?? q).trim();
    if (!query) return;
    if (overrideQuery && overrideQuery !== q) setQ(overrideQuery);
    setBusy(true);
    setSelected(new Set());
    try {
      // Premium BAILII branch — only reachable when the user owns the
      // add-on (UI hides the toggle otherwise). Server enforces too.
      const data = (tab === "law-uk" && lawSource === "bailii")
        ? await searchBailii({ q: query, limit: 20 })
        : await searchCorpus({ source: tab, q: query, limit: 20 });
      setItems(data.items || []);
      if (!(data.items || []).length) toast("No matches — try different terms");
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.message;
      if (status === 402) {
        toast.error("Law Pack Add-on required — $10 one-off unlocks BAILII full-text search");
      } else if (status === 502 || status === 503) {
        const label = tab === "arxiv" ? "arXiv" : tab === "gutenberg" ? "Gutenberg" : "UK law sources";
        toast.error(detail || `${label} are slow right now — try again in a moment`);
      } else {
        toast.error(detail || "Search failed");
      }
    } finally {
      setBusy(false);
    }
  }, [q, tab, lawSource, busy]);

  const startPremiumCheckout = async () => {
    if (checkoutBusy) return;
    // Lite tier doesn't include Pro entitlements — Law Pack is positioned
    // as a Pro-tier add-on. Surface a clear upgrade nudge instead of
    // letting them buy an add-on they can't fully use.
    if (license.active && !license.isProOnly) {
      toast.error("Law Pack add-on requires Pro — upgrade from Lite first");
      return;
    }
    setCheckoutBusy(true);
    try {
      const data = await startPremiumUkLawCheckout();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Couldn't start checkout — try again");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message;
      toast.error(detail || "Couldn't start checkout — try again");
      setCheckoutBusy(false);
    }
  };

  const requestSummary = async (it) => {
    if (summaries[it.id] || summaryBusy[it.id]) return;
    setSummaryBusy((s) => ({ ...s, [it.id]: true }));
    const pending = toast.loading("AI summarising case…");
    try {
      const userKey = getApiKey();
      const res = await summariseCase({
        url: it.pdf_url,
        title: it.title,
        citation: it.citation || "",
        userKey,
      });
      setSummaries((s) => ({ ...s, [it.id]: res.summary || { raw: res.raw } }));
      toast.dismiss(pending);
      toast.success("Summary ready");
    } catch (err) {
      toast.dismiss(pending);
      const detail = err?.response?.data?.detail || err?.message;
      toast.error(detail || "Couldn't summarise");
    } finally {
      setSummaryBusy((s) => ({ ...s, [it.id]: false }));
    }
  };

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const doImport = async () => {
    if (!selected.size) return;
    if (!isPro && selected.size > 1) {
      toast.error("Free tier is limited to 1 file per batch — upgrade to Pro");
      return;
    }
    const chosen = items.filter((it) => selected.has(it.id));
    // BAILII results are HTML pages, not PDFs — there's no static PDF
    // we can fetch.  Instead we open each selected judgment in a new
    // tab so the user can save / print to PDF themselves.  This keeps
    // the existing intake-queue UX consistent for everything that DOES
    // have a PDF.
    if (tab === "law-uk" && lawSource === "bailii") {
      chosen.forEach((it) => {
        const url = it.pdf_url || it.source_url;
        if (url) window.open(url, "_blank", "noopener");
      });
      toast.success(`Opened ${chosen.length} judgment${chosen.length > 1 ? "s" : ""} in new tabs`);
      onClose && onClose();
      return;
    }
    setBusy(true);
    const pending = toast.loading(`Fetching ${chosen.length} file${chosen.length > 1 ? "s" : ""}…`);
    const files = [];
    let failed = 0;
    for (const it of chosen) {
      const url = it.pdf_url || it.text_url;
      try {
        const f = await fetchCorpusFile({ source: tab, url, title: it.title });
        files.push(f);
      } catch (err) {
        failed++;
        console.error("corpus fetch failed:", err);
      }
    }
    toast.dismiss(pending);
    setBusy(false);
    if (!files.length) {
      toast.error("None of the selected items could be fetched");
      return;
    }
    toast.success(`Imported ${files.length}${failed ? ` · ${failed} failed` : ""}`);
    onImport && onImport(files);
    onClose && onClose();
  };

  if (!open) return null;

  return (
    <div
      data-testid="corpus-browser"
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
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400/20 to-cyan-400/10 border border-emerald-400/30 grid place-items-center text-emerald-300">
              <Globe2 size={18} />
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">Import from</div>
              <h3 className="text-xl font-bold">Public-domain corpus</h3>
            </div>
          </div>
          <button
            data-testid="corpus-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-3" data-testid="corpus-tabs">
          <TabBtn active={tab === "arxiv"} onClick={() => setTab("arxiv")} icon={<FlaskConical size={12} />} testid="corpus-tab-arxiv">
            arXiv · papers
          </TabBtn>
          <TabBtn active={tab === "gutenberg"} onClick={() => setTab("gutenberg")} icon={<BookOpen size={12} />} testid="corpus-tab-gutenberg">
            Gutenberg · books
          </TabBtn>
          <TabBtn active={tab === "law-uk"} onClick={() => setTab("law-uk")} icon={<Scale size={12} />} testid="corpus-tab-law-uk">
            UK law · cases &amp; statutes
          </TabBtn>
        </div>

        <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-3 flex items-center gap-1.5">
          <Info size={11} />
          {tab === "arxiv"
            ? "1M+ open-access research papers · CC-BY or arXiv license"
            : tab === "gutenberg"
            ? "Classic literature in the public domain · no copyright"
            : "Official UK statutes (legislation.gov.uk) + court judgments (Find Case Law) · Open Government &amp; Open Justice licences"}
        </div>

        {/* UK Law sub-source switcher + Premium UK Law upsell */}
        {tab === "law-uk" && (
          ownsPremiumUkLaw ? (
            <div className="flex items-center gap-2 mb-3" data-testid="premium-uk-law-source-switch">
              <span className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad]">Source</span>
              <button
                data-testid="lawsource-official-btn"
                onClick={() => setLawSource("official")}
                className={`mono text-[10px] uppercase tracking-[0.18em] px-3 py-1 rounded-full border transition ${
                  lawSource === "official"
                    ? "bg-cyan-500/15 text-cyan-200 border-cyan-400/50"
                    : "text-[#9aaad0] border-white/10 hover:text-cyan-200 hover:border-cyan-400/30"
                }`}
              >
                Official
              </button>
              <button
                data-testid="lawsource-bailii-btn"
                onClick={() => setLawSource("bailii")}
                className={`mono text-[10px] uppercase tracking-[0.18em] px-3 py-1 rounded-full border transition flex items-center gap-1.5 ${
                  lawSource === "bailii"
                    ? "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/50"
                    : "text-[#9aaad0] border-white/10 hover:text-fuchsia-200 hover:border-fuchsia-400/30"
                }`}
                title="Full-text search across BAILII's 80,000+ judgments"
              >
                <Sparkles size={9} />
                BAILII full-text
              </button>
              <span className="mono text-[8.5px] uppercase tracking-[0.22em] text-amber-300/70 ml-auto">★ Premium</span>
            </div>
          ) : (
            <button
              data-testid="premium-uk-law-upsell"
              onClick={startPremiumCheckout}
              disabled={checkoutBusy}
              className="w-full text-left mb-3 p-3 rounded-lg flex items-start gap-3 bg-gradient-to-br from-amber-500/10 via-fuchsia-500/5 to-transparent border border-amber-400/30 hover:border-amber-300/60 transition disabled:opacity-60"
            >
              <div className="w-8 h-8 rounded-md bg-amber-500/20 border border-amber-400/40 grid place-items-center text-amber-300 flex-shrink-0">
                {checkoutBusy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={13} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-amber-300/80">Unlock · Law Pack Add-on</span>
                  <span className="mono text-[10px] uppercase tracking-[0.18em] px-2 py-[2px] rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/40">$10 once</span>
                </div>
                <div className="text-[12.5px] text-[#cfdaf3] leading-snug">
                  Adds <span className="text-fuchsia-200">BAILII full-text search</span> across 80,000+ UK &amp; Irish judgments,
                  <span className="text-cyan-200"> AI case summaries </span>(your own LLM key), and the
                  <span className="text-amber-200"> LexisNexis BYOK </span>proxy for institutional users.
                </div>
                <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] mt-1.5">
                  One-off · tied to your plan (lifetime = forever, Pro = while subscribed)
                </div>
              </div>
            </button>
          )
        )}

        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566187]" />
            <input
              data-testid="corpus-search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder={tab === "arxiv" ? "e.g. transformer attention" : tab === "gutenberg" ? "e.g. Pride and Prejudice" : "e.g. Equality Act 2010, mens rea, judicial review"}
              className="w-full bg-[#0a1428] border border-white/10 rounded-full pl-8 pr-3 py-2 text-[13px] placeholder:text-[#566187] focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <button
            data-testid="corpus-search-btn"
            onClick={runSearch}
            disabled={busy || !q.trim()}
            className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full bg-cyan-400 text-[#03131e] font-bold disabled:opacity-30 flex items-center gap-1.5"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Search
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
          {busy && items.length === 0 ? (
            <div className="p-10 text-center text-[#7a87ad]">
              <Loader2 size={20} className="animate-spin mx-auto mb-2 text-cyan-300" />
              <div className="mono text-[10px] uppercase tracking-[0.22em]">Searching…</div>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-[#7a87ad]" data-testid="corpus-empty">
              {!q.trim() && (
                <div className="mb-6" data-testid="corpus-featured">
                  <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80 mb-2.5 flex items-center justify-center gap-2">
                    <Sparkles size={10} /> Featured this week
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                    {pickFeatured(FEATURED_POOL[tab], 3, isoWeekKey()).map((f) => (
                      <button
                        key={f.q}
                        type="button"
                        data-testid={`corpus-featured-${f.q.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        onClick={() => runSearch(f.q)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-full text-[12px] border border-amber-400/30 text-amber-100/95 bg-amber-500/[0.06] hover:bg-amber-500/15 hover:border-amber-300/60 transition disabled:opacity-40"
                      >
                        {f.display}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mono text-[10px] uppercase tracking-[0.22em] mb-4">
                {q.trim() ? "No results" : tab === "arxiv" ? "Try one of these" : tab === "gutenberg" ? "Browse the classics" : "Common law-school searches"}
              </div>
              {!q.trim() && (
                <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                  {SUGGEST[tab].map((s) => (
                    <button
                      key={s}
                      type="button"
                      data-testid={`corpus-suggest-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      onClick={() => runSearch(s)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-full text-[12px] border border-cyan-400/25 text-cyan-100/90 bg-cyan-500/[0.05] hover:bg-cyan-500/15 hover:border-cyan-300/60 transition disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/5" data-testid="corpus-result-list">
              {items.map((it) => {
                const sel = selected.has(it.id);
                return (
                  <li
                    key={it.id}
                    data-testid={`corpus-item-${it.id}`}
                    onClick={() => toggle(it.id)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition ${
                      sel ? "bg-cyan-500/5" : ""
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-sm border flex-shrink-0 grid place-items-center transition ${
                        sel ? "bg-cyan-400 border-cyan-400 text-[#03131e]" : "border-white/20"
                      }`}
                    >
                      {sel && <Check size={11} strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate flex items-center gap-2">
                        {tab === "law-uk" && it.kind && (
                          <span
                            data-testid={`corpus-kind-${it.kind}`}
                            className={`mono text-[8.5px] uppercase tracking-[0.2em] px-1.5 py-[2px] rounded-full flex-shrink-0 border ${
                              it.kind === "judgment"
                                ? "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/40"
                                : "bg-amber-500/15 text-amber-200 border-amber-400/40"
                            }`}
                          >
                            {it.kind === "judgment" ? "Case" : "Statute"}
                          </span>
                        )}
                        <span className="truncate">{it.title}</span>
                      </div>
                      <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] mt-0.5 flex items-center gap-2 flex-wrap">
                        {(it.authors || []).length > 0 && (
                          <span className="truncate">
                            {(it.authors || []).slice(0, 2).join(", ")}
                            {(it.authors || []).length > 2 ? " et al." : ""}
                          </span>
                        )}
                        {it.year && <span>· {it.year}</span>}
                        {tab === "law-uk" && it.citation && (
                          <span className="text-cyan-300/90">· {it.citation}</span>
                        )}
                        {tab === "law-uk" && it.kind_label && !it.citation && (
                          <span className="truncate">· {it.kind_label}</span>
                        )}
                        {tab === "gutenberg" && !it.has_native_pdf && (
                          <span className="text-amber-400/80">· text → pdf</span>
                        )}
                        {tab === "gutenberg" && it.downloads && (
                          <span>· {it.downloads.toLocaleString()} dl</span>
                        )}
                      </div>
                      {it.abstract && <div className="text-[11px] text-[#7a87ad] mt-1 line-clamp-2">{it.abstract}</div>}
                      {tab === "law-uk" && lawSource === "bailii" && it.kind === "judgment" && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          {!summaries[it.id] ? (
                            <button
                              data-testid={`corpus-summarise-${it.id}`}
                              type="button"
                              disabled={!!summaryBusy[it.id]}
                              onClick={(e) => { e.stopPropagation(); requestSummary(it); }}
                              className="mono text-[9px] uppercase tracking-[0.22em] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-400/40 hover:bg-fuchsia-500/25 hover:border-fuchsia-300/70 transition disabled:opacity-50"
                            >
                              {summaryBusy[it.id] ? <Loader2 size={9} className="animate-spin" /> : <Brain size={9} />}
                              {summaryBusy[it.id] ? "Summarising…" : "AI Case Summary"}
                            </button>
                          ) : (
                            <CaseSummaryPanel summary={summaries[it.id]} onClear={() => setSummaries((s) => { const next = { ...s }; delete next[it.id]; return next; })} testIdRoot={it.id} />
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
            {items.length} results
            {selected.size > 0 && <span className="ml-3 text-cyan-300">{selected.size} selected</span>}
          </div>
          <button
            data-testid="corpus-import-btn"
            onClick={doImport}
            disabled={selected.size === 0 || busy}
            className="mono text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-[#03131e] font-bold disabled:opacity-30 flex items-center gap-1.5 hover:shadow-[0_0_16px_rgba(0,240,255,0.5)] transition"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Import {selected.size > 0 ? `${selected.size}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

const TabBtn = ({ active, onClick, children, icon, testid }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full mono text-[10px] uppercase tracking-[0.18em] flex items-center gap-1.5 transition ${
      active ? "bg-cyan-400 text-[#03131e] font-bold" : "text-[#9aa7c7] hover:text-cyan-200 border border-white/10"
    }`}
  >
    {icon}
    {children}
  </button>
);


/**
 * Inline case-note panel — renders the structured JSON the AI returned
 * for a BAILII judgment.  Falls back to a raw-text dump when the model
 * returned non-JSON despite being asked.  Visually it's a compact card
 * with each case-note section labelled in mono caps so a law student
 * can copy/paste straight into their revision notes.
 */
const CaseSummaryPanel = ({ summary, onClear, testIdRoot }) => {
  if (!summary) return null;
  if (summary.raw) {
    return (
      <div
        data-testid={`corpus-summary-${testIdRoot}`}
        className="mt-2 p-3 rounded-lg bg-fuchsia-500/[0.04] border border-fuchsia-400/20 text-[11.5px] text-[#cfdaf3] leading-relaxed"
      >
        <div className="mono text-[9px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2 flex items-center justify-between">
          <span>AI Summary (raw)</span>
          <button onClick={onClear} className="text-[#7a87ad] hover:text-white">Clear</button>
        </div>
        <pre className="whitespace-pre-wrap font-sans">{summary.raw}</pre>
      </div>
    );
  }
  const Sec = ({ label, value }) => value ? (
    <div className="mb-2">
      <div className="mono text-[8.5px] uppercase tracking-[0.22em] text-fuchsia-300/70 mb-0.5">{label}</div>
      <div className="text-[12px] text-[#cfdaf3] leading-snug">{value}</div>
    </div>
  ) : null;
  return (
    <div
      data-testid={`corpus-summary-${testIdRoot}`}
      className="mt-2 p-3 rounded-lg bg-fuchsia-500/[0.04] border border-fuchsia-400/20"
    >
      <div className="mono text-[9px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2 flex items-center justify-between">
        <span>AI Case Summary {summary.citation ? `· ${summary.citation}` : ""}</span>
        <button data-testid={`corpus-summary-clear-${testIdRoot}`} onClick={onClear} className="text-[#7a87ad] hover:text-white">Clear</button>
      </div>
      <Sec label="Parties" value={summary.parties} />
      <Sec label="Court" value={[summary.court, summary.year].filter(Boolean).join(" · ")} />
      <Sec label="Facts" value={summary.facts} />
      <Sec label="Issue" value={summary.issue} />
      <Sec label="Holding" value={summary.holding} />
      <Sec label="Ratio" value={summary.ratio} />
      {Array.isArray(summary.key_holdings) && summary.key_holdings.length > 0 && (
        <div className="mb-2">
          <div className="mono text-[8.5px] uppercase tracking-[0.22em] text-fuchsia-300/70 mb-0.5">Key holdings</div>
          <ul className="text-[12px] text-[#cfdaf3] leading-snug list-disc pl-4 space-y-0.5">
            {summary.key_holdings.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
      )}
      <Sec label="Application" value={summary.application} />
    </div>
  );
};

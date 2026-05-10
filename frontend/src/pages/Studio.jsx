import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Search,
  Sparkles,
  Settings as SettingsIcon,
  FileUp,
  X,
  Plus,
  Loader2,
  Trash2,
  Download,
  Copy,
  Edit3,
  ListChecks,
  FlaskConical,
  GraduationCap,
  Share2,
  ExternalLink,
  Bookmark,
  Brain,
  PanelLeftClose,
  PanelLeftOpen,
  CreditCard,
  Lock,
} from "lucide-react";
import Logo from "@/components/Logo";
import AssetsSidebar from "@/components/AssetsSidebar";
import MindMapCanvas from "@/components/MindMapCanvas";
import UpgradeDialog from "@/components/UpgradeDialog";
import SyncBadge from "@/components/SyncBadge";
import { loadCanvasFonts } from "@/lib/loadCanvasFonts";
import ShareDialog from "@/components/ShareDialog";
import ResearchProgressOverlay from "@/components/ResearchProgressOverlay";
import ShareCardDialog from "@/components/ShareCardDialog";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import { listMaps, getMap, saveMap, deleteMap, newId, ensureDefaultMap, addToRecents, getRecents } from "@/lib/storage";
import { blankFlowchart, isFlowchartMap } from "@/lib/flowchart";
import { seedExamplesIfFirstRun, ensureExampleMap, resetDemoData, removeRetiredAttentionDemo } from "@/lib/seedExamples";
import { getApiKey, setApiKey, clearApiKey, getProviders, maskKey, getResearchConfig } from "@/lib/settings";
import { buildMemoryContext, appendResearchMemory } from "@/lib/researchMemory";
import { useAuth } from "@/lib/auth";
import { useLicense } from "@/lib/license";
import RenewWall from "@/components/RenewWall";
import FounderWelcome from "@/components/FounderWelcome";
import { usePrivacyMode } from "@/lib/privacyMode";
import CommandPalette from "@/components/CommandPalette";
import BookmarksImportModal from "@/components/BookmarksImportModal";
import AffiliateSettings from "@/components/AffiliateSettings";
import i18n from "@/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LlmFuelGauge from "@/components/LlmFuelGauge";
import CheckForUpdatesLink from "@/components/CheckForUpdatesLink";
import FilmModeToggle from "@/components/FilmModeToggle";
import ThemeToggle from "@/components/ThemeToggle";
import StudioLeftToolbar from "@/components/StudioLeftToolbar";
import SelectionPropertiesPanel from "@/components/SelectionPropertiesPanel";
import OnboardingTour, { hasSeenTour, resetTour } from "@/components/OnboardingTour";
import ResearchSettings from "@/components/ResearchSettings";
import LexisNexisSettings from "@/components/LexisNexisSettings";
import { buildMapThumbnail } from "@/lib/exportPng";
import { track } from "@/lib/posthog";
import { runResearchAssistant, runResearchAssistantStream } from "@/lib/api";

const blankMap = (t, title) => ({
  id: newId(),
  title: title || (t ? t("studio.defaults.untitledMap") : "Untitled Map"),
  summary: "",
  shape: "rect",
  children: [
    { id: "n1", title: t ? t("studio.defaults.idea1") : "Idea 1", shape: "ellipse", children: [] },
    { id: "n2", title: t ? t("studio.defaults.idea2") : "Idea 2", shape: "ellipse", children: [] },
    { id: "n3", title: t ? t("studio.defaults.idea3") : "Idea 3", shape: "ellipse", children: [] },
  ],
});

/**
 * Compact timestamp shown under the map title. Example: "Feb 23, 2026 · 10:43 PM".
 */
const formatStudioStamp = (ts) => {
  if (!ts) return "";
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
};

export default function Studio({ mode = "mindmap" }) {
  // Lazy-load the 30-family mind-map font pack the FIRST time anyone
  // opens Studio. This is keyed on module load so we only fire it once
  // per session — marketing pages (landing/pricing/FAQ) never trigger
  // it, saving them ~600KB of font CSS + woff2 fetches per visit.
  loadCanvasFonts();

  const isFlowchart = mode === "flowchart";
  const navigate = useNavigate();
  const privacyOn = usePrivacyMode();
  const { t } = useTranslation();
  const [maps, setMaps] = useState(() => {
    // Seed a default "Map Title" map on first visit. Flowchart Studio
    // gets its own flowchart seed (Start + one of each shape + End)
    // when the user has no flowchart-flagged maps yet — without this
    // a freshly-routed /flowchart visitor would land on whatever
    // mind-map happened to be first in storage.
    const all = listMaps();
    if (all.length === 0) {
      ensureDefaultMap((key, opts) => i18n.t(key, opts));
    }
    if (isFlowchart && !all.some((m) => isFlowchartMap(m))) {
      const flow = blankFlowchart();
      saveMap(flow);
    }
    return listMaps();
  });
  const [activeId, setActiveId] = useState(() => {
    // Prune retired demo (Attention-Is-All-You-Need) from any user library
    // BEFORE we resolve the default map — otherwise a user whose most-recent
    // map is the retired demo would land on it just as we're trying to
    // remove it.
    try { removeRetiredAttentionDemo(); } catch { /* ignore */ }
    // Seed the example maps once on first run so /app?example=guide always
    // works for first-time visitors arriving via the landing-page CTA.
    try { seedExamplesIfFirstRun(); } catch { /* ignore */ }
    const all = listMaps();
    // Flowchart Studio: prefer the most-recent flowchart-flagged map
    // over generic mind-maps so the user lands on a flowchart.
    if (isFlowchart) {
      const flowMaps = all.filter(isFlowchartMap);
      if (flowMaps.length) {
        addToRecents(flowMaps[0].id);
        return flowMaps[0].id;
      }
    }
    // Honor ?map=<id> query param (used by /library → open in Studio)
    try {
      const params = new URLSearchParams(window.location.search);
      const want = params.get("map");
      if (want && all.some((m) => m.id === want)) {
        addToRecents(want);
        return want;
      }
      // ?example=guide|welcome — public marketing CTA. We force-create the
      // requested map regardless of existing library state.
      const ex = params.get("example");
      if (ex) {
        const target = ensureExampleMap(ex === "welcome" ? "welcome" : "guide");
        if (target) {
          addToRecents(target);
          return target;
        }
      }
    } catch { /* ignore */ }
    // Default-open preference (when no ?map= or ?example= param):
    //   1. The most-recent map the user actually opened (from `recents`)
    //   2. If no recents (true first-time user), prefer the WELCOME map —
    //      it's the simplest, most playful, and the one designed to teach
    //      right-click / toolbar / sharing in 5 nodes.
    //   3. Fall back to whatever `listMaps()` returns first.
    try {
      const recents = getRecents();
      // Skip flowchart-flagged maps when we're in mind-map mode — without
      // this, navigating from /flowchart to /app would re-open the user's
      // most-recent flowchart inside the mind-map studio shell, leaving
      // them with no obvious way back to a regular mind map. (Flowchart
      // mode does the inverse filter above on line 129.)
      const recentLive = recents.find((id) => {
        const m = all.find((x) => x.id === id);
        if (!m) return false;
        if (isFlowchartMap(m)) return false;
        return true;
      });
      if (recentLive) {
        addToRecents(recentLive);
        return recentLive;
      }
    } catch { /* ignore */ }
    const welcome = all.find((m) => m.id === "example-welcome");
    if (welcome && !isFlowchartMap(welcome)) {
      addToRecents(welcome.id);
      return welcome.id;
    }
    // Final fallback — first non-flowchart map the user has.
    const first = all.find((m) => !isFlowchartMap(m))?.id || all[0]?.id || null;
    if (first) addToRecents(first);
    return first;
  });
  const [openOpen, setOpenOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const v = localStorage.getItem("mindmapper.sidebar");
      return v === null ? true : v === "1";
    } catch { return true; }
  });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Renew wall state — separate from upgradeOpen because the wall has
  // a contextual "action" that drives the headline copy. `renewAction`
  // null = closed; otherwise one of 'new-map' | 'ai' | 'cloud' | 'share'.
  const [renewAction, setRenewAction] = useState(null);
  const license = useLicense();
  const [shareOpen, setShareOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  // --- Streaming-research overlay state ---
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchPhase, setResearchPhase] = useState(null);
  const [researchBranches, setResearchBranches] = useState([]);
  const researchAbortRef = useRef(null);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState(null);
  const [saveTick, setSaveTick] = useState(0);
  // Selection info pushed up by MindMapCanvas — drives the right-side
  // SelectionPropertiesPanel and gives Studio the ability to apply colour /
  // shape / font patches without holding a ref.
  const [selectionInfo, setSelectionInfo] = useState({ type: null, id: null, data: null, applyPatch: null });
  const { user, signIn, signOut, refresh: refreshUser } = useAuth();
  const fileInputRef = useRef(null);

  // Undo/Redo stacks (session-only, per-map). Max 50 steps.
  const undoStacksRef = useRef({}); // { [mapId]: [prevMap, ...] }
  const redoStacksRef = useRef({});
  const [historyTick, setHistoryTick] = useState(0); // trigger re-render on undo/redo state change

  // Refresh user state if we just came back from Stripe checkout. Poll
  // /checkout-status until 'paid' so the user becomes Pro without a hard
  // refresh even if our webhook races (or the preview env has no webhook).
  const [stuckSession, setStuckSession] = useState(null);
  const [rescuing, setRescuing] = useState(false);

  // Show a celebratory, sticky "Now a Pro" toast with a "Share on X" action.
  // Used by both the polling success path and the no-session_id path.
  const showProCelebration = useCallback(() => {
    const text = "I just went Pro on marvex.app — turns any PDF into a knowledge graph in 60 seconds. Cosmic. 🧠✨";
    const url = "https://marvex.app";
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    toast.success("🎉 Welcome to Pro — unlimited maps, cloud sync, Deep Research", {
      duration: 12000,
      action: {
        label: "Share on X",
        onClick: () => window.open(tweetUrl, "_blank", "noopener,width=550,height=420"),
      },
    });
  }, []);

  // Access-code redemption celebration. The redemption itself happens in
  // lib/auth.jsx's post-auth effect; auth.jsx stashes a one-shot flag in
  // sessionStorage that we read here on mount and turn into the
  // appropriate toast (different copy per tier so the user knows exactly
  // what they got — pro / annual / lifetime / founder).
  useEffect(() => {
    let raw = "";
    try { raw = sessionStorage.getItem("mindmapper.access_code.just_redeemed") || ""; } catch { /* ignore */ }
    if (!raw) return;
    try { sessionStorage.removeItem("mindmapper.access_code.just_redeemed"); } catch { /* ignore */ }
    let payload = {};
    try { payload = JSON.parse(raw); } catch { /* ignore */ }
    const tier = (payload.tier || "").toLowerCase();
    if (tier === "founder") {
      const num = payload.founder_number ? ` #${payload.founder_number}` : "";
      toast.success(`✨ Founder${num} status granted — Lifetime Pro · gold badge for life`, { duration: 14000 });
    } else if (tier === "lifetime") {
      toast.success("✨ Lifetime Pro granted — every Pro feature, forever", { duration: 12000 });
    } else if (tier === "annual") {
      toast.success("🎁 Pro Annual granted — 365 days of every Pro feature", { duration: 10000 });
    } else if (tier) {
      toast.success("🎁 Pro access granted — enjoy every Pro feature on us", { duration: 10000 });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get("upgraded");
    const addon = params.get("addon");
    const sessionId = params.get("session_id");
    // Add-on checkout success — same poll-and-refresh dance, different
    // celebration copy.  We strip the query so the success state is
    // not re-celebrated on refresh.
    if (addon === "premium-uk-law" && sessionId) {
      let attempts = 0;
      const MAX = 8;
      const pollAddon = async () => {
        try {
          const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
          const { default: axios } = await import("axios");
          const r = await axios.get(`${API}/billing/checkout-status/${sessionId}`, { withCredentials: true });
          const paid = r.data?.payment_status === "paid" || r.data?.status === "completed";
          if (paid) {
            toast.success("🎓 Law Pack Add-on unlocked — BAILII full-text + LexisNexis BYOK live now", {
              duration: 12000,
            });
            await refreshUser();
            return;
          }
        } catch { /* keep polling */ }
        attempts += 1;
        if (attempts < MAX) setTimeout(pollAddon, 2000);
      };
      pollAddon();
      window.history.replaceState({}, "", "/app");
      return;
    }
    if (addon === "cancelled") {
      toast("Add-on cancelled");
      window.history.replaceState({}, "", "/app");
      return;
    }
    if (upgraded === "true" && sessionId) {
      let attempts = 0;
      const MAX = 8; // ~16s total
      const poll = async () => {
        try {
          const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
          const { default: axios } = await import("axios");
          const r = await axios.get(`${API}/billing/checkout-status/${sessionId}`, { withCredentials: true });
          const paid = r.data?.payment_status === "paid" || r.data?.status === "completed";
          if (paid) {
            track("checkout_completed", { plan: r.data?.plan || "unknown", session_id: sessionId });
            showProCelebration();
            await refreshUser();
            return;
          }
        } catch { /* transient — keep polling */ }
        attempts += 1;
        if (attempts < MAX) {
          setTimeout(poll, 2000);
        } else {
          // Webhook never arrived. Offer the user a Contact support rescue.
          track("checkout_stuck", { session_id: sessionId });
          setStuckSession(sessionId);
        }
      };
      poll();
      window.history.replaceState({}, "", "/app");
    } else if (upgraded === "true") {
      track("checkout_completed", { plan: "unknown", session_id: null });
      showProCelebration();
      refreshUser();
      window.history.replaceState({}, "", "/app");
    } else if (upgraded === "false") {
      track("checkout_cancelled", { session_id: sessionId || null });
      toast("Upgrade cancelled");
      window.history.replaceState({}, "", "/app");
    }  }, [refreshUser, showProCelebration]);

  const requestStripeRescue = async () => {
    if (!stuckSession) return;
    setRescuing(true);
    try {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const { default: axios } = await import("axios");
      const r = await axios.post(`${API}/billing/resync/${stuckSession}`, {}, { withCredentials: true });
      if (r.data?.already_pro) {
        toast.success("You're already Pro — refreshing...");
        await refreshUser();
      } else {
        toast.success(r.data?.message || "We'll verify your payment and enable Pro within 24h.");
      }
      setStuckSession(null);
    } catch {
      toast.error("Couldn't reach our servers — please email press@marvex.app with your receipt.");
    } finally {
      setRescuing(false);
    }
  };

  // Honour ?focus=<nodeId> when arriving from /highlights or elsewhere.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fid = params.get("focus");
    if (fid) {
      setFocusNodeId(fid);
      // Strip the query param so refresh-shares don't re-focus forever.
      const url = new URL(window.location.href);
      url.searchParams.delete("focus");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // "When user closes map, stickies are added to Reminders" — implemented as
  // a toast that fires when the active map changes (or Studio unmounts). The
  // reminders themselves are derived live from sticky annotations (see
  // /app/frontend/src/lib/reminders.js), so there's no migration step — this
  // is purely a "you've got N reminders waiting in Output" nudge.
  useEffect(() => {
    if (!activeId) return undefined;
    const startingMapId = activeId;
    return () => {
      try {
        const m = getMap(startingMapId);
        const active = (m?.annotations || []).filter(
          (a) => a.type === "sticky" && !a.done && (a.text || "").trim(),
        );
        if (active.length > 0) {
          toast(
            `📌 ${active.length} sticky note${active.length === 1 ? "" : "s"} saved to Output → Reminders`,
            {
              action: {
                label: "Open",
                onClick: () => navigate("/output"),
              },
            },
          );
        }
      } catch { /* swallow — don't block navigation */ }
    };
  }, [activeId, navigate]);

  // Cross-component events — e.g. Cloud Save success toast "Share this map" CTA.
  useEffect(() => {
    const onOpenShare = () => setShareOpen(true);
    window.addEventListener("mindmapper:open-share", onOpenShare);
    return () => window.removeEventListener("mindmapper:open-share", onOpenShare);
  }, []);

  // Onboarding tour — auto-open on first visit, honour `?tour=1` retrigger.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      resetTour();
      setTourOpen(true);
      // Strip the query param so a refresh doesn't re-open.
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState({}, "", url.pathname + url.search);
      return;
    }
    if (!hasSeenTour()) {
      // Defer a beat so the canvas and sidebar have rendered before the
      // spotlight measures its first target.
      const id = setTimeout(() => setTourOpen(true), 800);
      return () => clearTimeout(id);
    }
  }, []);

  // Memoise the active map so that re-renders that don't actually change
  // the underlying map data don't hand a fresh object reference to
  // MindMapCanvas (which would cascade into its `useEffect([..., map])`
  // notifier and bounce SelectionPropertiesPanel updates back through a
  // ping-pong loop). Re-reads localStorage only when activeId or saveTick
  // changes (saveTick is bumped after every save). Includes `historyTick`
  // so undo/redo actions also surface the new map snapshot.
  const active = useMemo(
    () => (activeId ? getMap(activeId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, saveTick, historyTick],
  );
  const isPro = !!user && (user.subscription_status === "active" || user.subscription_status === "trialing");

  const refresh = useCallback(() => setMaps(listMaps()), []);

  // Stable upgrade-dialog opener — passed to MindMapCanvas → useNodeCrud,
  // where it ends up in the useCallback deps of `_capExceeded` and
  // `addChild`. An inline `() => setUpgradeOpen(true)` here would mint
  // a fresh fn ref on every Studio render, invalidating `addChild` and
  // causing a "Maximum update depth exceeded" cascade once free users
  // start hitting the 30-node cap. Same pattern as the iter76 fix for
  // `active`/`handleMapChange`.
  const openUpgradeDialog = useCallback(() => setUpgradeOpen(true), []);

  const toggleSidebar = () => {
    setSidebarOpen((v) => {
      const next = !v;
      try { localStorage.setItem("mindmapper.sidebar", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const handleNew = () => {
    // Read-only mode (option B in the pricing model): expired / free
    // users can still open and edit the maps they already have, but
    // creating new ones requires an active subscription. Pop the renew
    // wall instead of silently doing nothing — silence is a worse UX
    // than a clear "here's why" with a renew CTA.
    if (license.blocksAction("new-map")) {
      setRenewAction("new-map");
      return;
    }
    // Free users (no active sub) who already have an oversized map (>30
    // structured nodes — likely grandfathered from a previous Pro period
    // or pre-cap era) can keep editing those maps but can't spawn NEW
    // maps until they upgrade. The trigger is a strong usage signal —
    // they're already heavy users — and the existing-map carve-out keeps
    // the rule from feeling punitive on a fresh free signup.
    if (!license.active) {
      try {
        const all = listMaps();
        const oversized = all.some((m) => {
          let n = 0;
          const walk = (node) => {
            if (!node) return;
            n += 1;
            (node.children || []).forEach(walk);
          };
          walk(m);
          return n > 30;
        });
        if (oversized) {
          toast.error(
            "You've outgrown the free tier — upgrade to keep creating new maps. Your existing maps stay editable.",
            { duration: 6000 }
          );
          setUpgradeOpen(true);
          return;
        }
      } catch { /* localStorage parse errors → fall through, never block */ }
    }
    // Flowchart Studio uses a different seed: a Start node + one of
    // each shape + End. The shape palette lives in lib/flowchart.js.
    const m = isFlowchart ? blankFlowchart() : blankMap(t);
    saveMap(m);
    setActiveId(m.id);
    refresh();
    toast.success(isFlowchart ? "New flowchart created" : t("studio.defaults.newMapCreated"));
  };

  const handleOpenList = () => setOpenOpen(true);

  const handlePickMap = (id) => {
    addToRecents(id);
    setActiveId(id);
    setOpenOpen(false);
  };

  const handleDeleteMap = (id) => {
    deleteMap(id);
    refresh();
    if (activeId === id) {
      const remaining = listMaps();
      setActiveId(remaining[0]?.id || null);
    }
    toast("Map deleted");
  };

  const handleDuplicateMap = (id) => {
    const src = getMap(id);
    if (!src) return;
    // Deep-clone + regenerate every node id to prevent positions/undo collisions
    const regen = (node) => ({
      ...node,
      id: newId(),
      children: (node.children || []).map(regen),
    });
    const copy = {
      ...regen(src),
      title: `${src.title || "Untitled"} (Copy)`,
      positions: {}, // start from fresh radial layout
    };
    saveMap(copy);
    setActiveId(copy.id);
    refresh();
    setOpenOpen(false);
    toast.success("Map duplicated");
  };

  const handleMapChange = useCallback((next) => {
    // Push the PREVIOUS map state onto undo stack (cap 50)
    if (activeId) {
      const prev = getMap(activeId);
      if (prev) {
        const stack = undoStacksRef.current[activeId] || [];
        stack.push(prev);
        if (stack.length > 50) stack.shift();
        undoStacksRef.current[activeId] = stack;
        // Any new edit invalidates redo
        redoStacksRef.current[activeId] = [];
      }
    }
    try {
      saveMap(next);
    } catch (err) {
      // Roll back the undo stack push so the user isn't stuck with a no-op
      if (activeId) {
        const stack = undoStacksRef.current[activeId] || [];
        stack.pop();
      }
      toast.error(err.message || "Could not save map");
      return;
    }
    setSaveTick((t) => t + 1);
    setHistoryTick((t) => t + 1);
    refresh();
  }, [activeId, refresh]);

  const handleUndo = () => {
    if (!activeId) return;
    const stack = undoStacksRef.current[activeId] || [];
    if (!stack.length) return;
    const prev = stack.pop();
    const current = getMap(activeId);
    const redo = redoStacksRef.current[activeId] || [];
    if (current) redo.push(current);
    redoStacksRef.current[activeId] = redo;
    saveMap(prev);
    setSaveTick((t) => t + 1);
    setHistoryTick((t) => t + 1);
    refresh();
  };

  const handleRedo = () => {
    if (!activeId) return;
    const redo = redoStacksRef.current[activeId] || [];
    if (!redo.length) return;
    const next = redo.pop();
    const current = getMap(activeId);
    const undo = undoStacksRef.current[activeId] || [];
    if (current) undo.push(current);
    undoStacksRef.current[activeId] = undo;
    saveMap(next);
    setSaveTick((t) => t + 1);
    setHistoryTick((t) => t + 1);
    refresh();
  };

  const canUndo = (() => {
    void historyTick; // ensure React re-evaluates this on undo/redo state changes
    return !!(activeId && (undoStacksRef.current[activeId]?.length || 0) > 0);
  })();
  const canRedo = (() => {
    void historyTick;
    return !!(activeId && (redoStacksRef.current[activeId]?.length || 0) > 0);
  })();

  const handleTitleChange = (newTitle) => {
    if (!active) return;
    handleMapChange({ ...active, title: newTitle });
  };

  const handleResearch = async (focusNode) => {
    if (!active || !focusNode) return;
    // Flatten the map into a depth-aware outline so the LLM can dedupe siblings.
    const outline = [];
    const walk = (node, depth = 0) => {
      outline.push({ title: node.title || "", depth });
      (node.children || []).forEach((c) => walk(c, depth + 1));
    };
    walk(active, 0);

    const cfg = getResearchConfig();
    const userKey = getApiKey();

    // RAG memory: pluck top-K related past research entries for context.
    const memory = buildMemoryContext(focusNode.title || "", focusNode.summary || "", 3);

    // Streaming mode: open the progress overlay, reveal branches as they arrive.
    setResearchBranches([]);
    setResearchPhase({
      phase: "starting",
      message: memory.length
        ? `Connecting to Mikey · drawing on ${memory.length} prior note${memory.length === 1 ? "" : "s"}…`
        : "Connecting to Mikey…",
    });
    setResearchOpen(true);
    const controller = new AbortController();
    researchAbortRef.current = controller;

    try {
      const finalMap = await runResearchAssistantStream({
        mapContext: {
          title: active.title || "Untitled",
          focus_title: focusNode.title || "",
          focus_summary: focusNode.summary || "",
          outline,
        },
        persona: cfg.persona,
        audience: cfg.audience,
        depth: cfg.depth,
        userKey,
        memory,
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === "phase") setResearchPhase(ev);
          else if (ev.type === "branch") {
            setResearchBranches((bs) => [...bs, ev.branch]);
          }
        },
      });
      if (!finalMap) throw new Error("Research stream ended without a final map");

      // Append to RAG memory so future research calls can reference this result.
      appendResearchMemory({
        focus: focusNode.title || "",
        mapTitle: active.title || "",
        persona: cfg.persona,
        audience: cfg.audience,
        depth: cfg.depth,
        map: finalMap,
      });

      const m = {
        id: newId(),
        title: finalMap.title || focusNode.title || "Research",
        summary: finalMap.summary || "",
        children: finalMap.children || [],
        source: "research",
        researchMeta: {
          sourceMapId: active.id,
          sourceMapTitle: active.title,
          sourceNodeId: focusNode.id,
          sourceNodeTitle: focusNode.title,
          persona: cfg.persona || "",
          audience: cfg.audience || "",
          depth: cfg.depth || "balanced",
          createdAt: Date.now(),
        },
      };
      saveMap(m);
      setActiveId(m.id);
      refresh();
      setResearchPhase({ phase: "done", message: `Created "${m.title}"` });
      toast.success(`Research map created · ${(finalMap.children || []).length} branches`);
      // Leave the overlay visible briefly so the user can see the complete state.
      setTimeout(() => setResearchOpen(false), 2200);
    } catch (err) {
      setResearchOpen(false);
      if (err.name === "AbortError") {
        toast("Research cancelled");
        return;
      }
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401 || status === 403) {
        toast.error("Sign in to use the Research Assistant");
      } else if (status === 402) {
        toast.error(detail || "Free AI limit reached — add your own API key in Settings");
        setUpgradeOpen(true);
      } else {
        toast.error(detail || err?.message || "Research failed");
      }
    }
  };

  const handleDeepen = async (focusNode) => {
    if (!active || !focusNode) return;
    // Pro-only superpower (Lite users see an upgrade nudge). BYOK does
    // NOT unlock this — Deepen / Deep Research are positioned as Pro
    // entitlements regardless of who pays for the AI calls.
    if (!license.isProOnly) {
      toast.error("Deepen is a Pro feature — Lite tier doesn't include AI superpowers");
      setUpgradeOpen(true);
      return;
    }
    // Build the outline context so the assistant can dedupe against the
    // branch's existing children.
    const outline = [];
    const walk = (node, depth = 0) => {
      outline.push({ title: node.title || "", depth });
      (node.children || []).forEach((c) => walk(c, depth + 1));
    };
    walk(active, 0);

    const cfg = getResearchConfig();
    const userKey = getApiKey();
    const memory = buildMemoryContext(focusNode.title || "", focusNode.summary || "", 3);
    const pending = toast.loading(`Deepening "${focusNode.title}"…`);
    try {
      const research = await runResearchAssistant({
        mapContext: {
          title: active.title || "Untitled",
          focus_title: focusNode.title || "",
          focus_summary: focusNode.summary || "",
          outline,
        },
        persona: cfg.persona,
        audience: cfg.audience,
        depth: cfg.depth,
        userKey,
        memory,
      });
      toast.dismiss(pending);

      const newBranches = (research.children || []).map((c) => ({
        ...c,
        id: `${focusNode.id}-deep-${Math.random().toString(36).slice(2, 7)}`,
      }));
      if (!newBranches.length) {
        toast("Research came back empty — try rewording the map element");
        return;
      }

      // Append to RAG memory even for Deepen — every research call counts.
      appendResearchMemory({
        focus: focusNode.title || "",
        mapTitle: active.title || "",
        persona: cfg.persona,
        audience: cfg.audience,
        depth: cfg.depth,
        map: research,
      });

      // Recursively graft new branches as children of the focus node, in-place.
      const graft = (node) => {
        if (node.id === focusNode.id) {
          return { ...node, children: [...(node.children || []), ...newBranches] };
        }
        if (!node.children || !node.children.length) return node;
        return { ...node, children: node.children.map(graft) };
      };
      const isRoot = focusNode.id === active.id;
      const nextMap = isRoot
        ? {
            ...active,
            children: [...(active.children || []), ...newBranches],
            source: active.source || "research",
          }
        : {
            ...active,
            children: (active.children || []).map(graft),
            source: active.source || "research",
          };
      handleMapChange(nextMap);
      setFocusNodeId(focusNode.id);
      toast.success(`Deepened · +${newBranches.length} branches`);
    } catch (err) {
      toast.dismiss(pending);
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401 || status === 403) {
        toast.error("Sign in to use Deepen");
      } else if (status === 402) {
        toast.error(detail || "Free AI limit reached — add your own API key in Settings");
        setUpgradeOpen(true);
      } else {
        toast.error(detail || err?.message || "Deepen failed");
      }
    }
  };

  const handleDeepResearch = async (focusNode) => {
    if (!active || !focusNode) return;
    const cfg = getResearchConfig();
    const userKey = getApiKey();

    // Pro-only gate (Deep Research is a Pro entitlement; Lite tier
    // doesn't include AI superpowers regardless of BYOK status).
    if (!license.isProOnly) {
      toast.error("Deep Research is a Pro superpower — recursive AI trees");
      setUpgradeOpen(true);
      return;
    }

    // L2 branching cap — keeps Stripe/AI costs bounded for the merchant.
    const MAX_L2_PER_BRANCH = 2;

    const outline = [];
    const walk = (node, depth = 0) => {
      outline.push({ title: node.title || "", depth });
      (node.children || []).forEach((c) => walk(c, depth + 1));
    };
    walk(active, 0);

    const pending = toast.loading(`Deep research · L1 on "${focusNode.title}"…`);

    // ---- Level 1 ----
    let l1Branches = [];
    let l1RawMap = null;
    try {
      const l1 = await runResearchAssistant({
        mapContext: {
          title: active.title || "Untitled",
          focus_title: focusNode.title || "",
          focus_summary: focusNode.summary || "",
          outline,
        },
        persona: cfg.persona,
        audience: cfg.audience,
        depth: cfg.depth,
        userKey,
        memory: buildMemoryContext(focusNode.title || "", focusNode.summary || "", 3),
      });
      l1RawMap = l1;
      l1Branches = (l1.children || []).map((c) => ({
        ...c,
        id: `${focusNode.id}-dr-${Math.random().toString(36).slice(2, 7)}`,
      }));
    } catch (err) {
      toast.dismiss(pending);
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401 || status === 403) toast.error("Sign in to use Deep Research");
      else if (status === 402) { toast.error(detail || "Free AI limit reached"); setUpgradeOpen(true); }
      else toast.error(detail || err?.message || "Deep Research failed");
      return;
    }

    if (!l1Branches.length) {
      toast.dismiss(pending);
      toast("Deep Research came back empty — try rewording the map element");
      return;
    }

    // ---- Level 2 (parallel) ----
    toast.loading(`Deep research · L2 (${l1Branches.length} parallel branches)…`, { id: pending });
    const l2Results = await Promise.allSettled(
      l1Branches.map(async (parent) => {
        try {
          const r = await runResearchAssistant({
            mapContext: {
              title: active.title || "Untitled",
              focus_title: parent.title || "",
              focus_summary: parent.summary || "",
              outline: [...outline, { title: parent.title, depth: 1 }],
            },
            persona: cfg.persona,
            audience: cfg.audience,
            depth: cfg.depth,
            userKey,
            memory: buildMemoryContext(parent.title || "", parent.summary || "", 2),
          });
          const kids = (r.children || []).slice(0, MAX_L2_PER_BRANCH).map((c) => ({
            ...c,
            id: `${parent.id}-dr-${Math.random().toString(36).slice(2, 7)}`,
          }));
          return { parentId: parent.id, kids };
        } catch {
          return { parentId: parent.id, kids: [] };
        }
      })
    );

    // Merge L2 kids back into their L1 parents.
    let totalAdded = l1Branches.length;
    l2Results.forEach((r) => {
      if (r.status === "fulfilled") {
        const parent = l1Branches.find((p) => p.id === r.value.parentId);
        if (parent) {
          parent.children = [...(parent.children || []), ...r.value.kids];
          totalAdded += r.value.kids.length;
        }
      }
    });

    // Graft the whole L1+L2 subtree under the focus node, in-place.
    const graft = (node) => {
      if (node.id === focusNode.id) {
        return { ...node, children: [...(node.children || []), ...l1Branches] };
      }
      if (!node.children || !node.children.length) return node;
      return { ...node, children: node.children.map(graft) };
    };
    const isRoot = focusNode.id === active.id;
    const nextMap = isRoot
      ? {
          ...active,
          children: [...(active.children || []), ...l1Branches],
          source: active.source || "research",
        }
      : {
          ...active,
          children: (active.children || []).map(graft),
          source: active.source || "research",
        };
    handleMapChange(nextMap);
    setFocusNodeId(focusNode.id);
    toast.dismiss(pending);
    toast.success(`Deep research complete · +${totalAdded} branches`);

    // Append the combined L1+L2 tree to RAG memory so the recursive work
    // is available to future research calls. We feed it the grafted
    // branches (which already contain their L2 kids) through the same
    // shape appendResearchMemory expects.
    if (l1RawMap) {
      appendResearchMemory({
        focus: focusNode.title || "",
        mapTitle: active.title || "",
        persona: cfg.persona,
        audience: cfg.audience,
        depth: cfg.depth,
        map: { ...l1RawMap, children: l1Branches },
      });
    }
  };


  const handleExport = () => {
    if (!active) return;
    const blob = new Blob([JSON.stringify(active, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(active.title || "mindmap").replace(/[^\w\-]+/g, "_")}.mindmap.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as JSON");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const m = {
        id: newId(),
        title: parsed.title || "Imported map",
        summary: parsed.summary || "",
        children: parsed.children || [],
      };
      saveMap(m);
      setActiveId(m.id);
      refresh();
      toast.success("Map imported");
    } catch {
      toast.error("Could not import — invalid JSON");
    } finally {
      e.target.value = "";
    }
  };

  // Keyboard: Cmd/Ctrl-K opens search; [ toggles sidebar; Cmd/Ctrl-Z undo / Shift+Z redo
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      const isInput = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        if (isInput) return;
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (isInput) return;
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if (e.key === "[") {
        if (isInput) return;
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setOpenOpen(false);
        setSettingsOpen(false);
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const searchHits = searchQuery.trim()
    ? maps
        .map((m) => {
          const q = searchQuery.toLowerCase();
          const matches = [];
          const walk = (node, path = []) => {
            const next = [...path, node.title];
            if ((node.title || "").toLowerCase().includes(q) || (node.summary || "").toLowerCase().includes(q)) {
              matches.push({ path: next, summary: node.summary });
            }
            (node.children || []).forEach((c) => walk(c, next));
          };
          walk(m);
          return matches.length ? { map: m, matches } : null;
        })
        .filter(Boolean)
    : [];

  // True when any blocking modal/panel is on top of the canvas — used to hide
  // the floating left/right toolbars so they don't poke through dialogs.
  const obstructing =
    openOpen || searchOpen || settingsOpen || upgradeOpen || shareOpen ||
    tourOpen || researchOpen || shareCardOpen || paletteOpen || todoOpen;

  return (
    <div data-testid="studio-page" className="h-screen w-screen overflow-hidden flex bg-[#03040a] text-white">
      {/* Subscription-health banner (fixed top strip via portal — only renders
          when past-due / cancel-at-period-end / renews-soon). */}
      <SubscriptionBanner fixed />
      {/* SIDEBAR */}
      <aside
        data-testid="studio-sidebar"
        aria-hidden={!sidebarOpen}
        className="flex-shrink-0 flex flex-col border-r border-white/5 overflow-hidden transition-[width,border] duration-300 ease-in-out"
        style={{
          background: "linear-gradient(180deg, #060a1c 0%, #04060f 100%)",
          width: sidebarOpen ? 260 : 0,
          borderRightWidth: sidebarOpen ? 1 : 0,
        }}
      >
        <div style={{ width: 260, minWidth: 260 }} className="flex flex-col h-full">
        {/* Brand */}
        <div className="px-5 py-6 flex items-center gap-3 border-b border-white/5 relative">
          <Link to="/" data-testid="sidebar-home-link"><Logo size={48} /></Link>
          <div className="leading-tight">
            <div className="text-[12px] mono uppercase tracking-[0.2em] text-cyan-300/80">{t("studio.brand")}</div>
            <div className="text-[10px] mono uppercase tracking-[0.22em] text-[#566187]">{t("studio.brandSubtitle")}</div>
            {privacyOn && (
              <div
                data-testid="privacy-badge-studio"
                className="mt-1 inline-flex items-center gap-1 mono text-[8px] uppercase tracking-[0.22em] text-emerald-200 px-1.5 py-[2px] rounded-full border border-emerald-400/40 bg-emerald-500/15"
                title="Pure Local Mode is on — nothing is sent to the cloud"
              >
                <Lock size={8} /> Local only
              </div>
            )}
          </div>
          <button
            data-testid="sidebar-collapse-btn"
            onClick={toggleSidebar}
            title={t("studio.hideSidebar")}
            className="absolute top-4 right-3 w-7 h-7 rounded-md grid place-items-center text-[#7a87ad] hover:text-cyan-300 hover:bg-cyan-500/10 transition"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>

        {/* CREATE */}
        <div className="px-5 pt-6">
          <div className="mono text-[10px] uppercase tracking-[0.25em] text-[#566187] mb-3">{t("studio.sections.create")}</div>
          <div className="flex gap-2">
            <button
              data-testid="btn-new-map"
              onClick={handleNew}
              className="flex-1 px-3 py-2.5 rounded-lg bg-[#0a1428] border border-cyan-500/40 text-cyan-100 text-[12px] mono uppercase tracking-[0.18em] transition-all duration-200 hover:bg-[#0f1d38] hover:border-cyan-400 hover:text-cyan-200 hover:shadow-[0_0_14px_rgba(0,240,255,0.45),inset_0_0_10px_rgba(0,240,255,0.15)]"
              style={{ boxShadow: "0 0 10px rgba(0,240,255,0.25), inset 0 0 8px rgba(0,240,255,0.08)" }}
            >
              {t("studio.actions.new")}
            </button>
            <button
              data-testid="btn-open-map"
              onClick={handleOpenList}
              className="flex-1 px-3 py-2.5 rounded-lg bg-[#0a1428] border border-cyan-500/40 text-cyan-100 text-[12px] mono uppercase tracking-[0.18em] transition-all duration-200 hover:bg-[#0f1d38] hover:border-cyan-400 hover:text-cyan-200 hover:shadow-[0_0_14px_rgba(0,240,255,0.45),inset_0_0_10px_rgba(0,240,255,0.15)]"
              style={{ boxShadow: "0 0 10px rgba(0,240,255,0.25), inset 0 0 8px rgba(0,240,255,0.08)" }}
            >
              {t("studio.actions.open")}
            </button>
          </div>
          <button
            data-testid="btn-import-bookmarks"
            onClick={() => setBookmarksOpen(true)}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-transparent border border-fuchsia-400/30 text-fuchsia-200 text-[11px] mono uppercase tracking-[0.18em] transition-all duration-200 hover:bg-fuchsia-400/10 hover:border-fuchsia-400 hover:text-fuchsia-100 flex items-center justify-center gap-1.5"
            title="Drop a bookmarks.html exported from any browser to turn it into a mind-map"
          >
            <Bookmark size={12} />
            Import bookmarks
          </button>
        </div>

        {/* ASSETS */}
        <AssetsSidebar
          activeMapId={active?.id}
          studioActive={!!active}
          /* In Flowchart Studio, the "Marvex Studio" entry should route
             to the mind-map studio (/app) — without this override the
             default behaviour kicks in and opens the JSON-import file
             picker, which is confusing because the button is labelled
             "Marvex Studio". In mind-map mode we keep the import-file
             shortcut since users there have no other quick way to load
             a .json export. */
          onStudioClick={isFlowchart ? (() => navigate("/app")) : handleImportClick}
        />
        <input
          ref={fileInputRef}
          data-testid="hidden-import-input"
          type="file"
          accept="application/json"
          hidden
          onChange={handleImportFile}
        />

        {/* spacer + nav icons */}
        <div className="flex-1" />
        <div className="px-5 pb-7 flex flex-col gap-3 items-start">
          <SidebarIcon
            testid="sidebar-icon-todo"
            label={t("studio.icons.todo")}
            onClick={() => setTodoOpen(true)}
          >
            <ListChecks size={18} />
          </SidebarIcon>
          <SidebarIcon
            testid="sidebar-icon-search"
            label={t("studio.icons.search")}
            onClick={() => setSearchOpen(true)}
          >
            <Search size={18} />
          </SidebarIcon>
          <SidebarIcon
            testid="sidebar-icon-export"
            label={t("studio.icons.exportCurrent")}
            onClick={handleExport}
            disabled={!active}
          >
            <Download size={18} />
          </SidebarIcon>
          <SidebarIcon
            testid="sidebar-icon-highlights"
            label={t("studio.icons.highlights")}
            onClick={() => navigate("/highlights")}
          >
            <Bookmark size={18} />
          </SidebarIcon>
          <SidebarIcon
            testid="sidebar-icon-memory"
            label={t("studio.icons.memory")}
            onClick={() => navigate("/memory")}
          >
            <Brain size={18} />
          </SidebarIcon>
          <SidebarIcon
            testid="sidebar-icon-tools"
            label={t("studio.icons.tools")}
            onClick={() => navigate("/tools")}
          >
            <FlaskConical size={18} />
          </SidebarIcon>
          <SidebarIcon
            testid="sidebar-icon-learn"
            label={t("studio.icons.learn")}
            onClick={() => navigate("/learn")}
          >
            <GraduationCap size={18} />
          </SidebarIcon>
          <SidebarIcon
            testid="sidebar-icon-settings"
            label={t("studio.icons.settings")}
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon size={18} />
          </SidebarIcon>
        </div>
        </div>
      </aside>

      {/* Reveal button when sidebar is collapsed — kept very visible
          (cyan glow + label) so users always know how to bring the menu
          back. Sits top-left over the canvas. */}
      {!sidebarOpen && (
        <button
          data-testid="sidebar-expand-btn"
          onClick={toggleSidebar}
          title={t("studio.showSidebar")}
          className="fixed top-4 left-4 z-50 px-3 h-10 rounded-lg flex items-center gap-2 bg-[#0a0f24]/90 backdrop-blur border-2 border-cyan-400/70 text-cyan-200 hover:border-cyan-300 hover:bg-[#0f1d38] hover:shadow-[0_0_22px_rgba(0,240,255,0.6)] transition mono text-[10px] uppercase tracking-[0.22em]"
          style={{
            boxShadow: "0 0 16px rgba(0,240,255,0.45), inset 0 0 10px rgba(0,240,255,0.15)",
            animation: "pulse-glow 2.5s ease-in-out infinite",
          }}
        >
          <PanelLeftOpen size={16} />
          <span>Menu</span>
        </button>
      )}

      {/* MAIN CANVAS */}
      <main className="flex-1 relative cosmic-bg">
        {/* Top bar */}
        <div
          className="absolute top-0 left-0 right-0 z-40 py-6 pr-8 flex items-start justify-between pointer-events-none transition-[padding] duration-300"
          style={{
            paddingLeft: sidebarOpen ? 32 : 72,
            // Solid backdrop on the top half so map nodes can NEVER bleed
            // through the title / clock area, then a soft fade-out so the
            // canvas still looks open below.
            background: "linear-gradient(to bottom, rgba(3,6,15,1) 0%, rgba(3,6,15,1) 55%, rgba(3,6,15,0.85) 75%, rgba(3,6,15,0) 100%)",
          }}
        >
          <div className="pointer-events-auto">
            <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">
              MARVEX.COM
            </div>
            {active ? (
              <div className="mt-2 flex items-center gap-2 group max-w-xl">
                <Edit3
                  size={14}
                  className="text-cyan-300/60 group-hover:text-cyan-300 group-focus-within:text-cyan-300 transition-colors shrink-0"
                  aria-hidden
                />
                <input
                  data-testid="map-title-input"
                  value={active.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  title={t("studio.topBar.renameHint")}
                  placeholder={t("studio.topBar.untitledMap")}
                  className="bg-transparent text-xl md:text-2xl font-semibold text-white outline-none w-full border-b border-transparent hover:border-cyan-400/40 focus:border-cyan-400 transition-colors py-0.5 cursor-text"
                />
                <button
                  data-testid="map-close-btn"
                  onClick={() => {
                    setActiveId(null);
                    navigate("/library");
                  }}
                  title="Close map and return to Library"
                  className="shrink-0 ml-1 p-1 rounded-md text-[#7a87ad] hover:text-fuchsia-300 hover:bg-white/5 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="mt-2 text-xl md:text-2xl font-semibold text-white/70">{t("studio.topBar.noMapOpen")}</div>
            )}
            {active?.updatedAt && (
              <div
                data-testid="map-timestamp"
                className="mt-1 ml-[22px] mono text-[10px] uppercase tracking-[0.2em] text-[#6c7aa3]"
                title={`Created ${new Date(active.createdAt || active.updatedAt).toLocaleString()} · Updated ${new Date(active.updatedAt).toLocaleString()}`}
              >
                {formatStudioStamp(active.updatedAt)}
              </div>
            )}
          </div>

          {/* Avatar bottom-right is in cosmic main; place top-right small badge */}
          <div className="pointer-events-auto flex items-center gap-3">
            <LlmFuelGauge
              freeRemaining={user ? Math.max(0, 3 - (user.free_conversions_used || 0)) : null}
              isPro={user?.subscription_status === "active" || user?.subscription_status === "trialing"}
              onClick={() => setSettingsOpen(true)}
            />
            <ApiKeyStatusChip onClick={() => setSettingsOpen(true)} />
            <LanguageSwitcher compact />
            <FilmModeToggle />
            <ThemeToggle />
            <CheckForUpdatesLink />
            <UserBadge user={user} onSignIn={signIn} onSignOut={signOut} onUpgrade={() => setUpgradeOpen(true)} />
            {active && !privacyOn && (
              <button
                data-testid="studio-share-btn"
                onClick={() => setShareOpen(true)}
                title={t("studio.topBar.shareHint")}
                className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-cyan-400/30 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-400/10 transition flex items-center gap-1.5"
              >
                <Share2 size={11} /> {t("studio.topBar.share")}
              </button>
            )}
            {active && (
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#6c7aa3] hidden md:block">
                {t("studio.topBar.autoSaved")}
              </div>
            )}
          </div>
        </div>

        {/* CANVAS */}
        {active ? (
          <MindMapCanvas
            key={active.id}
            map={active}
            onChange={handleMapChange}
            isPro={isPro}
            isProOnly={license.isProOnly}
            nodeCap={license.nodeCap}
            onUpgrade={openUpgradeDialog}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onExportJson={handleExport}
            saveTick={saveTick}
            focusNodeId={focusNodeId}
            onFocusConsumed={() => setFocusNodeId(null)}
            onResearch={handleResearch}
            onDeepen={active?.source === "research" || active?.source === "enriched" ? handleDeepen : undefined}
            onDeepResearch={active?.source === "research" || active?.source === "enriched" ? handleDeepResearch : undefined}
            onSelectionChange={setSelectionInfo}
            flowchartMode={isFlowchart}
          />
        ) : (
          <EmptyState onNew={handleNew} onPdf={() => navigate("/intake")} />
        )}

        {/* Left action toolbar — Save / Save-As / Close / New / Compile.
            Sits below the title + clock, always visible while a map is open. */}
        {active && (
          <StudioLeftToolbar
            hidden={obstructing}
            onSaveNow={() => {
              if (!active) return;
              saveMap(active);
              setSaveTick((t) => t + 1);
              toast.success("Saved");
            }}
            onSaveAs={() => {
              if (!active) return;
              const newTitle = window.prompt("Save as — new title:", `${active.title || "Untitled"} (Copy)`);
              if (!newTitle) return;
              const regen = (n) => ({ ...n, id: newId(), children: (n.children || []).map(regen) });
              const copy = { ...regen(active), title: newTitle.trim(), positions: {} };
              saveMap(copy);
              setActiveId(copy.id);
              refresh();
              toast.success("Saved as new map");
            }}
            onCloseMap={() => {
              // Auto-save the current map then return the user to the Library
              // where they can pick another or import a fresh PDF.
              if (active) saveMap(active);
              toast.success("Map saved");
              navigate("/library");
            }}
            onNewMap={handleNew}
            onCompile={() => {
              window.dispatchEvent(new CustomEvent("mindmapper:compile"));
            }}
          />
        )}

        {/* Right-side selection-properties panel — colour / shape / font */}
        <SelectionPropertiesPanel
          visible={!!(active && selectionInfo.type && selectionInfo.data)}
          node={selectionInfo.data}
          selectionType={selectionInfo.type}
          isPro={isPro}
          onUpgrade={() => setUpgradeOpen(true)}
          onSetShape={(shape) => selectionInfo.applyPatch?.({ shape, width: undefined, height: undefined })}
          onSetColor={({ fill, stroke }) => selectionInfo.applyPatch?.({ fill, stroke })}
          onSetFontSize={(fontSize) => selectionInfo.applyPatch?.({ fontSize })}
          onSetFontFamily={(fontFamily) => selectionInfo.applyPatch?.({ fontFamily })}
          onSetConnector={(patch) => selectionInfo.applyPatch?.(patch)}
        />

        {/* Avatar bottom-right (decorative, matches reference) */}
        <div className="absolute bottom-7 right-7 z-30 pointer-events-none">
          <div
            className="w-16 h-16 rounded-full neon-ring overflow-hidden"
            style={{ background: "#0a0f24" }}
            data-testid="cosmic-avatar"
          >
            <svg viewBox="0 0 64 64" className="w-full h-full">
              <defs>
                <radialGradient id="ag" cx="50%" cy="40%" r="60%">
                  <stop offset="0" stopColor="#36e6ff" />
                  <stop offset="1" stopColor="#0a0f24" />
                </radialGradient>
              </defs>
              <rect width="64" height="64" fill="url(#ag)" />
              <circle cx="32" cy="26" r="10" fill="#0a0f24" />
              <path d="M14 56 C 18 42, 46 42, 50 56 Z" fill="#0a0f24" />
            </svg>
          </div>
        </div>
      </main>

      {/* DIALOGS */}
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      <RenewWall
        open={!!renewAction}
        action={renewAction}
        onClose={() => setRenewAction(null)}
        onUpgrade={() => setUpgradeOpen(true)}
        onSignIn={signIn}
      />
      <FounderWelcome user={user} />
      {stuckSession && (
        <div
          data-testid="stripe-rescue-banner"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] rounded-xl border border-amber-400/40 bg-[#1a1404] px-4 py-3 shadow-[0_10px_30px_rgba(255,180,0,0.18)]"
        >
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80 mb-1">
            Payment taking a moment
          </div>
          <div className="text-[13px] text-[#f0e6cc] leading-snug">
            We haven&apos;t heard back from Stripe yet. If you completed checkout, we can verify it manually — you&apos;ll be Pro within 24 hours.
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              data-testid="stripe-rescue-contact"
              onClick={requestStripeRescue}
              disabled={rescuing}
              className="mono text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-md bg-amber-400 text-[#1a1404] font-semibold hover:bg-amber-300 disabled:opacity-60"
            >
              {rescuing ? "Sending…" : "Contact support"}
            </button>
            <button
              data-testid="stripe-rescue-dismiss"
              onClick={() => setStuckSession(null)}
              className="mono text-[10px] uppercase tracking-[0.18em] px-2 py-1.5 text-[#a5967a] hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <ShareDialog
        open={shareOpen}
        map={active}
        onClose={() => setShareOpen(false)}
        onOpenShareCard={() => setShareCardOpen(true)}
      />
      <ResearchProgressOverlay
        open={researchOpen}
        phase={researchPhase}
        branches={researchBranches}
        onCancel={() => { researchAbortRef.current?.abort(); setResearchOpen(false); }}
        onShare={() => { setResearchOpen(false); setShareCardOpen(true); }}
      />
      <ShareCardDialog
        open={shareCardOpen}
        map={active}
        shareSlug={active ? (JSON.parse(localStorage.getItem("mindmapper.shares.v1") || "{}")[active.id] || null) : null}
        onClose={() => setShareCardOpen(false)}
      />

      <CommandPalette
        open={paletteOpen}
        maps={maps}
        onClose={() => setPaletteOpen(false)}
        onPickMap={(id) => {
          handlePickMap(id);
          setPaletteOpen(false);
        }}
        onPickNode={(mapId, nodeId) => {
          if (mapId !== activeId) {
            addToRecents(mapId);
            setActiveId(mapId);
          }
          setFocusNodeId(nodeId);
          setPaletteOpen(false);
        }}
      />

      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />

      {todoOpen && (
        <TodoModal
          maps={maps}
          activeId={activeId}
          onClose={() => setTodoOpen(false)}
          onJumpToMap={(id) => { handlePickMap(id); setTodoOpen(false); }}
          onToggle={(mapId, stickyId) => {
            const m = getMap(mapId);
            if (!m) return;
            const next = {
              ...m,
              annotations: (m.annotations || []).map((a) =>
                a.id === stickyId ? { ...a, done: !a.done } : a
              ),
            };
            saveMap(next);
            refresh();
          }}
        />
      )}

      <BookmarksImportModal
        open={bookmarksOpen}
        onClose={() => setBookmarksOpen(false)}
        onImported={(saved) => {
          refresh();
          setActiveId(saved.id);
        }}
      />


      {openOpen && (
        <ModalShell title={t("studio.modals.openMap")} onClose={() => setOpenOpen(false)} testid="open-modal" wide>
          {maps.length === 0 ? (
            <div className="text-[#7a87ad] py-10 text-center">
              {t("studio.modals.noMapsYet")} <span className="text-cyan-300">{t("studio.modals.noMapsYetCta")}</span> {t("studio.modals.noMapsYetAfter")}
            </div>
          ) : (() => {
            const mapsById = new Map(maps.map((m) => [m.id, m]));
            const recentIds = getRecents().filter((id) => mapsById.has(id)).slice(0, 3);
            const recentMaps = recentIds.map((id) => mapsById.get(id));
            const recentSet = new Set(recentIds);
            const restMaps = maps.filter((m) => !recentSet.has(m.id));
            return (
              <div className="max-h-[72vh] overflow-auto pr-1">
                {recentMaps.length > 0 && (
                  <div className="mb-5" data-testid="open-recents">
                    <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-2.5">
                      {t("studio.modals.recentlyOpened")}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {recentMaps.map((m) => (
                        <MapCard
                          key={m.id}
                          map={m}
                          isActive={m.id === activeId}
                          featured
                          onOpen={() => handlePickMap(m.id)}
                          onDuplicate={() => handleDuplicateMap(m.id)}
                          onDelete={() => handleDeleteMap(m.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {restMaps.length > 0 && (
                  <div>
                    {recentMaps.length > 0 && (
                      <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mb-2.5">
                        {t("studio.modals.allMaps")}
                      </div>
                    )}
                    <div
                      data-testid="open-grid"
                      className="grid grid-cols-2 md:grid-cols-3 gap-3"
                    >
                      {restMaps.map((m) => (
                        <MapCard
                          key={m.id}
                          map={m}
                          isActive={m.id === activeId}
                          onOpen={() => handlePickMap(m.id)}
                          onDuplicate={() => handleDuplicateMap(m.id)}
                          onDelete={() => handleDeleteMap(m.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </ModalShell>
      )}

      {searchOpen && (
        <ModalShell title={t("studio.modals.globalSearch")} onClose={() => setSearchOpen(false)} testid="search-modal">
          <input
            data-testid="search-input"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("studio.modals.searchPlaceholder")}
            className="w-full bg-[#0a0f24] border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-cyan-400/60 text-white"
          />
          <div className="mt-4 max-h-[55vh] overflow-auto">
            {searchQuery.trim() === "" ? (
              <div className="text-[#7a87ad] text-sm py-4">
                {t("studio.modals.searchHint")}
              </div>
            ) : searchHits.length === 0 ? (
              <div className="text-[#7a87ad] text-sm py-4">{t("studio.modals.searchNoMatches")}</div>
            ) : (
              searchHits.map(({ map, matches }) => (
                <div key={map.id} className="mb-5">
                  <button
                    onClick={() => { setActiveId(map.id); setSearchOpen(false); }}
                    className="text-cyan-300 mono text-[11px] uppercase tracking-[0.2em] mb-2 hover:underline"
                    data-testid={`search-map-${map.id}`}
                  >
                    {map.title}
                  </button>
                  <ul className="space-y-1.5 ml-1">
                    {matches.slice(0, 6).map((hit, i) => (
                      <li key={i} className="text-sm text-[#cfdaf3]">
                        <span className="text-[#566187] mono text-[11px]">›</span>{" "}
                        {hit.path.join(" / ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </ModalShell>
      )}

      {settingsOpen && (
        <ModalShell title="Settings" onClose={() => setSettingsOpen(false)} testid="settings-modal">
          <div className="space-y-4 text-[14px] text-[#cfdaf3]">
            <ApiKeySection />
            <ResearchSettings />
            <LexisNexisSettings />
            <AffiliateSettings />
            <div className="h-px bg-white/5 my-2" />
            <SettingRow label="Storage" value="Browser local-storage (zero cloud)" />
            <SettingRow label="PDF · Local mode" value="pypdf · outline + heading scan" />
            <SettingRow label="PDF · AI mode" value="Claude / OpenAI / Gemini (your key or shared)" />
            <SettingRow label="Saved maps" value={`${maps.length}`} />
            {/* Recording / demo helper — wipe local maps and re-seed the
                "How to use" + welcome + guide trio. Confirms before wiping. */}
            <div className="pt-3 mt-2 border-t border-white/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80">
                    Reset demo data
                  </div>
                  <div className="text-[12px] text-[#9aa7c7] mt-1 leading-relaxed">
                    Wipes all local maps and restores the curated "How to use" tutorials.
                    Useful between video recording takes.
                  </div>
                </div>
                <button
                  data-testid="settings-reset-demo"
                  onClick={() => {
                    const n = maps.length;
                    if (!window.confirm(
                      `Wipe all ${n} map${n === 1 ? "" : "s"} and restore the demo seeds?\n\nThis CANNOT be undone.`
                    )) return;
                    try {
                      const seeded = resetDemoData();
                      setActiveId(null);
                      refresh();
                      setSettingsOpen(false);
                      toast.success(`Demo reset — ${seeded} maps restored`);
                    } catch (err) {
                      console.error(err);
                      toast.error("Couldn't reset demo data");
                    }
                  }}
                  className="shrink-0 mono text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-full border border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-400/10 hover:border-fuchsia-400 transition"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="pt-3 border-t border-white/5 text-[#7a87ad] mono text-[11px] uppercase tracking-[0.2em]">
              Made for the relentless researcher.
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}


const MapCard = ({ map, isActive, onOpen, onDuplicate, onDelete, featured = false }) => {
  const thumbnail = React.useMemo(() => {
    try {
      return buildMapThumbnail(map);
    } catch {
      return null;
    }
  }, [map]);

  const branches = (map.children || []).length;
  const updated = new Date(map.updatedAt || map.createdAt || Date.now());

  return (
    <div
      data-testid={`open-card-${map.id}`}
      className={`group relative rounded-xl border overflow-hidden transition-all cursor-pointer ${
        isActive
          ? "border-cyan-400/70 shadow-[0_0_16px_rgba(0,240,255,0.25)]"
          : "border-white/10 hover:border-cyan-400/50 hover:shadow-[0_0_12px_rgba(0,240,255,0.18)]"
      }`}
      style={{ background: "rgba(4,8,20,0.6)" }}
      onClick={onOpen}
    >
      {/* Thumbnail */}
      <div
        className={`relative ${featured ? "aspect-[16/9]" : "aspect-[16/10]"} overflow-hidden bg-[#03040a]`}
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
        {isActive && (
          <div
            className="absolute top-2 left-2 mono text-[9px] uppercase tracking-[0.22em] px-2 py-[3px] rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-400/50"
            data-testid={`open-card-active-${map.id}`}
          >
            Open now
          </div>
        )}

        {/* Hover actions overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            data-testid={`open-card-duplicate-${map.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="w-7 h-7 rounded-md grid place-items-center bg-[#0a0f24]/90 border border-white/10 text-[#9aaad0] hover:text-cyan-300 hover:border-cyan-400/60"
            title="Duplicate"
          >
            <Copy size={13} />
          </button>
          <button
            data-testid={`open-card-delete-${map.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-7 h-7 rounded-md grid place-items-center bg-[#0a0f24]/90 border border-white/10 text-[#9aaad0] hover:text-red-400 hover:border-red-400/60"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="px-3 py-2.5">
        <div className="text-[13px] text-white font-medium truncate" title={map.title}>
          {map.title || "Untitled"}
        </div>
        <div className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] mt-1">
          {branches} {branches === 1 ? "branch" : "branches"} · {updated.toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};


const SidebarIcon = ({ children, label, onClick, testid, disabled }) => (
  <button
    data-testid={testid}
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={`w-10 h-10 rounded-lg grid place-items-center text-[#7a87ad] transition ${
      disabled ? "opacity-40 cursor-not-allowed" : "hover:text-cyan-300 hover:bg-cyan-500/5 hover:shadow-[0_0_12px_rgba(0,240,255,0.25)]"
    }`}
  >
    {children}
  </button>
);

const UserBadge = ({ user, onSignIn, onSignOut, onUpgrade }) => {
  const { t } = useTranslation();
  const [openingPortal, setOpeningPortal] = useState(false);
  const openBillingPortal = async () => {
    if (openingPortal) return;
    setOpeningPortal(true);
    try {
      const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
      const { default: axios } = await import("axios");
      const r = await axios.post(`${API}/billing/portal`, {}, { withCredentials: true });
      if (r.data?.url) {
        window.location.href = r.data.url;
        return;
      }
      toast.error(t("studio.userBadge.portalUnavailable"));
    } catch (e) {
      const msg = e?.response?.data?.detail || t("studio.userBadge.portalUnavailable");
      toast.error(msg);
    } finally {
      setOpeningPortal(false);
    }
  };
  if (!user) {
    return (
      <button
        data-testid="auth-signin-btn"
        onClick={onSignIn}
        className="cta-ghost text-xs"
      >
        {t("studio.userBadge.signIn")}
      </button>
    );
  }
  const isPro = user.subscription_status === "active" || user.subscription_status === "trialing";
  const remaining = Math.max(0, 3 - (user.free_conversions_used || 0));
  return (
    <div className="flex items-center gap-2" data-testid="user-badge">
      {!isPro && (
        <button
          data-testid="upgrade-btn"
          onClick={onUpgrade}
          className="mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-full bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/40 hover:bg-fuchsia-500/25 transition"
        >
          {remaining > 0 ? t("studio.userBadge.upgradeWithFree", { remaining }) : t("studio.userBadge.upgradeToPro")}
        </button>
      )}
      {isPro && (
        <>
          <SyncBadge />
          {user.founder ? (
            <div className="inline-flex items-center gap-1">
              <span
                data-testid="founder-badge"
                title={`VIP Founder #${user.founder_number} — lifetime access + early features`}
                className="mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-full text-amber-950 font-semibold border border-amber-300"
                style={{
                  background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 50%, #d97706 100%)",
                  boxShadow: "0 0 14px rgba(245,158,11,0.45), inset 0 0 8px rgba(255,255,255,0.25)",
                }}
              >
                ★ Founder #{user.founder_number}
              </span>
              <button
                data-testid="founder-share-btn"
                title="Share on X"
                onClick={() => {
                  const text = "I just became a Founder on marvex.app — the mind-map tool that turns any PDF into a knowledge graph in 60 seconds 🧠✨";
                  const url = "https://marvex.app";
                  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                  window.open(tweetUrl, "_blank", "noopener,width=550,height=420");
                }}
                className="w-7 h-7 rounded-full grid place-items-center text-amber-200 hover:text-amber-100 hover:bg-amber-500/15 transition"
              >
                <Share2 size={13} />
              </button>
            </div>
          ) : (
            <span className="mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/40">
              {t("studio.userBadge.pro")} {user.subscription_status === "trialing" ? t("studio.userBadge.trial") : ""}
            </span>
          )}
        </>
      )}
      {isPro && (
        <a
          data-testid="affiliate-link-btn"
          href="/affiliate"
          title="View your referral link, commission, and recent referrals"
          className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-full bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-400/30 hover:bg-fuchsia-500/20 hover:border-fuchsia-400/60 transition"
        >
          <Sparkles size={11} />
          Affiliate
        </a>
      )}
      {isPro && (
        <button
          data-testid="manage-subscription-btn"
          onClick={openBillingPortal}
          disabled={openingPortal}
          title={t("studio.userBadge.manageSubscriptionHint")}
          className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-full bg-cyan-500/10 text-cyan-200 border border-cyan-400/30 hover:bg-cyan-500/20 hover:border-cyan-400/60 transition disabled:opacity-50"
        >
          {openingPortal ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />}
          {t("studio.userBadge.manageSubscription")}
        </button>
      )}
      {!!(user.addons && user.addons.premium_uk_law && user.addons.premium_uk_law.active) && (
        <a
          data-testid="premium-uk-law-badge"
          href="/intake?corpus=open"
          title="Premium UK Law unlocked — BAILII full-text + LexisNexis BYOK + AI case summaries. Click to open the corpus browser."
          className="inline-flex items-center gap-1 mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-full bg-gradient-to-br from-amber-500/15 to-fuchsia-500/10 text-amber-200 border border-amber-400/40 hover:from-amber-500/25 hover:to-fuchsia-500/15 hover:border-amber-300/70 transition"
        >
          <span aria-hidden="true">⚖</span>
          Premium ✦
        </a>
      )}
      <div
        title={user.email}
        className={`w-8 h-8 rounded-full overflow-hidden grid place-items-center ${
          user.founder ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-[#03040a]" : "border border-cyan-400/40"
        } bg-[#0a0f24]`}
        style={user.founder ? { boxShadow: "0 0 12px rgba(245,158,11,0.55)" } : undefined}
      >
        {user.picture ? (
          <img src={user.picture} alt={`${user.name || "Marvex Studio user"} profile picture`} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[12px] font-bold text-cyan-300">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <button
        data-testid="auth-signout-btn"
        onClick={onSignOut}
        title={t("studio.userBadge.signOutHint")}
        className="text-[#7a87ad] hover:text-cyan-300 text-[11px] mono uppercase tracking-[0.18em] px-2 py-1 rounded hover:bg-white/5 transition"
      >
        {t("studio.userBadge.signOutLabel")}
      </button>
    </div>
  );
};

const ModalShell = ({ title, children, onClose, testid, wide }) => (
  <div data-testid={testid} className="fixed inset-0 z-50 grid place-items-center px-4" style={{ background: "rgba(3,4,10,0.7)", backdropFilter: "blur(8px)" }}>
    <div className={`w-full ${wide ? "max-w-4xl" : "max-w-2xl"} glass-panel rounded-2xl p-6 fade-up`} style={{ borderColor: "rgba(0,240,255,0.18)" }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5" data-testid="modal-close">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const SettingRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5">
    <span className="text-[#7a87ad] mono text-[11px] uppercase tracking-[0.2em]">{label}</span>
    <span className="text-cyan-200">{value}</span>
  </div>
);

/**
 * Compact top-bar chip that surfaces BYOK status with one click to open
 * Settings. Fuchsia + pulsing dot when no key set → gets users to add one;
 * cyan + steady dot when a key is configured. Empty when the user is mid-
 * Settings panel already.
 */
const ApiKeyStatusChip = ({ onClick }) => {
  const [entry, setEntry] = useState(() => getApiKey());
  useEffect(() => {
    const refresh = () => setEntry(getApiKey());
    window.addEventListener("storage", refresh);
    window.addEventListener("mindmapper:apikey-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("mindmapper:apikey-changed", refresh);
    };
  }, []);
  const has = !!entry?.provider;
  return (
    <button
      data-testid="api-key-status-chip"
      onClick={onClick}
      title={has ? `Using your ${entry.provider} key` : "Add your AI API key to unlock unlimited usage"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 mono text-[10px] uppercase tracking-[0.18em] transition border ${
        has
          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-400/15"
          : "border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-200 hover:border-fuchsia-400 hover:bg-fuchsia-400/15"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${has ? "bg-cyan-300" : "bg-fuchsia-300 animate-pulse"}`}
      />
      {has ? `Your ${entry.provider}` : "Add AI key"}
    </button>
  );
};

const ApiKeySection = () => {
  const [entry, setEntry] = useState(() => getApiKey());
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState(entry?.provider || "anthropic");
  const [keyValue, setKeyValue] = useState("");

  const providers = getProviders();

  const save = () => {
    const trimmed = (keyValue || "").trim();
    if (!trimmed) {
      toast.error("Paste a key first");
      return;
    }
    const saved = setApiKey({ provider, key: trimmed });
    setEntry(saved);
    setEditing(false);
    setKeyValue("");
    window.dispatchEvent(new CustomEvent("mindmapper:apikey-changed"));
    toast.success("API key saved locally");
  };

  const remove = () => {
    clearApiKey();
    setEntry(null);
    setKeyValue("");
    window.dispatchEvent(new CustomEvent("mindmapper:apikey-changed"));
    toast("API key removed");
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">
            Your AI API Key
          </div>
          <div className="text-[13px] text-[#cfdaf3] font-medium">
            Bring your own key · zero cost to the app
          </div>
        </div>
        {entry ? (
          <span className="mono text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Active
          </span>
        ) : (
          <span className="mono text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded bg-[#0a0f24] text-[#7a87ad] border border-white/10">
            Not set
          </span>
        )}
      </div>

      <p className="text-[12px] text-[#7a87ad] leading-relaxed mb-3">
        When set, every AI call (PDF conversion, Research, enrichment) hits your
        provider directly and bills to <span className="text-cyan-300">your own account</span>.
        We never see the key. Stored only in this browser — nothing on our servers.
      </p>

      {/* Empty state — show the four provider cards with direct sign-up links */}
      {!entry && !editing && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3" data-testid="api-key-provider-grid">
            {providers.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 mb-1">
                  {p.name}
                </div>
                <div className="text-[11px] text-[#9aaad0] leading-snug mb-2 min-h-[2.5rem]">
                  {p.hint}
                </div>
                <a
                  href={p.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`api-key-signup-${p.id}`}
                  className="inline-flex items-center gap-1 mono text-[10px] uppercase tracking-[0.18em] text-fuchsia-300 hover:text-fuchsia-200"
                >
                  {p.label} <ExternalLink size={10} />
                </a>
              </div>
            ))}
          </div>
          {/* Galaxy.ai tip — for users who'd rather not manage API keys */}
          <a
            href={process.env.REACT_APP_GALAXYAI_URL || "https://galaxy.ai/"}
            target="_blank"
            rel="noopener noreferrer sponsored"
            data-testid="api-key-galaxy-tip"
            onClick={() => track("affiliate_click", {
              tool: "Galaxy.ai",
              location: "studio_byok_tip",
              affiliate: true,
            })}
            className="block rounded-md border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.08] to-fuchsia-500/[0.05] p-3 mb-3 hover:border-amber-300/60 transition group"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg grid place-items-center bg-amber-500/15 border border-amber-400/40 text-amber-200 group-hover:scale-105 transition-transform">
                <Sparkles size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mono text-[9px] uppercase tracking-[0.22em] text-amber-300/90 mb-1">
                  Don&apos;t want to manage API keys?
                </div>
                <div className="text-[12px] text-[#cfdaf3] leading-snug">
                  <span className="font-semibold text-amber-100">Galaxy.ai</span> — one
                  flat-rate subscription, every model (GPT-5, Claude, Gemini, Grok). Cheaper
                  than ChatGPT Plus + Claude Pro combined.
                </div>
                <span className="inline-flex items-center gap-1 mt-1.5 mono text-[10px] uppercase tracking-[0.18em] text-amber-300 group-hover:text-amber-200">
                  Try Galaxy.ai <ExternalLink size={10} />
                </span>
              </div>
            </div>
          </a>
        </>
      )}

      {entry && !editing && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-md bg-[#0a0f24] border border-white/10">
          <div className="flex items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
              {providers.find((p) => p.id === entry.provider)?.name || entry.provider}
            </span>
            <span className="mono text-[11px] text-[#9aaad0]" data-testid="api-key-mask">
              {maskKey(entry.key)}
            </span>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-2 mb-3">
          <select
            data-testid="api-key-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            data-testid="api-key-input"
            type="password"
            autoComplete="off"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={`Paste your ${providers.find((p) => p.id === provider)?.name || ""} key`}
            className="w-full bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white placeholder-[#566187]"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        {!editing && !entry && (
          <button
            data-testid="api-key-add"
            onClick={() => setEditing(true)}
            className="cta-ghost text-sm"
          >
            Add a key
          </button>
        )}
        {!editing && entry && (
          <>
            <button
              data-testid="api-key-replace"
              onClick={() => { setEditing(true); setProvider(entry.provider); }}
              className="cta-ghost text-sm"
            >
              Replace
            </button>
            <button
              data-testid="api-key-remove"
              onClick={remove}
              className="text-sm px-4 py-2 rounded-full border border-red-500/40 text-red-300 hover:bg-red-500/10 transition"
            >
              Remove
            </button>
          </>
        )}
        {editing && (
          <>
            <button
              data-testid="api-key-save"
              onClick={save}
              className="cta-pill text-sm"
            >
              Save locally
            </button>
            <button
              onClick={() => { setEditing(false); setKeyValue(""); }}
              className="cta-ghost text-sm"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      <div className="mt-3 text-[11px] text-[#566187] leading-relaxed">
        Get a key: <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">Anthropic</a>
        {" · "}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">OpenAI</a>
        {" · "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">Google AI Studio</a>
      </div>
    </div>
  );
};

const EmptyState = ({ onNew, onPdf }) => {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 grid place-items-center px-6">
      <div className="text-center max-w-lg">
        <div className="mb-7 flex justify-center"><Logo size={88} /></div>
        <h2 className="text-3xl md:text-4xl font-bold mb-3">{t("studio.empty.title")}</h2>
        <p className="text-[#9aaad0] mb-8">
          {t("studio.empty.body")}
        </p>
        <div className="flex items-center gap-3 justify-center">
          <button onClick={onPdf} className="cta-pill text-sm" data-testid="empty-pdf-btn">
            <Sparkles size={14} /> {t("studio.empty.cta")}
          </button>
        </div>
      </div>
    </div>
  );
};

const TodoModal = ({ maps, activeId, onClose, onJumpToMap, onToggle }) => {
  const { t } = useTranslation();
  // Aggregate all stickies across maps
  const allStickies = maps.flatMap((m) =>
    (m.annotations || [])
      .filter((a) => a.type === "sticky")
      .map((a) => ({ ...a, mapId: m.id, mapTitle: m.title || t("common.untitled") }))
  );
  const open = allStickies.filter((a) => !a.done);
  const done = allStickies.filter((a) => a.done);

  return (
    <div
      data-testid="todo-modal"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl glass-panel rounded-2xl p-6 fade-up max-h-[82vh] overflow-auto"
        style={{ borderColor: "rgba(253,233,146,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#fde992]/80">{t("studio.todo.eyebrow")}</div>
            <h3 className="text-xl font-semibold text-white mt-1">{t("studio.todo.title")}</h3>
            <p className="text-[12px] text-[#7a87ad] mt-1">
              {t("studio.todo.stats", { open: open.length, done: done.length })}
            </p>
          </div>
          <button
            data-testid="todo-close"
            onClick={onClose}
            className="text-[#7a87ad] hover:text-white transition"
          >
            {t("common.close")}
          </button>
        </div>

        {allStickies.length === 0 ? (
          <div className="py-12 text-center text-[#7a87ad]">
            {t("studio.todo.emptyBody")}
          </div>
        ) : (
          <>
            <TodoSection title={t("studio.todo.sectionOpen")} items={open} activeId={activeId} onJumpToMap={onJumpToMap} onToggle={onToggle} />
            {done.length > 0 && (
              <TodoSection title={t("studio.todo.sectionDone")} items={done} activeId={activeId} onJumpToMap={onJumpToMap} onToggle={onToggle} dimmed />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const TodoSection = ({ title, items, activeId, onJumpToMap, onToggle, dimmed }) => {
  const { t } = useTranslation();
  return (
    <div className={`mt-4 ${dimmed ? "opacity-70" : ""}`}>
      <div className="mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70 mb-2">{title}</div>
      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={`${it.mapId}_${it.id}`}
            data-testid={`todo-row-${it.id}`}
            className="flex items-start gap-3 p-3 rounded-lg border border-white/5 hover:border-cyan-400/30 transition bg-white/[0.02]"
          >
            <button
              data-testid={`todo-toggle-${it.id}`}
              onClick={() => onToggle(it.mapId, it.id)}
              className={`w-5 h-5 mt-0.5 rounded-sm border-2 grid place-items-center shrink-0 transition ${
                it.done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "border-[#fde992]/70 hover:bg-[#fde992]/20"
              }`}
            >
              {it.done && "✓"}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-[14px] text-white whitespace-pre-wrap break-words ${it.done ? "line-through opacity-60" : ""}`}>
                {it.text || <span className="opacity-40">(empty)</span>}
              </div>
              <button
                onClick={() => onJumpToMap(it.mapId)}
                className={`mt-1 mono text-[9px] uppercase tracking-[0.18em] transition ${
                  it.mapId === activeId
                    ? "text-cyan-300/70"
                    : "text-[#7a87ad] hover:text-cyan-300"
                }`}
              >
                {it.mapTitle}{it.mapId === activeId ? ` ${t("studio.todo.currentMap")}` : ` ${t("studio.todo.jumpToMap")}`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


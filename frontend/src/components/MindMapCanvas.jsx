import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Keyboard } from "lucide-react";
import { toast } from "sonner";
import ContextMenu, { SHAPE_PALETTE } from "@/components/ContextMenu";
import AnnotationsLayer from "@/components/AnnotationsLayer";
import ClipartPicker from "@/components/ClipartLibrary";
import CompileDocumentDialog from "@/components/CompileDocumentDialog";
import { resolveBackground } from "@/lib/backgrounds";
import { compressImage } from "@/lib/imageCompress";
import { maybeTagAmazonUrl, buildBookLink } from "@/lib/affiliates";
import usePanZoom from "@/components/mindmap/hooks/usePanZoom";
import useCanvasDrag from "@/components/mindmap/hooks/useCanvasDrag";
import useCanvasHotkeys from "@/components/mindmap/hooks/useCanvasHotkeys";
import useSelection from "@/components/mindmap/hooks/useSelection";
import useEditing from "@/components/mindmap/hooks/useEditing";
import useContextMenu from "@/components/mindmap/hooks/useContextMenu";
import useNodeCrud from "@/components/mindmap/hooks/useNodeCrud";
import useClipboard from "@/components/mindmap/hooks/useClipboard";
import useExportHandlers from "@/components/mindmap/hooks/useExportHandlers";
import IconPicker from "@/components/IconPicker";
import BookmarkPickerModal from "@/components/BookmarkPickerModal";
import { openLink as openLinkExternally } from "@/lib/openLink";
import { useNavigate } from "react-router-dom";
import { blankTimeline, saveTimeline } from "@/lib/timelineStorage";
import TimelineCreateDialog from "@/components/timeline/TimelineCreateDialog";
import { useLicense } from "@/lib/license";

import {
  computeLayout,
  walk,
  findAndUpdate,
  newNodeId,
} from "@/components/mindmap/lib/tree";
import { CtrlBtn } from "@/components/mindmap/render/Buttons";
import ShortcutsOverlay from "@/components/mindmap/render/ShortcutsOverlay";
import LinkDialog from "@/components/mindmap/render/LinkDialog";
import TopToolbar from "@/components/mindmap/render/TopToolbar";
import MapEdges from "@/components/mindmap/render/MapEdges";
import CanvasContextMenu from "@/components/mindmap/render/CanvasContextMenu";
import MapNode from "@/components/mindmap/render/MapNode";
import FreeCapNudge from "@/components/mindmap/render/FreeCapNudge";
import { FREE_NODE_CAP } from "@/components/mindmap/constants";
import { usePrivacyMode } from "@/lib/privacyMode";
import { downloadMmap } from "@/lib/mapFile";

/**
 * Normalise a user-entered link string.
 * Accepts: https://x, http://x, x.com (→ https://x.com), user@host (→ mailto:), file:// paths, /abs paths.
 */
const normalizeLink = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  let url;
  if (/^[a-z]+:/i.test(s)) url = s; // already has scheme
  else if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(s)) url = `mailto:${s}`;
  else if (/^\//.test(s)) url = `file://${s}`;
  else if (/^[A-Za-z]:[\\/]/.test(s)) url = `file:///${s.replace(/\\/g, "/")}`; // windows
  else url = `https://${s}`;
  // Auto-append the user's Amazon Associates tag when applicable.
  return maybeTagAmazonUrl(url);
};

const linkKind = (link) => {
  if (!link) return "";
  if (/^data:/i.test(link)) return "file";
  if (/^mailto:/i.test(link)) return "email";
  if (/^file:/i.test(link)) return "file";
  return "web";
};

/**
 * Interactive mind-map canvas.
 * Features: radial layout · pan/zoom · node drag/resize · edge selection · in-place rename ·
 * per-node shape/color/font customisation · per-edge color/width/style · context menu on right-click.
 *
 * Node fields (all optional, sensible defaults applied):
 *   id, title, summary, children[], shape, fill, stroke, fontSize, fontFamily, width, height,
 *   edgeStyle: { color, width, dashed }   (styles the line coming INTO this node)
 */

// Constants, helpers (sizeOf, computeLayout, walk, findAndUpdate,
// findAndRemove, newNodeId) and the ShapeSvg renderer all live in
// `@/components/mindmap/{constants,lib/tree,render/ShapeSvg}` — imported
// at the top of this file.

export default function MindMapCanvas({
  map,
  onChange,
  isPro = false,
  isProOnly = false,
  nodeCap = Infinity,
  onUpgrade,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onExportJson,
  saveTick = 0,
  focusNodeId = null,
  onFocusConsumed,
  onResearch,
  onDeepen,
  onDeepResearch,
  readOnly = false,
  // When true, the per-node + menu shows the flowchart shape palette
  // (Process / Decision / Start-End / I/O / etc.) instead of the
  // generic Add-child / Add-sibling row. Driven by FlowchartStudio.
  flowchartMode = false,
  // Optional: notify the parent (Studio) when the active selection changes,
  // so it can render the right-side properties panel.  Payload shape:
  //   { type: 'node'|'annotation'|null, id, data }
  onSelectionChange,
}) {
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Router instance — used by the link helper to deep-link PDFs into the
  // internal Reader (`/read?src=…`) instead of opening them externally.
  const navigate = useNavigate();
  // License — gates the "Insert Timeline" toolbar action behind Pro+.
  const license = useLicense();

  // Selection (node + edge) — extracted hook.
  const {
    selected, selectedEdge,
    setSelected, setSelectedEdge,
    selectNode, selectEdge, clearSelection,
  } = useSelection();

  // Inline text editing — extracted hook.
  const { editing, setEditing, editInputRef, commitEdit } = useEditing({
    map, onChange, findAndUpdate,
  });

  // Context menu (node / edge) — extracted hook.
  const { menu, setMenu, openNodeMenu, openEdgeMenu, closeMenu } = useContextMenu({
    selectNode, selectEdge, readOnly,
  });

  // "Saved" flash indicator (blinks on each successful save)
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (saveTick === 0) return;
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 1200);
    return () => clearTimeout(t);
  }, [saveTick]);

  // Toolbar shape-picker dropdown
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  // Toolbar background-picker popover
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  // Cloud-save popover (save to Google Drive)
  const [cloudSaveOpen, setCloudSaveOpen] = useState(false);
  // Toolbar orientation toggle — persists across reloads. Keep as a string
  // ("h"|"v") so the localStorage value is human-readable in DevTools.
  const [toolbarOrient, setToolbarOrient] = useState(() => {
    try { return localStorage.getItem("mm.topToolbarOrient") === "v" ? "v" : "h"; } catch { return "h"; }
  });
  useEffect(() => {
    try { localStorage.setItem("mm.topToolbarOrient", toolbarOrient); } catch {}
  }, [toolbarOrient]);
  const privacyOn = usePrivacyMode();
  // Latest-map ref — used by event handlers (arrow-key nudge etc.) that
  // need to read the freshest map state when rapid keystrokes fire faster
  // than React re-renders. Without this, closures over `map` go stale
  // between presses and only the last write survives.
  const mapRef = useRef(map);
  useEffect(() => { mapRef.current = map; }, [map]);
  // Same trick for `selected` — needed by the shift-click handler so the
  // setMultiSelected functional updater reads the LATEST selection (not the
  // value captured when the previous render happened to bind onClick).
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Link editor dialog (node linking)
  const [linkDialog, setLinkDialog] = useState(null); // { nodeId, initial }
  const [iconPickerNode, setIconPickerNode] = useState(null); // nodeId | null
  // Bookmark picker modal. When open, we know which nodeId was right-clicked
  // so we can attach the picked bookmark (url + title) as that node's link.
  const [bookmarkPickerNode, setBookmarkPickerNode] = useState(null); // nodeId | null
  // Clipart picker modal (open/closed). When the user picks an icon we drop
  // it as a `clipart` annotation at the canvas centre.
  const [clipartOpen, setClipartOpen] = useState(false);
  // Compile-to-document dialog state. `compileSrc` carries the (sub)tree to
  // pass to the LLM plus a "source" enum so the dialog header reads right
  // ("Whole map" / "Branch + descendants" / "3 selected nodes").
  const [compileSrc, setCompileSrc] = useState(null);
  // Tell the parent (Studio) to hide the floating toolbar whenever a modal /
  // picker is on top of the canvas, so it doesn't obstruct clipart, compile,
  // icon-picker etc.
  useEffect(() => {
    const obstructing = !!compileSrc || clipartOpen;
    window.dispatchEvent(new CustomEvent("mindmapper:obstruction", { detail: { obstructing } }));
  }, [compileSrc, clipartOpen]);
  // Multi-select set — Shift/Cmd-click adds nodes & annotations to a join-pool.
  // We use a Set<string> wrapped in state so equality checks trigger renders.
  const [multiSelected, setMultiSelected] = useState(() => new Set());
  // Selected annotation id — drives resize-handle display in AnnotationsLayer.
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  // Canvas right-click "quick insert" mini menu state.
  // Set to {x, y} (screen coords) when active. Items inserted at canvas
  // centre rather than the cursor — keeps the code simple and predictable
  // (the user can drag the new item afterwards).
  const [canvasMenu, setCanvasMenu] = useState(null);
  // ---- Connection mode ----
  // Click-to-connect workflow: user clicks the "link" toolbar button → first
  // node click stores its centre as `connectFrom`; second node click drops a
  // connector annotation between the two centres and re-arms the mode for
  // chaining (Esc to exit). Faster than right-click → Insert line → drag.
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState(null); // { id } | null
  // Escape exits connect mode. Effect runs only when connectMode flips
  // (connectFrom intentionally NOT in deps to avoid re-subscribing on every
  // node-click).
  useEffect(() => {
    if (!connectMode) { setConnectFrom(null); return undefined; }
    const onKey = (e) => {
      if (e.key === "Escape") { setConnectMode(false); setConnectFrom(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connectMode]);
  const fileLinkInputRef = useRef(null);
  const fileLinkTargetRef = useRef(null); // nodeId being targeted by hidden file input

  // Window-level event bridge so the parent (Studio) can trigger Compile
  // without holding a ref to this component. The left-toolbar dispatches a
  // CustomEvent("mindmapper:compile") that we catch here.
  useEffect(() => {
    const handler = () => openCompileDialog("auto");
    window.addEventListener("mindmapper:compile", handler);
    return () => window.removeEventListener("mindmapper:compile", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, multiSelected]);

  // Keyboard: Delete / Backspace removes the active selection.  Skipped when
  // the focus is in an editable field so backspace inside a node title /
  // sticky textarea / search box behaves normally.  Honours readOnly.
  // Also: Ctrl/Cmd + X / C / V handle cut / copy / paste of nodes and
  // annotations using an in-memory clipboard.
  useEffect(() => {
    if (readOnly) return undefined;
    const onKey = (e) => {
      const t = e.target;
      const tag = (t?.tagName || "").toLowerCase();
      const inEditable = tag === "input" || tag === "textarea" || t?.isContentEditable;
      // Cut/Copy/Paste — Ctrl or Cmd + X / C / V.  Skip when the user is in
      // an editable field — let the browser do its native thing there.
      if ((e.ctrlKey || e.metaKey) && !inEditable && !editing) {
        const k = e.key.toLowerCase();
        if (k === "x") { e.preventDefault(); cutSelection();    return; }
        if (k === "c") { e.preventDefault(); copySelection();   return; }
        if (k === "v") { e.preventDefault(); pasteFromClipboard(); return; }
      }
      // Arrow keys nudge the active selection (single node, multi-select, or
      // annotation) by a small amount — Shift = bigger jump. Skipped when an
      // input/textarea has focus or the user is inline-editing a title.
      if (!inEditable && !editing &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
           e.key === "ArrowUp"   || e.key === "ArrowDown")) {
        const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
        const dy = e.key === "ArrowUp"   ? -1 : e.key === "ArrowDown"  ? 1 : 0;
        const step = e.shiftKey ? 25 : 6;
        // Annotation drag: most annotations live in their own list with
        // x,y. We only nudge if SOMETHING is selected.
        if (selectedAnnotation) {
          e.preventDefault();
          setAnnotations((arr) =>
            arr.map((a) => a.id === selectedAnnotation
              ? (a.type === "connector"
                  ? { ...a, x1: (a.x1 || 0) + dx * step, x2: (a.x2 || 0) + dx * step,
                              y1: (a.y1 || 0) + dy * step, y2: (a.y2 || 0) + dy * step }
                  : { ...a, x: (a.x || 0) + dx * step, y: (a.y || 0) + dy * step })
              : a)
          );
          return;
        }
        const ids = multiSelected.size > 0 ? [...multiSelected]
                  : (selected && selected !== map.id) ? [selected]
                  : [];
        if (ids.length === 0) return;
        e.preventDefault();
        // Read from mapRef.current (latest map) instead of the stale closure
        // — fixes the bug where rapid arrow presses all read the same
        // snapshot and only the last write survived.
        const cur = mapRef.current;
        const next = { ...cur, positions: { ...(cur.positions || {}) } };
        const layoutDefaults = computeLayout(cur);
        const merged = { ...layoutDefaults, ...(cur.positions || {}) };
        for (const id of ids) {
          const p = merged[id] || { x: 0, y: 0 };
          next.positions[id] = { x: p.x + dx * step, y: p.y + dy * step };
        }
        onChange(next);
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (inEditable) return;
      // Don't fire while inline-editing a node title.
      if (editing) return;
      // 1) Multi-selection wins — bulk delete every selected node.
      if (multiSelected.size > 0) {
        const ids = [...multiSelected];
        e.preventDefault();
        ids.forEach((id) => { if (id !== map.id && findNode(id)) removeNode(id); });
        setMultiSelected(new Set());
        return;
      }
      // 2) Then a single annotation.
      if (selectedAnnotation) {
        e.preventDefault();
        deleteAnnotation(selectedAnnotation);
        setSelectedAnnotation(null);
        return;
      }
      // 3) Then a single node — skip the root.
      if (selected && selected !== map.id) {
        e.preventDefault();
        removeNode(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, editing, multiSelected, selectedAnnotation, selected, map.id]);

  // Layout
  const positions = useMemo(() => {
    const defaults = computeLayout(map);
    return { ...defaults, ...(map.positions || {}) };
  }, [map]);

  // Pan / zoom / wheel / fit / focus-node — extracted hook.
  const { view, setView, resetView, zoomBy } = usePanZoom({
    containerRef,
    mapId: map.id,
    focusNodeId,
    positions,
    onFocusConsumed,
    setSelected,
    setSelectedEdge,
  });

  // Flat list w/ parent ref for edges
  const flat = useMemo(() => {
    const items = [];
    walk(map, (n, depth, parent) => items.push({ node: n, depth, parent }));
    return items;
  }, [map]);

  const findNode = useCallback((id) => {
    let hit = null;
    walk(map, (n) => { if (n.id === id) hit = n; });
    return hit;
  }, [map]);

  const findParent = useCallback((id) => {
    let hit = null;
    walk(map, (n, _d, parent) => { if (n.id === id) hit = parent; });
    return hit;
  }, [map]);

  // Drag / resize / bg-pan — extracted hook.
  const { onMouseDown, onMouseMove, onMouseUp, startNodeDrag, startResize, dragKind } = useCanvasDrag({
    map,
    onChange,
    view,
    setView,
    positions,
    setSelected,
    setSelectedEdge,
    setMenu,
    findAndUpdate,
    setMultiSelected,
    setSelectedAnnotation,
  });

  // --- CRUD — extracted hook ---
  const { countNodes, addChild, addSibling, removeNode, updateNode } = useNodeCrud({
    map,
    onChange,
    positions,
    nodeCap,
    onUpgrade,
    findNode,
    setSelected,
    setEditing,
  });

  // --- Keyboard shortcuts — extracted hook. ---
  useCanvasHotkeys({
    selected,
    editing,
    menu,
    shortcutsOpen,
    setShortcutsOpen,
    setMenu,
    setSelected,
    setSelectedEdge,
    setEditing,
    addChild,
    removeNode,
    rootId: map.id,
    openBookmarkPicker: (nodeId) => setBookmarkPickerNode(nodeId),
  });

  // --- Context menu action helpers ---
  const ctxNode = menu?.type === "node" ? findNode(menu.id) : null;
  const ctxEdgeChild = menu?.type === "edge" ? findNode(menu.id) : null;

  // --- Toolbar handlers ---
  const selectedNode = selected ? findNode(selected) : null;

  const handleToolbarShape = (shape) => {
    if (!selectedNode) return;
    const meta = SHAPE_PALETTE.find((s) => s.value === shape);
    if (meta?.pro && !isPro) {
      setShapePickerOpen(false);
      onUpgrade && onUpgrade();
      return;
    }
    updateNode(selected, (n) => {
      n.shape = shape;
      delete n.width;
      delete n.height;
    });
    setShapePickerOpen(false);
  };

  // Export handlers — extracted hook
  const {
    handleExportPng,
    handleExportHighResPng,
    handleExportSvg,
    handleExportMarkdown,
    handleExportPdf,
    handleScreenshot,
  } = useExportHandlers(map);

  const handleToolbarUndo = () => {
    if (!canUndo) return;
    onUndo && onUndo();
  };
  const handleToolbarRedo = () => {
    if (!canRedo) return;
    onRedo && onRedo();
  };

  // --- Link handlers ---
  const openNodeLink = (node) => {
    if (!node?.link) return;
    try {
      // Routes by type:
      //   • PDF (http or data:)  → internal Reader (/read?src=…)
      //   • Audio / video / docs → OS default app via shell.openPath
      //   • Websites             → user's default browser
      // See /app/frontend/src/lib/openLink.js for the full rule set.
      openLinkExternally(node.link, {
        label: node.linkLabel || node.title || "file",
        navigate,
      });
    } catch {
      toast.error("Could not open link");
    }
  };

  const openLinkDialog = (nodeId) => {
    const n = findNode(nodeId);
    setLinkDialog({ nodeId, initial: n?.link || "" });
  };

  const saveLink = (nodeId, value) => {
    const normalised = normalizeLink(value);
    updateNode(nodeId, (n) => {
      if (normalised) n.link = normalised;
      else delete n.link;
    });
    setLinkDialog(null);
    toast.success(normalised ? "Link attached" : "Link removed");
  };

  // Pick a bookmark from the user's previously-imported library and drop it
  // onto the target node. We copy BOTH the URL and the bookmark's title, so
  // the visible node text updates to match — this is the "insert bookmark"
  // gesture people mentally expect: tap bookmark → node becomes that
  // bookmark, no follow-up editing.
  const applyPickedBookmark = (nodeId, bookmark) => {
    if (!bookmark?.url) return;
    const normalised = normalizeLink(bookmark.url);
    if (!normalised) {
      toast.error("That bookmark's URL looks invalid");
      return;
    }
    updateNode(nodeId, (n) => {
      n.link = normalised;
      // Only overwrite the title if the current node is still blank or
      // placeholder-ish. Users who've renamed a node already shouldn't
      // suddenly see their text replaced.
      const placeholder = !n.title || /^(node|new node|untitled)$/i.test(n.title.trim());
      if (placeholder && bookmark.title) n.title = bookmark.title;
    });
    toast.success("Bookmark attached");
  };

  // --- Upload-as-link: store any file from the user's device on the node.
  // For images we keep the existing inline-on-canvas feature. This is for
  // *linking* (PDF, video, audio, generic doc) — the file becomes a clickable
  // link from the icon badge or node title.
  // Cap at 3MB to keep localStorage usable. For larger files, recommend
  // hosting on Drive/Dropbox and pasting a URL.
  const FILE_LINK_CAP_BYTES = 3 * 1024 * 1024;
  const triggerUpload = (nodeId) => {
    fileLinkTargetRef.current = nodeId;
    fileLinkInputRef.current?.click();
  };
  const onFileLinkPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again works
    const nodeId = fileLinkTargetRef.current;
    fileLinkTargetRef.current = null;
    if (!file || !nodeId) return;
    if (file.size > FILE_LINK_CAP_BYTES) {
      toast.error("File is over 3 MB — please host on Drive/Dropbox and paste the URL instead.");
      return;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      // Auto-pick a default icon based on MIME type if the node has none.
      const guessedIcon = (() => {
        const m = file.type.toLowerCase();
        if (m.startsWith("video/")) return "video";
        if (m.startsWith("audio/")) return "music";
        if (m === "application/pdf") return "pdf";
        if (m.startsWith("image/")) return "image";
        return null;
      })();
      updateNode(nodeId, (n) => {
        n.link = dataUrl;
        n.linkLabel = file.name;
        if (!n.icon && guessedIcon) n.icon = guessedIcon;
      });
      toast.success(`Linked: ${file.name}`);
    } catch {
      toast.error("Could not read that file");
    }
  };

  // --- Icon picker
  const openIconPicker = (nodeId) => setIconPickerNode(nodeId);
  const setNodeIcon = (nodeId, name) => {
    updateNode(nodeId, (n) => {
      if (name) n.icon = name;
      else delete n.icon;
    });
    setIconPickerNode(null);
    toast.success(name ? "Icon set" : "Icon removed");
  };

  // --- Background picker ---
  const setMapBackground = (value) => {
    // null clears; string keeps
    onChange({ ...map, background: value || undefined });
  };

  // --- Annotations (sticky notes / text / images) ---
  // Memoized so that when `map.annotations` is undefined we don't mint a
  // fresh `[]` on every render — that would make this an unstable
  // dependency for the selection-change useEffect below and trigger
  // "Maximum update depth exceeded" loops once free users start adding
  // nodes (each save bumps map ref → annotations ref churn → useEffect
  // re-fires → setSelectionInfo → Studio re-renders → loop).
  const annotations = useMemo(() => map.annotations || [], [map.annotations]);
  const setAnnotations = (next) => onChange({ ...map, annotations: next });

  const addAnnotation = (item) => {
    // Drop new item at the centre of the current viewport in world coords
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect() || { width: 800, height: 600 };
    const worldX = (rect.width / 2 - view.x) / view.k;
    const worldY = (rect.height / 2 - view.y) / view.k;
    const defaults = {
      sticky:  { w: 190, h: 160, text: "" },
      text:    { w: 220, h: 80,  text: "Text box" },
      // Floating shape with editable text — useful for headings, dividers,
      // and side-by-side mini-maps that aren't connected to the main tree.
      shape:   { w: 220, h: 100, text: "Heading", shape: "rect", color: "#39E0FF" },
      image:   { w: 220, h: 140, text: "" },
      comment: { w: 180, h: 90,  text: "", color: "#00f0ff" },
    }[item.type] || {};
    const full = {
      id: `annot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: item.type,
      x: worldX,
      y: worldY,
      ...defaults,
      ...item,
    };
    setAnnotations([...annotations, full]);
  };

  const updateAnnotations = (next) => setAnnotations(next);
  const deleteAnnotation = (id) => setAnnotations(annotations.filter((a) => a.id !== id));

  /**
   * Insert a timeline annotation onto the current map.
   *
   * Step 1 — open the setup wizard so the user picks designation,
   * palette, scope, and category count (mirroring /timeline/new).
   * Step 2 — wizard's onCreate handler stubs the timeline doc in
   * localStorage and drops a 16:9 timeline-card annotation at the
   * centre of the viewport. Click the card → opens the linked
   * /timeline/:id in a new tab so the user keeps their map context.
   */
  const [tlCreateOpen, setTlCreateOpen] = useState(false);
  const handleInsertTimeline = () => {
    // Pro-only feature — bounce non-Pro users to /pricing with a toast
    // explaining the gate. Lite users explicitly NOT included since
    // timelines are a flagship Pro+ feature (still in beta).
    if (!(license.isProOnly || license.founder)) {
      toast.error("Timelines are a Pro feature (currently in beta) — upgrade to unlock");
      navigate("/pricing");
      return;
    }
    setTlCreateOpen(true);
  };

  const handleCreateTimelineFromWizard = (params) => {
    const stub = blankTimeline(params);
    try {
      saveTimeline(stub);
    } catch (e) {
      toast.error(e.message || "Could not create timeline");
      return;
    }
    addAnnotation({
      type: "timeline",
      timelineId: stub.id,
      title: stub.title,
      // 16:9 — same aspect ratio as the landing cinematic-teaser video,
      // sized to be readable but not dominant on most maps.
      w: 720,
      h: 405,
    });
    setTlCreateOpen(false);
    toast.success(`Timeline "${stub.title}" embedded — click it to open`);
  };

  // Notify Studio when selection changes so it can render the right-side
  // properties panel.  We include a `applyPatch(mutator)` function bound to
  // the current selected id, so the parent doesn't need direct access to
  // updateNode().  Re-runs whenever selected/annotation/map changes.
  useEffect(() => {
    if (!onSelectionChange) return;
    if (selectedAnnotation) {
      const data = annotations.find((a) => a.id === selectedAnnotation);
      const id = selectedAnnotation;
      onSelectionChange({
        type: "annotation",
        id,
        data,
        applyPatch: (patch) => setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a))),
      });
      return;
    }
    if (selected) {
      const data = findNode(selected);
      const id = selected;
      onSelectionChange({
        type: "node",
        id,
        data,
        applyPatch: (patch) => onChange(findAndUpdate(map, id, (n) => Object.assign(n, patch))),
      });
      return;
    }
    onSelectionChange({ type: null, id: null, data: null, applyPatch: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedAnnotation, map, annotations]);

  // ---- Cut / Copy / Paste — extracted hook ----
  const { cutSelection, copySelection, pasteFromClipboard, hasClipboard } = useClipboard({
    map,
    onChange,
    selected,
    selectedAnnotation,
    setSelected,
    setSelectedAnnotation,
    findNode,
    removeNode,
    annotations,
    setAnnotations,
    deleteAnnotation,
  });
  const hasSelection = () => !!((selected && selected !== map.id) || selectedAnnotation);

  // Drop a clipart icon at the canvas centre. Picked from ClipartPicker.
  const addClipart = (iconName, color) => {
    addAnnotation({ type: "clipart", icon: iconName, color, w: 80, h: 80 });
    setClipartOpen(false);
    toast.success("Clipart added");
  };

  // Insert a free-floating line/arrow at the canvas centre. The user can drag
  // the endpoints (visible when selected) to position it precisely.
  const addConnector = ({ arrow = true, label = "Line added" } = {}) => {
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect() || { width: 800, height: 600 };
    const cx = (rect.width / 2 - view.x) / view.k;
    const cy = (rect.height / 2 - view.y) / view.k;
    const half = 80; // half-length of the initial line in world units
    const conn = {
      id: `annot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: "connector",
      x1: cx - half,
      y1: cy,
      x2: cx + half,
      y2: cy,
      color: "#00f0ff",
      width: 1.6,
      arrow,
    };
    setAnnotations([...annotations, conn]);
    setSelectedAnnotation(conn.id);
    toast.success(label);
  };

  // Join two-or-more selected items with lines. Builds connector annotations
  // between consecutive pairs in selection order so a chain of three nodes
  // produces two lines (1→2, 2→3).
  const joinSelectedWithLine = (arrow = true) => {
    const ids = [...multiSelected];
    if (ids.length < 2) {
      toast.error("Select 2+ items first (Shift-click)");
      return;
    }
    // Resolve each id's world-space centre. Nodes use `positions[id]`,
    // annotations use {x,y} (or midpoint for connectors).
    const centreOf = (id) => {
      const p = positions[id];
      if (p) return p;
      const ann = annotations.find((a) => a.id === id);
      if (!ann) return null;
      if (ann.type === "connector") {
        return { x: (ann.x1 + ann.x2) / 2, y: (ann.y1 + ann.y2) / 2 };
      }
      return { x: ann.x, y: ann.y };
    };
    const pts = ids.map(centreOf).filter(Boolean);
    if (pts.length < 2) {
      toast.error("Couldn't resolve selection positions");
      return;
    }
    const newConns = [];
    for (let i = 0; i < pts.length - 1; i++) {
      newConns.push({
        id: `annot_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
        type: "connector",
        x1: pts[i].x,
        y1: pts[i].y,
        x2: pts[i + 1].x,
        y2: pts[i + 1].y,
        color: "#ff6ad5",
        width: 1.8,
        arrow,
      });
    }
    setAnnotations([...annotations, ...newConns]);
    setMultiSelected(new Set());
    toast.success(`Joined ${pts.length} items with ${newConns.length} line${newConns.length > 1 ? "s" : ""}`);
  };

  // Group multi-selected nodes into a new parent branch. Annotations in the
  // pool are ignored — only tree-nodes can be grouped. Each selected subtree
  // is detached (with its descendants intact) and re-parented under a fresh
  // node attached as a top-level child of the root. The user is dropped into
  // rename mode immediately so they can name the branch.
  const groupSelectedAsBranch = () => {
    // Filter to node ids only, excluding the root (you can't group the root)
    const ids = [...multiSelected].filter((id) => id !== map.id && findNode(id));
    if (ids.length < 2) {
      toast.error("Select 2+ map elements (Shift-click) to group");
      return;
    }
    if (Number.isFinite(nodeCap)) {
      // We're adding exactly one new node (the new parent) — same cap as addChild
      const total = countNodes(map);
      if (total >= nodeCap) {
        const tierLabel = nodeCap === FREE_NODE_CAP ? "Free" : "Lite";
        toast.error(`${tierLabel} limit reached (${nodeCap} map elements). Upgrade to Pro for unlimited.`);
        onUpgrade && onUpgrade();
        return;
      }
    }
    // Deep-clone the tree, then walk it removing any node whose id is in `ids`
    // and stashing those subtrees for re-parenting.
    const next = JSON.parse(JSON.stringify(map));
    const subtrees = [];
    const idSet = new Set(ids);
    const recur = (n) => {
      n.children = (n.children || []).filter((c) => {
        if (idSet.has(c.id)) {
          subtrees.push(c);
          return false; // detach
        }
        recur(c);
        return true;
      });
    };
    recur(next);
    if (subtrees.length < 2) {
      toast.error("Couldn't find the selected map elements in the tree");
      return;
    }
    const newParent = {
      id: newNodeId(),
      title: "New group",
      shape: "rect",
      children: subtrees,
    };
    next.children = next.children || [];
    next.children.push(newParent);
    onChange(next);
    setMultiSelected(new Set());
    setSelected(newParent.id);
    // Drop the user straight into rename mode for the new branch.
    setTimeout(() => setEditing(newParent.id), 80);
    toast.success(`Grouped ${subtrees.length} map elements into a new branch`);
  };

  // Compile a (sub)tree into a Markdown document via the LLM. Source is
  // chosen automatically:
  //   - multi-selected nodes (≥2) → synthetic root with each subtree as a child
  //   - a single node id → that node + its descendants
  //   - null → the whole map
  const openCompileDialog = (kind = "auto", nodeId = null) => {
    let mode = kind;
    if (mode === "auto") {
      if (multiSelected.size >= 2) mode = "selection";
      else if (nodeId) mode = "subtree";
      else mode = "whole-map";
    }    if (mode === "whole-map") {
      setCompileSrc({ source: "whole-map", root: map, count: 1 });
      return;
    }
    if (mode === "subtree" && nodeId) {
      const sub = findNode(nodeId);
      if (!sub) { toast.error("Map element not found"); return; }
      setCompileSrc({ source: "subtree", root: sub, count: 1 });
      return;
    }
    if (mode === "selection") {
      const ids = [...multiSelected].filter((id) => findNode(id));
      if (ids.length < 1) { toast.error("Select 1+ map elements first (Shift-click)"); return; }
      const subtrees = ids.map((id) => findNode(id)).filter(Boolean);
      // Synthetic root that wraps the user's pool. Title falls back to the
      // map title so the document doesn't read as "Selection".
      const synth = {
        id: "__compile_root__",
        title: subtrees.length === 1 ? subtrees[0].title : (map.title || "Selected ideas"),
        summary: subtrees.length === 1 ? (subtrees[0].summary || "") : `Compiled from ${subtrees.length} selected branches`,
        children: subtrees.length === 1 ? (subtrees[0].children || []) : subtrees,
      };
      setCompileSrc({ source: "selection", root: synth, count: subtrees.length });
    }
  };

  const pickImageFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image too large — max 10 MB");
        return;
      }
      try {
        const pending = toast.loading("Optimising image…");
        const { dataUrl, sizeKb } = await compressImage(file, { maxDim: 1400, targetKb: 700 });
        toast.dismiss(pending);
        if (sizeKb > 1500) {
          toast.error("Image is still too large after compression — try a smaller picture");
          return;
        }
        addAnnotation({ type: "image", src: dataUrl });
        toast.success(`Image inserted (${sizeKb.toFixed(0)} KB)`);
      } catch (err) {
        toast.error(err?.message || "Could not process image");
      }
    };
    input.click();
  };

  // --- Render helpers ---
  // Click handler (extracted: handles connect-mode chaining, ctrl-click
  // open-link, shift/cmd multi-select, plain select).
  const handleNodeClick = useCallback((e, node) => {
    e.stopPropagation();
    // ---- Click-to-connect mode ----
    if (connectMode) {
      if (!connectFrom) {
        setConnectFrom({ id: node.id });
        return;
      }
      if (connectFrom.id === node.id) {
        setConnectFrom(null);
        return;
      }
      const a = positions[connectFrom.id];
      const b = positions[node.id];
      if (a && b) {
        const conn = {
          id: `annot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: "connector",
          x1: a.x, y1: a.y,
          x2: b.x, y2: b.y,
          color: "#00f0ff",
          width: 1.6,
          arrow: true,
        };
        setAnnotations([...annotations, conn]);
        toast.success("Connected", { duration: 900 });
      }
      setConnectFrom({ id: node.id });
      return;
    }
    if ((e.metaKey || e.ctrlKey) && node.link) {
      openNodeLink(node);
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setMultiSelected((prev) => {
        const next = new Set(prev);
        const cur = selectedRef.current;
        if (next.size === 0 && cur && cur !== node.id) next.add(cur);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      selectNode(node.id);
      closeMenu();
      return;
    }
    setMultiSelected(new Set());
    setSelectedAnnotation(null);
    selectNode(node.id);
    closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectMode, connectFrom, positions, annotations, selectNode, closeMenu]);

  const handleIconClick = useCallback((node, clickable) => {
    if (clickable) openNodeLink(node);
    else openIconPicker(node.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderNode = ({ node, depth }, v) => (
    <MapNode
      key={node.id}
      node={node}
      depth={depth}
      pos={positions[node.id]}
      v={v}
      selected={selected}
      hover={hover}
      editing={editing}
      multiSelected={multiSelected}
      connectMode={connectMode}
      connectFrom={connectFrom}
      editInputRef={editInputRef}
      onMouseEnter={() => setHover(node.id)}
      onMouseLeave={() => setHover((h) => (h === node.id ? null : h))}
      onMouseDown={(e) => startNodeDrag(e, node.id)}
      onClick={(e) => handleNodeClick(e, node)}
      onDoubleClick={(e) => { if (readOnly) return; e.stopPropagation(); setEditing(node.id); }}
      onContextMenu={(e) => openNodeMenu(e, node.id)}
      onEditCommit={commitEdit}
      onEditCancel={() => setEditing(null)}
      onResizeStart={startResize}
      onIconClick={handleIconClick}
      onLinkClick={openNodeLink}
      onChromeEdit={setEditing}
      onChromeAdd={addChild}
      onChromeDel={removeNode}
    />
  );

  // Drag-to-select rectangle. While the user holds Shift and drags on the
  // empty canvas, we paint a translucent cyan box; on mouse-up every node
  // whose centre falls inside the box (in world-space coords) joins the
  // multiSelected set so the user can immediately move them with arrow keys.
  const [selectBox, setSelectBox] = useState(null); // {x0,y0,x1,y1} screen coords
  const selectBoxRef = useRef(null);

  // --- JSX RENDER ---
  return (
    <div
      ref={containerRef}
      data-testid="mindmap-canvas"
      onMouseDown={(e) => {
        // Shift + drag on empty canvas = selection-rectangle. We hand off
        // to the existing pan handler only when no modifier is held.
        if (e.shiftKey && e.button === 0) {
          let n = e.target;
          let isBg = false;
          while (n && n !== e.currentTarget) {
            if (n.getAttribute && n.getAttribute("data-role") === "canvas-bg") { isBg = true; break; }
            if (n.dataset && (n.dataset.testid || "").startsWith("mm-node-")) break;
            n = n.parentNode;
          }
          if (isBg) {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x0 = e.clientX - rect.left;
            const y0 = e.clientY - rect.top;
            selectBoxRef.current = { x0, y0, x1: x0, y1: y0, rect };
            setSelectBox({ x0, y0, x1: x0, y1: y0 });
            return;
          }
        }
        onMouseDown(e);
      }}
      onMouseMove={(e) => {
        if (selectBoxRef.current) {
          const { rect, x0, y0 } = selectBoxRef.current;
          const x1 = e.clientX - rect.left;
          const y1 = e.clientY - rect.top;
          selectBoxRef.current = { ...selectBoxRef.current, x1, y1 };
          setSelectBox({ x0, y0, x1, y1 });
          return;
        }
        onMouseMove(e);
      }}
      onMouseUp={(e) => {
        if (selectBoxRef.current) {
          const { x0, y0, x1, y1 } = selectBoxRef.current;
          const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
          const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
          // Convert to world-space using the current view transform — the
          // canvas-bg <g> applies translate(view.x,view.y) scale(view.k),
          // so worldX = (screenX - view.x) / view.k.
          const wMinX = (minX - view.x) / view.k;
          const wMaxX = (maxX - view.x) / view.k;
          const wMinY = (minY - view.y) / view.k;
          const wMaxY = (maxY - view.y) / view.k;
          // Walk every node in the tree and test centre containment.
          const next = new Set();
          const walk = (n) => {
            if (n.id !== map.id) {
              const p = positions[n.id] || { x: 0, y: 0 };
              if (p.x >= wMinX && p.x <= wMaxX && p.y >= wMinY && p.y <= wMaxY) {
                next.add(n.id);
              }
            }
            (n.children || []).forEach(walk);
          };
          walk(map);
          if (next.size > 0) {
            setMultiSelected(next);
            // Pick any node as the "primary" so the right-side panel can
            // show common properties (just first in iteration order).
            const first = next.values().next().value;
            selectNode(first);
            toast.success(`Selected ${next.size} map element${next.size === 1 ? "" : "s"}`, { duration: 900 });
          }
          selectBoxRef.current = null;
          setSelectBox(null);
          return;
        }
        onMouseUp(e);
      }}
      onMouseLeave={(e) => {
        if (selectBoxRef.current) {
          selectBoxRef.current = null;
          setSelectBox(null);
        }
        onMouseUp(e);
      }}
      onContextMenu={(e) => {
        // Walk up from e.target looking for the canvas-bg marker — handles
        // both HTML and SVG element targets (SVG dataset support is patchy).
        let n = e.target;
        let isBg = false;
        while (n && n !== e.currentTarget) {
          if (n.getAttribute && n.getAttribute("data-role") === "canvas-bg") {
            isBg = true;
            break;
          }
          // Stop when we hit an interactive element (node/edge/annotation)
          if (n.dataset && (n.dataset.testid || "").startsWith("mm-node-")) break;
          n = n.parentNode;
        }
        if (isBg) {
          e.preventDefault();
          closeMenu();
          setCanvasMenu({ x: e.clientX, y: e.clientY });
        }
      }}
      className="absolute inset-0 z-10 no-select"
      style={{
        cursor: dragKind === "pan" ? "grabbing" : "grab",
        ...(resolveBackground(map.background) || {}),
      }}
    >
      {/* Selection rectangle overlay — Shift+drag on empty canvas */}
      {selectBox && (
        <div
          data-testid="mm-select-box"
          className="absolute pointer-events-none border-2 border-cyan-300/80 bg-cyan-400/15 rounded-md"
          style={{
            left: Math.min(selectBox.x0, selectBox.x1),
            top: Math.min(selectBox.y0, selectBox.y1),
            width: Math.abs(selectBox.x1 - selectBox.x0),
            height: Math.abs(selectBox.y1 - selectBox.y0),
            zIndex: 25,
            boxShadow: "0 0 14px rgba(0,240,255,0.45), inset 0 0 12px rgba(0,240,255,0.25)",
          }}
        />
      )}
      {/* SVG layer: edges */}
      <svg data-role="canvas-bg" className="absolute inset-0 w-full h-full" style={{ pointerEvents: "auto" }}>
        <defs>
          <marker id="arrow-cyan" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 L2,5 Z" fill="currentColor" opacity="0.9" />
          </marker>
        </defs>
        <g data-role="canvas-bg" transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <MapEdges
            flat={flat}
            positions={positions}
            selectedEdge={selectedEdge}
            selectEdge={selectEdge}
            closeMenu={closeMenu}
            openEdgeMenu={openEdgeMenu}
          />
        </g>
      </svg>

      {/* HTML layer: nodes (position baked with view transform — no CSS scale) */}
      <div className="absolute inset-0" style={{ pointerEvents: "none", zIndex: 2 }}>
        {flat.map((item) => renderNode(item, view))}
      </div>

      {/* Annotation layer — sticky notes / text / images / clipart / connectors */}
      <div className="absolute inset-0" style={{ pointerEvents: "none", zIndex: 3 }}>
        <AnnotationsLayer
          items={annotations}
          scale={view.k}
          baked={(x, y) => ({ x: x * view.k + view.x, y: y * view.k + view.y })}
          onChange={updateAnnotations}
          onDelete={deleteAnnotation}
          selectedId={selectedAnnotation}
          multiSelected={multiSelected}
          onSelect={(id, e) => {
            // Shift/Cmd-click to add an annotation to the join-pool. Plain
            // click selects only this annotation and clears any node selection.
            if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
              setMultiSelected((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
              setSelectedAnnotation(id);
              return;
            }
            setSelected(null);
            setSelectedEdge(null);
            setMultiSelected(new Set());
            setSelectedAnnotation(id);
          }}
        />
      </div>

      {/* Top Toolbar — floating glass panel */}
      <TopToolbar
        justSaved={justSaved}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleToolbarUndo}
        onRedo={handleToolbarRedo}
        selectedNode={selectedNode}
        isPro={isPro}
        isProOnly={isProOnly}
        shapePickerOpen={shapePickerOpen}
        setShapePickerOpen={setShapePickerOpen}
        onPickShape={handleToolbarShape}
        zoom={view.k}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={resetView}
        onExportPng={handleExportPng}
        onExportHighResPng={handleExportHighResPng}
        onExportSvg={handleExportSvg}
        onExportMarkdown={handleExportMarkdown}
        onExportPdf={handleExportPdf}
        onExportJson={onExportJson}
        onExportMmap={() => {
          try {
            downloadMmap(map);
            toast.success(".mmap saved · only Marvex Studio can open it natively");
          } catch (err) {
            toast.error(`Save failed: ${err?.message || "unknown"}`);
          }
        }}
        onScreenshot={handleScreenshot}
        currentBackground={map.background}
        bgPickerOpen={bgPickerOpen}
        setBgPickerOpen={setBgPickerOpen}
        onPickBackground={setMapBackground}
        onAddSticky={() => addAnnotation({ type: "sticky" })}
        onAddText={() => addAnnotation({ type: "text" })}
        onAddShape={() => addAnnotation({ type: "shape" })}
        onAddImage={pickImageFile}
        onAddClipart={() => setClipartOpen(true)}
        onAddLine={() => addConnector({ arrow: false, label: "Line added" })}
        onAddArrow={() => addConnector({ arrow: true, label: "Arrow added" })}
        onToggleConnect={() => {
          setConnectMode((m) => !m);
          setConnectFrom(null);
        }}
        connectMode={connectMode}
        onAddComment={() => addAnnotation({ type: "comment" })}
        onAddTimeline={handleInsertTimeline}
        onCompile={() => openCompileDialog("auto")}
        map={map}
        onUpgrade={onUpgrade}
        cloudSaveOpen={cloudSaveOpen}
        setCloudSaveOpen={setCloudSaveOpen}
        orientation={toolbarOrient}
        onToggleOrientation={() => setToolbarOrient((o) => (o === "h" ? "v" : "h"))}
        privacyOn={privacyOn}
      />

      {/* Controls bottom-left — keyboard shortcuts only (zoom moved to top toolbar) */}
      <div className="absolute bottom-7 left-7 z-30 flex flex-col gap-2" data-testid="mindmap-controls">
        <CtrlBtn onClick={() => setShortcutsOpen(true)} testid="mm-shortcuts"><Keyboard size={16} /></CtrlBtn>
      </div>

      {/* Hint */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 mono text-[10px] uppercase tracking-[0.22em] text-[#566187] pointer-events-none">
        Drag · Scroll zoom · Double-click rename · <span className="text-cyan-300">Right-click = options</span> · Press <span className="text-cyan-300">?</span> for shortcuts
      </div>

      {/* Inline freemium upgrade nudge — appears for free-tier users
          starting at 24 nodes (soft pill) and at 30 nodes (hard card),
          dismissable per-map per-session. Pro/Lite/Founder users
          never see it. */}
      <FreeCapNudge
        nodeCap={nodeCap}
        nodeCount={countNodes(map)}
        mapId={map?.id}
        isPro={isPro}
        onUpgrade={onUpgrade}
      />

      {/* Shortcuts overlay */}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}

      {/* Context menu */}
      {menu && (
        <ContextMenu
          menu={menu}
          node={ctxNode}
          edge={ctxEdgeChild?.edgeStyle || {}}
          isPro={isPro}
          onUpgrade={onUpgrade}
          onClose={closeMenu}
          onSetShape={(shape) => { updateNode(menu.id, (n) => { n.shape = shape; delete n.width; delete n.height; }); }}
          onSetColor={({ fill, stroke }) => { updateNode(menu.id, (n) => { n.fill = fill; n.stroke = stroke; }); }}
          onSetFontSize={(fs) => { updateNode(menu.id, (n) => { n.fontSize = fs; }); }}
          onSetFontFamily={(ff) => { updateNode(menu.id, (n) => { n.fontFamily = ff; }); }}
          onAddChild={(count = 1) => { closeMenu(); addChild(menu.id, count); }}
          onAddShapeChild={(shapeDef) => { closeMenu(); addChild(menu.id, 1, shapeDef); }}
          flowchartMode={flowchartMode}
          onAddSibling={(count = 1) => { closeMenu(); addSibling(menu.id, count); }}
          joinCount={multiSelected.size}
          onJoinLine={() => { closeMenu(); joinSelectedWithLine(false); }}
          onJoinArrow={() => { closeMenu(); joinSelectedWithLine(true); }}
          onGroupBranch={() => { closeMenu(); groupSelectedAsBranch(); }}
          onApplyStyleToSelection={
            multiSelected.size >= 2 && multiSelected.has(menu.id)
              ? () => {
                  closeMenu();
                  // Copy fill/stroke/shape/font from this node to every other
                  // node in multiSelected. Source node itself stays unchanged.
                  const src = findNode(menu.id);
                  if (!src) return;
                  const patch = {};
                  if (src.fill !== undefined)        patch.fill       = src.fill;
                  if (src.stroke !== undefined)      patch.stroke     = src.stroke;
                  if (src.shape !== undefined)      { patch.shape    = src.shape; }
                  if (src.fontSize !== undefined)    patch.fontSize   = src.fontSize;
                  if (src.fontFamily !== undefined)  patch.fontFamily = src.fontFamily;
                  let next = map;
                  for (const id of multiSelected) {
                    if (id === menu.id) continue;
                    next = findAndUpdate(next, id, (n) => {
                      Object.assign(n, patch);
                      // Resize-on-shape-change like onSetShape: drop custom
                      // width/height so the new shape's defaults apply.
                      if (patch.shape) { delete n.width; delete n.height; }
                    });
                  }
                  onChange(next);
                  toast.success(`Style applied to ${multiSelected.size - 1} other map element${multiSelected.size === 2 ? "" : "s"}`);
                }
              : undefined
          }
          onCompile={() => { closeMenu(); openCompileDialog("auto", menu.id); }}
          onDeleteNode={() => { closeMenu(); removeNode(menu.id); }}
          onEditLink={() => { closeMenu(); openLinkDialog(menu.id); }}
          onUploadLink={() => { closeMenu(); triggerUpload(menu.id); }}
          onInsertBookmark={() => { closeMenu(); setBookmarkPickerNode(menu.id); }}
          onOpenLink={() => { closeMenu(); openNodeLink(ctxNode); }}
          onPickIcon={() => { closeMenu(); openIconPicker(menu.id); }}
          onFindBook={() => {
            closeMenu();
            const link = buildBookLink(ctxNode?.title);
            if (!link) {
              toast.error("No affiliate storefront is configured yet");
              return;
            }
            window.open(link.url, "_blank", "noopener,noreferrer");
            toast.success(`Opened on ${link.label}`);
          }}
          onResearch={onResearch ? () => { closeMenu(); onResearch(ctxNode); } : undefined}
          onDeepen={onDeepen ? () => { closeMenu(); onDeepen(ctxNode); } : undefined}
          onDeepResearch={onDeepResearch ? () => { closeMenu(); onDeepResearch(ctxNode); } : undefined}
          onSetEdgeColor={(color) => { updateNode(menu.id, (n) => { n.edgeStyle = { ...(n.edgeStyle || {}), color }; }); }}
          onSetEdgeWidth={(width) => { updateNode(menu.id, (n) => { n.edgeStyle = { ...(n.edgeStyle || {}), width }; }); }}
          onSetEdgeDashed={(dashed) => { updateNode(menu.id, (n) => { n.edgeStyle = { ...(n.edgeStyle || {}), dashed }; }); }}
          onSetEdgeArrow={(arrow) => { updateNode(menu.id, (n) => { n.edgeStyle = { ...(n.edgeStyle || {}), arrow }; }); }}
          onSetEdgeLabel={(label) => { updateNode(menu.id, (n) => { n.edgeStyle = { ...(n.edgeStyle || {}), label }; }); }}
          onDeleteEdge={() => {
            closeMenu();
            // deleting the edge = removing the child node from tree
            const parent = findParent(menu.id);
            if (parent) removeNode(menu.id);
          }}
        />
      )}

      {/* Link editor */}
      {linkDialog && (
        <LinkDialog
          initial={linkDialog.initial}
          onCancel={() => setLinkDialog(null)}
          onSave={(val) => saveLink(linkDialog.nodeId, val)}
          onPickBookmark={() => {
            // Hand off the active node to the bookmark picker, then dismiss
            // the link dialog so the picker has the spotlight. The picker's
            // onPick handler will write the link back via applyPickedBookmark
            // (same path as the right-click → "Insert imported bookmark…").
            const nodeId = linkDialog.nodeId;
            setLinkDialog(null);
            setBookmarkPickerNode(nodeId);
          }}
        />
      )}
      {iconPickerNode && (
        <IconPicker
          current={findNode(iconPickerNode)?.icon || null}
          onPick={(name) => setNodeIcon(iconPickerNode, name)}
          onClose={() => setIconPickerNode(null)}
        />
      )}
      <BookmarkPickerModal
        open={!!bookmarkPickerNode}
        onClose={() => setBookmarkPickerNode(null)}
        onPick={(bookmark) => applyPickedBookmark(bookmarkPickerNode, bookmark)}
        onOpenImport={() => window.dispatchEvent(new CustomEvent("mm-open-bookmarks-import"))}
      />
      {clipartOpen && (
        <ClipartPicker
          onPick={addClipart}
          onClose={() => setClipartOpen(false)}
        />
      )}
      <CompileDocumentDialog
        open={!!compileSrc}
        onClose={() => setCompileSrc(null)}
        root={compileSrc?.root || null}
        mapTitle={map?.title || ""}
        source={compileSrc?.source || "subtree"}
        selectionCount={compileSrc?.count || 1}
      />
      {/* Canvas right-click quick-insert menu — extracted to its own
          component for readability; portals to document.body so
          position:fixed survives the CSS-transformed viewport. */}
      <CanvasContextMenu
        menu={canvasMenu}
        onClose={() => setCanvasMenu(null)}
        multiSelected={multiSelected}
        hasSelection={hasSelection}
        hasClipboard={hasClipboard}
        cutSelection={cutSelection}
        copySelection={copySelection}
        pasteFromClipboard={pasteFromClipboard}
        joinSelectedWithLine={joinSelectedWithLine}
        groupSelectedAsBranch={groupSelectedAsBranch}
        openCompileDialog={openCompileDialog}
        addAnnotation={addAnnotation}
        addConnector={addConnector}
        pickImageFile={pickImageFile}
        setClipartOpen={setClipartOpen}
      />
      {/* Hidden file input — shared by all "Upload file as link" actions */}
      <input
        ref={fileLinkInputRef}
        type="file"
        onChange={onFileLinkPicked}
        data-testid="mm-file-link-input"
        style={{ display: "none" }}
      />
      {/* Setup wizard for "Insert Timeline" — same dialog the standalone
          /timeline/new page uses, so embedded and standalone timelines
          have identical setup parity. */}
      <TimelineCreateDialog
        open={tlCreateOpen}
        onCreate={handleCreateTimelineFromWizard}
        onClose={() => setTlCreateOpen(false)}
      />
    </div>
  );
}

// ================== SUB-COMPONENTS ==================


import { useEffect } from "react";

/**
 * Canvas-level keyboard shortcuts for MindMapCanvas.
 *
 * Scope: global window listener, but noop's when focus is inside an
 * INPUT / TEXTAREA or when the user is actively editing a node title.
 *
 * Bindings:
 *   ?                 → toggle shortcuts overlay
 *   Escape            → close menu / shortcuts / deselect
 *   Tab (on selected) → add child (Pro gated by caller.addChild)
 *   Delete / Backspace → remove selected (except root)
 *   Enter / F2        → begin editing selected
 *   ⌘/Ctrl-B (on selected) → open the bookmark picker for that node, so
 *     attaching a saved bookmark is one keystroke away from anywhere on
 *     the canvas (vs. previously requiring right-click → 5th menu item).
 */
export default function useCanvasHotkeys({
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
  rootId,
  openBookmarkPicker,
}) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || editing) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        if (menu) { setMenu(null); return; }
        if (shortcutsOpen) setShortcutsOpen(false);
        else { setSelected(null); setSelectedEdge(null); }
        return;
      }
      if (!selected) return;
      if (e.key === "Tab") {
        e.preventDefault();
        addChild(selected);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selected === rootId) return;
        e.preventDefault();
        removeNode(selected);
      } else if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        setEditing(selected);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "b" || e.key === "B") &&
        openBookmarkPicker
      ) {
        e.preventDefault();
        openBookmarkPicker(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editing, shortcutsOpen, menu, rootId]);
}

import { useCallback, useState } from "react";

/**
 * Right-click context menu state for the canvas.
 *
 * Menu shape: `{type: "node" | "edge", id: string, x: number, y: number}` or
 * null when closed.
 *
 * The hook exposes three convenience openers that each:
 *   - preventDefault + stopPropagation on the event
 *   - set the appropriate selection (node or edge) via the injected setters
 *   - stash the menu at the cursor coords
 *
 * Closing is intentionally a plain setter so callers can wire it to Escape,
 * a bg click, or an action handler without ceremony.
 */
export default function useContextMenu({ selectNode, selectEdge, readOnly = false } = {}) {
  const [menu, setMenu] = useState(null);

  const openNodeMenu = useCallback((e, id) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    selectNode?.(id);
    setMenu({ type: "node", id, x: e.clientX, y: e.clientY });
  }, [selectNode, readOnly]);

  const openEdgeMenu = useCallback((e, id) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    selectEdge?.(id);
    setMenu({ type: "edge", id, x: e.clientX, y: e.clientY });
  }, [selectEdge, readOnly]);

  const closeMenu = useCallback(() => setMenu(null), []);

  return { menu, setMenu, openNodeMenu, openEdgeMenu, closeMenu };
}

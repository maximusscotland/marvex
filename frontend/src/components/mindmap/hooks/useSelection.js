import { useCallback, useState } from "react";

/**
 * Selection state for the canvas.
 *
 * Two orthogonal selections:
 *   - `selected`     — a node id (for node-level actions + toolbar)
 *   - `selectedEdge` — a child-node id (edge target, for edge-level actions)
 *
 * Selecting a node clears the edge selection and vice versa. Passing `null`
 * to either setter works too, but the helpers below make the common cases
 * (select one, select the other, clear both) a one-liner at the call-site.
 */
export default function useSelection() {
  const [selected, setSelected] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);

  const selectNode = useCallback((id) => {
    setSelected(id);
    setSelectedEdge(null);
  }, []);

  const selectEdge = useCallback((id) => {
    setSelectedEdge(id);
    setSelected(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setSelectedEdge(null);
  }, []);

  return {
    selected,
    selectedEdge,
    setSelected,
    setSelectedEdge,
    selectNode,
    selectEdge,
    clearSelection,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Inline text-editing state for node titles.
 *
 * Owns:
 *   - `editing`      — node id currently in edit-mode (null when none)
 *   - `editInputRef` — ref attached to the <input> inside the editing node
 *   - auto-focus + select-all effect when a node enters edit mode
 *   - `commitEdit(id, value)` helper — saves trimmed non-empty value, exits edit mode
 *
 * `commitEdit` is a one-shot that calls `onChange` with the new map tree,
 * trusting `findAndUpdate` to produce an immutable update. Empty / whitespace
 * values are rejected silently (node keeps its previous title) because users
 * very often bash Enter to dismiss the editor.
 */
export default function useEditing({ map, onChange, findAndUpdate }) {
  const [editing, setEditing] = useState(null);
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  const commitEdit = useCallback((id, value) => {
    setEditing(null);
    if (value == null) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange(findAndUpdate(map, id, (n) => { n.title = trimmed; }));
  }, [map, onChange, findAndUpdate]);

  return { editing, setEditing, editInputRef, commitEdit };
}

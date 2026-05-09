import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { findAndUpdate } from "@/components/mindmap/lib/tree";

const cloneNodeSubtree = (n) => {
  const fresh = {
    ...n,
    id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  };
  if (Array.isArray(n.children)) {
    fresh.children = n.children.map((c) => cloneNodeSubtree(c));
  }
  return fresh;
};

/**
 * useClipboard — in-memory cut/copy/paste for nodes + annotations.
 * Lives on the component instance so cross-tab clipboards don't leak.
 * Paste re-keys all ids so the same payload can be pasted N times.
 */
export default function useClipboard({
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
}) {
  const clipboardRef = useRef(null);

  const copyToClipboard = useCallback((kind, payload) => {
    clipboardRef.current = {
      kind,
      payload: JSON.parse(JSON.stringify(payload)),
      takenAt: Date.now(),
    };
    toast.success(kind === "node" ? "Map element copied" : "Annotation copied");
  }, []);

  const cutSelection = useCallback(() => {
    if (selected && selected !== map.id) {
      const target = findNode(selected);
      if (!target) return;
      copyToClipboard("node", target);
      removeNode(selected);
      return;
    }
    if (selectedAnnotation) {
      const target = annotations.find((a) => a.id === selectedAnnotation);
      if (!target) return;
      copyToClipboard("annotation", target);
      deleteAnnotation(selectedAnnotation);
      setSelectedAnnotation(null);
    }
  }, [
    selected, selectedAnnotation, map.id, annotations,
    findNode, removeNode, deleteAnnotation, setSelectedAnnotation, copyToClipboard,
  ]);

  const copySelection = useCallback(() => {
    if (selected && selected !== map.id) {
      const target = findNode(selected);
      if (target) copyToClipboard("node", target);
      return;
    }
    if (selectedAnnotation) {
      const target = annotations.find((a) => a.id === selectedAnnotation);
      if (target) copyToClipboard("annotation", target);
    }
  }, [selected, selectedAnnotation, map.id, annotations, findNode, copyToClipboard]);

  const pasteFromClipboard = useCallback(() => {
    const c = clipboardRef.current;
    if (!c) { toast.error("Nothing to paste yet — copy something first"); return; }
    if (c.kind === "node") {
      const parentId = (selected && findNode(selected)) ? selected : map.id;
      const fresh = cloneNodeSubtree(c.payload);
      const next = findAndUpdate(map, parentId, (n) => {
        n.children = [...(n.children || []), fresh];
      });
      onChange(next);
      setSelected(fresh.id);
      toast.success("Pasted");
      return;
    }
    if (c.kind === "annotation") {
      const fresh = {
        ...c.payload,
        id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        x: (c.payload.x || 0) + 32,
        y: (c.payload.y || 0) + 32,
      };
      setAnnotations([...annotations, fresh]);
      setSelectedAnnotation(fresh.id);
      toast.success("Pasted");
    }
  }, [
    map, onChange, selected, annotations, findNode,
    setSelected, setAnnotations, setSelectedAnnotation,
  ]);

  const hasClipboard = useCallback(() => !!clipboardRef.current, []);

  return { cutSelection, copySelection, pasteFromClipboard, hasClipboard };
}

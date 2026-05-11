import { useCallback } from "react";
import { toast } from "sonner";
import {
  walk,
  findAndUpdate,
  findAndRemove,
  newNodeId,
} from "@/components/mindmap/lib/tree";
import { FREE_NODE_CAP } from "@/components/mindmap/constants";

/**
 * useNodeCrud — hook bundling the tree-mutation operations (add child,
 * add sibling, remove, update, count) extracted from MindMapCanvas.
 *
 * Returned helpers all read fresh state from the closure so callers must
 * pass the latest map / positions on each render.
 */
export default function useNodeCrud({
  map,
  onChange,
  positions,
  nodeCap,
  onUpgrade,
  findNode,
  setSelected,
  setEditing,
}) {
  const countNodes = useCallback((root) => {
    let n = 0;
    walk(root, () => { n += 1; });
    return n;
  }, []);

  const updateNode = useCallback(
    (id, mutator) => onChange(findAndUpdate(map, id, mutator)),
    [map, onChange],
  );

  const removeNode = useCallback((id) => {
    if (id === map.id) return;
    onChange(findAndRemove(map, id));
    setSelected(null);
  }, [map, onChange, setSelected]);

  const _capExceeded = useCallback((delta) => {
    if (!Number.isFinite(nodeCap)) return false;
    const total = countNodes(map);
    if (total + delta > nodeCap) {
      const tierLabel = nodeCap === FREE_NODE_CAP ? "Free" : "Lite";
      toast.error(`${tierLabel} limit reached (${nodeCap} map elements). Upgrade to Pro for unlimited.`);
      onUpgrade && onUpgrade();
      return true;
    }
    return false;
  }, [map, nodeCap, onUpgrade, countNodes]);

  const addChild = useCallback((parentId, count = 1, shapeOverride = null) => {
    if (_capExceeded(count)) return;
    const parent = findNode(parentId);
    const overrideShape = shapeOverride && shapeOverride.shape ? shapeOverride : null;
    const inheritedShape = overrideShape ? overrideShape.shape : (parent?.shape || "ellipse");
    const inheritedFill = overrideShape ? overrideShape.fill : parent?.fill;
    const inheritedStroke = overrideShape ? overrideShape.stroke : parent?.stroke;
    const inheritedFontSize = parent?.fontSize;
    const inheritedFontFamily = parent?.fontFamily;
    const flowchartShapeId = overrideShape ? overrideShape.id : parent?.flowchartShape;
    const titleSeed = overrideShape ? overrideShape.label : "New idea";
    const parentPos = positions[parentId] || { x: 0, y: 0 };
    const existingCount = (parent?.children || []).length;
    const newIds = [];
    const newPositions = {};
    const next = findAndUpdate(map, parentId, (n) => {
      n.children = n.children || [];
      for (let i = 0; i < count; i++) {
        const childId = newNodeId();
        newIds.push(childId);
        const fanAngle = -Math.PI / 2 + (existingCount + i) * (Math.PI / 4);
        const offset = 150;
        newPositions[childId] = {
          x: parentPos.x + Math.cos(fanAngle) * offset,
          y: parentPos.y + Math.sin(fanAngle) * offset,
        };
        n.children.push({
          id: childId,
          title: titleSeed,
          shape: inheritedShape,
          ...(inheritedFill ? { fill: inheritedFill } : {}),
          ...(inheritedStroke ? { stroke: inheritedStroke } : {}),
          ...(inheritedFontSize ? { fontSize: inheritedFontSize } : {}),
          ...(inheritedFontFamily ? { fontFamily: inheritedFontFamily } : {}),
          ...(flowchartShapeId ? { flowchartShape: flowchartShapeId } : {}),
          // Pre-set an edge label on the parent→child connector when
          // the caller supplies one (used by Branch Yes/No so the two
          // outgoing edges read "Yes" and "No" without a second click).
          ...(overrideShape && overrideShape.edgeLabel
            ? { edgeStyle: { label: overrideShape.edgeLabel } }
            : {}),
          children: [],
        });
      }
    });
    next.positions = { ...(next.positions || {}), ...newPositions };
    onChange(next);
    const lastId = newIds[newIds.length - 1];
    setSelected(lastId);
    if (count === 1) setTimeout(() => setEditing(lastId), 50);
  }, [map, onChange, positions, findNode, setSelected, setEditing, _capExceeded]);

  const addSibling = useCallback((nodeId, count = 1) => {
    if (nodeId === map.id) {
      addChild(map.id, count);
      return;
    }
    let parentId = null;
    const findParentInner = (n) => {
      for (const c of (n.children || [])) {
        if (c.id === nodeId) { parentId = n.id; return true; }
        if (findParentInner(c)) return true;
      }
      return false;
    };
    findParentInner(map);
    if (!parentId) { addChild(map.id, count); return; }
    if (_capExceeded(count)) return;
    const sibling = findNode(nodeId);
    const siblingPos = positions[nodeId] || { x: 0, y: 0 };
    const newIds = [];
    const newPositions = {};
    const next = findAndUpdate(map, parentId, (n) => {
      n.children = n.children || [];
      for (let i = 0; i < count; i++) {
        const childId = newNodeId();
        newIds.push(childId);
        newPositions[childId] = {
          x: siblingPos.x + 140 + i * 30,
          y: siblingPos.y + 30 + i * 60,
        };
        n.children.push({
          id: childId,
          title: "New idea",
          shape: sibling?.shape || "ellipse",
          ...(sibling?.fill ? { fill: sibling.fill } : {}),
          ...(sibling?.stroke ? { stroke: sibling.stroke } : {}),
          ...(sibling?.fontSize ? { fontSize: sibling.fontSize } : {}),
          ...(sibling?.fontFamily ? { fontFamily: sibling.fontFamily } : {}),
          children: [],
        });
      }
    });
    next.positions = { ...(next.positions || {}), ...newPositions };
    onChange(next);
    const lastId = newIds[newIds.length - 1];
    setSelected(lastId);
    if (count === 1) setTimeout(() => setEditing(lastId), 50);
  }, [map, onChange, positions, findNode, setSelected, setEditing, addChild, _capExceeded]);

  return { countNodes, addChild, addSibling, removeNode, updateNode };
}

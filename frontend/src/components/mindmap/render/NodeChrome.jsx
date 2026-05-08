import React from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";

/**
 * Hover chrome shown above each map element — the small Rename / Add child /
 * Delete branch trio. Pure presentation: every action is a callback the
 * parent canvas handles.
 *
 * Root elements omit Delete because deleting the root would orphan the map.
 */
export default function NodeChrome({ node, isRoot, onEdit, onAdd, onDel }) {
  return (
    <div
      className="absolute -top-3 right-1 flex gap-1"
      style={{ pointerEvents: "auto" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        data-testid={`mm-edit-btn-${node.id}`}
        onClick={(e) => { e.stopPropagation(); onEdit(node.id); }}
        className="w-6 h-6 rounded-full grid place-items-center bg-[#0a0f24] border border-cyan-400/60 text-cyan-300 hover:bg-cyan-400/20"
        title="Rename"
      >
        <Edit3 size={11} />
      </button>
      <button
        data-testid={`mm-add-btn-${node.id}`}
        onClick={(e) => { e.stopPropagation(); onAdd(node.id); }}
        className="w-6 h-6 rounded-full grid place-items-center bg-[#0a0f24] border border-cyan-400/60 text-cyan-300 hover:bg-cyan-400/20"
        title="Add child"
      >
        <Plus size={12} />
      </button>
      {!isRoot && (
        <button
          data-testid={`mm-del-btn-${node.id}`}
          onClick={(e) => { e.stopPropagation(); onDel(node.id); }}
          className="w-6 h-6 rounded-full grid place-items-center bg-[#0a0f24] border border-red-400/60 text-red-300 hover:bg-red-400/20"
          title="Delete branch"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

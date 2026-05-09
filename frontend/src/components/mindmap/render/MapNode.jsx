/* eslint-disable react/prop-types */
import React from "react";
import { Mail, File as FileIcon, Globe } from "lucide-react";

import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_ROOT_FILL,
  DEFAULT_ROOT_STROKE,
} from "@/components/mindmap/constants";
import { sizeOf } from "@/components/mindmap/lib/tree";
import ShapeSvg from "@/components/mindmap/render/ShapeSvg";
import NodeChrome from "@/components/mindmap/render/NodeChrome";
import { getIconConfig } from "@/components/IconPicker";

const linkKind = (link) => {
  if (!link) return "";
  if (/^data:/i.test(link)) return "file";
  if (/^mailto:/i.test(link)) return "email";
  if (/^file:/i.test(link)) return "file";
  return "web";
};

/**
 * MapNode — extracted from MindMapCanvas. Renders a single tree node:
 * shape SVG, title (or inline-edit input), icon badge, link badge,
 * resize handles, hover/select chrome.
 *
 * All interactive logic (drag, resize, click, context-menu, edit) is
 * passed in as callbacks so this component stays a pure renderer.
 */
export default function MapNode({
  node,
  depth,
  pos,
  v,
  selected,
  hover,
  editing,
  multiSelected,
  connectMode,
  connectFrom,
  editInputRef,
  // Callbacks
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  onEditCommit,
  onEditCancel,
  onResizeStart,
  onIconClick,
  onLinkClick,
  // NodeChrome
  onChromeEdit,
  onChromeAdd,
  onChromeDel,
}) {
  if (!pos) return null;
  const isRoot = depth === 0;
  const shape = node.shape || (isRoot ? "rect" : "ellipse");
  const { w, h } = sizeOf({ ...node, shape }, isRoot);
  const fill = node.fill || (isRoot ? DEFAULT_ROOT_FILL : DEFAULT_FILL);
  const stroke = node.stroke || (isRoot ? DEFAULT_ROOT_STROKE : DEFAULT_STROKE);
  const fontSize = (node.fontSize || (isRoot ? 16 : 13)) * v.k;
  const fontFamily = node.fontFamily || "'Sora', sans-serif";
  const isSel = selected === node.id;
  const isHover = hover === node.id;
  const isEditing = editing === node.id;
  const isMulti = multiSelected.has(node.id);
  // Bake view transform into position/size
  const sw = w * v.k;
  const sh = h * v.k;
  const left = v.x + pos.x * v.k - sw / 2;
  const top = v.y + pos.y * v.k - sh / 2;
  const isConnectFrom = connectFrom?.id === node.id;

  return (
    <div
      data-testid={`mm-node-${node.id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className="node-pop absolute"
      style={{
        left,
        top,
        width: sw,
        height: sh,
        pointerEvents: "auto",
        cursor: connectMode ? "crosshair" : "grab",
        userSelect: isEditing ? "text" : "none",
        filter: isConnectFrom
          ? `drop-shadow(0 0 14px #ff6ad5) drop-shadow(0 0 28px #ff6ad5cc)`
          : `drop-shadow(0 0 8px ${isMulti ? "#ff6ad5" : stroke}aa) drop-shadow(0 0 16px ${isMulti ? "#ff6ad5" : stroke}44)`,
        outline: isConnectFrom
          ? "2px dashed #ff6ad5"
          : isMulti ? "2px dashed #ff6ad5" : "none",
        outlineOffset: (isConnectFrom || isMulti) ? 4 : 0,
        transition: "filter 0.18s ease",
      }}
    >
      <svg
        width={sw}
        height={sh}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <ShapeSvg shape={shape} w={w} h={h} fill={fill} stroke={stroke} strokeWidth={isSel ? 2.4 : isRoot ? 2 : 1.5} />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-center px-3"
        style={{ pointerEvents: isEditing ? "auto" : "none" }}
      >
        {isEditing ? (
          <input
            ref={editInputRef}
            data-testid={`mm-edit-${node.id}`}
            defaultValue={node.title}
            onBlur={(e) => onEditCommit(node.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditCommit(node.id, e.target.value);
              if (e.key === "Escape") onEditCancel();
            }}
            className="bg-transparent text-center outline-none w-full text-white"
            style={{ fontSize, fontFamily, pointerEvents: "auto" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="leading-tight"
            style={{
              fontSize,
              fontFamily,
              fontWeight: isRoot ? 700 : 600,
              color: "#eaf6ff",
              letterSpacing: isRoot ? "0.04em" : "0.02em",
              textTransform: isRoot ? "uppercase" : "none",
              textShadow: `0 0 6px ${stroke}55`,
              wordBreak: "break-word",
            }}
          >
            {node.title}
          </div>
        )}
      </div>

      {/* Icon badge (top-left). Clickable when a link is also set. */}
      {node.icon && !isEditing && (() => {
        const iconCfg = getIconConfig(node.icon);
        if (!iconCfg) return null;
        const Icon = iconCfg.component;
        const accent = iconCfg.accent || stroke;
        const clickable = !!node.link;
        return (
          <button
            data-testid={`mm-icon-${node.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onIconClick(node, clickable);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={
              clickable
                ? `Open: ${node.linkLabel || node.link}`
                : `${iconCfg.label} · click to change`
            }
            className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full grid place-items-center transition-all hover:scale-110"
            style={{
              background: "#0a0f24",
              border: `1.5px solid ${accent}`,
              boxShadow: `0 0 8px ${accent}aa`,
              color: accent,
              pointerEvents: "auto",
            }}
          >
            <Icon size={13} />
          </button>
        );
      })()}

      {/* Link badge (clickable to open) */}
      {node.link && !isEditing && (
        <button
          data-testid={`mm-link-${node.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onLinkClick(node);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title={`Open: ${node.link}`}
          className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full grid place-items-center transition-all hover:scale-110"
          style={{
            background: "#0a0f24",
            border: `1.5px solid ${stroke}`,
            boxShadow: `0 0 8px ${stroke}aa`,
            color: stroke,
            pointerEvents: "auto",
          }}
        >
          {linkKind(node.link) === "email" ? (
            <Mail size={11} />
          ) : linkKind(node.link) === "file" ? (
            <FileIcon size={11} />
          ) : (
            <Globe size={11} />
          )}
        </button>
      )}

      {/* Resize handles when selected */}
      {isSel && !isEditing && (
        <>
          {[
            ["tl", 0, 0, "nwse-resize"],
            ["tr", sw, 0, "nesw-resize"],
            ["bl", 0, sh, "nesw-resize"],
            ["br", sw, sh, "nwse-resize"],
          ].map(([corner, hx, hy, cur]) => (
            <div
              key={corner}
              data-testid={`mm-resize-${corner}-${node.id}`}
              onMouseDown={(e) => onResizeStart(e, node.id, corner, w, h)}
              style={{
                position: "absolute",
                left: hx - 6,
                top: hy - 6,
                width: 12,
                height: 12,
                background: "#0a0f24",
                border: `1.5px solid ${stroke}`,
                borderRadius: 3,
                boxShadow: `0 0 8px ${stroke}`,
                cursor: cur,
                pointerEvents: "auto",
              }}
            />
          ))}
        </>
      )}

      {/* Hover / select chrome */}
      {(isHover || isSel) && !isEditing && (
        <NodeChrome
          node={node}
          isRoot={isRoot}
          onEdit={onChromeEdit}
          onAdd={onChromeAdd}
          onDel={onChromeDel}
        />
      )}
    </div>
  );
}

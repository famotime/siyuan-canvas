import type {
  CanvasBounds,
  CanvasDocument,
} from "@/canvas/types"

import { findCanvasNodesInGroup } from "@/canvas/document"

export interface CanvasViewportSnapshot {
  scale: number
  x: number
  y: number
}

export interface CanvasStageSize {
  height: number
  width: number
}

export interface CanvasBoardOffset {
  left: number
  top: number
}

export interface SelectionToolbarPosition {
  placement: "bottom" | "top"
  x: number
  y: number
}

const TOOLBAR_MARGIN = 12
const TOOLBAR_OFFSET = 8

export function centerViewportOnBounds(
  viewport: CanvasViewportSnapshot,
  stageSize: CanvasStageSize,
  bounds: CanvasBounds,
  boardOffset: CanvasBoardOffset,
): CanvasViewportSnapshot {
  const centerX = (bounds.x - boardOffset.left + bounds.width / 2) * viewport.scale
  const centerY = (bounds.y - boardOffset.top + bounds.height / 2) * viewport.scale

  return {
    scale: viewport.scale,
    x: stageSize.width / 2 - centerX,
    y: stageSize.height / 2 - centerY,
  }
}

export function resolveSelectionToolbarPosition(
  selectionRect: CanvasBounds,
  stageSize: CanvasStageSize,
  toolbarSize: CanvasStageSize,
): SelectionToolbarPosition {
  const unclampedX = selectionRect.x + selectionRect.width / 2 - toolbarSize.width / 2
  const maxX = Math.max(TOOLBAR_MARGIN, stageSize.width - toolbarSize.width - TOOLBAR_MARGIN)
  const x = Math.min(maxX, Math.max(TOOLBAR_MARGIN, unclampedX))
  const topY = selectionRect.y - toolbarSize.height - TOOLBAR_OFFSET

  if (topY >= TOOLBAR_MARGIN) {
    return {
      placement: "top",
      x,
      y: topY,
    }
  }

  return {
    placement: "bottom",
    x,
    y: selectionRect.y + selectionRect.height + TOOLBAR_OFFSET,
  }
}

export function resolveDragNodeIds(
  document: CanvasDocument,
  draggedNodeId: string,
  selectedNodeIds: string[],
): string[] {
  const draggedNode = document.nodes.find((node) => node.id === draggedNodeId)
  const isDraggedNodeSelected = selectedNodeIds.includes(draggedNodeId)

  if (draggedNode?.type === "group") {
    const containedNodeIds = findCanvasNodesInGroup(document, draggedNodeId)
    if (!isDraggedNodeSelected) {
      return [draggedNodeId, ...containedNodeIds]
    }

    return [...new Set([...selectedNodeIds, ...containedNodeIds])]
  }

  return isDraggedNodeSelected ? selectedNodeIds : [draggedNodeId]
}

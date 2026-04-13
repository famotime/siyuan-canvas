import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasSide,
} from "@/canvas/types"

import { findCanvasNodesInGroup } from "@/canvas/document"
import { getCanvasNodeAnchor } from "@/canvas/node-interaction"

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

export interface CanvasPoint {
  x: number
  y: number
}

const TOOLBAR_MARGIN = 12
const TOOLBAR_OFFSET = 8
const EDGE_CURVE_FACTOR = 0.35
const EDGE_CURVE_MAX_OFFSET = 160
const EDGE_CURVE_MIN_OFFSET = 40

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

export function resolveEdgeToolbarPosition(
  midpoint: CanvasPoint,
  stageSize: CanvasStageSize,
  toolbarSize: CanvasStageSize,
): SelectionToolbarPosition {
  const unclampedX = midpoint.x - toolbarSize.width / 2
  const maxX = Math.max(TOOLBAR_MARGIN, stageSize.width - toolbarSize.width - TOOLBAR_MARGIN)
  const x = Math.min(maxX, Math.max(TOOLBAR_MARGIN, unclampedX))
  const topY = midpoint.y - toolbarSize.height - TOOLBAR_OFFSET

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
    y: midpoint.y + TOOLBAR_OFFSET,
  }
}

function clampEdgeCurveOffset(value: number): number {
  return Math.min(EDGE_CURVE_MAX_OFFSET, Math.max(EDGE_CURVE_MIN_OFFSET, value))
}

function getSideVector(side: CanvasSide): CanvasPoint {
  switch (side) {
    case "top":
      return { x: 0, y: -1 }
    case "right":
      return { x: 1, y: 0 }
    case "bottom":
      return { x: 0, y: 1 }
    case "left":
      return { x: -1, y: 0 }
    default:
      return { x: 0, y: 0 }
  }
}

export function getEdgeCurveControlPoints(
  from: CanvasPoint,
  fromSide: CanvasSide,
  to: CanvasPoint,
  toSide: CanvasSide,
): {
  fromControl: CanvasPoint
  toControl: CanvasPoint
} {
  const offset = clampEdgeCurveOffset(
    Math.round(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * EDGE_CURVE_FACTOR),
  )
  const fromVector = getSideVector(fromSide)
  const toVector = getSideVector(toSide)

  return {
    fromControl: {
      x: from.x + fromVector.x * offset,
      y: from.y + fromVector.y * offset,
    },
    toControl: {
      x: to.x + toVector.x * offset,
      y: to.y + toVector.y * offset,
    },
  }
}

export function getBezierPointAt(
  start: CanvasPoint,
  startControl: CanvasPoint,
  endControl: CanvasPoint,
  end: CanvasPoint,
  t: number,
): CanvasPoint {
  const oneMinusT = 1 - t
  const coefficientA = oneMinusT ** 3
  const coefficientB = 3 * oneMinusT ** 2 * t
  const coefficientC = 3 * oneMinusT * t ** 2
  const coefficientD = t ** 3

  return {
    x:
      coefficientA * start.x
      + coefficientB * startControl.x
      + coefficientC * endControl.x
      + coefficientD * end.x,
    y:
      coefficientA * start.y
      + coefficientB * startControl.y
      + coefficientC * endControl.y
      + coefficientD * end.y,
  }
}

export function getEdgeMidpointPosition(
  from: CanvasPoint,
  fromSide: CanvasSide,
  to: CanvasPoint,
  toSide: CanvasSide,
): CanvasPoint {
  const controls = getEdgeCurveControlPoints(from, fromSide, to, toSide)
  return getBezierPointAt(from, controls.fromControl, controls.toControl, to, 0.5)
}

export function createEdgeCurvePath(
  from: CanvasPoint,
  fromSide: CanvasSide,
  to: CanvasPoint,
  toSide: CanvasSide,
): string {
  const controls = getEdgeCurveControlPoints(from, fromSide, to, toSide)
  return `M ${from.x} ${from.y} C ${controls.fromControl.x} ${controls.fromControl.y}, ${controls.toControl.x} ${controls.toControl.y}, ${to.x} ${to.y}`
}

export function createBoundsFromPoints(start: CanvasPoint, end: CanvasPoint): CanvasBounds {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)

  return {
    height,
    width,
    x,
    y,
  }
}

export function resolveMarqueeSelectionNodeIds(
  document: CanvasDocument,
  bounds: CanvasBounds,
): string[] {
  return document.nodes
    .filter((node) =>
      node.x < bounds.x + bounds.width
      && node.x + node.width > bounds.x
      && node.y < bounds.y + bounds.height
      && node.y + node.height > bounds.y,
    )
    .map((node) => node.id)
}

function doBoundsIntersect(first: CanvasBounds, second: CanvasBounds): boolean {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

function createBoundsFromEdge(edge: CanvasEdge, document: CanvasDocument): CanvasBounds | null {
  const fromNode = document.nodes.find((node) => node.id === edge.fromNode)
  const toNode = document.nodes.find((node) => node.id === edge.toNode)

  if (!fromNode || !toNode) {
    return null
  }

  const from = getCanvasNodeAnchor(fromNode, edge.fromSide)
  const to = getCanvasNodeAnchor(toNode, edge.toSide)
  const controls = getEdgeCurveControlPoints(from, edge.fromSide, to, edge.toSide)
  const points = [from, controls.fromControl, controls.toControl, to]

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return {
    height: Math.max(1, maxY - minY),
    width: Math.max(1, maxX - minX),
    x: minX,
    y: minY,
  }
}

function createBoundsFromEdgeLabel(edge: CanvasEdge, document: CanvasDocument): CanvasBounds | null {
  if (!edge.label) {
    return null
  }

  const fromNode = document.nodes.find((node) => node.id === edge.fromNode)
  const toNode = document.nodes.find((node) => node.id === edge.toNode)
  if (!fromNode || !toNode) {
    return null
  }

  const from = getCanvasNodeAnchor(fromNode, edge.fromSide)
  const to = getCanvasNodeAnchor(toNode, edge.toSide)
  const midpoint = getEdgeMidpointPosition(from, edge.fromSide, to, edge.toSide)
  const width = Math.max(56, edge.label.length * 8 + 16)
  const height = 24

  return {
    height,
    width,
    x: midpoint.x - width / 2,
    y: midpoint.y - height / 2,
  }
}

export function resolveMarqueeSelectionEdgeIds(
  document: CanvasDocument,
  bounds: CanvasBounds,
): string[] {
  return document.edges
    .filter((edge) => {
      const edgeBounds = createBoundsFromEdge(edge, document)
      const labelBounds = createBoundsFromEdgeLabel(edge, document)

      return (edgeBounds && doBoundsIntersect(edgeBounds, bounds))
        || (labelBounds && doBoundsIntersect(labelBounds, bounds))
    })
    .map((edge) => edge.id)
}

export function resolveDragNodeIds(
  document: CanvasDocument,
  draggedNodeId: string,
  selectedNodeIds: string[],
): string[] {
  const draggedNode = document.nodes.find((node) => node.id === draggedNodeId)
  const isDraggedNodeSelected = selectedNodeIds.includes(draggedNodeId)

  if (!isDraggedNodeSelected) {
    if (draggedNode?.type === "group") {
      return [draggedNodeId, ...findCanvasNodesInGroup(document, draggedNodeId)]
    }

    return [draggedNodeId]
  }

  const dragNodeIds = [...selectedNodeIds]

  for (const selectedNodeId of selectedNodeIds) {
    const selectedNode = document.nodes.find((node) => node.id === selectedNodeId)
    if (selectedNode?.type !== "group") {
      continue
    }

    for (const containedNodeId of findCanvasNodesInGroup(document, selectedNodeId)) {
      if (!dragNodeIds.includes(containedNodeId)) {
        dragNodeIds.push(containedNodeId)
      }
    }
  }

  return dragNodeIds
}

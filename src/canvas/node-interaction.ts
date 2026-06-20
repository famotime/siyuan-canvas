import type {
  CanvasNode,
  CanvasSide,
} from "@/canvas/types"

export interface CanvasAnchorTarget {
  nodeId: string
  side: CanvasSide
  x: number
  y: number
}

export const CONNECTION_SNAP_DISTANCE = 24
const MIN_NODE_WIDTH = 50
const MIN_NODE_HEIGHT = 50
const MIN_GROUP_HEIGHT = 100

export function getCanvasNodeAnchor(node: CanvasNode, side: CanvasSide): { x: number, y: number } {
  switch (side) {
    case "top":
      return {
        x: node.x + node.width / 2,
        y: node.y,
      }
    case "right":
      return {
        x: node.x + node.width,
        y: node.y + node.height / 2,
      }
    case "bottom":
      return {
        x: node.x + node.width / 2,
        y: node.y + node.height,
      }
    case "left":
      return {
        x: node.x,
        y: node.y + node.height / 2,
      }
    default:
      return {
        x: node.x,
        y: node.y,
      }
  }
}

export function resizeCanvasNodeFromSide(
  node: CanvasNode,
  side: CanvasSide,
  deltaX: number,
  deltaY: number,
): { height: number, width: number, x: number, y: number } {
  const minHeight = node.type === "group" ? MIN_GROUP_HEIGHT : MIN_NODE_HEIGHT

  switch (side) {
    case "left": {
      const width = Math.max(MIN_NODE_WIDTH, Math.round(node.width - deltaX))
      return {
        height: node.height,
        width,
        x: node.x + node.width - width,
        y: node.y,
      }
    }
    case "right":
      return {
        height: node.height,
        width: Math.max(MIN_NODE_WIDTH, Math.round(node.width + deltaX)),
        x: node.x,
        y: node.y,
      }
    case "top": {
      const height = Math.max(minHeight, Math.round(node.height - deltaY))
      return {
        height,
        width: node.width,
        x: node.x,
        y: node.y + node.height - height,
      }
    }
    case "bottom":
      return {
        height: Math.max(minHeight, Math.round(node.height + deltaY)),
        width: node.width,
        x: node.x,
        y: node.y,
      }
    default:
      return {
        height: node.height,
        width: node.width,
        x: node.x,
        y: node.y,
      }
  }
}

export function resizeCanvasNodeFromCorner(
  node: CanvasNode,
  deltaX: number,
  deltaY: number,
): { height: number, width: number, x: number, y: number } {
  const minHeight = node.type === "group" ? MIN_GROUP_HEIGHT : MIN_NODE_HEIGHT

  return {
    height: Math.max(minHeight, Math.round(node.height + deltaY)),
    width: Math.max(MIN_NODE_WIDTH, Math.round(node.width + deltaX)),
    x: node.x,
    y: node.y,
  }
}

export function findNearestCanvasAnchor(
  nodes: CanvasNode[],
  point: { x: number, y: number },
  options: {
    excludeNodeId?: string
    maxDistance?: number
  } = {},
): CanvasAnchorTarget | null {
  const maxDistance = options.maxDistance ?? CONNECTION_SNAP_DISTANCE
  let nearest: CanvasAnchorTarget | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const node of nodes) {
    if (node.id === options.excludeNodeId) {
      continue
    }

    for (const side of ["top", "right", "bottom", "left"] as CanvasSide[]) {
      const anchor = getCanvasNodeAnchor(node, side)
      const distance = Math.hypot(anchor.x - point.x, anchor.y - point.y)
      if (distance > maxDistance || distance >= nearestDistance) {
        continue
      }

      nearest = {
        nodeId: node.id,
        side,
        x: anchor.x,
        y: anchor.y,
      }
      nearestDistance = distance
    }
  }

  return nearest
}

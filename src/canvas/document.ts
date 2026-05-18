export { applyCanvasNodeLayout } from "@/canvas/document-layout"
export { createCanvasGroupForNodes, findCanvasNodesInGroup } from "@/canvas/document-group"

import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasGeometryPatch,
  CanvasNode,
  CanvasNodeType,
} from "@/canvas/types"

export function createEmptyCanvasDocument(): CanvasDocument {
  return {
    nodes: [],
    edges: [],
  }
}

function createCanvasId(prefix: string): string {
  const random = Math.random().toString(16).slice(2, 10)
  return `${prefix}${random}`
}

export function createCanvasNode(type: CanvasNodeType): CanvasNode {
  const shared = {
    id: createCanvasId("node-"),
    type,
    x: 80,
    y: 80,
    width: type === "group" ? 640 : 320,
    height: type === "group" ? 360 : 180,
  } as const

  switch (type) {
    case "file":
      return {
        ...shared,
        type,
        file: "assets/example.md",
      }
    case "group":
      return {
        ...shared,
        type,
        label: "Group",
        color: "1",
      }
    case "link":
      return {
        ...shared,
        type,
        url: "https://obsidian.md",
      }
    case "text":
      return {
        ...shared,
        type,
        text: "New note",
      }
    default:
      throw new Error(`Unsupported node type: ${String(type)}`)
  }
}

export function createCanvasEdge(fromNode: string, toNode: string): CanvasEdge {
  return {
    id: createCanvasId("edge-"),
    fromNode,
    fromSide: "right",
    startArrow: false,
    toNode,
    toSide: "left",
    endArrow: true,
  }
}

export function upsertCanvasNode(document: CanvasDocument, node: CanvasNode): CanvasDocument {
  const nodes = document.nodes.some((candidate) => candidate.id === node.id)
    ? document.nodes.map((candidate) => (candidate.id === node.id ? node : candidate))
    : [...document.nodes, node]

  return {
    ...document,
    nodes,
  }
}

export function upsertCanvasEdge(document: CanvasDocument, edge: CanvasEdge): CanvasDocument {
  const edges = document.edges.some((candidate) => candidate.id === edge.id)
    ? document.edges.map((candidate) => (candidate.id === edge.id ? edge : candidate))
    : [...document.edges, edge]

  return {
    ...document,
    edges,
  }
}

export function removeCanvasNode(document: CanvasDocument, nodeId: string): CanvasDocument {
  return {
    ...document,
    nodes: document.nodes.filter((node) => node.id !== nodeId),
    edges: document.edges.filter((edge) => edge.fromNode !== nodeId && edge.toNode !== nodeId),
  }
}

export function removeCanvasNodes(document: CanvasDocument, nodeIds: string[]): CanvasDocument {
  const removedIds = new Set(nodeIds)
  return {
    ...document,
    nodes: document.nodes.filter((node) => !removedIds.has(node.id)),
    edges: document.edges.filter((edge) => !removedIds.has(edge.fromNode) && !removedIds.has(edge.toNode)),
  }
}

export function removeCanvasEdge(document: CanvasDocument, edgeId: string): CanvasDocument {
  return {
    ...document,
    edges: document.edges.filter((edge) => edge.id !== edgeId),
  }
}

function updateCanvasEdgeById(
  document: CanvasDocument,
  edgeId: string,
  updater: (edge: CanvasEdge) => CanvasEdge,
): CanvasDocument {
  return {
    ...document,
    edges: document.edges.map((edge) => (edge.id === edgeId ? updater(edge) : edge)),
  }
}

export function setCanvasEdgeLabel(
  document: CanvasDocument,
  edgeId: string,
  label: string,
): CanvasDocument {
  const normalizedLabel = label.trim()

  return updateCanvasEdgeById(document, edgeId, (edge) => {
    if (!normalizedLabel) {
      const { label: _removedLabel, ...nextEdge } = edge
      return nextEdge as CanvasEdge
    }

    return {
      ...edge,
      label: normalizedLabel,
    }
  })
}

export function setCanvasEdgeColor(
  document: CanvasDocument,
  edgeId: string,
  color: string,
): CanvasDocument {
  return updateCanvasEdgeById(document, edgeId, (edge) => {
    if (!color) {
      const { color: _removedColor, ...nextEdge } = edge
      return nextEdge as CanvasEdge
    }

    return {
      ...edge,
      color,
    }
  })
}

export function setCanvasEdgeDirection(
  document: CanvasDocument,
  edgeId: string,
  direction: {
    endArrow: boolean
    startArrow: boolean
  },
): CanvasDocument {
  return updateCanvasEdgeById(document, edgeId, (edge) => ({
    ...edge,
    endArrow: direction.endArrow,
    startArrow: direction.startArrow,
  }))
}

export function setCanvasEdgeEndpoint(
  document: CanvasDocument,
  edgeId: string,
  endpoint: "from" | "to",
  target: {
    nodeId: string
    side: CanvasEdge["fromSide"]
  },
): CanvasDocument {
  return updateCanvasEdgeById(document, edgeId, (edge) => (
    endpoint === "from"
      ? {
          ...edge,
          fromNode: target.nodeId,
          fromSide: target.side,
        }
      : {
          ...edge,
          toNode: target.nodeId,
          toSide: target.side,
        }
  ))
}

export function setCanvasNodeGeometry(
  document: CanvasDocument,
  nodeId: string,
  geometry: CanvasGeometryPatch,
): CanvasDocument {
  return {
    ...document,
    nodes: document.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node
      }

      return {
        ...node,
        ...geometry,
      }
    }),
  }
}

export function translateCanvasNodes(
  document: CanvasDocument,
  nodeIds: string[],
  deltaX: number,
  deltaY: number,
): CanvasDocument {
  const movedIds = new Set(nodeIds)
  return {
    ...document,
    nodes: document.nodes.map((node) => {
      if (!movedIds.has(node.id)) {
        return node
      }

      return {
        ...node,
        x: node.x + deltaX,
        y: node.y + deltaY,
      }
    }),
  }
}


export function getCanvasSelectionBounds(
  document: CanvasDocument,
  nodeIds: string[],
): CanvasBounds | null {
  const selectedIds = new Set(nodeIds)
  const selectedNodes = document.nodes.filter((node) => selectedIds.has(node.id))

  if (!selectedNodes.length) {
    return null
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of selectedNodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function setCanvasNodesColor(
  document: CanvasDocument,
  selectedNodeIds: string[],
  color: string,
): CanvasDocument {
  if (!selectedNodeIds.length) {
    return document
  }

  const selectedIds = new Set(selectedNodeIds)

  return {
    ...document,
    nodes: document.nodes.map((node) => {
      if (!selectedIds.has(node.id)) {
        return node
      }

      if (!color) {
        const { color: _removedColor, ...nextNode } = node
        return nextNode as typeof node
      }

      return { ...node, color }
    }),
  }
}


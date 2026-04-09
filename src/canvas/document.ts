import type {
  CanvasDocument,
  CanvasEdge,
  CanvasGeometryPatch,
  CanvasGroupNode,
  CanvasNode,
  CanvasNodeType,
  CanvasSelectionBounds,
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
    toNode,
    toSide: "left",
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

export function computeSelectionBounds(
  document: CanvasDocument,
  nodeIds: string[],
): CanvasSelectionBounds | null {
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

export function applyColorToSelectedNodes(
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
    nodes: document.nodes.map((node) => (selectedIds.has(node.id) ? { ...node, color } : node)),
  }
}

export function createGroupNodeAroundSelection(
  document: CanvasDocument,
  selectedNodeIds: string[],
  padding = 24,
): CanvasDocument {
  if (!selectedNodeIds.length) {
    throw new Error("Cannot create a group without selected nodes.")
  }

  const bounds = computeSelectionBounds(document, selectedNodeIds)

  if (!bounds) {
    throw new Error("Selected nodes are missing from the document.")
  }

  const normalizedPadding = Math.max(0, padding)
  const group = createCanvasNode("group") as CanvasGroupNode

  const positionedGroup: CanvasGroupNode = {
    ...group,
    x: bounds.x - normalizedPadding,
    y: bounds.y - normalizedPadding,
    width: bounds.width + normalizedPadding * 2,
    height: bounds.height + normalizedPadding * 2,
  }

  return {
    ...document,
    nodes: [...document.nodes, positionedGroup],
  }
}

export function findNodesFullyEnclosedByGroup(document: CanvasDocument, groupId: string): CanvasNode[] {
  const group = document.nodes.find(
    (node): node is CanvasGroupNode => node.id === groupId && node.type === "group",
  )

  if (!group) {
    return []
  }

  const groupLeft = group.x
  const groupTop = group.y
  const groupRight = group.x + group.width
  const groupBottom = group.y + group.height

  return document.nodes.filter((node) => {
    if (node.id === group.id) {
      return false
    }

    const nodeLeft = node.x
    const nodeTop = node.y
    const nodeRight = node.x + node.width
    const nodeBottom = node.y + node.height

    return (
      nodeLeft >= groupLeft &&
      nodeTop >= groupTop &&
      nodeRight <= groupRight &&
      nodeBottom <= groupBottom
    )
  })
}

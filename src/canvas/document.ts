import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasGeometryPatch,
  CanvasGroupNode,
  CanvasNode,
  CanvasNodeLayoutAction,
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

const ROW_GAP = 32
const COLUMN_GAP = 24
const GRID_GAP = 24

export function applyCanvasNodeLayout(
  document: CanvasDocument,
  nodeIds: string[],
  action: CanvasNodeLayoutAction,
): CanvasDocument {
  if (!nodeIds.length) {
    return document
  }

  const selectedNodes = getSelectedCanvasNodes(document, nodeIds)
  if (!selectedNodes.length) {
    return document
  }

  const bounds = getBoundsForCanvasNodes(selectedNodes)

  let updates = new Map<string, CanvasGeometryPatch>()

  switch (action) {
    case "left-align":
      updates = buildNodeGeometryUpdates(selectedNodes, () => ({ x: bounds.x }))
      break
    case "center-horizontal":
      updates = buildNodeGeometryUpdates(selectedNodes, (node) => ({
        x: bounds.x + bounds.width / 2 - node.width / 2,
      }))
      break
    case "right-align":
      updates = buildNodeGeometryUpdates(selectedNodes, (node) => ({
        x: bounds.x + bounds.width - node.width,
      }))
      break
    case "top-align":
      updates = buildNodeGeometryUpdates(selectedNodes, () => ({ y: bounds.y }))
      break
    case "center-vertical":
      updates = buildNodeGeometryUpdates(selectedNodes, (node) => ({
        y: bounds.y + bounds.height / 2 - node.height / 2,
      }))
      break
    case "bottom-align":
      updates = buildNodeGeometryUpdates(selectedNodes, (node) => ({
        y: bounds.y + bounds.height - node.height,
      }))
      break
    case "arrange-row":
      updates = arrangeCanvasNodesInRow(selectedNodes, bounds)
      break
    case "arrange-column":
      updates = arrangeCanvasNodesInColumn(selectedNodes, bounds)
      break
    case "arrange-grid":
      updates = arrangeCanvasNodesInGrid(selectedNodes, bounds)
      break
    case "distribute-horizontal":
      updates = distributeCanvasNodesByCenter(selectedNodes, "horizontal")
      break
    case "distribute-vertical":
      updates = distributeCanvasNodesByCenter(selectedNodes, "vertical")
      break
    case "stretch-horizontal":
      updates = buildNodeGeometryUpdates(selectedNodes, () => ({
        x: bounds.x,
        width: bounds.width,
      }))
      break
    case "stretch-vertical":
      updates = buildNodeGeometryUpdates(selectedNodes, () => ({
        y: bounds.y,
        height: bounds.height,
      }))
      break
    default:
      return document
  }

  return applyCanvasNodeGeometryUpdates(document, updates)
}

function getSelectedCanvasNodes(document: CanvasDocument, nodeIds: string[]): CanvasNode[] {
  const selectedIds = new Set(nodeIds)
  return document.nodes.filter((node) => selectedIds.has(node.id))
}

function getBoundsForCanvasNodes(nodes: CanvasNode[]): CanvasBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
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

function buildNodeGeometryUpdates(
  nodes: CanvasNode[],
  patcher: (node: CanvasNode) => CanvasGeometryPatch,
): Map<string, CanvasGeometryPatch> {
  const updates = new Map<string, CanvasGeometryPatch>()

  for (const node of nodes) {
    updates.set(node.id, patcher(node))
  }

  return updates
}

function applyCanvasNodeGeometryUpdates(
  document: CanvasDocument,
  updates: Map<string, CanvasGeometryPatch>,
): CanvasDocument {
  if (!updates.size) {
    return document
  }

  return {
    ...document,
    nodes: document.nodes.map((node) => {
      const patch = updates.get(node.id)
      if (!patch) {
        return node
      }

      return {
        ...node,
        ...patch,
      }
    }),
  }
}

function distributeCanvasNodesByCenter(
  nodes: CanvasNode[],
  direction: "horizontal" | "vertical",
): Map<string, CanvasGeometryPatch> {
  if (nodes.length < 3) {
    return new Map()
  }

  const sortedNodes = [...nodes].sort((left, right) => {
    const leftPrimary = getNodeCenter(left, direction)
    const rightPrimary = getNodeCenter(right, direction)
    if (leftPrimary !== rightPrimary) {
      return leftPrimary - rightPrimary
    }

    const crossAxis = direction === "horizontal" ? "vertical" : "horizontal"
    const leftCross = getNodeCenter(left, crossAxis)
    const rightCross = getNodeCenter(right, crossAxis)
    if (leftCross !== rightCross) {
      return leftCross - rightCross
    }

    return left.id.localeCompare(right.id)
  })

  const firstNode = sortedNodes[0]
  const lastNode = sortedNodes[sortedNodes.length - 1]
  const firstCenter = getNodeCenter(firstNode, direction)
  const lastCenter = getNodeCenter(lastNode, direction)
  const spacing = (lastCenter - firstCenter) / (sortedNodes.length - 1)

  const updates = new Map<string, CanvasGeometryPatch>()

  for (let index = 1; index < sortedNodes.length - 1; index += 1) {
    const node = sortedNodes[index]
    const targetCenter = firstCenter + spacing * index

    if (direction === "horizontal") {
      updates.set(node.id, { x: targetCenter - node.width / 2 })
      continue
    }

    updates.set(node.id, { y: targetCenter - node.height / 2 })
  }

  return updates
}

function getNodeCenter(node: CanvasNode, axis: "horizontal" | "vertical"): number {
  return axis === "horizontal" ? node.x + node.width / 2 : node.y + node.height / 2
}

function arrangeCanvasNodesInRow(
  nodes: CanvasNode[],
  bounds: CanvasBounds,
): Map<string, CanvasGeometryPatch> {
  const sortedNodes = [...nodes].sort((left, right) => {
    if (left.x !== right.x) {
      return left.x - right.x
    }
    if (left.y !== right.y) {
      return left.y - right.y
    }

    return left.id.localeCompare(right.id)
  })

  const updates = new Map<string, CanvasGeometryPatch>()
  let currentX = bounds.x

  for (const node of sortedNodes) {
    updates.set(node.id, {
      x: currentX,
      y: bounds.y,
    })
    currentX += node.width + ROW_GAP
  }

  return updates
}

function arrangeCanvasNodesInColumn(
  nodes: CanvasNode[],
  bounds: CanvasBounds,
): Map<string, CanvasGeometryPatch> {
  const sortedNodes = [...nodes].sort((left, right) => {
    if (left.y !== right.y) {
      return left.y - right.y
    }
    if (left.x !== right.x) {
      return left.x - right.x
    }

    return left.id.localeCompare(right.id)
  })

  const updates = new Map<string, CanvasGeometryPatch>()
  let currentY = bounds.y

  for (const node of sortedNodes) {
    updates.set(node.id, {
      x: bounds.x,
      y: currentY,
    })
    currentY += node.height + COLUMN_GAP
  }

  return updates
}

function arrangeCanvasNodesInGrid(
  nodes: CanvasNode[],
  bounds: CanvasBounds,
): Map<string, CanvasGeometryPatch> {
  const sortedNodes = [...nodes].sort((left, right) => {
    if (left.y !== right.y) {
      return left.y - right.y
    }
    if (left.x !== right.x) {
      return left.x - right.x
    }

    return left.id.localeCompare(right.id)
  })

  const columns = getCanvasGridColumnCount(sortedNodes.length, bounds)
  const rows = Math.ceil(sortedNodes.length / columns)

  const columnWidths = Array.from({ length: columns }, () => 0)
  const rowHeights = Array.from({ length: rows }, () => 0)

  sortedNodes.forEach((node, index) => {
    const columnIndex = index % columns
    const rowIndex = Math.floor(index / columns)
    columnWidths[columnIndex] = Math.max(columnWidths[columnIndex], node.width)
    rowHeights[rowIndex] = Math.max(rowHeights[rowIndex], node.height)
  })

  const columnPositions = Array.from({ length: columns }, () => bounds.x)
  for (let columnIndex = 1; columnIndex < columns; columnIndex += 1) {
    columnPositions[columnIndex] =
      columnPositions[columnIndex - 1] + columnWidths[columnIndex - 1] + GRID_GAP
  }

  const rowPositions = Array.from({ length: rows }, () => bounds.y)
  for (let rowIndex = 1; rowIndex < rows; rowIndex += 1) {
    rowPositions[rowIndex] = rowPositions[rowIndex - 1] + rowHeights[rowIndex - 1] + GRID_GAP
  }

  const updates = new Map<string, CanvasGeometryPatch>()

  sortedNodes.forEach((node, index) => {
    const columnIndex = index % columns
    const rowIndex = Math.floor(index / columns)
    updates.set(node.id, {
      x: columnPositions[columnIndex],
      y: rowPositions[rowIndex],
    })
  })

  return updates
}

function getCanvasGridColumnCount(nodeCount: number, bounds: CanvasBounds): number {
  if (nodeCount <= 1) {
    return 1
  }

  if (bounds.height === 0) {
    return nodeCount
  }

  const aspectRatio = bounds.width / bounds.height
  const estimatedColumns = Math.round(Math.sqrt(nodeCount * aspectRatio))
  return Math.max(1, Math.min(nodeCount, estimatedColumns))
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

export function createCanvasGroupForNodes(
  document: CanvasDocument,
  selectedNodeIds: string[],
  padding = 24,
): { document: CanvasDocument; groupId: string } {
  if (!selectedNodeIds.length) {
    throw new Error("Cannot create a group without selected nodes.")
  }

  const bounds = getCanvasSelectionBounds(document, selectedNodeIds)

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

  const nextDocument = {
    ...document,
    nodes: [...document.nodes, positionedGroup],
  }

  return {
    document: nextDocument,
    groupId: positionedGroup.id,
  }
}

export function findCanvasNodesInGroup(document: CanvasDocument, groupId: string): string[] {
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

  return document.nodes
    .filter((node) => {
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
    .map((node) => node.id)
}

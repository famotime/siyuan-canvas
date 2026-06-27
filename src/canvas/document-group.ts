import type { CanvasDocument, CanvasGroupNode, CanvasEdge, CanvasNode } from "@/canvas/types"
import { createCanvasNode, getCanvasSelectionBounds } from "@/canvas/document"

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

export function collapseCanvasGroup(
  document: CanvasDocument,
  groupId: string,
  collapsedHeight = 46,
): CanvasDocument {
  const groupIndex = document.nodes.findIndex((n) => n.id === groupId && n.type === "group")
  if (groupIndex === -1) {
    return document
  }
  const group = { ...document.nodes[groupIndex] } as CanvasGroupNode
  if (group.collapsed) {
    return document
  }

  const childNodeIds = findCanvasNodesInGroup(document, groupId)
  const collapsedNodes = document.nodes.filter((n) => childNodeIds.includes(n.id))

  const childIdSet = new Set(childNodeIds)
  const internalAndGroupNodeIdSet = new Set([...childNodeIds, groupId])

  const collapsedEdges: CanvasEdge[] = []
  const remainingEdges: CanvasEdge[] = []

  for (const edge of document.edges) {
    const fromInChild = childIdSet.has(edge.fromNode)
    const toInChild = childIdSet.has(edge.toNode)
    const fromInGroupOrChild = internalAndGroupNodeIdSet.has(edge.fromNode)
    const toInGroupOrChild = internalAndGroupNodeIdSet.has(edge.toNode)

    if (fromInGroupOrChild && toInGroupOrChild) {
      collapsedEdges.push(edge)
    } else if (fromInChild || toInChild) {
      const newEdge = { ...edge }
      if (fromInChild) {
        newEdge.collapsedOriginalFromNode = edge.fromNode
        newEdge.fromNode = groupId
      }
      if (toInChild) {
        newEdge.collapsedOriginalToNode = edge.toNode
        newEdge.toNode = groupId
      }
      remainingEdges.push(newEdge)
    } else {
      remainingEdges.push(edge)
    }
  }

  group.collapsed = true
  group.originalWidth = group.width
  group.originalHeight = group.height
  group.collapsedNodes = collapsedNodes
  group.collapsedEdges = collapsedEdges
  group.height = collapsedHeight

  const newNodes = document.nodes
    .filter((n) => !childIdSet.has(n.id))
    .map((n) => (n.id === groupId ? group : n))

  return {
    ...document,
    nodes: newNodes,
    edges: remainingEdges,
  }
}

export function expandCanvasGroup(
  document: CanvasDocument,
  groupId: string,
): CanvasDocument {
  const groupIndex = document.nodes.findIndex((n) => n.id === groupId && n.type === "group")
  if (groupIndex === -1) {
    return document
  }
  const group = { ...document.nodes[groupIndex] } as CanvasGroupNode
  if (!group.collapsed) {
    return document
  }

  const collapsedNodes = group.collapsedNodes ?? []
  const collapsedEdges = group.collapsedEdges ?? []

  group.width = group.originalWidth ?? group.width
  group.height = group.originalHeight ?? group.height

  delete group.collapsed
  delete group.originalWidth
  delete group.originalHeight
  delete group.collapsedNodes
  delete group.collapsedEdges

  const restoredEdges = document.edges.map((edge) => {
    let modified = false
    const newEdge = { ...edge }
    if (newEdge.fromNode === groupId && newEdge.collapsedOriginalFromNode) {
      newEdge.fromNode = newEdge.collapsedOriginalFromNode
      delete newEdge.collapsedOriginalFromNode
      modified = true
    }
    if (newEdge.toNode === groupId && newEdge.collapsedOriginalToNode) {
      newEdge.toNode = newEdge.collapsedOriginalToNode
      delete newEdge.collapsedOriginalToNode
      modified = true
    }
    return modified ? newEdge : edge
  })

  const newNodes = document.nodes.map((n) => (n.id === groupId ? group : n))
  newNodes.push(...collapsedNodes)

  const newEdges = [...restoredEdges, ...collapsedEdges]

  return {
    ...document,
    nodes: newNodes,
    edges: newEdges,
  }
}

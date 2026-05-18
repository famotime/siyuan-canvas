import type { CanvasDocument, CanvasGroupNode } from "@/canvas/types"
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

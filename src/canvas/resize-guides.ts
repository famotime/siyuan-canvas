import type { CanvasDocument, CanvasNode } from "@/canvas/types"
import { toBoardX, toBoardY } from "@/canvas/board"
import type { CanvasBoardMetrics } from "@/canvas/board"

const SIZE_MATCH_TOLERANCE = 2

export interface ResizeGuideWidthLine {
  nodeId: string
  leftX: number
  rightX: number
  topY: number
  bottomY: number
}

export interface ResizeGuideHeightLine {
  nodeId: string
  topY: number
  bottomY: number
  leftX: number
  rightX: number
}

export interface ResizeGuideLabel {
  nodeId: string
  boardX: number
  boardY: number
  text: string
}

export interface ResizeGuideResult {
  matchNodeIds: string[]
  labels: ResizeGuideLabel[]
  widthLines: ResizeGuideWidthLine[]
  heightLines: ResizeGuideHeightLine[]
}

export function computeResizeGuides(
  document: CanvasDocument,
  resizingNode: CanvasNode,
  newWidth: number,
  newHeight: number,
  board: CanvasBoardMetrics,
): ResizeGuideResult {
  const matchNodeIds: string[] = []
  const labels: ResizeGuideLabel[] = []
  const widthLines: ResizeGuideWidthLine[] = []
  const heightLines: ResizeGuideHeightLine[] = []

  for (const other of document.nodes) {
    if (other.id === resizingNode.id) continue

    const widthMatch = Math.abs(newWidth - other.width) <= SIZE_MATCH_TOLERANCE
    const heightMatch = Math.abs(newHeight - other.height) <= SIZE_MATCH_TOLERANCE

    if (!widthMatch && !heightMatch) continue

    matchNodeIds.push(other.id)

    const leftX = toBoardX(board, other.x)
    const rightX = toBoardX(board, other.x + other.width)
    const topY = toBoardY(board, other.y)
    const bottomY = toBoardY(board, other.y + other.height)

    const pad = 6
    if (widthMatch) {
      widthLines.push({
        bottomY: bottomY + pad,
        leftX,
        nodeId: other.id,
        rightX: rightX + 2,
        topY: topY - pad,
      })
    }
    if (heightMatch) {
      heightLines.push({
        bottomY: bottomY + 2,
        leftX: leftX - pad,
        nodeId: other.id,
        rightX: rightX + pad,
        topY,
      })
    }

    // 标签文字
    if (widthMatch && heightMatch) {
      labels.push({
        boardX: rightX + 6,
        boardY: topY - 2,
        nodeId: other.id,
        text: `W=${other.width} H=${other.height}`,
      })
    } else if (widthMatch) {
      labels.push({
        boardX: rightX + 6,
        boardY: topY - 2,
        nodeId: other.id,
        text: `W = ${other.width}px`,
      })
    } else {
      labels.push({
        boardX: rightX + 6,
        boardY: topY - 2,
        nodeId: other.id,
        text: `H = ${other.height}px`,
      })
    }
  }

  return { matchNodeIds, labels, widthLines, heightLines }
}

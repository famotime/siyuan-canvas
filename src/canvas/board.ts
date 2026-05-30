import type { CanvasNode } from "@/canvas/types"

export interface CanvasBoardMetrics {
  height: number
  left: number
  top: number
  width: number
}

const DEFAULT_BOARD_HEIGHT = 4200
const DEFAULT_BOARD_WIDTH = 5600
const DEFAULT_PADDING = 480

export function createCanvasBoardMetrics(
  nodes: CanvasNode[],
  options: {
    minHeight?: number
    minWidth?: number
    padding?: number
  } = {},
): CanvasBoardMetrics {
  const minHeight = options.minHeight ?? DEFAULT_BOARD_HEIGHT
  const minWidth = options.minWidth ?? DEFAULT_BOARD_WIDTH
  const padding = options.padding ?? DEFAULT_PADDING

  if (nodes.length === 0) {
    return {
      height: minHeight,
      left: -minWidth / 2,
      top: -minHeight / 2,
      width: minWidth,
    }
  }

  const left = -minWidth / 2
  const top = -minHeight / 2
  const maxNodeX = Math.max(...nodes.map((node) => node.x + node.width))
  const maxNodeY = Math.max(...nodes.map((node) => node.y + node.height))

  const right = Math.max(minWidth / 2, maxNodeX + padding)
  const bottom = Math.max(minHeight / 2, maxNodeY + padding)

  return {
    height: bottom - top,
    left,
    top,
    width: right - left,
  }
}

export function toBoardX(board: CanvasBoardMetrics, x: number): number {
  return x - board.left
}

export function toBoardY(board: CanvasBoardMetrics, y: number): number {
  return y - board.top
}

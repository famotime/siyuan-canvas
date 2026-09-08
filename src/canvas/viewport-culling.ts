import type { CanvasBoardMetrics } from "@/canvas/board"
import type { CanvasNode } from "@/canvas/types"

export interface CanvasViewportBounds {
  bottom: number
  left: number
  right: number
  top: number
}

export const DEFAULT_VIEWPORT_BUFFER = 400

/**
 * 根据 stage 容器尺寸、视口变换与画布 Board 指标，计算可视区域在世界坐标系中的边界矩形
 */
export function computeViewportVisibleBounds(
  viewport: { scale: number, x: number, y: number },
  board: CanvasBoardMetrics,
  stageSize: { clientWidth: number, clientHeight: number },
  buffer = DEFAULT_VIEWPORT_BUFFER,
): CanvasViewportBounds {
  const scale = Math.max(0.001, viewport.scale)
  const left = (0 - viewport.x) / scale + board.left - buffer
  const top = (0 - viewport.y) / scale + board.top - buffer
  const right = (stageSize.clientWidth - viewport.x) / scale + board.left + buffer
  const bottom = (stageSize.clientHeight - viewport.y) / scale + board.top + buffer

  return { bottom, left, right, top }
}

/**
 * 判定给定的卡片节点是否与视口边界相交（AABB 碰撞检测）
 */
export function isNodeInViewportBounds(
  node: Pick<CanvasNode, "height" | "width" | "x" | "y">,
  bounds: CanvasViewportBounds,
): boolean {
  const nodeRight = node.x + node.width
  const nodeBottom = node.y + node.height

  return (
    nodeRight >= bounds.left &&
    node.x <= bounds.right &&
    nodeBottom >= bounds.top &&
    node.y <= bounds.bottom
  )
}

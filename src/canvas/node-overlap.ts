import type { CanvasNode } from "@/canvas/types"

/**
 * AABB 重叠检测：判断两个矩形是否相交
 */
export function doNodesOverlap(
  first: Pick<CanvasNode, 'height' | 'width' | 'x' | 'y'>,
  second: Pick<CanvasNode, 'height' | 'width' | 'x' | 'y'>,
): boolean {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

/**
 * 在已有节点集合中查找不重叠的位置。
 * 从初始位置开始，沿 Y 轴逐步偏移直到找到不重叠的位置。
 */
export function findNonOverlappingPosition(
  initialX: number,
  initialY: number,
  width: number,
  height: number,
  existingNodes: Pick<CanvasNode, 'height' | 'width' | 'x' | 'y'>[],
  stepY: number,
  maxAttempts = 100,
): { x: number, y: number } {
  let x = initialX
  let y = initialY

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const candidate = { x, y, width, height }
    const overlaps = existingNodes.some((node) => doNodesOverlap(candidate, node))
    if (!overlaps) break
    y += stepY
  }

  return { x, y }
}

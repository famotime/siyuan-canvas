import type { CanvasDocument, CanvasNode } from "@/canvas/types"

export interface AlignmentGuideLine {
  /** 参考线在 board 坐标系中的位置 */
  position: number
  /** 参考线的起点（board 坐标系中的次要轴坐标） */
  spanStart: number
  /** 参考线的终点 */
  spanEnd: number
}

export interface AlignmentGuideResult {
  /** 吸附调整后的 deltaX */
  deltaX: number
  /** 吸附调整后的 deltaY */
  deltaY: number
  /** 水平参考线（边对齐/中心对齐的 Y 轴位置） */
  horizontal: AlignmentGuideLine[]
  /** 垂直参考线（边对齐/中心对齐的 X 轴位置） */
  vertical: AlignmentGuideLine[]
}

const SNAP_THRESHOLD = 8
const MIN_SPAN_PADDING = 8

interface NodeBounds {
  id: string
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
  width: number
  height: number
}

function getNodeBounds(node: CanvasNode): NodeBounds {
  return {
    bottom: node.y + node.height,
    centerX: node.x + node.width / 2,
    centerY: node.y + node.height / 2,
    height: node.height,
    id: node.id,
    left: node.x,
    right: node.x + node.width,
    top: node.y,
    width: node.width,
  }
}

/**
 * 计算拖拽时的智能对齐参考线和吸附调整量。
 * @param document 当前文档
 * @param draggedBounds 所有被拖拽节点的合并边界（移动后的位置）
 * @param draggedIds 被拖拽节点的 ID 集合
 * @param boardLeft board 的 left 偏移（用于将 canvas 坐标转为 board 坐标）
 * @param boardTop board 的 top 偏移
 */
export function computeAlignment(
  document: CanvasDocument,
  draggedBounds: { left: number, right: number, top: number, bottom: number, centerX: number, centerY: number, width: number, height: number },
  draggedIds: Set<string>,
  boardLeft: number,
  boardTop: number,
  rawDeltaX: number,
  rawDeltaY: number,
): AlignmentGuideResult {
  const horizontal: AlignmentGuideLine[] = []
  const vertical: AlignmentGuideLine[] = []

  let snapDeltaX = rawDeltaX
  let snapDeltaY = rawDeltaY

  // 收集所有静态节点的边界
  const staticBounds: NodeBounds[] = []
  for (const node of document.nodes) {
    if (draggedIds.has(node.id)) continue
    staticBounds.push(getNodeBounds(node))
  }

  if (staticBounds.length === 0) {
    return { deltaX: rawDeltaX, deltaY: rawDeltaY, horizontal: [], vertical: [] }
  }

  // 计算所有静态节点的整体范围（用于确定参考线 span）
  const allBounds = [...staticBounds, {
    left: draggedBounds.left, right: draggedBounds.right,
    top: draggedBounds.top, bottom: draggedBounds.bottom,
    centerX: draggedBounds.centerX, centerY: draggedBounds.centerY,
    width: draggedBounds.width, height: draggedBounds.height,
    id: '',
  }]

  const globalTop = Math.min(...allBounds.map(b => b.top)) - MIN_SPAN_PADDING
  const globalBottom = Math.max(...allBounds.map(b => b.bottom)) + MIN_SPAN_PADDING
  const globalLeft = Math.min(...allBounds.map(b => b.left)) - MIN_SPAN_PADDING
  const globalRight = Math.max(...allBounds.map(b => b.right)) + MIN_SPAN_PADDING

  // 垂直对齐检查（X 轴：左边缘、水平中心、右边缘）
  let bestVerticalSnap = Infinity
  const vertChecks: Array<{ draggedValue: number, getStaticValue: (b: NodeBounds) => number }> = [
    { draggedValue: draggedBounds.left, getStaticValue: b => b.left },
    { draggedValue: draggedBounds.centerX, getStaticValue: b => b.centerX },
    { draggedValue: draggedBounds.right, getStaticValue: b => b.right },
    { draggedValue: draggedBounds.left, getStaticValue: b => b.right },
    { draggedValue: draggedBounds.right, getStaticValue: b => b.left },
    { draggedValue: draggedBounds.centerX, getStaticValue: b => b.left },
    { draggedValue: draggedBounds.centerX, getStaticValue: b => b.right },
  ]

  for (const check of vertChecks) {
    for (const sb of staticBounds) {
      const staticValue = check.getStaticValue(sb)
      const diff = check.draggedValue - staticValue
      if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestVerticalSnap)) {
        bestVerticalSnap = diff
        vertical.push({
          position: staticValue - boardLeft,
          spanStart: globalTop - boardTop,
          spanEnd: globalBottom - boardTop,
        })
      }
    }
  }

  if (Math.abs(bestVerticalSnap) < SNAP_THRESHOLD) {
    snapDeltaX = rawDeltaX - bestVerticalSnap
    // 去重：只保留最近吸附位置的线
    if (vertical.length > 0) {
      const snapPos = vertical[vertical.length - 1]!.position
      vertical.length = 0
      vertical.push({
        position: snapPos,
        spanStart: globalTop - boardTop,
        spanEnd: globalBottom - boardTop,
      })
    }
  } else {
    vertical.length = 0
  }

  // 水平对齐检查（Y 轴：上边缘、垂直中心、下边缘）
  let bestHorizontalSnap = Infinity
  const horizChecks: Array<{ draggedValue: number, getStaticValue: (b: NodeBounds) => number }> = [
    { draggedValue: draggedBounds.top, getStaticValue: b => b.top },
    { draggedValue: draggedBounds.centerY, getStaticValue: b => b.centerY },
    { draggedValue: draggedBounds.bottom, getStaticValue: b => b.bottom },
    { draggedValue: draggedBounds.top, getStaticValue: b => b.bottom },
    { draggedValue: draggedBounds.bottom, getStaticValue: b => b.top },
    { draggedValue: draggedBounds.centerY, getStaticValue: b => b.top },
    { draggedValue: draggedBounds.centerY, getStaticValue: b => b.bottom },
  ]

  for (const check of horizChecks) {
    for (const sb of staticBounds) {
      const staticValue = check.getStaticValue(sb)
      const diff = check.draggedValue - staticValue
      if (Math.abs(diff) < SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestHorizontalSnap)) {
        bestHorizontalSnap = diff
        horizontal.push({
          position: staticValue - boardTop,
          spanStart: globalLeft - boardLeft,
          spanEnd: globalRight - boardLeft,
        })
      }
    }
  }

  if (Math.abs(bestHorizontalSnap) < SNAP_THRESHOLD) {
    snapDeltaY = rawDeltaY - bestHorizontalSnap
    if (horizontal.length > 0) {
      const snapPos = horizontal[horizontal.length - 1]!.position
      horizontal.length = 0
      horizontal.push({
        position: snapPos,
        spanStart: globalLeft - boardLeft,
        spanEnd: globalRight - boardLeft,
      })
    }
  } else {
    horizontal.length = 0
  }

  return { deltaX: snapDeltaX, deltaY: snapDeltaY, horizontal, vertical }
}

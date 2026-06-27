import type {
  CanvasBounds,
  CanvasNode,
} from "@/canvas/types"

export type CanvasAlignmentGuideKind = "bottom" | "center-x" | "center-y" | "left" | "right" | "top"

export interface CanvasAlignmentGuide {
  axis: "x" | "y"
  kind: CanvasAlignmentGuideKind
  position: number
}

export interface CanvasAlignmentGuideResolution {
  deltaX: number
  deltaY: number
  guides: CanvasAlignmentGuide[]
}

export interface ResolveCanvasAlignmentGuidesOptions {
  deltaX: number
  deltaY: number
  movingNodeIds: string[]
  nodes: CanvasNode[]
  threshold?: number
}

const DEFAULT_ALIGNMENT_GUIDE_THRESHOLD = 8

function createBoundsForNodes(nodes: CanvasNode[]): CanvasBounds | null {
  if (nodes.length === 0) {
    return null
  }

  const left = Math.min(...nodes.map(node => node.x))
  const top = Math.min(...nodes.map(node => node.y))
  const right = Math.max(...nodes.map(node => node.x + node.width))
  const bottom = Math.max(...nodes.map(node => node.y + node.height))

  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  }
}

function getVerticalAnchors(bounds: CanvasBounds) {
  return [
    { kind: "left" as const, value: bounds.x },
    { kind: "center-x" as const, value: bounds.x + bounds.width / 2 },
    { kind: "right" as const, value: bounds.x + bounds.width },
  ]
}

function getHorizontalAnchors(bounds: CanvasBounds) {
  return [
    { kind: "top" as const, value: bounds.y },
    { kind: "center-y" as const, value: bounds.y + bounds.height / 2 },
    { kind: "bottom" as const, value: bounds.y + bounds.height },
  ]
}

function getBoundsDistance(a: CanvasBounds, b: CanvasBounds): number {
  const aCenterX = a.x + a.width / 2
  const aCenterY = a.y + a.height / 2
  const bCenterX = b.x + b.width / 2
  const bCenterY = b.y + b.height / 2
  const dx = aCenterX - bCenterX
  const dy = aCenterY - bCenterY
  return Math.sqrt(dx * dx + dy * dy)
}

function resolveAxisSnap<TKind extends CanvasAlignmentGuideKind>(
  movingAnchors: Array<{ kind: TKind, value: number }>,
  targetAnchors: Array<{ kind: TKind, value: number, spatialDistance: number }>,
  threshold: number,
): null | { kind: TKind, offset: number, position: number, spatialDistance: number } {
  let best: null | { distance: number, kind: TKind, offset: number, position: number, spatialDistance: number } = null

  for (const movingAnchor of movingAnchors) {
    for (const targetAnchor of targetAnchors) {
      if (targetAnchor.kind !== movingAnchor.kind) {
        continue
      }

      const offset = targetAnchor.value - movingAnchor.value
      const distance = Math.abs(offset)
      if (distance > threshold) {
        continue
      }

      // 优先吸附空间距离近的目标卡片（差距超10个画布单位）。在空间距离极其接近时，才比较对齐偏离量。
      const isBetter = !best
        || targetAnchor.spatialDistance < best.spatialDistance - 10
        || (Math.abs(targetAnchor.spatialDistance - best.spatialDistance) <= 10 && distance < best.distance)

      if (isBetter) {
        best = {
          distance,
          kind: movingAnchor.kind,
          offset,
          position: targetAnchor.value,
          spatialDistance: targetAnchor.spatialDistance,
        }
      }
    }
  }

  return best
}

export function resolveCanvasAlignmentGuides(options: ResolveCanvasAlignmentGuidesOptions): CanvasAlignmentGuideResolution {
  const threshold = options.threshold ?? DEFAULT_ALIGNMENT_GUIDE_THRESHOLD
  const movingIdSet = new Set(options.movingNodeIds)
  const movingNodes = options.nodes.filter(node => movingIdSet.has(node.id))
  const targetNodes = options.nodes.filter(node => !movingIdSet.has(node.id))
  const movingBounds = createBoundsForNodes(movingNodes)

  if (!movingBounds || targetNodes.length === 0) {
    return {
      deltaX: options.deltaX,
      deltaY: options.deltaY,
      guides: [],
    }
  }

  const movedBounds = {
    ...movingBounds,
    x: movingBounds.x + options.deltaX,
    y: movingBounds.y + options.deltaY,
  }
  const targetBoundsWithDistance = targetNodes
    .map((node) => {
      const bounds = createBoundsForNodes([node])
      if (!bounds) {
        return null
      }
      const spatialDistance = getBoundsDistance(movedBounds, bounds)
      return { bounds, spatialDistance }
    })
    .filter((item): item is { bounds: CanvasBounds, spatialDistance: number } => Boolean(item))

  const xSnap = resolveAxisSnap(
    getVerticalAnchors(movedBounds),
    targetBoundsWithDistance.flatMap(({ bounds, spatialDistance }) =>
      getVerticalAnchors(bounds).map(anchor => ({ ...anchor, spatialDistance }))
    ),
    threshold,
  )
  const ySnap = resolveAxisSnap(
    getHorizontalAnchors(movedBounds),
    targetBoundsWithDistance.flatMap(({ bounds, spatialDistance }) =>
      getHorizontalAnchors(bounds).map(anchor => ({ ...anchor, spatialDistance }))
    ),
    threshold,
  )
  const guides: CanvasAlignmentGuide[] = []

  if (xSnap) {
    guides.push({
      axis: "x",
      kind: xSnap.kind,
      position: xSnap.position,
    })
  }

  if (ySnap) {
    guides.push({
      axis: "y",
      kind: ySnap.kind,
      position: ySnap.position,
    })
  }

  return {
    deltaX: options.deltaX + (xSnap?.offset ?? 0),
    deltaY: options.deltaY + (ySnap?.offset ?? 0),
    guides,
  }
}

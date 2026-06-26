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

function resolveAxisSnap<TKind extends CanvasAlignmentGuideKind>(
  movingAnchors: Array<{ kind: TKind, value: number }>,
  targetAnchors: Array<{ kind: TKind, value: number }>,
  threshold: number,
): null | { kind: TKind, offset: number, position: number } {
  let best: null | { distance: number, kind: TKind, offset: number, position: number } = null

  for (const movingAnchor of movingAnchors) {
    for (const targetAnchor of targetAnchors) {
      const offset = targetAnchor.value - movingAnchor.value
      const distance = Math.abs(offset)
      if (distance > threshold) {
        continue
      }

      if (!best || distance < best.distance) {
        best = {
          distance,
          kind: movingAnchor.kind,
          offset,
          position: targetAnchor.value,
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
  const targetBoundsList = targetNodes
    .map(node => createBoundsForNodes([node]))
    .filter((bounds): bounds is CanvasBounds => Boolean(bounds))

  const xSnap = resolveAxisSnap(
    getVerticalAnchors(movedBounds),
    targetBoundsList.flatMap(getVerticalAnchors),
    threshold,
  )
  const ySnap = resolveAxisSnap(
    getHorizontalAnchors(movedBounds),
    targetBoundsList.flatMap(getHorizontalAnchors),
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

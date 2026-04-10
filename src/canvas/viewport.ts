export interface CanvasViewport {
  scale: number
  x: number
  y: number
}

export interface CanvasViewportPoint {
  x: number
  y: number
}

export const MIN_VIEWPORT_SCALE = 0.1
export const MAX_VIEWPORT_SCALE = 2.5

export function clampViewportScale(scale: number): number {
  return Math.min(MAX_VIEWPORT_SCALE, Math.max(MIN_VIEWPORT_SCALE, scale))
}

export function scaleViewportAtPoint(
  viewport: CanvasViewport,
  point: CanvasViewportPoint,
  nextScale: number,
): CanvasViewport {
  const worldX = (point.x - viewport.x) / viewport.scale
  const worldY = (point.y - viewport.y) / viewport.scale

  return {
    scale: nextScale,
    x: point.x - worldX * nextScale,
    y: point.y - worldY * nextScale,
  }
}

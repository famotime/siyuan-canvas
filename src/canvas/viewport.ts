export interface CanvasViewport {
  scale: number
  x: number
  y: number
}

export interface CanvasViewportPoint {
  x: number
  y: number
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

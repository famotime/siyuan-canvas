import type { CanvasNode } from "@/canvas/types"

import { toPng } from "html-to-image"

export type CanvasPngExportRange = "full" | "viewport"
export type CanvasPngExportBackgroundMode = "custom" | "transparent" | "white"

export interface CanvasPngExportBounds {
  height: number
  width: number
  x: number
  y: number
}

export interface CanvasPngExportOptions {
  background: {
    color: string
    mode: CanvasPngExportBackgroundMode
  }
  range: CanvasPngExportRange
}

interface CanvasViewportSnapshot {
  scale: number
  x: number
  y: number
}

interface CanvasStageSize {
  height: number
  width: number
}

interface ResolveCanvasPngExportBoundsOptions {
  nodes: CanvasNode[]
  padding: number
  range: CanvasPngExportRange
  stageSize: CanvasStageSize
  viewport: CanvasViewportSnapshot
}

interface ExportCanvasWorldToPngOptions {
  backgroundColor?: string
  bounds: CanvasPngExportBounds
  filename: string
  world: HTMLElement
}

const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i
const PNG_EXPORT_IGNORE_SELECTOR = "[data-canvas-png-export-ignore='true']"

export function resolveCanvasPngExportBounds(options: ResolveCanvasPngExportBoundsOptions): CanvasPngExportBounds {
  const {
    nodes,
    padding,
    range,
    stageSize,
    viewport,
  } = options

  if (range === "viewport") {
    const scale = viewport.scale || 1
    return {
      height: Math.max(1, stageSize.height / scale),
      width: Math.max(1, stageSize.width / scale),
      x: -viewport.x / scale,
      y: -viewport.y / scale,
    }
  }

  if (nodes.length === 0) {
    return {
      height: 1,
      width: 1,
      x: 0,
      y: 0,
    }
  }

  const minX = Math.min(...nodes.map(node => node.x))
  const minY = Math.min(...nodes.map(node => node.y))
  const maxX = Math.max(...nodes.map(node => node.x + node.width))
  const maxY = Math.max(...nodes.map(node => node.y + node.height))

  return {
    height: Math.max(1, maxY - minY + padding * 2),
    width: Math.max(1, maxX - minX + padding * 2),
    x: minX - padding,
    y: minY - padding,
  }
}

export function resolveCanvasPngExportBackground(options: CanvasPngExportOptions["background"]): string | undefined {
  if (options.mode === "transparent") {
    return undefined
  }

  if (options.mode === "custom") {
    return HEX_COLOR_PATTERN.test(options.color) ? options.color : "#ffffff"
  }

  return "#ffffff"
}

export function createCanvasPngExportFilename(name: string): string {
  const normalized = name.trim().replace(/\.canvas$/i, "").replace(/\.png$/i, "")
  return `${normalized || "canvas-export"}.png`
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  console.log("[Canvas PNG Export] downloadDataUrl", { filename, dataUrlLen: dataUrl.length })
  const anchor = document.createElement("a")
  anchor.href = dataUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  console.log("[Canvas PNG Export] anchor click dispatched")
}

export function shouldIncludeCanvasPngExportNode(node: Node): boolean {
  if (!(node instanceof Element)) {
    return true
  }

  return !node.closest(PNG_EXPORT_IGNORE_SELECTOR)
}

export async function exportCanvasWorldToPng(options: ExportCanvasWorldToPngOptions) {
  const scrollbarStyle = document.createElement("style")
  scrollbarStyle.textContent = `
    .canvas-node__body,
    .canvas-node__body * {
      scrollbar-width: none !important;
      overflow: hidden !important;
    }
    .canvas-node__body::-webkit-scrollbar,
    .canvas-node__body *::-webkit-scrollbar {
      display: none !important;
    }
  `
  options.world.appendChild(scrollbarStyle)

  const toPngOptions = {
    backgroundColor: options.backgroundColor,
    cacheBust: true,
    filter: shouldIncludeCanvasPngExportNode,
    height: Math.ceil(options.bounds.height),
    pixelRatio: 2,
    skipFonts: true,
    style: {
      height: `${options.world.offsetHeight}px`,
      transform: `translate(${-options.bounds.x}px, ${-options.bounds.y}px)`,
      transformOrigin: "top left",
      width: `${options.world.offsetWidth}px`,
    },
    width: Math.ceil(options.bounds.width),
  }

  if (toPngOptions.width <= 0 || toPngOptions.height <= 0) {
    throw new Error(`Invalid export bounds: ${toPngOptions.width}x${toPngOptions.height}`)
  }

  console.log("[Canvas PNG Export] toPng options", toPngOptions)

  try {
    const dataUrl = await toPng(options.world, toPngOptions)
    console.log("[Canvas PNG Export] toPng succeeded, dataUrl length:", dataUrl.length)
    downloadDataUrl(dataUrl, options.filename)
  } finally {
    scrollbarStyle.remove()
  }
}

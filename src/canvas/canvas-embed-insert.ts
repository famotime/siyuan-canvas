import type { CanvasDocument } from "@/canvas/types"
import { appendBlock, setBlockAttrs, updateBlock } from "@/api"
import { parseCanvasDocument } from "@/canvas/format"
import { generateCanvasEmbedDataUrl } from "@/canvas/canvas-embed-preview"

export const CANVAS_EMBED_CLASS = "canvas-embed-preview"
export const CANVAS_EMBED_BOUND_ATTR = "data-canvas-embed-bound"
export const CANVAS_PATH_ATTR = "custom-canvas-path"

function buildCanvasEmbedHtml(canvasPath: string, dataUrl: string, title: string): string {
  const escapedPath = canvasPath.replace(/"/g, "&quot;")
  const escapedTitle = title.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  return `<!-- canvas-embed -->
<div class="${CANVAS_EMBED_CLASS}" data-canvas-path="${escapedPath}">
  <img src="${dataUrl}" alt="${escapedTitle}" style="max-width:100%;border-radius:6px;" />
  <span class="canvas-embed-badge">Canvas</span>
  <span class="canvas-embed-title">${escapedTitle}</span>
</div>`
}

export interface InsertCanvasEmbedOptions {
  canvasPath: string
  canvasRaw: string
  parentBlockId: string
  title?: string
}

export async function insertCanvasEmbed(options: InsertCanvasEmbedOptions): Promise<string | null> {
  const { canvasPath, canvasRaw, parentBlockId, title } = options

  const result = parseCanvasDocument(canvasRaw)
  if (!result.document || result.errors.length > 0) {
    return null
  }

  const dataUrl = generateCanvasEmbedDataUrl(result.document)
  if (!dataUrl) {
    return null
  }

  const embedTitle = title || canvasPath.replace(/^.*\//, "").replace(/\.canvas$/i, "")
  const html = buildCanvasEmbedHtml(canvasPath, dataUrl, embedTitle)

  const ops = await appendBlock("dom", html, parentBlockId)
  if (!ops || ops.length === 0) {
    return null
  }

  const blockId = ops[0].doOperations?.[0]?.id as string | undefined
  if (blockId) {
    await setBlockAttrs(blockId, { [CANVAS_PATH_ATTR]: canvasPath })
  }

  return blockId ?? null
}

export async function refreshCanvasEmbedBlock(
  blockId: string,
  canvasPath: string,
  canvasRaw: string,
  title?: string,
): Promise<boolean> {
  const result = parseCanvasDocument(canvasRaw)
  if (!result.document || result.errors.length > 0) {
    return false
  }

  const dataUrl = generateCanvasEmbedDataUrl(result.document)
  if (!dataUrl) {
    return false
  }

  const embedTitle = title || canvasPath.replace(/^.*\//, "").replace(/\.canvas$/i, "")
  const html = buildCanvasEmbedHtml(canvasPath, dataUrl, embedTitle)

  await updateBlock("dom", html, blockId)
  return true
}

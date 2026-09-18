import {
  appendBlock,
  insertBlock,
  setBlockAttrs,
  upload,
  updateBlock,
} from "@/api"
import { generateCanvasEmbedSvg } from "@/canvas/canvas-embed-preview"
import { parseCanvasDocument } from "@/canvas/format"

export const CANVAS_EMBED_CLASS = "canvas-embed-preview"
export const CANVAS_EMBED_BOUND_ATTR = "data-canvas-embed-bound"
export const CANVAS_PATH_ATTR = "custom-canvas-path"
export const CANVAS_EMBED_REFRESH_EVENT = "siyuan-canvas-embed-refresh"

export interface CanvasEmbedRefreshEventDetail {
  path: string
}

function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/]/g, "\\]")
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/]/g, "\\]")
}

function sanitizePreviewAssetName(value: string): string {
  return (value || "canvas-preview")
    .replace(/[\\/:*?"'<>|]/g, "_")
    .replace(/[\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    || "canvas-preview"
}

async function uploadCanvasEmbedPreview(svg: string, title: string): Promise<string | null> {
  const fileName = `${sanitizePreviewAssetName(title)}.svg`
  const file = new File([svg], fileName, { type: "image/svg+xml" })
  const result = await upload("/assets/", [file])
  return result?.succMap?.[fileName] || null
}

function escapeMarkdownImageTitle(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function buildCanvasEmbedMarkdown(_canvasPath: string, imagePath: string, title: string): string {
  const safeTitle = escapeMarkdownImageTitle(title)
  return `![${escapeMarkdownImageAlt(title)}](${imagePath} "${safeTitle}")`
}

export function buildCanvasLinkMarkdown(canvasPath: string, title?: string): string {
  const fileName = title || canvasPath.replace(/^.*\//, "") || "canvas.canvas"
  return `[${escapeMarkdownLinkText(fileName)}](${canvasPath})`
}

export interface InsertCanvasEmbedOptions {
  canvasPath: string
  canvasRaw: string
  parentBlockId: string
  previousBlockId?: string
  title?: string
}

export interface InsertCanvasLinkOptions {
  canvasPath: string
  parentBlockId: string
  previousBlockId?: string
  title?: string
}

export async function insertCanvasEmbed(options: InsertCanvasEmbedOptions): Promise<string | null> {
  const {
    canvasPath,
    canvasRaw,
    parentBlockId,
    previousBlockId,
    title,
  } = options

  const result = parseCanvasDocument(canvasRaw)
  if (!result.document || result.errors.length > 0) {
    return null
  }

  const svg = generateCanvasEmbedSvg(result.document)
  if (!svg) {
    return null
  }

  const embedTitle = title || canvasPath.replace(/^.*\//, "").replace(/\.canvas$/i, "")
  const imagePath = await uploadCanvasEmbedPreview(svg, embedTitle)
  if (!imagePath) {
    return null
  }
  const markdown = buildCanvasEmbedMarkdown(canvasPath, imagePath, embedTitle)

  let ops = previousBlockId
    ? await insertBlock("markdown", markdown, undefined, previousBlockId, parentBlockId)
    : null
  if (!ops || ops.length === 0) {
    ops = await appendBlock("markdown", markdown, parentBlockId)
  }
  if (!ops || ops.length === 0) {
    return null
  }

  const blockId = ops[0].doOperations?.[0]?.id as string | undefined
  if (blockId) {
    await setBlockAttrs(blockId, { [CANVAS_PATH_ATTR]: canvasPath })
  }

  return blockId ?? null
}

export async function insertCanvasLink(options: InsertCanvasLinkOptions): Promise<string | null> {
  const {
    canvasPath,
    parentBlockId,
    previousBlockId,
    title,
  } = options

  const markdown = buildCanvasLinkMarkdown(canvasPath, title)

  let ops = previousBlockId
    ? await insertBlock("markdown", markdown, undefined, previousBlockId, parentBlockId)
    : null
  if (!ops || ops.length === 0) {
    ops = await appendBlock("markdown", markdown, parentBlockId)
  }
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

  const svg = generateCanvasEmbedSvg(result.document)
  if (!svg) {
    return false
  }

  const embedTitle = title || canvasPath.replace(/^.*\//, "").replace(/\.canvas$/i, "")
  const imagePath = await uploadCanvasEmbedPreview(svg, embedTitle)
  if (!imagePath) {
    return false
  }

  await updateBlock("markdown", buildCanvasEmbedMarkdown(canvasPath, imagePath, embedTitle), blockId)
  await setBlockAttrs(blockId, { [CANVAS_PATH_ATTR]: canvasPath })

  return true
}

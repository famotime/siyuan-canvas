export interface ResolvedCanvasImageTarget {
  blockId?: string
  kind: "image"
  openPath: string
  path: string
  title: string
}

export interface ResolvedCanvasBlockTarget {
  hpath: string
  id: string
  kind: "block"
  path: string
  rootId: string
  type?: string
  title: string
}

export interface ResolvedCanvasDocumentTarget {
  hpath: string
  id: string
  kind: "document"
  path: string
  title: string
}

export interface ResolvedCanvasNestedTarget {
  kind: "canvas"
  path: string
  title: string
}

export interface ResolvedCanvasFileFallbackTarget {
  kind: "file"
  path: string
  title: string
}

export type ResolvedCanvasFileTarget =
  | ResolvedCanvasBlockTarget
  | ResolvedCanvasDocumentTarget
  | ResolvedCanvasNestedTarget
  | ResolvedCanvasImageTarget
  | ResolvedCanvasFileFallbackTarget

export interface CanvasFileTargetLookups {
  resolveBlockById: (blockId: string) => Promise<ResolvedCanvasBlockTarget | null>
  resolveCanvasByPath: (path: string) => Promise<ResolvedCanvasNestedTarget | null>
  resolveDocumentByBlockId: (blockId: string) => Promise<ResolvedCanvasDocumentTarget | null>
  resolveDocumentByPath: (path: string) => Promise<ResolvedCanvasDocumentTarget | null>
  resolveImageByBlockId: (blockId: string) => Promise<ResolvedCanvasImageTarget | null>
  resolveImageByPath: (path: string) => Promise<ResolvedCanvasImageTarget | null>
}

const BLOCK_ID_PATTERN = /^\d{14}-[a-z0-9]{7}$/i
const EMBEDDED_BLOCK_ID_PATTERN = /\{\:\s*[^}]*\bid="(\d{14}-[a-z0-9]{7})"[^}]*\}/i
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/i
const IMAGE_PATH_PATTERN = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i

function getFallbackTitle(path: string): string {
  const segments = path.replace(/\\/g, "/").split("/")
  return segments[segments.length - 1] || path
}

function toDirectImageOpenPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed || trimmed.startsWith("/")) {
    return trimmed
  }

  if (trimmed.startsWith("assets/")) {
    return `/data/${trimmed}`
  }

  if (trimmed.startsWith("data/")) {
    return `/${trimmed}`
  }

  return trimmed
}

function extractEmbeddedBlockId(input: string): string | null {
  return input.match(EMBEDDED_BLOCK_ID_PATTERN)?.[1] || null
}

function extractEmbeddedImagePath(input: string): string | null {
  return input.match(MARKDOWN_IMAGE_PATTERN)?.[1]?.trim() || null
}

export async function resolveCanvasFileTarget(
  input: string,
  lookups: CanvasFileTargetLookups,
): Promise<ResolvedCanvasFileTarget> {
  const trimmed = input.trim()
  if (!trimmed) {
    return {
      kind: "file",
      path: "",
      title: "",
    }
  }

  const blockId = BLOCK_ID_PATTERN.test(trimmed) ? trimmed : extractEmbeddedBlockId(trimmed)
  if (blockId) {
    const block = await lookups.resolveBlockById(blockId)
    if (block) {
      return block
    }

    const image = await lookups.resolveImageByBlockId(blockId)
    if (image) {
      return image
    }

    const document = await lookups.resolveDocumentByBlockId(blockId)
    if (document) {
      return document
    }
  }

  const lookupPath = extractEmbeddedImagePath(trimmed) || trimmed

  const canvas = await lookups.resolveCanvasByPath(lookupPath)
  if (canvas) {
    return canvas
  }

  const document = await lookups.resolveDocumentByPath(lookupPath)
  if (document) {
    return document
  }

  const image = await lookups.resolveImageByPath(lookupPath)
  if (image) {
    return image
  }

  if (IMAGE_PATH_PATTERN.test(lookupPath)) {
    return {
      kind: "image",
      openPath: toDirectImageOpenPath(lookupPath),
      path: lookupPath,
      title: getFallbackTitle(lookupPath),
    }
  }

  return {
    kind: "file",
    path: trimmed,
    title: getFallbackTitle(trimmed),
  }
}

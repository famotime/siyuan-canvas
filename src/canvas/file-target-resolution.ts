export interface ResolvedCanvasImageTarget {
  blockId?: string
  kind: "image"
  openPath: string
  path: string
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
  | ResolvedCanvasDocumentTarget
  | ResolvedCanvasNestedTarget
  | ResolvedCanvasImageTarget
  | ResolvedCanvasFileFallbackTarget

export interface CanvasFileTargetLookups {
  resolveCanvasByPath: (path: string) => Promise<ResolvedCanvasNestedTarget | null>
  resolveDocumentByBlockId: (blockId: string) => Promise<ResolvedCanvasDocumentTarget | null>
  resolveDocumentByPath: (path: string) => Promise<ResolvedCanvasDocumentTarget | null>
  resolveImageByBlockId: (blockId: string) => Promise<ResolvedCanvasImageTarget | null>
  resolveImageByPath: (path: string) => Promise<ResolvedCanvasImageTarget | null>
}

const BLOCK_ID_PATTERN = /^\d{14}-[a-z0-9]{7}$/i

function getFallbackTitle(path: string): string {
  const segments = path.replace(/\\/g, "/").split("/")
  return segments[segments.length - 1] || path
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

  if (BLOCK_ID_PATTERN.test(trimmed)) {
    const image = await lookups.resolveImageByBlockId(trimmed)
    if (image) {
      return image
    }

    const document = await lookups.resolveDocumentByBlockId(trimmed)
    if (document) {
      return document
    }
  }

  const canvas = await lookups.resolveCanvasByPath(trimmed)
  if (canvas) {
    return canvas
  }

  const document = await lookups.resolveDocumentByPath(trimmed)
  if (document) {
    return document
  }

  const image = await lookups.resolveImageByPath(trimmed)
  if (image) {
    return image
  }

  return {
    kind: "file",
    path: trimmed,
    title: getFallbackTitle(trimmed),
  }
}

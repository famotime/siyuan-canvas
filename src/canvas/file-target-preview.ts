import type { ResolvedCanvasFileTarget } from "@/canvas/file-target-resolution"
import type { ResolvedCanvasFileNode } from "@/canvas/file-node-resolution"

export interface CanvasThumbnailNode {
  height: number
  width: number
  x: number
  y: number
}

export interface CanvasThumbnailEdge {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface CanvasFileTargetPreview {
  badge: string
  clampMode?: "viewport"
  detail: string
  headline: string
  helper: string
  imageSrc?: string
  kind: "canvas" | "document" | "file" | "image"
  previewHtml?: string
  thumbnail?: {
    edges: CanvasThumbnailEdge[]
    nodes: CanvasThumbnailNode[]
  }
}

type PreviewInput = (
  ResolvedCanvasFileTarget
  | ResolvedCanvasFileNode
) & {
  excerptHtml?: string
  thumbnail?: {
    edges: CanvasThumbnailEdge[]
    nodes: CanvasThumbnailNode[]
  }
}

function toImageSource(target: PreviewInput): string | undefined {
  if ("openPath" in target && typeof target.openPath === "string") {
    return target.openPath
  }

  if ("asset" in target && target.asset?.openPath) {
    return target.asset.openPath
  }

  return undefined
}

export function createCanvasFileTargetPreview(target: PreviewInput): CanvasFileTargetPreview {
  switch (target.kind) {
    case "document":
      return {
        badge: "Document",
        clampMode: "viewport",
        detail: "hpath" in target ? target.hpath || target.path : target.path,
        headline: target.title,
        helper: "Opens in SiYuan",
        kind: "document",
        previewHtml: target.excerptHtml || "",
      }
    case "canvas":
      return {
        badge: "Canvas",
        detail: target.path,
        headline: target.title,
        helper: "Opens nested canvas",
        kind: "canvas",
        thumbnail: target.thumbnail,
      }
    case "image":
      return {
        badge: "Image",
        detail: target.path,
        headline: target.title,
        helper: "Image file",
        imageSrc: toImageSource(target),
        kind: "image",
      }
    case "asset":
      return {
        badge: "Image Asset",
        detail: "description" in target ? target.description : target.path,
        headline: target.title,
        helper: "Opens in asset viewer",
        imageSrc: toImageSource(target),
        kind: "image",
      }
    default:
      return {
        badge: "File",
        detail: "description" in target ? target.description : target.path,
        headline: target.title,
        helper: "Unresolved path",
        kind: "file",
      }
  }
}

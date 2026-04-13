import type { ResolvedCanvasFileTarget } from "@/canvas/file-target-resolution"
import type { ResolvedCanvasFileNode } from "@/canvas/file-node-resolution"

import { parseCanvasDocument } from "@/canvas/format"

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
  kind: "block" | "canvas" | "document" | "file" | "image"
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
  imageSrc?: string
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

  if ("imageSrc" in target && typeof target.imageSrc === "string") {
    return target.imageSrc
  }

  return undefined
}

export function createCanvasFileTargetPreview(target: PreviewInput): CanvasFileTargetPreview {
  switch (target.kind) {
    case "block":
      return {
        badge: "Block",
        clampMode: "viewport",
        detail: "hpath" in target ? target.hpath || target.path : target.path,
        headline: target.title,
        helper: "Opens block in SiYuan",
        imageSrc: toImageSource(target),
        kind: "block",
        previewHtml: target.excerptHtml || "",
      }
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

export async function loadCanvasTargetPreview(
  target: Extract<ResolvedCanvasFileTarget, { kind: "canvas" }>,
  sources: {
    readCanvasText: (path: string) => Promise<string>
  },
): Promise<CanvasFileTargetPreview> {
  try {
    const raw = await sources.readCanvasText(target.path)
    const parsed = parseCanvasDocument(raw)
    if (!parsed.document) {
      return createCanvasFileTargetPreview(target)
    }

    const nodeById = new Map(parsed.document.nodes.map((node) => [node.id, node]))
    return createCanvasFileTargetPreview({
      ...target,
      thumbnail: {
        edges: parsed.document.edges.flatMap((edge) => {
          const fromNode = nodeById.get(edge.fromNode)
          const toNode = nodeById.get(edge.toNode)
          if (!fromNode || !toNode) {
            return []
          }

          return [{
            fromX: fromNode.x + fromNode.width / 2,
            fromY: fromNode.y + fromNode.height / 2,
            toX: toNode.x + toNode.width / 2,
            toY: toNode.y + toNode.height / 2,
          }]
        }),
        nodes: parsed.document.nodes.map((node) => ({
          height: node.height,
          width: node.width,
          x: node.x,
          y: node.y,
        })),
      },
    })
  } catch {
    return createCanvasFileTargetPreview(target)
  }
}

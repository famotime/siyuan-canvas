import type { ResolvedCanvasFileNode } from "@/canvas/file-node-resolution"

export interface CanvasFileNodePreview {
  badge: string
  detail: string
  headline: string
  helper: string
  imageSrc?: string
}

function isImageAssetPath(path: string): boolean {
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(path)
}

export function createCanvasFileNodePreview(node: ResolvedCanvasFileNode): CanvasFileNodePreview {
  switch (node.kind) {
    case "canvas":
      return {
        badge: "Canvas",
        detail: node.description,
        headline: node.title,
        helper: "Opens nested canvas",
      }
    case "document":
      return {
        badge: "Document",
        detail: node.description,
        headline: node.title,
        helper: "Opens in SiYuan",
      }
    case "asset":
      return {
        badge: isImageAssetPath(node.asset?.path || node.path) ? "Image Asset" : "Asset",
        detail: node.description,
        headline: node.title,
        helper: "Opens in asset viewer",
        imageSrc: isImageAssetPath(node.asset?.path || node.path) ? node.asset?.openPath : undefined,
      }
    case "file":
      return {
        badge: "File",
        detail: node.description,
        headline: node.title,
        helper: "Unresolved path",
      }
    default:
      return {
        badge: "File",
        detail: node.description,
        headline: node.title,
        helper: "Unresolved path",
      }
  }
}

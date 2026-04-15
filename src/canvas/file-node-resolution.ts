import {
  resolveCanvasFileTarget,
  type CanvasFileTargetLookups,
} from "@/canvas/file-target-resolution"

export interface ResolvedCanvasDocument {
  hpath: string
  id: string
  path: string
  title: string
}

export interface ResolvedCanvasAsset {
  name: string
  openPath: string
  path: string
  title?: string
}

export interface ResolveCanvasFileNodeLookups {
  resolveAssetByPath: (path: string) => Promise<ResolvedCanvasAsset | null>
  resolveDocumentByPath: (path: string) => Promise<ResolvedCanvasDocument | null>
}

export interface ResolvedCanvasFileNode {
  asset?: ResolvedCanvasAsset
  description: string
  document?: ResolvedCanvasDocument
  kind: "asset" | "canvas" | "document" | "file"
  path: string
  title: string
}

function getFileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

export function createFallbackCanvasFileNode(path: string): ResolvedCanvasFileNode {
  const trimmed = path.trim()
  return {
    description: trimmed,
    kind: trimmed.endsWith(".canvas") ? "canvas" : "file",
    path: trimmed,
    title: getFileName(trimmed),
  }
}

export async function resolveCanvasFileNode(
  path: string,
  lookups: ResolveCanvasFileNodeLookups,
): Promise<ResolvedCanvasFileNode> {
  const targetLookups: CanvasFileTargetLookups = {
    resolveBlockById: async () => null,
    resolveCanvasByPath: async (candidatePath) => {
      const trimmed = candidatePath.trim()
      if (!trimmed.endsWith(".canvas")) {
        return null
      }

      return {
        kind: "canvas",
        path: trimmed,
        title: getFileName(trimmed),
      }
    },
    resolveDocumentByBlockId: async () => null,
    resolveDocumentByPath: async (candidatePath) => {
      const document = await lookups.resolveDocumentByPath(candidatePath)
      return document
        ? {
            hpath: document.hpath,
            id: document.id,
            kind: "document" as const,
            path: document.path,
            title: document.title,
          }
        : null
    },
    resolveImageByBlockId: async () => null,
    resolveImageByPath: async (candidatePath) => {
      const asset = await lookups.resolveAssetByPath(candidatePath)
      return asset
        ? {
            blockId: asset.blockId,
            kind: "image" as const,
            openPath: asset.openPath,
            path: asset.path,
            title: asset.title || asset.name,
          }
        : null
    },
  }

  const resolved = await resolveCanvasFileTarget(path, targetLookups)

  switch (resolved.kind) {
    case "document":
      return {
        description: resolved.hpath || resolved.path,
        document: {
          hpath: resolved.hpath,
          id: resolved.id,
          path: resolved.path,
          title: resolved.title,
        },
        kind: "document",
        path,
        title: resolved.title || getFileName(resolved.path),
      }
    case "canvas":
      return {
        description: resolved.path,
        kind: "canvas",
        path,
        title: resolved.title || getFileName(resolved.path),
      }
    case "image":
      return {
        asset: {
          blockId: resolved.blockId,
          name: resolved.title || getFileName(resolved.path),
          openPath: resolved.openPath,
          path: resolved.path,
          title: resolved.title,
        },
        description: resolved.path,
        kind: "asset",
        path,
        title: resolved.title || getFileName(resolved.path),
      }
    case "block":
      return {
        description: resolved.hpath || resolved.path,
        document: {
          hpath: resolved.hpath,
          id: resolved.rootId,
          path: resolved.path,
          title: resolved.title,
        },
        kind: "document",
        path,
        title: resolved.title || getFileName(resolved.path),
      }
    default:
      return {
        description: resolved.path,
        kind: "file",
        path,
        title: resolved.title || getFileName(resolved.path),
      }
  }
}

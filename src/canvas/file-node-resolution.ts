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
  return path.split("/").pop() || path
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
  const fallback = createFallbackCanvasFileNode(path)
  if (fallback.kind === "canvas") {
    return fallback
  }

  const document = await lookups.resolveDocumentByPath(path)
  if (document) {
    return {
      description: document.hpath || document.path,
      document,
      kind: "document",
      path,
      title: document.title || getFileName(document.path),
    }
  }

  const asset = await lookups.resolveAssetByPath(path)
  if (asset) {
    return {
      asset,
      description: asset.path,
      kind: "asset",
      path,
      title: asset.title || asset.name,
    }
  }

  return fallback
}

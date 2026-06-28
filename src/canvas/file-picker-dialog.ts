export interface CanvasFilePickerOption {
  blockId?: string
  kind: "block" | "canvas" | "document" | "image" | "query"
  path: string
  subtitle: string
  title: string
}

export interface CanvasFilePickerGroups {
  blocks: CanvasFilePickerOption[]
  canvases: CanvasFilePickerOption[]
  documents: CanvasFilePickerOption[]
  images: CanvasFilePickerOption[]
}

export async function searchCanvasFilePickerTargets(
  query: string,
  sources: {
    searchBlocks: (query: string) => Promise<CanvasFilePickerOption[]>
    searchDocuments: (query: string) => Promise<CanvasFilePickerOption[]>
    searchImages: (query: string) => Promise<CanvasFilePickerOption[]>
    searchWorkspaceCanvasFiles: (query: string) => Promise<CanvasFilePickerOption[]>
  },
): Promise<CanvasFilePickerGroups> {
  const trimmed = query.trim()
  const [blocks, documents, images, canvases] = await Promise.all([
    sources.searchBlocks(trimmed),
    sources.searchDocuments(trimmed),
    sources.searchImages(trimmed),
    sources.searchWorkspaceCanvasFiles(trimmed),
  ])

  return {
    blocks,
    canvases,
    documents,
    images,
  }
}

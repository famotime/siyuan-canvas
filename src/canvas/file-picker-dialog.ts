export interface CanvasFilePickerOption {
  kind: "canvas" | "document" | "image"
  path: string
  subtitle: string
  title: string
}

export interface CanvasFilePickerGroups {
  canvases: CanvasFilePickerOption[]
  documents: CanvasFilePickerOption[]
  images: CanvasFilePickerOption[]
}

export async function searchCanvasFilePickerTargets(
  query: string,
  sources: {
    searchDocuments: (query: string) => Promise<CanvasFilePickerOption[]>
    searchImages: (query: string) => Promise<CanvasFilePickerOption[]>
    searchWorkspaceCanvasFiles: (query: string) => Promise<CanvasFilePickerOption[]>
  },
): Promise<CanvasFilePickerGroups> {
  const trimmed = query.trim()
  const [documents, images, canvases] = await Promise.all([
    sources.searchDocuments(trimmed),
    sources.searchImages(trimmed),
    sources.searchWorkspaceCanvasFiles(trimmed),
  ])

  return {
    canvases,
    documents,
    images,
  }
}

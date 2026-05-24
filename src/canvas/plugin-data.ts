export type CanvasRecentFileSource = "local" | "workspace"

export const CANVAS_DEFAULT_DIRECTORY = "/data/storage/petal/siyuan-canvas"

export interface CanvasPluginSettings {
  defaultCanvasDirectory: string
  detectExternalChanges: boolean
  enableDebugLog: boolean
  recentFilesLimit: number
  noteCreationDirectory: string
  showCanvasThumbnails: boolean
}

export interface CanvasInspectorSectionsState {
  createEdge: boolean
  document: boolean
  edge: boolean
  node: boolean
  recent: boolean
  selection: boolean
}

export interface CanvasPluginUiState {
  inspectorSections: CanvasInspectorSectionsState
}

export interface CanvasRecentFile {
  openedAt: string
  path: string
  sourceType: CanvasRecentFileSource
  title: string
}

export interface CanvasPluginData {
  recentFiles: CanvasRecentFile[]
  settings: CanvasPluginSettings
  ui: CanvasPluginUiState
  version: 1
}

export function createDefaultCanvasPluginSettings(): CanvasPluginSettings {
  return {
    defaultCanvasDirectory: CANVAS_DEFAULT_DIRECTORY,
    detectExternalChanges: true,
    enableDebugLog: false,
    recentFilesLimit: 8,
    noteCreationDirectory: "",
    showCanvasThumbnails: false,
  }
}

export function createDefaultCanvasPluginUiState(): CanvasPluginUiState {
  return {
    inspectorSections: {
      createEdge: true,
      document: true,
      edge: true,
      node: true,
      recent: true,
      selection: true,
    },
  }
}

export function createDefaultCanvasPluginData(): CanvasPluginData {
  return {
    recentFiles: [],
    settings: createDefaultCanvasPluginSettings(),
    ui: createDefaultCanvasPluginUiState(),
    version: 1,
  }
}

function getCanvasPathTitle(path: string): string {
  const normalized = path.split(/[\\/]/)
  return normalized[normalized.length - 1] || path
}

function normalizeRecentSourceType(path: string, value: unknown): CanvasRecentFileSource {
  if (value === "local" || value === "workspace") {
    return value
  }

  return path.startsWith("/data/") ? "workspace" : "local"
}

export function normalizeCanvasPluginData(value: unknown): CanvasPluginData {
  const defaults = createDefaultCanvasPluginData()
  if (!value || typeof value !== "object") {
    return defaults
  }

  const candidate = value as Partial<CanvasPluginData> & {
    settings?: Partial<CanvasPluginSettings>
    recentFiles?: Partial<CanvasRecentFile>[]
    ui?: {
      inspectorSections?: Partial<Record<keyof CanvasInspectorSectionsState, unknown>>
    }
  }

  const recentFiles = Array.isArray(candidate.recentFiles)
    ? candidate.recentFiles
        .filter((item): item is Partial<CanvasRecentFile> => Boolean(item && typeof item === "object"))
        .filter((item) => typeof item.path === "string" && item.path.length > 0)
        .map((item) => ({
          openedAt: typeof item.openedAt === "string" && item.openedAt
            ? item.openedAt
            : new Date(0).toISOString(),
          path: item.path!,
          sourceType: normalizeRecentSourceType(item.path!, item.sourceType),
          title: typeof item.title === "string" && item.title ? item.title : getCanvasPathTitle(item.path!),
        }))
    : defaults.recentFiles

  const settings = {
    defaultCanvasDirectory: typeof candidate.settings?.defaultCanvasDirectory === "string"
      && candidate.settings.defaultCanvasDirectory.trim()
      ? candidate.settings.defaultCanvasDirectory.trim()
      : defaults.settings.defaultCanvasDirectory,
    detectExternalChanges: typeof candidate.settings?.detectExternalChanges === "boolean"
      ? candidate.settings.detectExternalChanges
      : defaults.settings.detectExternalChanges,
    enableDebugLog: typeof candidate.settings?.enableDebugLog === "boolean"
      ? candidate.settings.enableDebugLog
      : defaults.settings.enableDebugLog,
    recentFilesLimit: Number.isInteger(candidate.settings?.recentFilesLimit)
      && Number(candidate.settings?.recentFilesLimit) > 0
      ? Number(candidate.settings?.recentFilesLimit)
      : defaults.settings.recentFilesLimit,
    noteCreationDirectory: typeof candidate.settings?.noteCreationDirectory === "string"
      ? candidate.settings.noteCreationDirectory.trim()
      : defaults.settings.noteCreationDirectory,
    showCanvasThumbnails: typeof candidate.settings?.showCanvasThumbnails === "boolean"
      ? candidate.settings.showCanvasThumbnails
      : defaults.settings.showCanvasThumbnails,
  }

  const defaultInspectorSections = defaults.ui.inspectorSections
  const candidateInspectorSections = candidate.ui?.inspectorSections
  const inspectorSections: CanvasInspectorSectionsState = {
    createEdge: typeof candidateInspectorSections?.createEdge === "boolean"
      ? candidateInspectorSections.createEdge
      : defaultInspectorSections.createEdge,
    document: typeof candidateInspectorSections?.document === "boolean"
      ? candidateInspectorSections.document
      : defaultInspectorSections.document,
    edge: typeof candidateInspectorSections?.edge === "boolean"
      ? candidateInspectorSections.edge
      : defaultInspectorSections.edge,
    node: typeof candidateInspectorSections?.node === "boolean"
      ? candidateInspectorSections.node
      : defaultInspectorSections.node,
    recent: typeof candidateInspectorSections?.recent === "boolean"
      ? candidateInspectorSections.recent
      : defaultInspectorSections.recent,
    selection: typeof candidateInspectorSections?.selection === "boolean"
      ? candidateInspectorSections.selection
      : defaultInspectorSections.selection,
  }

  return {
    recentFiles: recentFiles.slice(0, settings.recentFilesLimit),
    settings,
    ui: {
      inspectorSections,
    },
    version: 1,
  }
}

export function rememberRecentCanvasFile(
  data: CanvasPluginData,
  entry: CanvasRecentFile,
): CanvasPluginData {
  const normalized = normalizeCanvasPluginData(data)
  const recentFiles = [
    entry,
    ...normalized.recentFiles.filter((item) => item.path !== entry.path),
  ].slice(0, normalized.settings.recentFilesLimit)

  return {
    ...normalized,
    recentFiles,
  }
}

export function removeRecentCanvasFile(
  data: CanvasPluginData,
  path: string,
): CanvasPluginData {
  const normalized = normalizeCanvasPluginData(data)
  return {
    ...normalized,
    recentFiles: normalized.recentFiles.filter((item) => item.path !== path),
  }
}

export function updateCanvasPluginUiState(
  data: CanvasPluginData,
  ui: Partial<CanvasPluginUiState>,
): CanvasPluginData {
  const normalized = normalizeCanvasPluginData(data)

  return normalizeCanvasPluginData({
    ...normalized,
    ui: {
      ...normalized.ui,
      ...ui,
      inspectorSections: {
        ...normalized.ui.inspectorSections,
        ...ui.inspectorSections,
      },
    },
  })
}

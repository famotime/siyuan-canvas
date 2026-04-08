export interface CanvasPluginSettings {
  defaultCanvasDirectory: string
  detectExternalChanges: boolean
  recentFilesLimit: number
}

export interface CanvasRecentFile {
  openedAt: string
  path: string
  title: string
}

export interface CanvasPluginData {
  recentFiles: CanvasRecentFile[]
  settings: CanvasPluginSettings
  version: 1
}

export function createDefaultCanvasPluginSettings(): CanvasPluginSettings {
  return {
    defaultCanvasDirectory: "/data/storage/siyuan-canvas",
    detectExternalChanges: true,
    recentFilesLimit: 8,
  }
}

export function createDefaultCanvasPluginData(): CanvasPluginData {
  return {
    recentFiles: [],
    settings: createDefaultCanvasPluginSettings(),
    version: 1,
  }
}

export function normalizeCanvasPluginData(value: unknown): CanvasPluginData {
  const defaults = createDefaultCanvasPluginData()
  if (!value || typeof value !== "object") {
    return defaults
  }

  const candidate = value as Partial<CanvasPluginData> & {
    settings?: Partial<CanvasPluginSettings>
    recentFiles?: Partial<CanvasRecentFile>[]
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
          title: typeof item.title === "string" && item.title ? item.title : item.path!.split("/").pop() || item.path!,
        }))
    : defaults.recentFiles

  const settings = {
    defaultCanvasDirectory: typeof candidate.settings?.defaultCanvasDirectory === "string"
      && candidate.settings.defaultCanvasDirectory.trim()
      ? candidate.settings.defaultCanvasDirectory.trim().replace(/\/+$/, "")
      : defaults.settings.defaultCanvasDirectory,
    detectExternalChanges: typeof candidate.settings?.detectExternalChanges === "boolean"
      ? candidate.settings.detectExternalChanges
      : defaults.settings.detectExternalChanges,
    recentFilesLimit: Number.isInteger(candidate.settings?.recentFilesLimit)
      && Number(candidate.settings?.recentFilesLimit) > 0
      ? Number(candidate.settings?.recentFilesLimit)
      : defaults.settings.recentFilesLimit,
  }

  return {
    recentFiles: recentFiles.slice(0, settings.recentFilesLimit),
    settings,
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

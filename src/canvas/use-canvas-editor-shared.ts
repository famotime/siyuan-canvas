import type { Plugin } from "siyuan"
import type {
  CanvasPluginSettings,
  CanvasPluginUiState,
  CanvasRecentFileSource,
  CanvasRecentFile,
} from "@/canvas/plugin-data"
import type { CanvasI18nKey } from "@/i18n/canvas"
import type { CanvasTabBootstrap } from "@/main"

export interface CanvasPluginBridge extends Plugin {
  app: unknown
  getCanvasSettings?: () => CanvasPluginSettings
  getCanvasUiState?: () => CanvasPluginUiState
  getRecentCanvasFiles?: () => CanvasRecentFile[]
  i18n?: Record<string, string>
  rememberRecentCanvas?: (path: string, title?: string, sourceType?: CanvasRecentFileSource) => Promise<void>
  openCanvasSettings?: () => void
  openCanvasTab?: (bootstrap?: CanvasTabBootstrap) => Promise<void>
  updateCanvasUiState?: (ui: Partial<CanvasPluginUiState>) => Promise<void>
}

export type CanvasEditorFileSource = CanvasRecentFileSource | "unsaved"

export type CanvasI18nTranslator = (
  key: CanvasI18nKey,
  replacements?: Record<string, number | string>,
) => string

export function getCanvasFileName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

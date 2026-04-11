import type { Plugin } from "siyuan"
import type {
  CanvasPluginSettings,
  CanvasRecentFile,
} from "@/canvas/plugin-data"
import type { CanvasI18nKey } from "@/i18n/canvas"
import type { CanvasTabBootstrap } from "@/main"

export interface CanvasPluginBridge extends Plugin {
  app: unknown
  getCanvasSettings?: () => CanvasPluginSettings
  getRecentCanvasFiles?: () => CanvasRecentFile[]
  i18n?: Record<string, string>
  rememberRecentCanvas?: (path: string, title?: string) => Promise<void>
  openCanvasSettings?: () => void
  openCanvasTab?: (bootstrap?: CanvasTabBootstrap) => Promise<void>
}

export type CanvasI18nTranslator = (
  key: CanvasI18nKey,
  replacements?: Record<string, number | string>,
) => string

export function getCanvasFileName(path: string): string {
  return path.split("/").pop() || path
}

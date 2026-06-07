import type { CanvasPluginSettings } from "@/canvas/plugin-data"

/**
 * 创建条件调试日志函数。仅在设置中启用调试日志时输出。
 */
export function createDebugLog(getSettings: () => CanvasPluginSettings): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    if (getSettings().enableDebugLog) {
      console.log('[Canvas]', ...args)
    }
  }
}

import enUS from "@/i18n/en_US.json"
import zhCN from "@/i18n/zh_CN.json"

type CanvasI18nCatalog = typeof zhCN

export type CanvasI18nKey = keyof CanvasI18nCatalog

type CanvasI18nSource = Partial<Record<CanvasI18nKey, string>> | null | undefined

const FALLBACK_LOCALE: CanvasI18nCatalog = zhCN

export const DEFAULT_CANVAS_LOCALES = {
  enUS,
  zhCN,
} as const

export function createCanvasI18n(source?: CanvasI18nSource) {
  return (key: CanvasI18nKey, replacements?: Record<string, number | string>) => {
    const template = source?.[key] || FALLBACK_LOCALE[key]

    if (!replacements) {
      return template
    }

    return template.replace(/\{(\w+)\}/g, (_, token: string) => {
      const value = replacements[token]
      return value === undefined ? `{${token}}` : String(value)
    })
  }
}

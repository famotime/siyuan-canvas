import type { Plugin } from "siyuan"
import type { App as VueApp } from "vue"
import { createApp } from "vue"

import App from "@/App.vue"

let pluginInstance: Plugin | null = null
const appMap = new WeakMap<HTMLElement, VueApp>()
const themeCleanupMap = new WeakMap<HTMLElement, () => void>()

type CanvasThemeMode = "dark" | "light"

export interface CanvasTabBootstrap {
  path?: string
  raw?: string
  title?: string
}

export function bindPlugin(plugin: Plugin): void {
  pluginInstance = plugin
}

export function requirePlugin(): Plugin {
  if (!pluginInstance) {
    throw new Error("Plugin instance has not been bound.")
  }

  return pluginInstance
}

function normalizeThemeMode(value: unknown): CanvasThemeMode | null {
  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase()
    if (normalizedValue.includes("dark")) {
      return "dark"
    }

    if (normalizedValue.includes("light")) {
      return "light"
    }
  }

  if (typeof value === "number") {
    if (value === 1) {
      return "dark"
    }

    if (value === 0) {
      return "light"
    }
  }

  return null
}

function detectHostThemeMode(element: HTMLElement): CanvasThemeMode {
  const explicitThemeMode = normalizeThemeMode(element.parentElement?.closest<HTMLElement>("[data-theme-mode]")?.dataset.themeMode)
    ?? normalizeThemeMode(document.documentElement.dataset.themeMode)
    ?? normalizeThemeMode(document.body?.dataset.themeMode)
    ?? normalizeThemeMode((window as any).siyuan?.config?.appearance?.mode)

  if (explicitThemeMode) {
    return explicitThemeMode
  }

  const currentThemeMode = normalizeThemeMode(element.dataset.themeMode)
  if (currentThemeMode) {
    return currentThemeMode
  }

  if (document.documentElement.classList.contains("dark") || document.body?.classList.contains("dark")) {
    return "dark"
  }

  return "light"
}

function applyThemeMode(element: HTMLElement, mode: CanvasThemeMode): void {
  element.dataset.themeMode = mode

  const rootElement = element.firstElementChild
  if (rootElement instanceof HTMLElement) {
    rootElement.dataset.themeMode = mode
  }
}

export function bindThemeSync(element: HTMLElement, plugin: Plugin): void {
  const syncThemeMode = () => {
    applyThemeMode(element, detectHostThemeMode(element))
  }

  let animationFrameId = 0
  const scheduleThemeSync = () => {
    if (typeof cancelAnimationFrame === "function" && animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }

    if (typeof requestAnimationFrame === "function") {
      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = 0
        syncThemeMode()
      })
      return
    }

    syncThemeMode()
  }

  let hostThemeObserver: MutationObserver | null = null

  syncThemeMode()
  if (typeof MutationObserver !== "undefined") {
    hostThemeObserver = new MutationObserver(() => {
      scheduleThemeSync()
    })

    hostThemeObserver.observe(document.documentElement, {
      attributeFilter: ["class", "data-theme-mode"],
      attributes: true,
    })

    if (document.body) {
      hostThemeObserver.observe(document.body, {
        attributeFilter: ["class", "data-theme-mode"],
        attributes: true,
      })
    }
  }

  plugin.eventBus.on("switch-protyle-mode", scheduleThemeSync)
  themeCleanupMap.set(element, () => {
    hostThemeObserver?.disconnect()
    if (typeof cancelAnimationFrame === "function" && animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
    plugin.eventBus.off("switch-protyle-mode", scheduleThemeSync)
  })
}

export function mountCanvasApp(
  element: HTMLElement,
  bootstrap: CanvasTabBootstrap,
  setTitle: (title: string) => void,
): void {
  const plugin = requirePlugin()
  const app = createApp(App, {
    bootstrap,
    plugin,
    setTitle,
  })
  app.mount(element)
  bindThemeSync(element, plugin)
  appMap.set(element, app)
}

export function unmountCanvasApp(element: HTMLElement): void {
  themeCleanupMap.get(element)?.()
  themeCleanupMap.delete(element)

  const app = appMap.get(element)
  if (!app) {
    return
  }

  app.unmount()
  appMap.delete(element)
  element.innerHTML = ""
}

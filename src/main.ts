import type { Plugin } from "siyuan"
import type { App as VueApp } from "vue"
import { createApp } from "vue"

import App from "@/App.vue"

let pluginInstance: Plugin | null = null
const appMap = new WeakMap<HTMLElement, VueApp>()

export interface CanvasTabBootstrap {
  path?: string
  raw?: string
  title?: string
}

export function bindPlugin(plugin: Plugin): void {
  pluginInstance = plugin
}

function requirePlugin(): Plugin {
  if (!pluginInstance) {
    throw new Error("Plugin instance has not been bound.")
  }

  return pluginInstance
}

export function mountCanvasApp(
  element: HTMLElement,
  bootstrap: CanvasTabBootstrap,
  setTitle: (title: string) => void,
): void {
  const app = createApp(App, {
    bootstrap,
    plugin: requirePlugin(),
    setTitle,
  })
  app.mount(element)
  appMap.set(element, app)
}

export function unmountCanvasApp(element: HTMLElement): void {
  const app = appMap.get(element)
  if (!app) {
    return
  }

  app.unmount()
  appMap.delete(element)
  element.innerHTML = ""
}

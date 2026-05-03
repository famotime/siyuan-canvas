import type {
  Custom,
  Plugin,
} from "siyuan"
import type { CanvasTabBootstrap } from "@/main"

import {
  openTab,
} from "siyuan"
import { getCanvasFileName } from "@/canvas/use-canvas-editor-shared"
import {
  mountCanvasApp,
  unmountCanvasApp,
} from "@/main"

export const CANVAS_EDITOR_TAB_TYPE = "-canvas-editor"
export const CANVAS_TAB_ICON_ID = "iconCanvasTab"
export const CANVAS_TAB_ICON_SVG = '<path fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M24 24V19L39 4L44 9L29 24H24Z"/><path stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" d="M16 24H9C6.23858 24 4 26.2386 4 29C4 31.7614 6.23858 34 9 34H39C41.7614 34 44 36.2386 44 39C44 41.7614 41.7614 44 39 44H18"/>'

export async function openCanvasEditorTab(
  plugin: Plugin & { app: unknown },
  pluginName: string,
  bootstrap: CanvasTabBootstrap,
  untitledTitle: string,
): Promise<void> {
  const title = bootstrap.title || (bootstrap.path ? getCanvasFileName(bootstrap.path) : "") || untitledTitle
  await openTab({
    app: plugin.app,
    custom: {
      id: `${pluginName}${CANVAS_EDITOR_TAB_TYPE}`,
      icon: CANVAS_TAB_ICON_ID,
      title,
      data: bootstrap,
    },
    keepCursor: false,
    openNewTab: true,
  })
}

export function registerCanvasEditorTab(plugin: Plugin, tabType = CANVAS_EDITOR_TAB_TYPE): void {
  plugin.addTab({
    type: tabType,
    init(this: Custom) {
      const host = this.element as HTMLElement
      host.innerHTML = ""
      host.classList.add("siyuan-canvas__tab")
      mountCanvasApp(host, this.data ?? {}, (title) => {
        this.tab.updateTitle(title)
      })
    },
    destroy(this: Custom) {
      unmountCanvasApp(this.element as HTMLElement)
    },
  })
}

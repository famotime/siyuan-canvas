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
      icon: "iconGraph",
      title,
      data: bootstrap,
    },
    keepCursor: true,
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

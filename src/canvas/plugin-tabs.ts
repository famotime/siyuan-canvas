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
  CANVAS_TAB_ICON_BODY,
  CANVAS_TAB_ICON_ID,
} from "@/icons"
import {
  mountCanvasApp,
  unmountCanvasApp,
} from "@/main"

export const CANVAS_EDITOR_TAB_TYPE = "-canvas-editor"
export { CANVAS_TAB_ICON_ID }

/**
 * @deprecated 历史导出，新代码请改用 `@/icons` 中的 `CANVAS_TAB_ICON_BODY`。
 * 保留是为了兼容下游可能直接 import 此符号的代码。
 */
export const CANVAS_TAB_ICON_SVG = CANVAS_TAB_ICON_BODY

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
        if (this.tab) {
          this.tab.updateTitle(title)
        }
      })
    },
    destroy(this: Custom) {
      unmountCanvasApp(this.element as HTMLElement)
    },
  })
}

import type {
  Custom,
  Plugin,
} from "siyuan"
import type { CanvasTabBootstrap } from "@/main"

import {
  Dialog,
  getFrontend,
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

function isMobileFrontend(): boolean {
  const frontend = getFrontend()
  return frontend === "mobile" || frontend === "browser-mobile"
}

function openCanvasEditorMobileDialog(
  bootstrap: CanvasTabBootstrap,
  title: string,
): void {
  let host: HTMLElement | null = null
  const dialog = new Dialog({
    title,
    width: "100vw",
    height: "100vh",
    content: `<div class="siyuan-canvas__mobile-viewer"><div class="siyuan-canvas__tab"></div></div>`,
    destroyCallback: () => {
      if (host) {
        unmountCanvasApp(host)
      }
    },
  })
  host = dialog.element.querySelector<HTMLElement>(".siyuan-canvas__tab")
  if (!host) {
    dialog.destroy()
    return
  }

  mountCanvasApp(host, bootstrap, (nextTitle) => {
    dialog.element.setAttribute("aria-label", nextTitle)
  })
}

export async function openCanvasEditorTab(
  plugin: Plugin & { app: unknown },
  pluginName: string,
  bootstrap: CanvasTabBootstrap,
  untitledTitle: string,
): Promise<void> {
  const title = bootstrap.title || (bootstrap.path ? getCanvasFileName(bootstrap.path) : "") || untitledTitle
  if (isMobileFrontend()) {
    openCanvasEditorMobileDialog(bootstrap, title)
    return
  }

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
      Object.assign(host.style, {
        height: "100%",
        minHeight: "0",
        overflow: "hidden",
        position: "relative",
      })
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

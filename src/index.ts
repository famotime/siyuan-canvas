import type { Custom } from "siyuan"

import type { CanvasTabBootstrap } from "@/main"
import {
  getFrontend,
  openTab,
  Plugin,
  showMessage,
} from "siyuan"
import PluginInfoString from "@/../plugin.json"
import {
  bindPlugin,

  mountCanvasApp,
  unmountCanvasApp,
} from "@/main"

import "@/index.scss"

const pluginInfo = PluginInfoString as { name: string, version: string }
const TAB_TYPE = "-canvas-editor"

export default class SiyuanCanvasPlugin extends Plugin {
  public isBrowser = false
  public isElectron = false
  public isInWindow = false
  public isLocal = false
  public isMobile = false
  public platform: SyFrontendTypes
  public readonly version = pluginInfo.version

  async onload() {
    const frontend = getFrontend()
    this.platform = frontend as SyFrontendTypes
    this.isMobile = frontend === "mobile" || frontend === "browser-mobile"
    this.isBrowser = frontend.includes("browser")
    this.isLocal = location.href.includes("127.0.0.1") || location.href.includes("localhost")
    this.isInWindow = location.href.includes("window.html")

    try {
      require("@electron/remote").require("@electron/remote/main")
      this.isElectron = true
    } catch {
      this.isElectron = false
    }

    bindPlugin(this)
    this.registerCanvasTab()

    this.addTopBar({
      icon: "iconGraph",
      title: "SiYuan Canvas",
      callback: () => {
        void this.openCanvasTab()
      },
    })

    this.addCommand({
      langKey: "openCanvas",
      langText: "Open Canvas Workspace",
      hotkey: "Ctrl+Alt+C",
      callback: () => {
        void this.openCanvasTab()
      },
    })

    this.addCommand({
      langKey: "openCanvasPath",
      langText: "Open Canvas by Path",
      callback: () => {
        // eslint-disable-next-line no-alert
        const path = window.prompt("Workspace path", "/data/storage/siyuan-canvas/untitled.canvas")
        if (!path) {
          return
        }

        void this.openCanvasTab({ path })
      },
    })

    showMessage("SiYuan Canvas loaded", 2500, "info")
  }

  onunload() {}

  public async openCanvasTab(bootstrap: CanvasTabBootstrap = {}): Promise<void> {
    const title = bootstrap.title || bootstrap.path?.split("/").pop() || "Untitled.canvas"
    await openTab({
      app: this.app,
      custom: {
        id: `${pluginInfo.name}${TAB_TYPE}`,
        icon: "iconGraph",
        title,
        data: bootstrap,
      },
      keepCursor: true,
      openNewTab: true,
    })
  }

  private registerCanvasTab(): void {
    this.addTab({
      type: TAB_TYPE,
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
}

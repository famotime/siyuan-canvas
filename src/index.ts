import type { Custom } from "siyuan"
import type {
  CanvasPluginSettings,
  CanvasRecentFile,
} from "@/canvas/plugin-data"

import type { CanvasTabBootstrap } from "@/main"
import {
  getFrontend,
  openTab,
  Plugin,
  Setting,
  showMessage,
} from "siyuan"
import PluginInfoString from "@/../plugin.json"
import {
  createDefaultCanvasPluginData,
  normalizeCanvasPluginData,
  rememberRecentCanvasFile,
} from "@/canvas/plugin-data"
import {
  bindPlugin,

  mountCanvasApp,
  unmountCanvasApp,
} from "@/main"

import "@/index.scss"

const pluginInfo = PluginInfoString as { name: string, version: string }
const TAB_TYPE = "-canvas-editor"
const STORAGE_KEY = "canvas-plugin-data"

export default class SiyuanCanvasPlugin extends Plugin {
  public isBrowser = false
  public isElectron = false
  public isInWindow = false
  public isLocal = false
  public isMobile = false
  public platform: SyFrontendTypes
  public readonly version = pluginInfo.version
  private canvasData = createDefaultCanvasPluginData()

  async onload() {
    this.canvasData = normalizeCanvasPluginData(await this.loadData(STORAGE_KEY))
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

    this.addCommand({
      langKey: "openCanvasSettings",
      langText: "Open Canvas Settings",
      callback: () => {
        this.openCanvasSettings()
      },
    })

    showMessage("SiYuan Canvas loaded", 2500, "info")
  }

  onunload() {}

  override openSetting(): void {
    this.openCanvasSettings()
  }

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

  public getCanvasSettings(): CanvasPluginSettings {
    return {
      ...this.canvasData.settings,
    }
  }

  public getRecentCanvasFiles(): CanvasRecentFile[] {
    return this.canvasData.recentFiles.map((item) => ({ ...item }))
  }

  public async rememberRecentCanvas(path: string, title?: string): Promise<void> {
    if (!path) {
      return
    }

    this.canvasData = rememberRecentCanvasFile(this.canvasData, {
      openedAt: new Date().toISOString(),
      path,
      title: title || path.split("/").pop() || path,
    })
    await this.persistCanvasData()
  }

  public async updateCanvasSettings(settings: Partial<CanvasPluginSettings>): Promise<void> {
    this.canvasData = normalizeCanvasPluginData({
      ...this.canvasData,
      settings: {
        ...this.canvasData.settings,
        ...settings,
      },
    })
    await this.persistCanvasData()
  }

  public openCanvasSettings(): void {
    const draft = this.getCanvasSettings()
    const setting = new Setting({
      width: "560px",
    })
    const saveDraft = async () => {
      await this.updateCanvasSettings(draft)
    }

    setting.addItem({
      title: "Default canvas directory",
      description: "Relative save/open paths will be resolved under this directory.",
      createActionElement: () => {
        const input = document.createElement("input")
        input.className = "b3-text-field fn__flex-center"
        input.value = draft.defaultCanvasDirectory
        input.addEventListener("change", () => {
          draft.defaultCanvasDirectory = input.value.trim() || "/data/storage/siyuan-canvas"
          void saveDraft()
        })
        return input
      },
    })
    setting.addItem({
      title: "Recent canvas file limit",
      description: "Controls how many recent canvas paths are shown in the editor.",
      createActionElement: () => {
        const input = document.createElement("input")
        input.className = "b3-text-field fn__flex-center"
        input.type = "number"
        input.min = "1"
        input.max = "20"
        input.value = draft.recentFilesLimit.toString()
        input.addEventListener("change", () => {
          const nextValue = Number.parseInt(input.value, 10)
          draft.recentFilesLimit = Number.isNaN(nextValue) ? 8 : Math.min(20, Math.max(1, nextValue))
          input.value = draft.recentFilesLimit.toString()
          void saveDraft()
        })
        return input
      },
    })
    setting.addItem({
      title: "Detect external file changes",
      description: "Warn before saving if the underlying canvas file changed on disk.",
      createActionElement: () => {
        const input = document.createElement("input")
        input.type = "checkbox"
        input.checked = draft.detectExternalChanges
        input.addEventListener("change", () => {
          draft.detectExternalChanges = input.checked
          void saveDraft()
        })
        return input
      },
    })

    this.setting = setting
    setting.open(this.name)
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

  private async persistCanvasData(): Promise<void> {
    await this.saveData(STORAGE_KEY, this.canvasData)
  }
}

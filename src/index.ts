import type { Custom } from "siyuan"
import type {
  CanvasPluginSettings,
  CanvasRecentFile,
} from "@/canvas/plugin-data"

import type { CanvasTabBootstrap } from "@/main"
import {
  getFrontend,
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
import { openCanvasPluginSettingsPanel } from "@/canvas/plugin-settings-panel"
import { detectCanvasPluginRuntime } from "@/canvas/plugin-runtime"
import {
  CANVAS_EDITOR_TAB_TYPE,
  openCanvasEditorTab,
  registerCanvasEditorTab,
} from "@/canvas/plugin-tabs"
import { createCanvasI18n } from "@/i18n/canvas"
import {
  bindPlugin,
} from "@/main"

import "@/index.scss"

const pluginInfo = PluginInfoString as { name: string, version: string }
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
    const runtime = detectCanvasPluginRuntime(
      frontend as SyFrontendTypes,
      location.href,
      (moduleId) => require(moduleId),
    )
    this.platform = runtime.platform
    this.isMobile = runtime.isMobile
    this.isBrowser = runtime.isBrowser
    this.isLocal = runtime.isLocal
    this.isInWindow = runtime.isInWindow
    this.isElectron = runtime.isElectron

    bindPlugin(this)
    registerCanvasEditorTab(this, CANVAS_EDITOR_TAB_TYPE)

    this.addTopBar({
      icon: "iconGraph",
      title: this.t("addTopBarIcon"),
      callback: () => {
        void this.openCanvasTab()
      },
    })

    this.addCommand({
      langKey: "openCanvas",
      langText: this.t("openCanvas"),
      hotkey: "Ctrl+Alt+C",
      callback: () => {
        void this.openCanvasTab()
      },
    })

    this.addCommand({
      langKey: "openCanvasPath",
      langText: this.t("openCanvasPath"),
      callback: () => {
        // eslint-disable-next-line no-alert
        const path = window.prompt(this.t("promptWorkspacePath"), "/data/storage/siyuan-canvas/untitled.canvas")
        if (!path) {
          return
        }

        void this.openCanvasTab({ path })
      },
    })

    this.addCommand({
      langKey: "openCanvasSettings",
      langText: this.t("openCanvasSettings"),
      callback: () => {
        this.openCanvasSettings()
      },
    })

    showMessage(this.t("pluginLoaded"), 2500, "info")
  }

  onunload() {}

  override openSetting(): void {
    this.openCanvasSettings()
  }

  public async openCanvasTab(bootstrap: CanvasTabBootstrap = {}): Promise<void> {
    await openCanvasEditorTab(this, pluginInfo.name, bootstrap, this.t("untitledCanvas"))
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
    this.setting = openCanvasPluginSettingsPanel({
      createSetting: (options) => new Setting(options),
      getSettings: () => this.getCanvasSettings(),
      pluginName: this.name,
      saveSettings: async (settings) => {
        await this.updateCanvasSettings(settings)
      },
      t: (key, replacements) => this.t(key, replacements),
    })
  }

  private async persistCanvasData(): Promise<void> {
    await this.saveData(STORAGE_KEY, this.canvasData)
  }

  private t(
    key: Parameters<ReturnType<typeof createCanvasI18n>>[0],
    replacements?: Record<string, number | string>,
  ): string {
    return createCanvasI18n((this as Plugin & { i18n?: Record<string, string> }).i18n)(key, replacements)
  }
}

import type { Custom } from "siyuan"
import type {
  CanvasPluginUiState,
  CanvasPluginSettings,
  CanvasRecentFileSource,
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
  removeRecentCanvasFile,
  updateCanvasPluginUiState,
} from "@/canvas/plugin-data"
import { openCanvasPluginSettingsPanel } from "@/canvas/plugin-settings-panel"
import { detectCanvasPluginRuntime } from "@/canvas/plugin-runtime"
import { openTextInputDialog } from "@/canvas/text-input-dialog"
import {
  CANVAS_EDITOR_TAB_TYPE,
  CANVAS_TAB_ICON_ID,
  CANVAS_TAB_ICON_SVG,
  openCanvasEditorTab,
  registerCanvasEditorTab,
} from "@/canvas/plugin-tabs"
import { createCanvasI18n } from "@/i18n/canvas"
import { getCanvasFileName } from "@/canvas/use-canvas-editor-shared"
import {
  bindPlugin,
} from "@/main"

import "@/index.scss"

const pluginInfo = PluginInfoString as { name: string, version: string }
const STORAGE_KEY = "canvas-plugin-data"

const TOPBAR_ICON_SVG = '<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M24 24V19L39 4L44 9L29 24H24Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 24H9C6.23858 24 4 26.2386 4 29C4 31.7614 6.23858 34 9 34H39C41.7614 34 44 36.2386 44 39C44 41.7614 41.7614 44 39 44H18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'

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
    this.addIcons(`<symbol id="${CANVAS_TAB_ICON_ID}" viewBox="0 0 48 48">${CANVAS_TAB_ICON_SVG}</symbol>`)
    registerCanvasEditorTab(this, CANVAS_EDITOR_TAB_TYPE)

    this.addTopBar({
      icon: TOPBAR_ICON_SVG,
      title: this.t("addTopBarIcon"),
      callback: () => {
        void this.openCanvasTab()
      },
    })

    this.addCommand({
      langKey: "openCanvas",
      langText: this.t("openCanvas"),
      hotkey: "⌃⌥C",
      callback: () => {
        void this.openCanvasTab()
      },
    })

    this.addCommand({
      langKey: "openCanvasPath",
      langText: this.t("openCanvasPath"),
      callback: async () => {
        const path = await openTextInputDialog({
          cancelLabel: this.t("dialogCancel"),
          confirmLabel: this.t("dialogConfirm"),
          initialValue: `${this.canvasData.settings.defaultCanvasDirectory}/${this.t("untitledCanvas")}`,
          title: this.t("promptWorkspacePath"),
        })
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
  }

  onunload() {
  }

  async uninstall() {
    try {
      await this.removeData(STORAGE_KEY)
    } catch (e) {
      showMessage(this.t("uninstallDataRemoveFailed", { name: this.name, error: String(e) }), 2500, "error")
    }
  }

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

  public getCanvasUiState(): CanvasPluginUiState {
    return {
      inspectorSections: {
        ...this.canvasData.ui.inspectorSections,
      },
    }
  }

  public getRecentCanvasFiles(): CanvasRecentFile[] {
    return this.canvasData.recentFiles.map((item) => ({ ...item }))
  }

  public async rememberRecentCanvas(path: string, title?: string, sourceType: CanvasRecentFileSource = "workspace"): Promise<void> {
    if (!path) {
      return
    }

    this.canvasData = rememberRecentCanvasFile(this.canvasData, {
      openedAt: new Date().toISOString(),
      path,
      sourceType,
      title: title || getCanvasFileName(path) || path,
    })
    await this.persistCanvasData()
  }

  public async removeRecentCanvasFile(path: string): Promise<void> {
    this.canvasData = removeRecentCanvasFile(this.canvasData, path)
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

  public async updateCanvasUiState(ui: Partial<CanvasPluginUiState>): Promise<void> {
    this.canvasData = updateCanvasPluginUiState(this.canvasData, ui)
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

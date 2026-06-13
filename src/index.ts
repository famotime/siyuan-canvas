import type { Custom } from "siyuan"
import type { IProtyle } from "siyuan"
import type {
  CanvasPluginUiState,
  CanvasPluginSettings,
  CanvasRecentFileSource,
  CanvasRecentFile,
} from "@/canvas/plugin-data"

import type { CanvasTabBootstrap } from "@/main"
import {
  fetchSyncPost,
  getAllEditor,
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
import { openCanvasFilePickerDialog } from "@/canvas/canvas-file-picker-dialog"
import {
  CANVAS_EDITOR_TAB_TYPE,
  openCanvasEditorTab,
  registerCanvasEditorTab,
} from "@/canvas/plugin-tabs"
import {
  CANVAS_TAB_ICON_BODY,
  CANVAS_TAB_ICON_ID,
  TOPBAR_ICON_SVG,
} from "@/icons"
import { createCanvasI18n } from "@/i18n/canvas"
import { getCanvasFileName } from "@/canvas/use-canvas-editor-shared"
import {
  bindPlugin,
} from "@/main"
import { setCanvasEmbedDebugEnabled, startCanvasEmbedObserver, stopCanvasEmbedObserver } from "@/canvas/canvas-embed-observer"
import { insertCanvasEmbed } from "@/canvas/canvas-embed-insert"
import { getFileText } from "@/api"

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
  private lastActiveProtyle: IProtyle | null = null

  private readonly rememberActiveProtyle = (event: CustomEvent<{ protyle?: IProtyle }>) => {
    if (event.detail?.protyle) {
      this.lastActiveProtyle = event.detail.protyle
    }
  }

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
    this.addIcons(`<symbol id="${CANVAS_TAB_ICON_ID}" viewBox="0 0 48 48">${CANVAS_TAB_ICON_BODY}</symbol>`)
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

    this.addCommand({
      langKey: "insertCanvasEmbed",
      langText: this.t("insertCanvasEmbed"),
      callback: () => {
        void this.insertCanvasEmbedFromCommand()
      },
      editorCallback: (protyle) => {
        void this.insertCanvasEmbedFromCommand(protyle)
      },
    })

    this.eventBus?.on?.("loaded-protyle-static", this.rememberActiveProtyle)
    this.eventBus?.on?.("loaded-protyle-dynamic", this.rememberActiveProtyle)
    this.eventBus?.on?.("switch-protyle", this.rememberActiveProtyle)
    startCanvasEmbedObserver(this, pluginInfo.name, {
      debugLogEnabled: this.canvasData.settings.enableDebugLog,
    })
  }

  onunload() {
    this.eventBus?.off?.("loaded-protyle-static", this.rememberActiveProtyle)
    this.eventBus?.off?.("loaded-protyle-dynamic", this.rememberActiveProtyle)
    this.eventBus?.off?.("switch-protyle", this.rememberActiveProtyle)
    stopCanvasEmbedObserver()
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
      onSettingsChanged: () => {
        setCanvasEmbedDebugEnabled(this.canvasData.settings.enableDebugLog)
        window.dispatchEvent(new CustomEvent("siyuan-canvas-settings-changed"))
      },
      pluginName: this.name,
      saveSettings: async (settings) => {
        await this.updateCanvasSettings(settings)
      },
      t: (key, replacements) => this.t(key, replacements),
    })
  }

  private async insertCanvasEmbedFromCommand(protyle?: IProtyle): Promise<void> {
    const path = await openCanvasFilePickerDialog({
      cancelLabel: this.t("dialogCancel"),
      confirmLabel: this.t("dialogConfirm"),
      noResultsLabel: this.t("canvasFilePickerNoResults"),
      searchPlaceholder: this.t("canvasFilePickerSearchPlaceholder"),
      title: this.t("insertCanvasEmbedPrompt"),
      defaultDirectory: this.canvasData.settings.defaultCanvasDirectory,
    })
    let canvasPath = path?.trim().replace(/^["']|["']$/g, '') ?? ""
    if (!canvasPath) return

    // 支持绝对路径：自动剥离工作区目录前缀，转为工作区相对路径
    if (/^[a-zA-Z]:[/\\]/.test(canvasPath)) {
      try {
        const resp = await fetchSyncPost('/api/system/getConf', {})
        const workspaceDir: string | undefined = resp?.data?.conf?.system?.workspaceDir
        if (workspaceDir) {
          const normalizedWorkspace = workspaceDir.replace(/\\/g, '/').replace(/\/+$/, '')
          const normalizedPath = canvasPath.replace(/\\/g, '/')
          if (normalizedPath.toLowerCase().startsWith(normalizedWorkspace.toLowerCase())) {
            canvasPath = normalizedPath.slice(normalizedWorkspace.length)
            if (!canvasPath.startsWith('/')) canvasPath = `/${canvasPath}`
          }
        }
      } catch {
        // 获取工作区路径失败时保持原路径不变
      }
    }

    try {
      const rawStr = await getFileText(canvasPath)
      if (!rawStr) {
        this.debugInsertCanvasEmbed("unable to read canvas file", { canvasPath })
        showMessage(this.t("messageUnableOpenCanvasFile"), 4000, "error")
        return
      }

      const docId = this.resolveInsertTargetDocumentId(protyle)
      if (!docId) {
        this.debugInsertCanvasEmbed("no target document found", {
          activeElement: document.activeElement?.className,
          canvasPath,
          editorCount: getAllEditor?.()?.length ?? 0,
          hasCommandProtyle: Boolean(protyle),
          hasLastActiveProtyle: Boolean(this.lastActiveProtyle),
          protyleCount: document.querySelectorAll(".protyle").length,
          wysiwygCount: document.querySelectorAll(".protyle-wysiwyg").length,
        })
        showMessage(this.t("insertCanvasEmbedNoDocument"), 4000, "warning")
        return
      }

      const blockId = await insertCanvasEmbed({
        canvasPath,
        canvasRaw: rawStr,
        parentBlockId: docId,
      })
      if (blockId) {
        showMessage(this.t("insertCanvasEmbedSuccess"), 3000)
      } else {
        showMessage(this.t("insertCanvasEmbedFailed"), 4000, "error")
      }
    } catch (error) {
      this.debugInsertCanvasEmbed("insert failed", { canvasPath, error })
      showMessage(this.t("insertCanvasEmbedFailed"), 4000, "error")
    }
  }

  private resolveInsertTargetDocumentId(protyle?: IProtyle): string {
    const fromCommand = this.getProtyleRootId(protyle)
    if (fromCommand) {
      this.lastActiveProtyle = protyle!
      return fromCommand
    }

    const fromLastActive = this.getProtyleRootId(this.lastActiveProtyle)
    if (fromLastActive) {
      return fromLastActive
    }

    const fromEditorList = getAllEditor?.()
      ?.map(editor => this.getProtyleRootId(editor.protyle))
      .find(Boolean)
    if (fromEditorList) {
      return fromEditorList
    }

    const wysiwyg = document.querySelector<HTMLElement>(".protyle-wysiwyg[data-node-id]")
    const fromWysiwyg = wysiwyg?.getAttribute("data-node-id")
    if (fromWysiwyg) {
      return fromWysiwyg
    }

    const docRoot = document.querySelector<HTMLElement>(".protyle-wysiwyg [data-node-id][data-type='NodeDocument']")
    return docRoot?.getAttribute("data-node-id") || ""
  }

  private getProtyleRootId(protyle?: IProtyle | null): string {
    return protyle?.block?.rootID || protyle?.block?.id || protyle?.element?.querySelector<HTMLElement>(".protyle-wysiwyg[data-node-id]")?.getAttribute("data-node-id") || ""
  }

  private debugInsertCanvasEmbed(message: string, payload: Record<string, unknown>): void {
    if (!this.canvasData.settings.enableDebugLog) {
      return
    }
    console.warn("[siyuan-canvas] insert canvas embed:", message, payload)
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

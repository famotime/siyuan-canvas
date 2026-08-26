import type { Custom } from "siyuan"
import type { IProtyle } from "siyuan"
import type {
  CanvasPluginUiState,
  CanvasPluginSettings,
  CanvasRecentFileSource,
  CanvasRecentFile,
} from "@/canvas/plugin-data"

import { ref } from "vue"
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
  mountCanvasDockApp,
  unmountCanvasDockApp,
} from "@/main"
import { setCanvasEmbedDebugEnabled, startCanvasEmbedObserver, stopCanvasEmbedObserver } from "@/canvas/canvas-embed-observer"
import { insertCanvasEmbed, insertCanvasLink } from "@/canvas/canvas-embed-insert"
import { getFileText } from "@/api"
import { runCanvasEmbedCommand } from "@/canvas/canvas-embed-command"

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
  public activeEditor = ref<any>(null)
  public activeAiConfig = ref<any>(null)
  private canvasData = createDefaultCanvasPluginData()
  private lastActiveProtyle: IProtyle | null = null
  private _onApiSwitchReady: (() => void) | null = null

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
    this.addIcons(
      `<symbol id="${CANVAS_TAB_ICON_ID}" viewBox="0 0 48 48">${CANVAS_TAB_ICON_BODY}</symbol>` +
      `<symbol id="iconCanvasDock" viewBox="0 0 48 48">${CANVAS_TAB_ICON_BODY}</symbol>`
    )
    registerCanvasEditorTab(this, CANVAS_EDITOR_TAB_TYPE)

    const pluginInstance = this
    this.addDock({
      config: {
        position: "RightTop",
        size: { width: "320px", height: "0" },
        icon: CANVAS_TAB_ICON_ID,
        title: this.t("canvasHelper"),
        show: false,
      },
      type: "siyuan-canvas-dock",
      init(this: any) {
        mountCanvasDockApp(this.element, pluginInstance)
      },
      destroy(this: any) {
        unmountCanvasDockApp(this.element)
      },
    })

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
      hotkey: "⌃⇧⌥C",
      callback: () => {
        void this.insertCanvasEmbedFromCommand()
      },
      editorCallback: (protyle) => {
        void this.insertCanvasEmbedFromCommand(protyle)
      },
    })

    this.protyleSlash = [
      {
        filter: [
          "insertCanvasEmbed",
          "插入 Canvas 预览",
          "无界：插入 Canvas 预览",
          "charucanvas",
          "cr",
          "canvas",
          "preview",
          "wj",
          "yulan",
          "embed",
        ],
        html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#${CANVAS_TAB_ICON_ID}"></use></svg><span class="b3-list-item__text">${this.t("insertCanvasEmbedSlash")}</span></div>`,
        id: "insertCanvasEmbed",
        callback: (protyle: any, nodeElement: HTMLElement) => {
          void this.insertCanvasEmbedFromCommand(protyle, nodeElement)
        },
      },
    ]

    this.eventBus?.on?.("loaded-protyle-static", this.rememberActiveProtyle)
    this.eventBus?.on?.("loaded-protyle-dynamic", this.rememberActiveProtyle)
    this.eventBus?.on?.("switch-protyle", this.rememberActiveProtyle)
    startCanvasEmbedObserver(this, pluginInfo.name, {
      debugLogEnabled: this.canvasData.settings.enableDebugLog,
    })

    this.registerToApiSwitch()
    this._onApiSwitchReady = () => {
      this.registerToApiSwitch()
    }
    window.addEventListener("siyuan-api-switch:ready", this._onApiSwitchReady)
  }

  onunload() {
    this.protyleSlash = []
    this.eventBus?.off?.("loaded-protyle-static", this.rememberActiveProtyle)
    this.eventBus?.off?.("loaded-protyle-dynamic", this.rememberActiveProtyle)
    this.eventBus?.off?.("switch-protyle", this.rememberActiveProtyle)
    stopCanvasEmbedObserver()

    if (this._onApiSwitchReady) {
      window.removeEventListener("siyuan-api-switch:ready", this._onApiSwitchReady)
    }
    if ((window as any).siyuanApiSwitch?.unregister) {
      try {
        ;(window as any).siyuanApiSwitch.unregister("siyuan-canvas")
      } catch (err) {
        console.error("[siyuan-canvas] Failed to unregister from api-switch:", err)
      }
    }
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
    this.registerToApiSwitch()
  }

  public async updateCanvasUiState(ui: Partial<CanvasPluginUiState>): Promise<void> {
    this.canvasData = updateCanvasPluginUiState(this.canvasData, ui)
    await this.persistCanvasData()
  }

  public registerToApiSwitch(): void {
    if ((window as any).siyuanApiSwitch) {
      const settings = this.canvasData.settings
      const localConfig = {
        provider: settings.aiProvider || "openai",
        baseUrl: settings.aiBaseUrl || "",
        apiKey: settings.aiApiKey || "",
        model: settings.aiModel || "",
        models: settings.aiModels ? settings.aiModels.split(",").map((m: string) => m.trim()).filter(Boolean) : [],
        requestTimeoutSeconds: settings.aiRequestTimeoutSeconds ?? 30,
        temperature: settings.aiTemperature ?? 0.7,
        maxTokens: settings.aiMaxTokens ?? 4096,
      }
      ;(window as any).siyuanApiSwitch.register(
        "siyuan-canvas",
        this.t("canvasHelper") || "Canvas",
        (config: any) => {
          this.activeAiConfig.value = config
          if (this.canvasData.settings.enableDebugLog) {
            console.log("[siyuan-canvas] AI Config updated by api-switch:", config)
          }
          window.dispatchEvent(new CustomEvent("siyuan-canvas:ai-config-changed", { detail: config }))
        },
        localConfig
      )
    }
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
      isAiControlled: () => !!this.activeAiConfig.value,
      getActiveAiConfig: () => this.activeAiConfig.value,
    })
  }

  private async insertCanvasEmbedFromCommand(protyle?: IProtyle, nodeElement?: HTMLElement): Promise<void> {
    const pickerResult = await openCanvasFilePickerDialog({
      cancelLabel: this.t("dialogCancel"),
      confirmLabel: this.t("dialogConfirm"),
      insertLinkSwitchLabel: this.t("canvasFilePickerInsertLink"),
      noResultsLabel: this.t("canvasFilePickerNoResults"),
      searchPlaceholder: this.t("canvasFilePickerSearchPlaceholder"),
      title: this.t("insertCanvasEmbedPrompt"),
      defaultDirectory: this.canvasData.settings.defaultCanvasDirectory,
    })
    if (!pickerResult) {
      return
    }
    const { path, mode } = pickerResult
    const blockId = await runCanvasEmbedCommand({
      canvasPath: path,
      mode,
      commandProtyle: protyle,
      targetNodeElement: nodeElement,
      targetBlockId: nodeElement?.getAttribute?.("data-node-id") || undefined,
      debugLog: (message, payload) => this.debugInsertCanvasEmbed(message, payload),
      getAllEditor: () => getAllEditor?.() ?? [],
      getFileText,
      getWorkspaceDir: async () => {
        const resp = await fetchSyncPost('/api/system/getConf', {})
        return resp?.data?.conf?.system?.workspaceDir
      },
      insertCanvasEmbed,
      insertCanvasLink,
      lastActiveProtyle: this.lastActiveProtyle,
      messages: {
        insertCanvasEmbedFailed: this.t("insertCanvasEmbedFailed"),
        insertCanvasEmbedNoDocument: this.t("insertCanvasEmbedNoDocument"),
        insertCanvasEmbedSuccess: this.t("insertCanvasEmbedSuccess"),
        insertCanvasLinkFailed: this.t("insertCanvasLinkFailed"),
        insertCanvasLinkSuccess: this.t("insertCanvasLinkSuccess"),
        messageUnableOpenCanvasFile: this.t("messageUnableOpenCanvasFile"),
      },
      showMessage,
    })

    if (blockId && protyle) {
      this.lastActiveProtyle = protyle!
    }
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

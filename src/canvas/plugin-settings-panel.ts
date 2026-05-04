import type { Setting } from "siyuan"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"
import type { CanvasI18nTranslator } from "@/canvas/use-canvas-editor-shared"

interface CanvasPluginSettingsPanelOptions {
  createSetting: (options: { width: string }) => Setting
  getSettings: () => CanvasPluginSettings
  pluginName: string
  saveSettings: (settings: CanvasPluginSettings) => Promise<void>
  t: CanvasI18nTranslator
}

export function openCanvasPluginSettingsPanel(options: CanvasPluginSettingsPanelOptions): Setting {
  const {
    createSetting,
    getSettings,
    pluginName,
    saveSettings,
    t,
  } = options

  const draft = getSettings()
  const setting = createSetting({
    width: "560px",
  })
  const saveDraft = async () => {
    await saveSettings({
      ...draft,
    })
  }

  setting.addItem({
    title: t("settingsDefaultCanvasDirectoryTitle"),
    description: t("settingsDefaultCanvasDirectoryDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.className = "b3-text-field fn__flex-center"
      input.type = "text"
      input.value = draft.defaultCanvasDirectory
      input.addEventListener("change", () => {
        draft.defaultCanvasDirectory = input.value.trim() || draft.defaultCanvasDirectory
        input.value = draft.defaultCanvasDirectory
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsRecentCanvasFileLimitTitle"),
    description: t("settingsRecentCanvasFileLimitDescription"),
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
    title: t("settingsDetectExternalFileChangesTitle"),
    description: t("settingsDetectExternalFileChangesDescription"),
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

  setting.open(pluginName)
  return setting
}

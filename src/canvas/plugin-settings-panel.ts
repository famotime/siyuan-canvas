import type { CanvasColorThemeId } from "@/canvas/canvas-color-themes"
import type { Setting } from "siyuan"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"
import type { CanvasI18nTranslator } from "@/canvas/use-canvas-editor-shared"

import { CANVAS_COLOR_THEMES } from "@/canvas/canvas-color-themes"

interface CanvasPluginSettingsPanelOptions {
  createSetting: (options: { width: string }) => Setting
  getSettings: () => CanvasPluginSettings
  onSettingsChanged?: () => void
  pluginName: string
  saveSettings: (settings: CanvasPluginSettings) => Promise<void>
  t: CanvasI18nTranslator
}

export function openCanvasPluginSettingsPanel(options: CanvasPluginSettingsPanelOptions): Setting {
  const {
    createSetting,
    getSettings,
    onSettingsChanged,
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
    onSettingsChanged?.()
  }

  setting.addItem({
    title: t("settingsColorThemeTitle"),
    description: t("settingsColorThemeDescription"),
    createActionElement: () => {
      const select = document.createElement("select")
      select.className = "b3-select fn__flex-center"
      for (const theme of CANVAS_COLOR_THEMES) {
        const option = document.createElement("option")
        option.value = theme.id
        option.textContent = t(theme.nameKey as any)
        if (theme.id === draft.colorTheme) {
          option.selected = true
        }
        select.appendChild(option)
      }
      select.addEventListener("change", () => {
        draft.colorTheme = select.value as CanvasColorThemeId
        void saveDraft()
      })
      return select
    },
  })
  setting.addItem({
    title: t("settingsDefaultCanvasDirectoryTitle"),
    description: t("settingsDefaultCanvasDirectoryDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.className = "b3-text-field fn__flex-center"
      input.type = "text"
      input.value = draft.defaultCanvasDirectory
      input.disabled = true
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
  setting.addItem({
    title: t("settingsShowCanvasThumbnailsTitle"),
    description: t("settingsShowCanvasThumbnailsDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = draft.showCanvasThumbnails
      input.addEventListener("change", () => {
        draft.showCanvasThumbnails = input.checked
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsShowNodeHeaderTitle"),
    description: t("settingsShowNodeHeaderDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = draft.showNodeHeader
      input.addEventListener("change", () => {
        draft.showNodeHeader = input.checked
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsShowDragAlignmentGuidesTitle"),
    description: t("settingsShowDragAlignmentGuidesDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = draft.showDragAlignmentGuides
      input.addEventListener("change", () => {
        draft.showDragAlignmentGuides = input.checked
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsAutoCreateTextCardOnDragTitle"),
    description: t("settingsAutoCreateTextCardOnDragDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = draft.autoCreateTextCardOnDrag
      input.addEventListener("change", () => {
        draft.autoCreateTextCardOnDrag = input.checked
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsEnableDebugLogTitle"),
    description: t("settingsEnableDebugLogDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = draft.enableDebugLog
      input.addEventListener("change", () => {
        draft.enableDebugLog = input.checked
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsNoteCreationDirectoryTitle"),
    description: t("settingsNoteCreationDirectoryDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.className = "b3-text-field fn__flex-center"
      input.type = "text"
      input.value = draft.noteCreationDirectory
      input.addEventListener("change", () => {
        draft.noteCreationDirectory = input.value.trim()
        void saveDraft()
      })
      return input
    },
  })

  setting.addItem({
    title: t("settingsPresentationStyleTitle"),
    description: t("settingsPresentationStyleDescription"),
    createActionElement: () => {
      const select = document.createElement("select")
      select.className = "b3-select fn__flex-center"
      
      const optionZoom = document.createElement("option")
      optionZoom.value = "zoom"
      optionZoom.textContent = t("settingsPresentationStyleZoom")
      
      const optionMask = document.createElement("option")
      optionMask.value = "mask"
      optionMask.textContent = t("settingsPresentationStyleMask")
      
      select.appendChild(optionZoom)
      select.appendChild(optionMask)
      
      select.value = draft.presentationStyle || "zoom"
      
      select.addEventListener("change", () => {
        draft.presentationStyle = select.value as "zoom" | "mask"
        void saveDraft()
      })
      return select
    },
  })
  setting.addItem({
    title: t("settingsPresentationAutoRatioTitle"),
    description: t("settingsPresentationAutoRatioDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.type = "checkbox"
      input.checked = draft.presentationAutoRatio !== false
      input.addEventListener("change", () => {
        draft.presentationAutoRatio = input.checked
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsPresentationMaskOpacityTitle"),
    description: t("settingsPresentationMaskOpacityDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "0"
      input.max = "100"
      input.value = (draft.presentationMaskOpacity !== undefined ? draft.presentationMaskOpacity : 60).toString()
      input.addEventListener("change", () => {
        const nextValue = Number.parseInt(input.value, 10)
        draft.presentationMaskOpacity = Number.isNaN(nextValue) ? 60 : Math.min(100, Math.max(0, nextValue))
        input.value = draft.presentationMaskOpacity.toString()
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsPresentationAutoPlayIntervalTitle"),
    description: t("settingsPresentationAutoPlayIntervalDescription"),
    createActionElement: () => {
      const input = document.createElement("input")
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "1"
      input.max = "60"
      input.value = (draft.presentationAutoPlayInterval || 3).toString()
      input.addEventListener("change", () => {
        const nextValue = Number.parseInt(input.value, 10)
        draft.presentationAutoPlayInterval = Number.isNaN(nextValue) ? 3 : Math.min(60, Math.max(1, nextValue))
        input.value = draft.presentationAutoPlayInterval.toString()
        void saveDraft()
      })
      return input
    },
  })

  setting.open(pluginName)
  return setting
}

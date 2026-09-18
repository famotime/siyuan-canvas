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
  isAiControlled?: () => boolean
  getActiveAiConfig?: () => any
}

export function openCanvasPluginSettingsPanel(options: CanvasPluginSettingsPanelOptions): Setting {
  const {
    createSetting,
    getSettings,
    onSettingsChanged,
    pluginName,
    saveSettings,
    t,
    isAiControlled,
  } = options

  const isControlled = isAiControlled?.() || false
  const activeAiConfig = options.getActiveAiConfig?.() || null

  const draft = getSettings()
  injectSettingsPanelStyles()
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
      select.dataset.settingKey = "colorTheme"
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
      input.dataset.settingKey = "defaultCanvasDirectory"
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
      input.dataset.settingKey = "recentFilesLimit"
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
      input.dataset.settingKey = "detectExternalChanges"
      input.className = "b3-switch fn__flex-center"
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
      input.dataset.settingKey = "showCanvasThumbnails"
      input.className = "b3-switch fn__flex-center"
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
      input.dataset.settingKey = "showNodeHeader"
      input.className = "b3-switch fn__flex-center"
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
      input.dataset.settingKey = "showDragAlignmentGuides"
      input.className = "b3-switch fn__flex-center"
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
      input.dataset.settingKey = "autoCreateTextCardOnDrag"
      input.className = "b3-switch fn__flex-center"
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
      input.dataset.settingKey = "enableDebugLog"
      input.className = "b3-switch fn__flex-center"
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
      input.dataset.settingKey = "noteCreationDirectory"
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
      select.dataset.settingKey = "presentationStyle"
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
      input.dataset.settingKey = "presentationAutoRatio"
      input.className = "b3-switch fn__flex-center"
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
      input.dataset.settingKey = "presentationMaskOpacity"
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
      input.dataset.settingKey = "presentationAutoPlayInterval"
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

  setting.addItem({
    title: t("settingsAiProviderTitle" as any) || "API 提供商",
    description: t("settingsAiProviderDescription" as any) || "大模型 API 提供商名称，例如 openai",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiProvider"
      input.className = "b3-text-field fn__flex-center"
      input.type = "text"
      input.value = isControlled && activeAiConfig ? (activeAiConfig.provider || "openai") : (draft.aiProvider || "openai")
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          draft.aiProvider = input.value.trim()
          void saveDraft()
        })
      }
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiBaseUrlTitle" as any) || "API 接口地址",
    description: t("settingsAiBaseUrlDescription" as any) || "API 的 baseUrl，如 https://api.openai.com/v1",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiBaseUrl"
      input.className = "b3-text-field fn__flex-center"
      input.type = "text"
      input.value = isControlled && activeAiConfig ? (activeAiConfig.baseUrl || "") : (draft.aiBaseUrl || "")
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          draft.aiBaseUrl = input.value.trim()
          void saveDraft()
        })
      }
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiApiKeyTitle" as any) || "API 密钥",
    description: t("settingsAiApiKeyDescription" as any) || "API 请求密钥，格式为 Bearer token 对应的 key",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiApiKey"
      input.className = "b3-text-field fn__flex-center"
      input.type = "password"
      input.value = isControlled && activeAiConfig ? (activeAiConfig.apiKey || "") : (draft.aiApiKey || "")
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          draft.aiApiKey = input.value.trim()
          void saveDraft()
        })
      }
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiModelTitle" as any) || "模型名称",
    description: t("settingsAiModelDescription" as any) || "当前使用的大模型名称，例如 gpt-4o",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiModel"
      input.className = "b3-text-field fn__flex-center"
      input.type = "text"
      input.value = isControlled && activeAiConfig ? (activeAiConfig.model || "") : (draft.aiModel || "")
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          draft.aiModel = input.value.trim()
          void saveDraft()
        })
      }
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiModelsTitle" as any) || "可选模型列表",
    description: t("settingsAiModelsDescription" as any) || "逗号分隔的候选模型列表",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiModels"
      input.className = "b3-text-field fn__flex-center"
      input.type = "text"
      input.value = isControlled && activeAiConfig ? (Array.isArray(activeAiConfig.models) ? activeAiConfig.models.join(", ") : (activeAiConfig.model || "")) : (draft.aiModels || "")
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          draft.aiModels = input.value.trim()
          void saveDraft()
        })
      }
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiRequestTimeoutSecondsTitle" as any) || "请求超时 (秒)",
    description: t("settingsAiRequestTimeoutSecondsDescription" as any) || "API 请求超时时长，默认30秒",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiRequestTimeoutSeconds"
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "5"
      input.max = "300"
      input.value = isControlled && activeAiConfig ? (activeAiConfig.requestTimeoutSeconds ?? 30).toString() : (draft.aiRequestTimeoutSeconds ?? 30).toString()
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          const val = Number.parseInt(input.value, 10)
          draft.aiRequestTimeoutSeconds = Number.isNaN(val) ? 30 : Math.min(300, Math.max(5, val))
          input.value = draft.aiRequestTimeoutSeconds.toString()
          void saveDraft()
        })
      }
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiTemperatureTitle" as any) || "温度 (Temperature)",
    description: t("settingsAiTemperatureDescription" as any) || "采样温度，值越高越随机，默认0.7",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiTemperature"
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "0"
      input.max = "2"
      input.step = "0.1"
      input.value = isControlled && activeAiConfig ? (activeAiConfig.temperature ?? 0.7).toString() : (draft.aiTemperature ?? 0.7).toString()
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          const val = Number.parseFloat(input.value)
          draft.aiTemperature = Number.isNaN(val) ? 0.7 : Math.min(2, Math.max(0, val))
          input.value = draft.aiTemperature.toString()
          void saveDraft()
        })
      }
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiMaxTokensTitle" as any) || "最大 Token 数",
    description: t("settingsAiMaxTokensDescription" as any) || "单次生成最大限制的 Token 数，默认4096",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiMaxTokens"
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "1"
      input.max = "65536"
      input.value = isControlled && activeAiConfig ? (activeAiConfig.maxTokens ?? 4096).toString() : (draft.aiMaxTokens ?? 4096).toString()
      input.disabled = isControlled
      if (!isControlled) {
        input.addEventListener("change", () => {
          const val = Number.parseInt(input.value, 10)
          draft.aiMaxTokens = Number.isNaN(val) ? 4096 : Math.min(65536, Math.max(1, val))
          input.value = draft.aiMaxTokens.toString()
          void saveDraft()
        })
      }
      return input
    },
  })

  setting.addItem({
    title: t("settingsEnableAiSearchTitle" as any) || "启用 AI 探索",
    description: t("settingsEnableAiSearchDescription" as any) || "是否在选中卡片时提供 AI 探索功能",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "enableAiSearch"
      input.className = "b3-switch fn__flex-center"
      input.type = "checkbox"
      input.checked = draft.enableAiSearch === true
      input.addEventListener("change", () => {
        draft.enableAiSearch = input.checked
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiSearchCardCountTitle" as any) || "候选卡片数量",
    description: t("settingsAiSearchCardCountDescription" as any) || "AI 探索生成的候选卡片数量，默认3个",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiSearchCardCount"
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "1"
      input.max = "10"
      input.value = (draft.aiSearchCardCount ?? 3).toString()
      input.addEventListener("change", () => {
        const val = Number.parseInt(input.value, 10)
        draft.aiSearchCardCount = Number.isNaN(val) ? 3 : Math.min(10, Math.max(1, val))
        input.value = draft.aiSearchCardCount.toString()
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiSearchContentRichnessTitle" as any) || "内容丰富度",
    description: t("settingsAiSearchContentRichnessDescription" as any) || "AI 探索生成卡片的内容丰富度，默认适中",
    createActionElement: () => {
      const select = document.createElement("select")
      select.dataset.settingKey = "aiSearchContentRichness"
      select.className = "b3-select fn__flex-center"
      const optSimple = document.createElement("option")
      optSimple.value = "simple"
      optSimple.textContent = t("settingsAiSearchContentRichnessSimple" as any) || "简洁"
      const optMedium = document.createElement("option")
      optMedium.value = "medium"
      optMedium.textContent = t("settingsAiSearchContentRichnessMedium" as any) || "适中"
      const optDetailed = document.createElement("option")
      optDetailed.value = "detailed"
      optDetailed.textContent = t("settingsAiSearchContentRichnessDetailed" as any) || "丰富"
      select.appendChild(optSimple)
      select.appendChild(optMedium)
      select.appendChild(optDetailed)
      select.value = draft.aiSearchContentRichness || "medium"
      select.addEventListener("change", () => {
        draft.aiSearchContentRichness = select.value as any
        void saveDraft()
      })
      return select
    },
  })
  setting.addItem({
    title: t("settingsAiSearchMaxDepthTitle" as any) || "前序追溯最大深度",
    description: t("settingsAiSearchMaxDepthDescription" as any) || "AI 探索追溯上下文的最大连线深度，默认3层",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiSearchMaxDepth"
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "1"
      input.max = "10"
      input.value = (draft.aiSearchMaxDepth ?? 3).toString()
      input.addEventListener("change", () => {
        const val = Number.parseInt(input.value, 10)
        draft.aiSearchMaxDepth = Number.isNaN(val) ? 3 : Math.min(10, Math.max(1, val))
        input.value = draft.aiSearchMaxDepth.toString()
        void saveDraft()
      })
      return input
    },
  })
  setting.addItem({
    title: t("settingsAiSearchMaxCardsTitle" as any) || "前序追溯最大卡片数",
    description: t("settingsAiSearchMaxCardsDescription" as any) || "AI 探索包含的前序卡片的最大数量限制，默认10个",
    createActionElement: () => {
      const input = document.createElement("input")
      input.dataset.settingKey = "aiSearchMaxCards"
      input.className = "b3-text-field fn__flex-center"
      input.type = "number"
      input.min = "1"
      input.max = "50"
      input.value = (draft.aiSearchMaxCards ?? 10).toString()
      input.addEventListener("change", () => {
        const val = Number.parseInt(input.value, 10)
        draft.aiSearchMaxCards = Number.isNaN(val) ? 10 : Math.min(50, Math.max(1, val))
        input.value = draft.aiSearchMaxCards.toString()
        void saveDraft()
      })
      return input
    },
  })

  setting.open(pluginName)

  let retryCount = 0
  const tryCategorize = () => {
    const anchorEl = document.querySelector('[data-setting-key="colorTheme"]')
    if (anchorEl) {
      try {
        categorizeSettings(t, isControlled)
      }
      catch (err) {
        console.error("Failed to categorize siyuan-canvas settings:", err)
      }
    }
    else if (retryCount < 50) {
      retryCount++
      setTimeout(tryCategorize, 50)
    }
  }
  tryCategorize()

  const onAiConfigChanged = (e: Event) => {
    const customEvent = e as CustomEvent
    const newConfig = customEvent.detail
    const isNowControlled = Boolean(newConfig)

    const baseUrlEl = document.querySelector('[data-setting-key="aiBaseUrl"]') as HTMLInputElement | null
    if (!baseUrlEl) {
      window.removeEventListener("siyuan-canvas:ai-config-changed", onAiConfigChanged)
      return
    }

    const providerEl = document.querySelector('[data-setting-key="aiProvider"]') as HTMLInputElement | null
    const apiKeyEl = document.querySelector('[data-setting-key="aiApiKey"]') as HTMLInputElement | null
    const modelEl = document.querySelector('[data-setting-key="aiModel"]') as HTMLInputElement | null
    const modelsEl = document.querySelector('[data-setting-key="aiModels"]') as HTMLInputElement | null
    const timeoutEl = document.querySelector('[data-setting-key="aiRequestTimeoutSeconds"]') as HTMLInputElement | null
    const tempEl = document.querySelector('[data-setting-key="aiTemperature"]') as HTMLInputElement | null
    const maxTokensEl = document.querySelector('[data-setting-key="aiMaxTokens"]') as HTMLInputElement | null

    if (providerEl) {
      providerEl.value = isNowControlled ? (newConfig.provider || "openai") : (draft.aiProvider || "openai")
      providerEl.disabled = isNowControlled
    }
    if (baseUrlEl) {
      baseUrlEl.value = isNowControlled ? (newConfig.baseUrl || "") : (draft.aiBaseUrl || "")
      baseUrlEl.disabled = isNowControlled
    }
    if (apiKeyEl) {
      apiKeyEl.value = isNowControlled ? (newConfig.apiKey || "") : (draft.aiApiKey || "")
      apiKeyEl.disabled = isNowControlled
    }
    if (modelEl) {
      modelEl.value = isNowControlled ? (newConfig.model || "") : (draft.aiModel || "")
      modelEl.disabled = isNowControlled
    }
    if (modelsEl) {
      modelsEl.value = isNowControlled ? (Array.isArray(newConfig.models) ? newConfig.models.join(", ") : (newConfig.model || "")) : (draft.aiModels || "")
      modelsEl.disabled = isNowControlled
    }
    if (timeoutEl) {
      timeoutEl.value = isNowControlled ? (newConfig.requestTimeoutSeconds ?? 30).toString() : (draft.aiRequestTimeoutSeconds ?? 30).toString()
      timeoutEl.disabled = isNowControlled
    }
    if (tempEl) {
      tempEl.value = isNowControlled ? (newConfig.temperature ?? 0.7).toString() : (draft.aiTemperature ?? 0.7).toString()
      tempEl.disabled = isNowControlled
    }
    if (maxTokensEl) {
      maxTokensEl.value = isNowControlled ? (newConfig.maxTokens ?? 4096).toString() : (draft.aiMaxTokens ?? 4096).toString()
      maxTokensEl.disabled = isNowControlled
    }

    const apiKeys = [
      "aiProvider", "aiBaseUrl", "aiApiKey", "aiModel", "aiModels",
      "aiRequestTimeoutSeconds", "aiTemperature", "aiMaxTokens"
    ]
    for (const key of apiKeys) {
      const el = document.querySelector(`[data-setting-key="${key}"]`)
      if (el) {
        let itemWrapper: HTMLElement | null = el as HTMLElement
        while (itemWrapper && itemWrapper.parentElement && !itemWrapper.classList.contains("siyuan-canvas-settings-details-content")) {
          if (itemWrapper.parentElement.classList.contains("siyuan-canvas-settings-details-content")) {
            break
          }
          itemWrapper = itemWrapper.parentElement
        }
        if (itemWrapper) {
          if (isNowControlled) {
            itemWrapper.classList.add("siyuan-canvas-settings-item--disabled")
          } else {
            itemWrapper.classList.remove("siyuan-canvas-settings-item--disabled")
          }
        }
      }
    }

    const aiContent = document.querySelector('[data-setting-key="aiProvider"]')?.closest(".siyuan-canvas-settings-details-content")
    if (aiContent) {
      let banner = aiContent.querySelector(".siyuan-canvas-settings-banner")
      if (isNowControlled) {
        if (!banner) {
          banner = document.createElement("div")
          banner.className = "siyuan-canvas-settings-banner"
          banner.textContent = t("settingsAiControlledHint" as any) || "当前已由 API 旋钮 (siyuan-api-switch) 插件接管配置，本地设置已失效。"
          aiContent.insertBefore(banner, aiContent.firstChild)
        }
      } else {
        if (banner) {
          banner.remove()
        }
      }
    }
  }

  window.addEventListener("siyuan-canvas:ai-config-changed", onAiConfigChanged)

  return setting
}

function categorizeSettings(t: CanvasI18nTranslator, isControlled: boolean) {
  const anchorEl = document.querySelector('[data-setting-key="colorTheme"]') as HTMLElement
  if (!anchorEl) return

  let wrapper: HTMLElement | null = anchorEl
  while (wrapper && wrapper.parentElement) {
    const parent = wrapper.parentElement
    if (parent.children.length > 5) {
      break
    }
    wrapper = parent
  }

  const container = wrapper?.parentElement
  if (!container) return

  const groups = [
    {
      id: "basic",
      title: t("settingsGroupBasic" as any) || "基础设置",
      keys: [
        "defaultCanvasDirectory",
        "noteCreationDirectory",
        "recentFilesLimit",
        "detectExternalChanges",
        "enableDebugLog",
      ],
      open: true,
    },
    {
      id: "display",
      title: t("settingsGroupDisplay" as any) || "显示设置",
      keys: [
        "colorTheme",
        "showCanvasThumbnails",
        "showNodeHeader",
        "showDragAlignmentGuides",
        "autoCreateTextCardOnDrag",
      ],
      open: true,
    },
    {
      id: "presentation",
      title: t("settingsGroupPresentation" as any) || "演示设置",
      keys: [
        "presentationStyle",
        "presentationAutoRatio",
        "presentationMaskOpacity",
        "presentationAutoPlayInterval",
      ],
      open: true,
    },
    {
      id: "ai",
      title: t("settingsGroupAi" as any) || "AI 服务",
      keys: [
        "aiProvider",
        "aiBaseUrl",
        "aiApiKey",
        "aiModel",
        "aiModels",
        "aiRequestTimeoutSeconds",
        "aiTemperature",
        "aiMaxTokens",
        "enableAiSearch",
        "aiSearchCardCount",
        "aiSearchContentRichness",
        "aiSearchMaxDepth",
        "aiSearchMaxCards",
      ],
      open: true,
    },
  ]

  const itemWrappersMap = new Map<string, HTMLElement>()
  for (const group of groups) {
    for (const key of group.keys) {
      const el = container.querySelector(`[data-setting-key="${key}"]`) as HTMLElement
      if (el) {
        let itemWrapper: HTMLElement | null = el
        while (itemWrapper && itemWrapper.parentElement !== container) {
          itemWrapper = itemWrapper.parentElement
        }
        if (itemWrapper) {
          itemWrappersMap.set(key, itemWrapper)
          
          const apiKeys = [
            "aiProvider",
            "aiBaseUrl",
            "aiApiKey",
            "aiModel",
            "aiModels",
            "aiRequestTimeoutSeconds",
            "aiTemperature",
            "aiMaxTokens"
          ]
          if (isControlled && apiKeys.includes(key)) {
            itemWrapper.classList.add("siyuan-canvas-settings-item--disabled")
          }
        }
      }
    }
  }

  // 具体的说明文字改为悬浮 Tooltips 提示
  const settingKeysMapping = [
    { key: "colorTheme", title: "settingsColorThemeTitle", desc: "settingsColorThemeDescription" },
    { key: "defaultCanvasDirectory", title: "settingsDefaultCanvasDirectoryTitle", desc: "settingsDefaultCanvasDirectoryDescription" },
    { key: "recentFilesLimit", title: "settingsRecentCanvasFileLimitTitle", desc: "settingsRecentCanvasFileLimitDescription" },
    { key: "detectExternalChanges", title: "settingsDetectExternalFileChangesTitle", desc: "settingsDetectExternalFileChangesDescription" },
    { key: "showCanvasThumbnails", title: "settingsShowCanvasThumbnailsTitle", desc: "settingsShowCanvasThumbnailsDescription" },
    { key: "showNodeHeader", title: "settingsShowNodeHeaderTitle", desc: "settingsShowNodeHeaderDescription" },
    { key: "showDragAlignmentGuides", title: "settingsShowDragAlignmentGuidesTitle", desc: "settingsShowDragAlignmentGuidesDescription" },
    { key: "autoCreateTextCardOnDrag", title: "settingsAutoCreateTextCardOnDragTitle", desc: "settingsAutoCreateTextCardOnDragDescription" },
    { key: "enableDebugLog", title: "settingsEnableDebugLogTitle", desc: "settingsEnableDebugLogDescription" },
    { key: "noteCreationDirectory", title: "settingsNoteCreationDirectoryTitle", desc: "settingsNoteCreationDirectoryDescription" },
    { key: "presentationStyle", title: "settingsPresentationStyleTitle", desc: "settingsPresentationStyleDescription" },
    { key: "presentationAutoRatio", title: "settingsPresentationAutoRatioTitle", desc: "settingsPresentationAutoRatioDescription" },
    { key: "presentationMaskOpacity", title: "settingsPresentationMaskOpacityTitle", desc: "settingsPresentationMaskOpacityDescription" },
    { key: "presentationAutoPlayInterval", title: "settingsPresentationAutoPlayIntervalTitle", desc: "settingsPresentationAutoPlayIntervalDescription" },
    { key: "enableAiSearch", title: "settingsEnableAiSearchTitle", desc: "settingsEnableAiSearchDescription" },
    { key: "aiSearchCardCount", title: "settingsAiSearchCardCountTitle", desc: "settingsAiSearchCardCountDescription" },
    { key: "aiSearchContentRichness", title: "settingsAiSearchContentRichnessTitle", desc: "settingsAiSearchContentRichnessDescription" },
    { key: "aiSearchMaxDepth", title: "settingsAiSearchMaxDepthTitle", desc: "settingsAiSearchMaxDepthDescription" },
    { key: "aiSearchMaxCards", title: "settingsAiSearchMaxCardsTitle", desc: "settingsAiSearchMaxCardsDescription" },
    { key: "aiProvider", title: "settingsAiProviderTitle", desc: "settingsAiProviderDescription" },
    { key: "aiBaseUrl", title: "settingsAiBaseUrlTitle", desc: "settingsAiBaseUrlDescription" },
    { key: "aiApiKey", title: "settingsAiApiKeyTitle", desc: "settingsAiApiKeyDescription" },
    { key: "aiModel", title: "settingsAiModelTitle", desc: "settingsAiModelDescription" },
    { key: "aiModels", title: "settingsAiModelsTitle", desc: "settingsAiModelsDescription" },
    { key: "aiRequestTimeoutSeconds", title: "settingsAiRequestTimeoutSecondsTitle", desc: "settingsAiRequestTimeoutSecondsDescription" },
    { key: "aiTemperature", title: "settingsAiTemperatureTitle", desc: "settingsAiTemperatureDescription" },
    { key: "aiMaxTokens", title: "settingsAiMaxTokensTitle", desc: "settingsAiMaxTokensDescription" }
  ]

  let globalTooltip: HTMLElement | null = null
  const getOrCreateGlobalTooltip = (): HTMLElement => {
    if (globalTooltip) return globalTooltip
    globalTooltip = document.querySelector(".siyuan-canvas-global-tooltip") as HTMLElement
    if (!globalTooltip) {
      globalTooltip = document.createElement("div")
      globalTooltip.className = "siyuan-canvas-global-tooltip"
      document.body.appendChild(globalTooltip)
    }
    return globalTooltip
  }

  settingKeysMapping.forEach(({ key, desc }) => {
    const itemWrapper = itemWrappersMap.get(key)
    if (!itemWrapper) return

    const descText = t(desc as any)
    if (!descText) return

    // 1. 隐藏描述文字：DOM 结构为 wrapper > .fn__flex-1 > .b3-label__text
    //    直接精准定位 .b3-label__text 并隐藏
    const descEl = itemWrapper.querySelector(".b3-label__text") as HTMLElement | null
    if (descEl) {
      descEl.style.display = "none"
    }

    // 2. 将 tooltip 文字存入 itemWrapper 的 dataset，供事件处理器读取
    itemWrapper.dataset.canvasTooltip = descText

    // 3. 绑定 mouseenter/mouseleave（仅绑定一次）
    if (!(itemWrapper as any).__tooltipBound) {
      (itemWrapper as any).__tooltipBound = true

      itemWrapper.addEventListener("mouseenter", () => {
        const text = itemWrapper.dataset.canvasTooltip
        if (!text) return

        const tooltip = getOrCreateGlobalTooltip()
        tooltip.textContent = text

        // display:block + visibility:hidden 使浏览器完成 reflow，确保能读取正确尺寸
        tooltip.style.display = "block"
        tooltip.style.visibility = "hidden"
        tooltip.classList.remove("siyuan-canvas-global-tooltip--show")

        // 强制同步 reflow 以读取真实尺寸
        void tooltip.offsetHeight

        const tooltipH = tooltip.offsetHeight || 36
        const tooltipW = tooltip.offsetWidth || 240

        const rect = itemWrapper.getBoundingClientRect()

        // 垂直方向：显示在设置行正下方 6px 处
        const top = rect.bottom + 6

        // 水平方向：与设置行左侧对齐，防止超出视口右边缘
        const rawLeft = rect.left
        const left = Math.max(8, Math.min(rawLeft, window.innerWidth - tooltipW - 8))

        tooltip.style.top = `${top}px`
        tooltip.style.left = `${left}px`
        tooltip.style.visibility = ""
        tooltip.classList.add("siyuan-canvas-global-tooltip--show")
      })

      itemWrapper.addEventListener("mouseleave", () => {
        const tooltip = getOrCreateGlobalTooltip()
        tooltip.classList.remove("siyuan-canvas-global-tooltip--show")
        tooltip.style.display = "none"
      })
    }
  })

  const categorizedWrappers = new Set(itemWrappersMap.values())
  const otherWrappers: HTMLElement[] = []
  Array.from(container.children).forEach((child) => {
    const htmlChild = child as HTMLElement
    if (htmlChild.tagName !== "DETAILS" && htmlChild.tagName !== "STYLE" && !categorizedWrappers.has(htmlChild)) {
      otherWrappers.push(htmlChild)
    }
  })

  injectSettingsPanelStyles()

  groups.forEach((group) => {
    const groupWrappers = group.keys
      .map(key => itemWrappersMap.get(key))
      .filter((w): w is HTMLElement => !!w)

    if (groupWrappers.length === 0) return

    const details = document.createElement("details")
    details.className = "siyuan-canvas-settings-details"
    if (group.open) {
      details.setAttribute("open", "")
    }

    const summary = document.createElement("summary")
    summary.className = "siyuan-canvas-settings-summary fn__flex fn__flex-center"

    const arrowIcon = document.createElement("span")
    arrowIcon.className = "siyuan-canvas-settings-summary-arrow fn__flex fn__flex-center"
    arrowIcon.innerHTML = `<svg viewBox="0 0 24 24" class="siyuan-canvas-settings-arrow-svg"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`

    const titleSpan = document.createElement("span")
    titleSpan.className = "siyuan-canvas-settings-summary-title"
    titleSpan.textContent = group.title

    summary.appendChild(arrowIcon)
    summary.appendChild(titleSpan)
    details.appendChild(summary)

    const contentDiv = document.createElement("div")
    contentDiv.className = "siyuan-canvas-settings-details-content"

    if (group.id === "ai" && isControlled) {
      const banner = document.createElement("div")
      banner.className = "siyuan-canvas-settings-banner"
      banner.textContent = t("settingsAiControlledHint" as any) || "当前已由 API 旋钮 (siyuan-api-switch) 插件接管配置，本地设置已失效。"
      contentDiv.appendChild(banner)
    }

    groupWrappers.forEach((wrapper) => {
      const providerEl = wrapper.querySelector('[data-setting-key="aiProvider"]')
      if (providerEl) {
        const separator = document.createElement("div")
        separator.className = "siyuan-canvas-settings-separator siyuan-canvas-settings-separator--first"
        
        const title = document.createElement("div")
        title.className = "siyuan-canvas-settings-separator-title"
        title.textContent = t("settingsGroupAiApiSubTitle" as any) || "API 基础设置"
        
        separator.appendChild(title)
        contentDiv.appendChild(separator)
      }

      const inputEl = wrapper.querySelector('[data-setting-key="enableAiSearch"]')
      if (inputEl) {
        const separator = document.createElement("div")
        separator.className = "siyuan-canvas-settings-separator"
        
        const line = document.createElement("hr")
        line.className = "siyuan-canvas-settings-separator-line"
        
        const title = document.createElement("div")
        title.className = "siyuan-canvas-settings-separator-title"
        title.textContent = t("settingsGroupAiSearchSubTitle" as any) || "AI 探索功能设置"
        
        separator.appendChild(line)
        separator.appendChild(title)
        contentDiv.appendChild(separator)
      }
      contentDiv.appendChild(wrapper)
    })

    details.appendChild(contentDiv)
    container.appendChild(details)
  })

  if (otherWrappers.length > 0) {
    const details = document.createElement("details")
    details.className = "siyuan-canvas-settings-details"
    details.setAttribute("open", "")

    const summary = document.createElement("summary")
    summary.className = "siyuan-canvas-settings-summary fn__flex fn__flex-center"

    const arrowIcon = document.createElement("span")
    arrowIcon.className = "siyuan-canvas-settings-summary-arrow fn__flex fn__flex-center"
    arrowIcon.innerHTML = `<svg viewBox="0 0 24 24" class="siyuan-canvas-settings-arrow-svg"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>`

    const titleSpan = document.createElement("span")
    titleSpan.className = "siyuan-canvas-settings-summary-title"
    titleSpan.textContent = t("settingsGroupOther" as any) || "其他设置"

    summary.appendChild(arrowIcon)
    summary.appendChild(titleSpan)
    details.appendChild(summary)

    const contentDiv = document.createElement("div")
    contentDiv.className = "siyuan-canvas-settings-details-content"

    otherWrappers.forEach((wrapper) => {
      contentDiv.appendChild(wrapper)
    })

    details.appendChild(contentDiv)
    container.appendChild(details)
  }
}

function injectSettingsPanelStyles() {
  if (document.getElementById("siyuan-canvas-settings-panel-styles")) return

  const style = document.createElement("style")
  style.id = "siyuan-canvas-settings-panel-styles"
  style.textContent = `
    .siyuan-canvas-settings-details {
      margin: 6px 0 18px 0 !important;
      border: 1px solid var(--b3-theme-border, rgba(0,0,0,0.1)) !important;
      border-radius: 8px !important;
      background-color: rgba(120, 120, 128, 0.06) !important;
      display: block !important;
      transition: all 0.2s ease-in-out !important;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03) !important;
    }
    .siyuan-canvas-settings-details[open] {
      background-color: var(--b3-theme-background) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06) !important;
    }
    .siyuan-canvas-settings-summary {
      padding: 14px 18px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      user-select: none !important;
      background-color: rgba(120, 120, 128, 0.04) !important;
      border-bottom: 1px solid transparent !important;
      display: flex !important;
      align-items: center !important;
      color: var(--b3-theme-on-background) !important;
      transition: background-color 0.2s ease !important;
      outline: none !important;
      border-radius: 8px !important;
    }
    .siyuan-canvas-settings-details[open] .siyuan-canvas-settings-summary {
      border-bottom-color: var(--b3-theme-border) !important;
      background-color: rgba(120, 120, 128, 0.02) !important;
      border-radius: 8px 8px 0 0 !important;
    }
    .siyuan-canvas-settings-summary:hover {
      background-color: rgba(120, 120, 128, 0.1) !important;
    }
    .siyuan-canvas-settings-summary::-webkit-details-marker {
      display: none !important;
    }
    .siyuan-canvas-settings-summary::marker {
      display: none !important;
    }
    .siyuan-canvas-settings-summary-arrow {
      margin-right: 12px !important;
      width: 16px !important;
      height: 16px !important;
      color: var(--b3-theme-on-background) !important;
      transition: transform 0.2s ease !important;
      opacity: 0.8 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .siyuan-canvas-settings-arrow-svg {
      width: 100% !important;
      height: 100% !important;
      fill: currentColor !important;
      transition: transform 0.2s ease !important;
    }
    .siyuan-canvas-settings-details[open] .siyuan-canvas-settings-summary-arrow {
      transform: rotate(90deg) !important;
    }
    .siyuan-canvas-settings-summary-title {
      flex: 1 !important;
      letter-spacing: 0.5px !important;
    }
    .siyuan-canvas-settings-details-content {
      padding: 6px 12px 10px 12px !important;
    }
    .siyuan-canvas-settings-details-content > .fn__flex,
    .siyuan-canvas-settings-details-content > .b3-label {
      padding: 10px 12px !important;
      margin: 2px 0 !important;
      border-bottom: 1px solid var(--b3-theme-border-mute, rgba(0, 0, 0, 0.04)) !important;
      border-radius: 6px !important;
      transition: background-color 0.15s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
    }
    .siyuan-canvas-settings-details-content > .fn__flex:hover,
    .siyuan-canvas-settings-details-content > .b3-label:hover {
      background-color: var(--b3-theme-hover) !important;
    }
    .siyuan-canvas-settings-details-content > *:last-child {
      border-bottom: none !important;
    }

    /* AI 接管提示 Banner */
    .siyuan-canvas-settings-banner {
      margin: 6px 12px 12px 12px !important;
      padding: 10px 14px !important;
      background-color: rgba(246, 190, 0, 0.1) !important;
      border: 1px dashed rgba(246, 190, 0, 0.4) !important;
      border-radius: 6px !important;
      color: var(--b3-theme-warning, #f6be00) !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      line-height: 1.5 !important;
    }

    /* AI 设置分隔区 */
    .siyuan-canvas-settings-separator {
      margin: 18px 12px 10px 12px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
    }
    .siyuan-canvas-settings-separator--first {
      margin-top: 6px !important;
    }
    .siyuan-canvas-settings-separator-line {
      border: none !important;
      border-top: 1px solid var(--b3-theme-border-mute, rgba(0, 0, 0, 0.08)) !important;
      margin: 0 !important;
      width: 100% !important;
    }
    .siyuan-canvas-settings-separator-title {
      font-size: 12px !important;
      font-weight: 600 !important;
      color: var(--b3-theme-on-surface-mute, rgba(0,0,0,0.5)) !important;
      letter-spacing: 0.8px !important;
    }

    /* 被接管置灰状态样式 */
    .siyuan-canvas-settings-item--disabled {
      opacity: 0.55 !important;
      pointer-events: none !important;
      background-color: rgba(120, 120, 128, 0.02) !important;
      filter: grayscale(1) !important;
    }
    .siyuan-canvas-settings-item--disabled input,
    .siyuan-canvas-settings-item--disabled select {
      cursor: not-allowed !important;
    }

    /* ⓘ 信息提示图标 */
    .siyuan-canvas-info-icon {
      cursor: help !important;
      margin-left: 8px !important;
      width: 14px !important;
      height: 14px !important;
      color: var(--b3-theme-on-surface-mute, --b3-theme-on-background) !important;
      opacity: 0.6 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: opacity 0.2s ease !important;
    }
    .siyuan-canvas-info-icon:hover {
      opacity: 1 !important;
    }
    .siyuan-canvas-info-svg {
      width: 100% !important;
      height: 100% !important;
      fill: currentColor !important;
    }
    
    /* 挂在 body 下的全局气泡浮层，彻底防 overflow 裁剪 */
    .siyuan-canvas-global-tooltip {
      position: fixed !important;
      background-color: #1e1e2e !important;
      color: #e2e8f0 !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
      padding: 7px 13px !important;
      border-radius: 7px !important;
      font-size: 12px !important;
      font-weight: normal !important;
      line-height: 1.55 !important;
      white-space: pre-wrap !important;
      width: 240px !important;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3) !important;
      z-index: 999999 !important;
      pointer-events: none !important;
      display: none;
      opacity: 0;
      transform: scale(0.88) translateY(4px);
      transform-origin: bottom center;
      transition: opacity 0.14s ease, transform 0.14s ease;
    }
    .siyuan-canvas-global-tooltip.siyuan-canvas-global-tooltip--show {
      opacity: 1 !important;
      transform: scale(1) translateY(0) !important;
    }

    /* 确保设置页所有设置条目（开关、输入框、下拉框等），文本与控件始终在同一行水平排列，严禁换行 */
    .b3-dialog__content .config-item:has([data-setting-key]),
    .siyuan-canvas-settings-details-content .config-item:has([data-setting-key]),
    .siyuan-canvas-settings-details-content > .fn__flex:has([data-setting-key]),
    .siyuan-canvas-settings-details-content > .b3-label:has([data-setting-key]),
    .b3-dialog__content .config-item:has(.b3-text-field),
    .b3-dialog__content .config-item:has(.b3-select),
    .b3-dialog__content .config-item:has(input[type="checkbox"]) {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 12px 16px !important;
      box-sizing: border-box !important;
    }

    .b3-dialog__content .config-item:has([data-setting-key]) > .fn__flex-1,
    .siyuan-canvas-settings-details-content .config-item:has([data-setting-key]) > .fn__flex-1,
    .b3-dialog__content .config-item:has(.b3-text-field) > .fn__flex-1,
    .b3-dialog__content .config-item:has(.b3-select) > .fn__flex-1,
    .b3-dialog__content .config-item:has(input[type="checkbox"]) > .fn__flex-1 {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      width: auto !important;
      max-width: none !important;
      margin-bottom: 0 !important;
      margin-right: 16px !important;
    }

    .b3-dialog__content .config-item:has([data-setting-key]) .config-name,
    .siyuan-canvas-settings-details-content .config-item:has([data-setting-key]) .config-name {
      margin-bottom: 0 !important;
      line-height: 20px !important;
      font-size: 14px !important;
    }

    .b3-dialog__content .config-item:has([data-setting-key]) > .fn__space,
    .siyuan-canvas-settings-details-content .config-item:has([data-setting-key]) > .fn__space {
      display: none !important;
    }

    /* 文本输入框与下拉选择框：固定标准 200px 尺寸靠右水平对齐，严禁换行撑满 */
    .b3-dialog__content .config-item > input[data-setting-key]:not([type="checkbox"]),
    .b3-dialog__content .config-item > select[data-setting-key],
    .b3-dialog__content .config-item > .b3-text-field:not([type="checkbox"]),
    .b3-dialog__content .config-item > .b3-select,
    .siyuan-canvas-settings-details-content input[data-setting-key]:not([type="checkbox"]),
    .siyuan-canvas-settings-details-content select[data-setting-key] {
      flex: 0 0 200px !important;
      width: 200px !important;
      min-width: 200px !important;
      max-width: 200px !important;
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      box-sizing: border-box !important;
      align-self: center !important;
    }

    /* 思源标准开关样式：宽 26px × 高 16px，与 14px 正文字体大小完美匹配 */
    .b3-dialog__content .config-item input[data-setting-key][type="checkbox"],
    .b3-dialog__content input[data-setting-key][type="checkbox"],
    .siyuan-canvas-settings-details-content input[data-setting-key][type="checkbox"],
    input[data-setting-key][type="checkbox"].fn__size200,
    input.b3-switch,
    input[data-setting-key][type="checkbox"] {
      position: relative !important;
      appearance: none !important;
      -webkit-appearance: none !important;
      width: 26px !important;
      min-width: 26px !important;
      max-width: 26px !important;
      height: 16px !important;
      min-height: 16px !important;
      max-height: 16px !important;
      flex: 0 0 26px !important;
      box-sizing: border-box !important;
      background-color: var(--b3-switch-background, #e1e3e1) !important;
      border: 1px solid var(--b3-switch-border, rgba(120, 120, 128, 0.3)) !important;
      border-radius: 12px !important;
      outline: none !important;
      cursor: pointer !important;
      transition: background-color 0.15s ease, border-color 0.15s ease !important;
      display: inline-block !important;
      margin: 0 !important;
    }

    .b3-dialog__content input[data-setting-key][type="checkbox"]:checked,
    input.b3-switch:checked,
    input[data-setting-key][type="checkbox"]:checked {
      background-color: var(--b3-switch-checked-background, var(--b3-theme-primary, #3575f0)) !important;
      border-color: transparent !important;
    }

    .b3-dialog__content input[data-setting-key][type="checkbox"]::after,
    input.b3-switch::after,
    input[data-setting-key][type="checkbox"]::after {
      content: "" !important;
      position: absolute !important;
      top: 50% !important;
      left: 7px !important;
      transform: translate(-50%, -50%) !important;
      width: 8px !important;
      height: 8px !important;
      border-radius: 50% !important;
      background-color: var(--b3-switch-border, rgba(0, 0, 0, 0.4)) !important;
      transition: left 0.12s ease, width 0.12s ease, height 0.12s ease, background-color 0.12s ease !important;
      pointer-events: none !important;
      box-shadow: none !important;
    }

    .b3-dialog__content input[data-setting-key][type="checkbox"]:checked::after,
    input.b3-switch:checked::after,
    input[data-setting-key][type="checkbox"]:checked::after {
      left: 17px !important;
      width: 12px !important;
      height: 12px !important;
      background-color: var(--b3-switch-checked, #ffffff) !important;
    }
  `
  document.head.appendChild(style)
}

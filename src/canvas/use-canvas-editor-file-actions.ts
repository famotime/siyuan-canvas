import type { Ref } from "vue"
import type { CanvasEditorState } from "@/canvas/editor-state"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"
import type {
  CanvasI18nTranslator,
  CanvasPluginBridge,
} from "@/canvas/use-canvas-editor-shared"

import { showMessage } from "siyuan"
import { createEmptyCanvasDocument } from "@/canvas/document"
import { parseCanvasDocument } from "@/canvas/format"
import { getCanvasFileName } from "@/canvas/use-canvas-editor-shared"

interface CanvasEditorFileActionOptions {
  fileInputRef: Ref<HTMLInputElement | undefined>
  getPluginSettings: () => CanvasPluginSettings
  plugin: CanvasPluginBridge
  refreshRecentFiles: () => void
  resetViewport: () => void
  state: CanvasEditorState
  suggestedFilename: Ref<string>
  t: CanvasI18nTranslator
}

export function createCanvasEditorFileActions(options: CanvasEditorFileActionOptions) {
  const {
    fileInputRef,
    getPluginSettings,
    plugin,
    refreshRecentFiles,
    resetViewport,
    state,
    suggestedFilename,
    t,
  } = options

  function ensureCanvasPath(input: string): string {
    const trimmed = input.trim()
    if (!trimmed) {
      return ""
    }

    const normalized = trimmed.endsWith(".canvas") ? trimmed : `${trimmed}.canvas`
    const baseDirectory = getPluginSettings().defaultCanvasDirectory
    return normalized.startsWith("/") ? normalized : `${baseDirectory}/${normalized}`
  }

  async function rememberRecentPath(path: string) {
    await plugin.rememberRecentCanvas?.(path, getCanvasFileName(path))
    refreshRecentFiles()
  }

  function newCanvas() {
    state.replaceDocument(createEmptyCanvasDocument(), "")
    suggestedFilename.value = t("untitledCanvas")
    resetViewport()
  }

  async function openPath() {
    // eslint-disable-next-line no-alert
    const input = window.prompt(
      t("promptWorkspacePath"),
      state.filePath || `${getPluginSettings().defaultCanvasDirectory}/${t("untitledCanvas")}`,
    )
    const path = ensureCanvasPath(input || "")
    if (!path) {
      return
    }

    try {
      await state.open(path)
      suggestedFilename.value = getCanvasFileName(path)
      await rememberRecentPath(path)
      resetViewport()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOpenCanvasFile"), 4000, "error")
    }
  }

  function triggerImport() {
    fileInputRef.value?.click()
  }

  async function importCanvas(file: File) {
    const raw = await file.text()
    const parsed = parseCanvasDocument(raw)
    if (!parsed.document) {
      showMessage(parsed.errors[0]?.message || t("messageInvalidCanvasFile"), 4000, "error")
      return
    }

    suggestedFilename.value = file.name
    state.replaceDocument(parsed.document, "")
    state.issues = {
      errors: parsed.errors,
      warnings: parsed.warnings,
    }
    resetViewport()
  }

  async function save() {
    // eslint-disable-next-line no-alert
    const input = window.prompt(
      t("promptWorkspaceSavePath"),
      state.filePath || `${getPluginSettings().defaultCanvasDirectory}/${suggestedFilename.value || t("untitledCanvas")}`,
    )
    const path = ensureCanvasPath(input || "")
    if (!path) {
      return
    }

    try {
      await state.save(path, {
        detectExternalChanges: getPluginSettings().detectExternalChanges,
      })
      suggestedFilename.value = getCanvasFileName(path)
      await rememberRecentPath(path)
      showMessage(t("messageCanvasSavedToWorkspace"), 2500, "info")
    } catch (error) {
      if (state.conflict) {
        showMessage(t("messageCanvasFileChangedOnDisk"), 5000, "error")
        return
      }

      showMessage(error instanceof Error ? error.message : t("messageUnableSaveCanvas"), 4000, "error")
    }
  }

  async function openRecentPath(path: string) {
    try {
      await state.open(path)
      suggestedFilename.value = getCanvasFileName(path)
      await rememberRecentPath(path)
      resetViewport()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOpenRecentCanvasFile"), 4000, "error")
    }
  }

  async function overwriteConflictVersion() {
    if (!state.filePath) {
      return
    }

    try {
      await state.save(state.filePath, {
        detectExternalChanges: getPluginSettings().detectExternalChanges,
        force: true,
      })
      await rememberRecentPath(state.filePath)
      showMessage(t("messageCanvasSavedByOverwritingDiskVersion"), 2500, "info")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOverwriteDiskVersion"), 4000, "error")
    }
  }

  function loadConflictVersion() {
    const conflictPath = state.conflict?.path || state.filePath
    state.loadConflictVersion()
    suggestedFilename.value = getCanvasFileName(conflictPath)
    showMessage(t("messageLoadedNewerCanvasVersionFromDisk"), 2500, "info")
  }

  function openSettings() {
    plugin.openCanvasSettings?.()
  }

  function exportCanvas() {
    const blob = new Blob([`${JSON.stringify(state.document, null, "\t")}\n`], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = suggestedFilename.value || state.filePath.split("/").pop() || "canvas-export.canvas"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return {
    ensureCanvasPath,
    exportCanvas,
    importCanvas,
    loadConflictVersion,
    newCanvas,
    openPath,
    openRecentPath,
    openSettings,
    overwriteConflictVersion,
    rememberRecentPath,
    save,
    triggerImport,
  }
}

import type { Ref } from "vue"
import type { CanvasEditorState } from "@/canvas/editor-state"
import type {
  CanvasPluginSettings,
  CanvasRecentFile,
  CanvasRecentFileSource,
} from "@/canvas/plugin-data"
import type {
  CanvasEditorFileSource,
  CanvasI18nTranslator,
  CanvasPluginBridge,
} from "@/canvas/use-canvas-editor-shared"

import {
  showMessage,
} from "siyuan"
import { openConfirmDialog } from "@/canvas/confirm-dialog"
import { createEmptyCanvasDocument } from "@/canvas/document"
import {
  parseCanvasDocument,
  stringifyCanvasDocument,
} from "@/canvas/format"
import {
  getSelectedLocalPath,
  localPathExists,
  readLocalFileText,
  writeLocalFileText,
} from "@/canvas/local-file-system"
import { openTextInputDialog } from "@/canvas/text-input-dialog"
import { getCanvasFileName } from "@/canvas/use-canvas-editor-shared"

interface CanvasEditorFileActionOptions {
  fileInputRef: Ref<HTMLInputElement | undefined>
  fileSource: Ref<CanvasEditorFileSource>
  getPluginSettings: () => CanvasPluginSettings
  plugin: CanvasPluginBridge
  refreshRecentFiles: () => void
  refreshWorkspaceDocuments: () => Promise<void>
  resetViewport: () => void
  state: CanvasEditorState
  suggestedFilename: Ref<string>
  t: CanvasI18nTranslator
}

interface ResolvedSaveTarget {
  path: string
  sourceType: CanvasRecentFileSource
}

function normalizeWorkspaceCanvasPath(input: string, baseDirectory: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return ""
  }

  const normalized = trimmed.endsWith(".canvas") ? trimmed : `${trimmed}.canvas`
  return normalized.startsWith("/") ? normalized : `${baseDirectory}/${normalized}`
}

function normalizeLocalCanvasPath(input: string, currentPath: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return ""
  }

  const normalized = trimmed.endsWith(".canvas") ? trimmed : `${trimmed}.canvas`
  if (
    normalized.includes("/")
    || normalized.includes("\\")
    || /^[a-z]:/i.test(normalized)
    || normalized.startsWith("\\\\")
    || !currentPath
  ) {
    return normalized
  }

  const slashIndex = Math.max(currentPath.lastIndexOf("/"), currentPath.lastIndexOf("\\"))
  if (slashIndex < 0) {
    return normalized
  }

  return `${currentPath.slice(0, slashIndex + 1)}${normalized}`
}

async function workspacePathExists(path: string): Promise<boolean> {
  const response = await fetch("/api/file/getFile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  })

  return response.status === 200
}

export function createCanvasEditorFileActions(options: CanvasEditorFileActionOptions) {
  const {
    fileInputRef,
    fileSource,
    getPluginSettings,
    plugin,
    refreshRecentFiles,
    refreshWorkspaceDocuments,
    resetViewport,
    state,
    suggestedFilename,
    t,
  } = options

  function defaultDirectory(): string {
    return getPluginSettings().defaultCanvasDirectory
  }

  function ensureCanvasPath(input: string): string {
    return normalizeWorkspaceCanvasPath(input, defaultDirectory())
  }

  async function confirmUnsavedChanges(): Promise<boolean> {
    if (!state.isDirty) return true
    return openConfirmDialog(
      t("confirmUnsavedChangesTitle"),
      t("confirmUnsavedChangesDescription"),
    )
  }

  async function rememberRecentPath(path: string, sourceType: CanvasRecentFileSource) {
    await plugin.rememberRecentCanvas?.(path, getCanvasFileName(path), sourceType)
    refreshRecentFiles()
  }

  async function nextUntitledName(): Promise<string> {
    const dir = defaultDirectory()
    const baseName = t("untitledCanvas").replace(/\.canvas$/i, "")
    const first = `${baseName}.canvas`
    if (!await workspacePathExists(`${dir}/${first}`)) return first
    for (let i = 2; i <= 99; i++) {
      const candidate = `${baseName} (${i}).canvas`
      if (!await workspacePathExists(`${dir}/${candidate}`)) return candidate
    }
    return first
  }

  async function newCanvas() {
    if (!await confirmUnsavedChanges()) return
    state.replaceDocument(createEmptyCanvasDocument(), "")
    suggestedFilename.value = await nextUntitledName()
    fileSource.value = "unsaved"
    resetViewport()
  }

  async function openWorkspacePath(path: string) {
    if (!await confirmUnsavedChanges()) return
    try {
      await state.open(path)
      suggestedFilename.value = getCanvasFileName(path)
      fileSource.value = "workspace"
      await rememberRecentPath(path, "workspace")
      resetViewport()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOpenCanvasFile"), 4000, "error")
    }
  }

  async function openLocalPath(path: string, fallbackTitle?: string) {
    if (!await confirmUnsavedChanges()) return
    try {
      const raw = await readLocalFileText(path)
      const parsed = parseCanvasDocument(raw)
      if (!parsed.document) {
        showMessage(parsed.errors[0]?.message || t("messageInvalidCanvasFile"), 4000, "error")
        return
      }

      suggestedFilename.value = fallbackTitle || getCanvasFileName(path)
      state.replaceDocument(parsed.document, path, { raw })
      state.issues = {
        errors: parsed.errors,
        warnings: parsed.warnings,
      }
      fileSource.value = "local"
      await rememberRecentPath(path, "local")
      resetViewport()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOpenLocalCanvasFile"), 4000, "error")
    }
  }

  async function openPath() {
    const input = await openTextInputDialog({
      cancelLabel: t("dialogCancel"),
      confirmLabel: t("dialogConfirm"),
      initialValue: state.filePath && fileSource.value === "workspace"
        ? state.filePath
        : `${defaultDirectory()}/${t("untitledCanvas")}`,
      title: t("promptWorkspacePath"),
    })
    const path = ensureCanvasPath(input || "")
    if (!path) {
      return
    }

    await openWorkspacePath(path)
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

    const localPath = getSelectedLocalPath(file)
    const title = file.name || getCanvasFileName(localPath)
    suggestedFilename.value = title
    state.replaceDocument(parsed.document, localPath, { raw })
    state.issues = {
      errors: parsed.errors,
      warnings: parsed.warnings,
    }
    fileSource.value = localPath ? "local" : "unsaved"

    if (localPath) {
      await rememberRecentPath(localPath, "local")
    }

    resetViewport()
  }

  function getDefaultSaveTarget(): ResolvedSaveTarget {
    if (fileSource.value === "local" && state.filePath) {
      return {
        path: state.filePath,
        sourceType: "local",
      }
    }

    return {
      path: state.filePath && fileSource.value === "workspace"
        ? state.filePath
        : `${defaultDirectory()}/${suggestedFilename.value || t("untitledCanvas")}`,
      sourceType: "workspace",
    }
  }

  function normalizeSaveTarget(input: string): ResolvedSaveTarget | null {
    const defaults = getDefaultSaveTarget()
    const path = defaults.sourceType === "local"
      ? normalizeLocalCanvasPath(input, state.filePath)
      : normalizeWorkspaceCanvasPath(input, defaultDirectory())

    if (!path) {
      return null
    }

    return {
      path,
      sourceType: defaults.sourceType,
    }
  }

  async function resolveSaveTarget(): Promise<ResolvedSaveTarget | null> {
    let candidate = getDefaultSaveTarget().path

    while (true) {
      const input = await openTextInputDialog({
        cancelLabel: t("dialogCancel"),
        confirmLabel: t("dialogSave"),
        initialValue: candidate,
        title: t("promptCanvasSavePath"),
      })
      const target = normalizeSaveTarget(input || "")
      if (!target) {
        return null
      }

      const isCurrentPath = target.path === state.filePath && target.sourceType === fileSource.value
      const exists = target.sourceType === "local"
        ? await localPathExists(target.path)
        : await workspacePathExists(target.path)

      if (exists && !isCurrentPath) {
        const overwrite = await openConfirmDialog(
          t("confirmOverwriteCanvasTitle"),
          t("confirmOverwriteCanvasDescription", { path: target.path }),
        )
        if (!overwrite) {
          candidate = target.path
          continue
        }
      }

      return target
    }
  }

  async function saveLocal(path: string) {
    const raw = stringifyCanvasDocument(state.document)
    await writeLocalFileText(path, raw)
    state.filePath = path
    state.isDirty = false
    state.lastSavedRaw = raw
    state.conflict = null
    suggestedFilename.value = getCanvasFileName(path)
    fileSource.value = "local"
    await rememberRecentPath(path, "local")
  }

  async function saveWorkspace(path: string) {
    await state.save(path, {
      detectExternalChanges: getPluginSettings().detectExternalChanges,
    })
    suggestedFilename.value = getCanvasFileName(path)
    fileSource.value = "workspace"
    await rememberRecentPath(path, "workspace")
    await refreshWorkspaceDocuments()
  }

  async function save() {
    const target = await resolveSaveTarget()
    if (!target) {
      return
    }

    try {
      if (target.sourceType === "local") {
        await saveLocal(target.path)
        return
      }

      await saveWorkspace(target.path)
    } catch (error) {
      if (state.conflict) {
        showMessage(t("messageCanvasFileChangedOnDisk"), 5000, "error")
        return
      }

      showMessage(
        error instanceof Error
          ? error.message
          : target.sourceType === "local"
            ? t("messageUnableSaveLocalCanvasFile")
            : t("messageUnableSaveCanvas"),
        4000,
        "error",
      )
    }
  }

  async function openRecentFile(recent: CanvasRecentFile) {
    if (recent.sourceType === "local") {
      await openLocalPath(recent.path, recent.title)
      return
    }

    await openWorkspacePath(recent.path)
  }

  async function openRecentPath(path: string) {
    await openWorkspacePath(path)
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
      await rememberRecentPath(state.filePath, "workspace")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOverwriteDiskVersion"), 4000, "error")
    }
  }

  function loadConflictVersion() {
    const conflictPath = state.conflict?.path || state.filePath
    state.loadConflictVersion()
    suggestedFilename.value = getCanvasFileName(conflictPath)
    fileSource.value = "workspace"
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
    anchor.download = suggestedFilename.value || getCanvasFileName(state.filePath) || "canvas-export.canvas"
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
    openRecentFile,
    openRecentPath,
    openSettings,
    openWorkspacePath,
    overwriteConflictVersion,
    rememberRecentPath,
    save,
    triggerImport,
  }
}

import type { CanvasPluginBridge } from "@/canvas/use-canvas-editor-shared"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"

import {
  fetchSyncPost,
  showMessage as siyuanShowMessage,
} from "siyuan"
import {
  computed,
  ref,
} from "vue"
import {
  putFile as siyuanPutFile,
  readDir as siyuanReadDir,
  removeFile as siyuanRemoveFile,
} from "@/api"
import { openConfirmDialog } from "@/canvas/confirm-dialog"
import { openTextInputDialog } from "@/canvas/text-input-dialog"
import {
  buildWorkspaceFilePath,
  collectWorkspaceCanvasFiles,
  collectWorkspaceFolderPaths,
  readWorkspaceDirectoryTree,
  sanitizeCanvasFileBaseName,
  sanitizeWorkspaceName,
  sortWorkspaceTreeNodes,
} from "@/canvas/workspace-tree-core"

export interface WorkspaceEntry {
  name: string
  updated?: number
  created?: number
  isDir: boolean
}

export type WorkspaceTreeNode = {
  type: 'file'
  path: string
  name: string
  updated?: number
  created?: number
} | {
  type: 'folder'
  path: string
  name: string
  children: WorkspaceTreeNode[]
}

export type WorkspaceSortField = 'name' | 'updated' | 'created'
export type WorkspaceSortDirection = 'asc' | 'desc'

export interface WorkspaceTreeDependencies {
  readDir: (path: string) => Promise<WorkspaceEntry[]>
  putFile: (path: string, isDir: boolean, file: Blob) => Promise<unknown>
  removeFile: (path: string) => Promise<unknown>
  showMessage: (msg: string, timeout?: number, type?: string) => void
  getSettings: () => CanvasPluginSettings
  plugin: Pick<CanvasPluginBridge, "removeRecentCanvasFile" | "updateCanvasUiState">
  onFilePathUpdate?: (path: string) => void
  refreshRecentFiles: () => void
  labels?: Partial<WorkspaceTreeLabels>
  promptText?: (options: {
    cancelLabel: string
    confirmLabel: string
    initialValue: string
    title: string
  }) => Promise<string | null>
  confirm?: (title: string, description: string) => Promise<boolean>
}

export interface WorkspaceTreeLabels {
  copyTitle: string
  deleteCanvasDescription: (path: string) => string
  deleteCanvasTitle: string
  deleteFolderDescription: (name: string) => string
  deleteFolderTitle: string
  dialogCancel: string
  dialogConfirm: string
  fileAlreadyExistsMessage: string
  folderNameTitle: string
  messageFileCopied: (name: string) => string
  messageFileMoved: (name: string, folder: string) => string
  messageFileRenamed: (name: string) => string
  messageFolderRenamed: (name: string) => string
  newFolderMessage: (name: string) => string
  notAvailableInBrowserMessage: string
  renameFolderTitle: string
  renameTitle: string
  unableToCopyFileMessage: string
  unableToGetWorkspacePathMessage: string
  unableToMoveFileMessage: string
  unableToOpenFolderMessage: string
  unableToRenameFileMessage: string
  unableToRenameFolderMessage: string
  unableToSaveMessage: string
}

const DEFAULT_WORKSPACE_TREE_LABELS: WorkspaceTreeLabels = {
  copyTitle: "Copy",
  deleteCanvasDescription: path => `Delete ${path}?`,
  deleteCanvasTitle: "Delete canvas?",
  deleteFolderDescription: name => `Delete "${name}" and all its contents?`,
  deleteFolderTitle: "Delete folder?",
  dialogCancel: "Cancel",
  dialogConfirm: "Confirm",
  fileAlreadyExistsMessage: "File already exists",
  folderNameTitle: "Folder name",
  messageFileCopied: name => `Copied to ${name}`,
  messageFileMoved: (name, folder) => `Moved ${name} to ${folder}`,
  messageFileRenamed: name => `Renamed to ${name}`,
  messageFolderRenamed: name => `Renamed folder to ${name}`,
  newFolderMessage: name => `New folder: ${name}`,
  notAvailableInBrowserMessage: "Not available in browser mode",
  renameFolderTitle: "Rename folder",
  renameTitle: "Rename",
  unableToCopyFileMessage: "Unable to copy file",
  unableToGetWorkspacePathMessage: "Unable to get workspace path",
  unableToMoveFileMessage: "Unable to move file",
  unableToOpenFolderMessage: "Unable to open folder",
  unableToRenameFileMessage: "Unable to rename file",
  unableToRenameFolderMessage: "Unable to rename folder",
  unableToSaveMessage: "Unable to save",
}

function notifyWorkspaceChanged() {
  window.dispatchEvent(new CustomEvent("siyuan-canvas:workspace-changed"))
}

export function createCanvasEditorWorkspaceTree(deps: WorkspaceTreeDependencies) {
  const labels = {
    ...DEFAULT_WORKSPACE_TREE_LABELS,
    ...deps.labels,
  }
  const promptText = deps.promptText ?? openTextInputDialog
  const confirm = deps.confirm ?? openConfirmDialog
  const workspaceDocuments = ref<WorkspaceTreeNode[]>([])
  const expandedFolders = ref<Set<string>>(new Set())
  const workspaceSortField = ref<WorkspaceSortField>('updated')
  const workspaceSortDirection = ref<WorkspaceSortDirection>('desc')

  async function readDirectoryTree(dirPath: string): Promise<WorkspaceTreeNode[]> {
    return readWorkspaceDirectoryTree(dirPath, deps.readDir)
  }

  function sortWorkspaceTree(nodes: WorkspaceTreeNode[]): WorkspaceTreeNode[] {
    return sortWorkspaceTreeNodes(nodes, workspaceSortField.value, workspaceSortDirection.value)
  }

  async function refreshWorkspaceDocuments(options?: { silent?: boolean }) {
    const directory = deps.getSettings().defaultCanvasDirectory

    try {
      const tree = await readDirectoryTree(directory)
      workspaceDocuments.value = sortWorkspaceTree(tree)
      if (!options?.silent) {
        notifyWorkspaceChanged()
      }
    } catch {
      workspaceDocuments.value = []
    }
  }

  async function createWorkspaceFolder() {
    const directory = deps.getSettings().defaultCanvasDirectory
    const folderName = await promptText({
      cancelLabel: labels.dialogCancel,
      confirmLabel: labels.dialogConfirm,
      initialValue: "",
      title: labels.folderNameTitle,
    })
    if (!folderName || !folderName.trim()) return
    const folderPath = `${directory}/${folderName.trim()}`
    try {
      await deps.putFile(folderPath, true, new Blob([]))
      await refreshWorkspaceDocuments()
      deps.showMessage(labels.newFolderMessage(folderName.trim()))
    } catch {
      deps.showMessage(labels.unableToSaveMessage, 4000, "error")
    }
  }

  function collectFolderPaths(nodes: WorkspaceTreeNode[]): string[] {
    return collectWorkspaceFolderPaths(nodes)
  }

  function setWorkspaceSortField(field: WorkspaceSortField) {
    workspaceSortField.value = field
    refreshWorkspaceDocuments()
  }

  function setWorkspaceSortDirection(direction: WorkspaceSortDirection) {
    workspaceSortDirection.value = direction
    refreshWorkspaceDocuments()
  }

  function toggleFolderExpand(path: string) {
    if (expandedFolders.value.has(path)) {
      expandedFolders.value.delete(path)
    } else {
      expandedFolders.value.add(path)
    }
    expandedFolders.value = new Set(expandedFolders.value)
  }

  function expandAllFolders() {
    expandedFolders.value = new Set(collectFolderPaths(workspaceDocuments.value))
  }

  function collapseAllFolders() {
    expandedFolders.value = new Set()
  }

  const allFoldersExpanded = computed(() => {
    const allPaths = collectFolderPaths(workspaceDocuments.value)
    return allPaths.length > 0 && allPaths.every(p => expandedFolders.value.has(p))
  })

  async function deleteWorkspaceDocument(path: string) {
    const confirmed = await confirm(
      labels.deleteCanvasTitle,
      labels.deleteCanvasDescription(path),
    )
    if (!confirmed) return
    try {
      await deps.removeFile(path)
    } catch {
      // file may already be absent on disk
    }
    await deps.plugin.removeRecentCanvasFile?.(path)
    deps.refreshRecentFiles()
    await refreshWorkspaceDocuments()
  }

  async function deleteWorkspaceFolder(folderPath: string) {
    const folderName = folderPath.substring(folderPath.lastIndexOf('/') + 1)
    const confirmed = await confirm(
      labels.deleteFolderTitle,
      labels.deleteFolderDescription(folderName),
    )
    if (!confirmed) return

    // collect canvas file paths before deletion so we can clean recent records
    try {
      const files = collectWorkspaceCanvasFiles(await readDirectoryTree(folderPath))
      await deps.removeFile(folderPath)
      for (const filePath of files) {
        await deps.plugin.removeRecentCanvasFile?.(filePath)
      }
    } catch {
      // folder may already be absent
    }
    deps.refreshRecentFiles()
    await refreshWorkspaceDocuments()
  }

  async function openInExplorer(filePath: string) {
    try {
      const resp = await fetchSyncPost("/api/system/getConf", {})
      const workspaceDir = resp?.data?.conf?.system?.workspaceDir
      if (!workspaceDir) {
        deps.showMessage(labels.unableToGetWorkspacePathMessage, 4000, "error")
        return
      }

      const dirToOpen = filePath.includes('/')
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : filePath
      const absolutePath = `${workspaceDir.replace(/[/\\]+$/, '')}/${dirToOpen.replace(/^[/\\]+/, '')}`.replace(/\//g, '\\')

      const remote = (window as any).require?.("@electron/remote")
      const electronShell = remote?.require?.("electron")?.shell
      if (electronShell?.openPath) {
        const result = await electronShell.openPath(absolutePath)
        if (result) deps.showMessage(result, 4000, "error")
      } else {
        deps.showMessage(labels.notAvailableInBrowserMessage, 4000, "error")
      }
    } catch {
      deps.showMessage(labels.unableToOpenFolderMessage, 4000, "error")
    }
  }

  async function moveWorkspaceFile(sourcePath: string, targetFolderPath: string): Promise<boolean> {
    const fileName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1)
    const targetFilePath = `${targetFolderPath}/${fileName}`
    const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'))

    if (sourceDir === targetFolderPath) return false

    try {
      const entries = await deps.readDir(targetFolderPath)
      if (Array.isArray(entries) && entries.some((e) => e.name === fileName)) {
        deps.showMessage(labels.fileAlreadyExistsMessage, 4000, "error")
        return false
      }
    } catch {
      // directory may not exist or be unreadable
    }

    try {
      const response = await fetch("/api/file/getFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: sourcePath }),
      })
      if (!response.ok) {
        deps.showMessage(labels.unableToMoveFileMessage, 4000, "error")
        return false
      }
      const content = await response.text()
      const blob = new Blob([content], { type: "application/json" })
      await deps.putFile(targetFilePath, false, blob)
    } catch {
      deps.showMessage(labels.unableToMoveFileMessage, 4000, "error")
      return false
    }

    try {
      await deps.removeFile(sourcePath)
    } catch {
      try { await deps.removeFile(targetFilePath) } catch { /* cleanup best-effort */ }
      deps.showMessage(labels.unableToMoveFileMessage, 4000, "error")
      return false
    }

    deps.onFilePathUpdate?.(targetFilePath)
    await deps.plugin.removeRecentCanvasFile?.(sourcePath)
    deps.refreshRecentFiles()
    await refreshWorkspaceDocuments()
    deps.showMessage(labels.messageFileMoved(fileName, targetFolderPath))
    return true
  }

  async function renameWorkspaceDocument(oldPath: string) {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const currentFullName = oldPath.substring(oldPath.lastIndexOf('/') + 1)
    const currentBaseName = currentFullName.replace(/\.canvas$/i, '')

    const newName = await promptText({
      cancelLabel: labels.dialogCancel,
      confirmLabel: labels.dialogConfirm,
      initialValue: currentBaseName,
      title: labels.renameTitle,
    })
    if (!newName || !newName.trim()) return

    const sanitized = sanitizeCanvasFileBaseName(newName)
    if (!sanitized || sanitized === currentBaseName) return

    const newPath = buildWorkspaceFilePath(dir, sanitized)

    try {
      const response = await fetch("/api/file/getFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: oldPath }),
      })
      if (!response.ok) {
        deps.showMessage(labels.unableToRenameFileMessage, 4000, "error")
        return
      }
      const content = await response.text()
      const blob = new Blob([content], { type: "application/json" })
      await deps.putFile(newPath, false, blob)
    } catch {
      deps.showMessage(labels.unableToRenameFileMessage, 4000, "error")
      return
    }

    try {
      await deps.removeFile(oldPath)
    } catch {
      try { await deps.removeFile(newPath) } catch { /* cleanup best-effort */ }
      deps.showMessage(labels.unableToRenameFileMessage, 4000, "error")
      return
    }

    deps.onFilePathUpdate?.(newPath)
    await deps.plugin.removeRecentCanvasFile?.(oldPath)
    deps.refreshRecentFiles()
    await refreshWorkspaceDocuments()
    window.dispatchEvent(new CustomEvent("siyuan-canvas:file-saved", { detail: { path: newPath } }))
    deps.showMessage(labels.messageFileRenamed(sanitized))
  }

  async function renameWorkspaceFolder(folderPath: string) {
    const parentDir = folderPath.substring(0, folderPath.lastIndexOf('/'))
    const currentName = folderPath.substring(folderPath.lastIndexOf('/') + 1)

    const newName = await promptText({
      cancelLabel: labels.dialogCancel,
      confirmLabel: labels.dialogConfirm,
      initialValue: currentName,
      title: labels.renameFolderTitle,
    })
    if (!newName || !newName.trim()) return

    const sanitized = sanitizeWorkspaceName(newName)
    if (!sanitized || sanitized === currentName) return

    const newFolderPath = `${parentDir}/${sanitized}`

    try {
      const files = collectWorkspaceCanvasFiles(await readDirectoryTree(folderPath))
      for (const filePath of files) {
        const relativePath = filePath.substring(folderPath.length + 1)
        const newFilePath = `${newFolderPath}/${relativePath}`

        const response = await fetch("/api/file/getFile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath }),
        })
        if (!response.ok) {
          deps.showMessage(labels.unableToRenameFolderMessage, 4000, "error")
          return
        }
        const content = await response.text()
        const blob = new Blob([content], { type: "application/json" })
        await deps.putFile(newFilePath, false, blob)
      }

      await deps.removeFile(folderPath)

      // update recent file records that were under the old folder
      for (const filePath of files) {
        const relativePath = filePath.substring(folderPath.length + 1)
        const newFilePath = `${newFolderPath}/${relativePath}`
        deps.onFilePathUpdate?.(newFilePath)
        await deps.plugin.removeRecentCanvasFile?.(filePath)
      }

      deps.refreshRecentFiles()
      await refreshWorkspaceDocuments()
      deps.showMessage(labels.messageFolderRenamed(sanitized))
    } catch {
      deps.showMessage(labels.unableToRenameFolderMessage, 4000, "error")
    }
  }

  async function copyWorkspaceDocument(sourcePath: string) {
    const dir = sourcePath.substring(0, sourcePath.lastIndexOf('/'))
    const fullName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1)
    const baseName = fullName.replace(/\.canvas$/i, '')

    const newName = await promptText({
      cancelLabel: labels.dialogCancel,
      confirmLabel: labels.dialogConfirm,
      initialValue: `${baseName} (copy)`,
      title: labels.copyTitle,
    })
    if (!newName || !newName.trim()) return

    const sanitized = sanitizeCanvasFileBaseName(newName)
    if (!sanitized) return

    const newPath = buildWorkspaceFilePath(dir, sanitized)

    try {
      const response = await fetch("/api/file/getFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: sourcePath }),
      })
      if (!response.ok) {
        deps.showMessage(labels.unableToCopyFileMessage, 4000, "error")
        return
      }
      const content = await response.text()
      const blob = new Blob([content], { type: "application/json" })
      await deps.putFile(newPath, false, blob)
      await refreshWorkspaceDocuments()
      window.dispatchEvent(new CustomEvent("siyuan-canvas:file-saved", { detail: { path: newPath } }))
      deps.showMessage(labels.messageFileCopied(sanitized))
    } catch {
      deps.showMessage(labels.unableToCopyFileMessage, 4000, "error")
    }
  }

  async function removeRecentFileRecord(path: string) {
    await deps.plugin.removeRecentCanvasFile?.(path)
    deps.refreshRecentFiles()
  }

  return {
    // state
    workspaceDocuments,
    expandedFolders,
    workspaceSortField,
    workspaceSortDirection,
    // computed
    allFoldersExpanded,
    // tree reading & sorting
    readDirectoryTree,
    sortWorkspaceTree,
    collectFolderPaths,
    // actions
    refreshWorkspaceDocuments,
    createWorkspaceFolder,
    deleteWorkspaceDocument,
    deleteWorkspaceFolder,
    openInExplorer,
    moveWorkspaceFile,
    renameWorkspaceDocument,
    renameWorkspaceFolder,
    copyWorkspaceDocument,
    removeRecentFileRecord,
    // expand/collapse
    setWorkspaceSortField,
    setWorkspaceSortDirection,
    toggleFolderExpand,
    expandAllFolders,
    collapseAllFolders,
  }
}

export type CanvasEditorWorkspaceTree = ReturnType<typeof createCanvasEditorWorkspaceTree>

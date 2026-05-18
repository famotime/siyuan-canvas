import type { CanvasPluginBridge } from "@/canvas/use-canvas-editor-shared"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"

import {
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
}

export function createCanvasEditorWorkspaceTree(deps: WorkspaceTreeDependencies) {
  const workspaceDocuments = ref<WorkspaceTreeNode[]>([])
  const expandedFolders = ref<Set<string>>(new Set())
  const workspaceSortField = ref<WorkspaceSortField>('updated')
  const workspaceSortDirection = ref<WorkspaceSortDirection>('desc')

  async function readDirectoryTree(dirPath: string): Promise<WorkspaceTreeNode[]> {
    let entries: WorkspaceEntry[]
    try {
      entries = (await deps.readDir(dirPath)) ?? []
    } catch {
      return []
    }

    const nodes: WorkspaceTreeNode[] = []
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`
      if (entry.isDir) {
        const children = await readDirectoryTree(fullPath)
        nodes.push({ type: 'folder', path: fullPath, name: entry.name, children })
      } else if (entry.name.endsWith('.canvas')) {
        nodes.push({
          type: 'file',
          path: fullPath,
          name: entry.name,
          updated: entry.updated,
          created: entry.created,
        })
      }
    }
    return nodes
  }

  function sortWorkspaceTree(nodes: WorkspaceTreeNode[]): WorkspaceTreeNode[] {
    const sorted = [...nodes].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1
      if (a.type !== 'folder' && b.type === 'folder') return 1

      const field = workspaceSortField.value
      const dir = workspaceSortDirection.value === 'asc' ? 1 : -1

      if (field === 'name') {
        return dir * a.name.localeCompare(b.name, 'zh-CN')
      }

      const aVal = a.type === 'file' ? (a[field] ?? 0) : 0
      const bVal = b.type === 'file' ? (b[field] ?? 0) : 0
      return dir * (aVal - bVal)
    })

    return sorted.map((node) =>
      node.type === 'folder'
        ? { ...node, children: sortWorkspaceTree(node.children) }
        : node,
    )
  }

  async function refreshWorkspaceDocuments() {
    const directory = deps.getSettings().defaultCanvasDirectory

    try {
      const tree = await readDirectoryTree(directory)
      workspaceDocuments.value = sortWorkspaceTree(tree)
    } catch {
      workspaceDocuments.value = []
    }
  }

  async function createWorkspaceFolder() {
    const directory = deps.getSettings().defaultCanvasDirectory
    const folderName = await openTextInputDialog({
      cancelLabel: "Cancel",
      confirmLabel: "Confirm",
      initialValue: "",
      title: "Folder name",
    })
    if (!folderName || !folderName.trim()) return
    const folderPath = `${directory}/${folderName.trim()}`
    try {
      await deps.putFile(folderPath, true, new Blob([]))
      await refreshWorkspaceDocuments()
      deps.showMessage("New folder: " + folderName.trim())
    } catch {
      deps.showMessage("Unable to save", 4000, "error")
    }
  }

  function collectFolderPaths(nodes: WorkspaceTreeNode[]): string[] {
    const paths: string[] = []
    for (const node of nodes) {
      if (node.type === 'folder') {
        paths.push(node.path)
        paths.push(...collectFolderPaths(node.children))
      }
    }
    return paths
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
    const confirmed = await openConfirmDialog(
      "Delete canvas?",
      `Delete ${path}?`,
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

  async function moveWorkspaceFile(sourcePath: string, targetFolderPath: string): Promise<boolean> {
    const fileName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1)
    const targetFilePath = `${targetFolderPath}/${fileName}`
    const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'))

    if (sourceDir === targetFolderPath) return false

    try {
      const entries = await deps.readDir(targetFolderPath)
      if (Array.isArray(entries) && entries.some((e) => e.name === fileName)) {
        deps.showMessage("File already exists", 4000, "error")
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
        deps.showMessage("Unable to move file", 4000, "error")
        return false
      }
      const content = await response.text()
      const blob = new Blob([content], { type: "application/json" })
      await deps.putFile(targetFilePath, false, blob)
    } catch {
      deps.showMessage("Unable to move file", 4000, "error")
      return false
    }

    try {
      await deps.removeFile(sourcePath)
    } catch {
      try { await deps.removeFile(targetFilePath) } catch { /* cleanup best-effort */ }
      deps.showMessage("Unable to move file", 4000, "error")
      return false
    }

    deps.onFilePathUpdate?.(targetFilePath)
    await deps.plugin.removeRecentCanvasFile?.(sourcePath)
    deps.refreshRecentFiles()
    await refreshWorkspaceDocuments()
    deps.showMessage(`Moved ${fileName} to ${targetFolderPath}`)
    return true
  }

  async function renameWorkspaceDocument(oldPath: string) {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('/'))
    const currentFullName = oldPath.substring(oldPath.lastIndexOf('/') + 1)
    const currentBaseName = currentFullName.replace(/\.canvas$/i, '')

    const newName = await openTextInputDialog({
      cancelLabel: "Cancel",
      confirmLabel: "Confirm",
      initialValue: currentBaseName,
      title: "Rename",
    })
    if (!newName || !newName.trim()) return

    const sanitized = newName.trim()
      .replace(/[\\/:*?"'<>|]/g, "_")
      .replace(/[~[\]()!&{}=#%;$]/g, "")
      .replace(/[\x00-\x1f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.+$/, "")
    if (!sanitized || sanitized === currentBaseName) return

    const newPath = `${dir}/${sanitized}.canvas`

    try {
      const response = await fetch("/api/file/getFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: oldPath }),
      })
      if (!response.ok) {
        deps.showMessage("Unable to rename file", 4000, "error")
        return
      }
      const content = await response.text()
      const blob = new Blob([content], { type: "application/json" })
      await deps.putFile(newPath, false, blob)
    } catch {
      deps.showMessage("Unable to rename file", 4000, "error")
      return
    }

    try {
      await deps.removeFile(oldPath)
    } catch {
      try { await deps.removeFile(newPath) } catch { /* cleanup best-effort */ }
      deps.showMessage("Unable to rename file", 4000, "error")
      return
    }

    deps.onFilePathUpdate?.(newPath)
    await deps.plugin.removeRecentCanvasFile?.(oldPath)
    deps.refreshRecentFiles()
    await refreshWorkspaceDocuments()
    deps.showMessage(`Renamed to ${sanitized}`)
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
    moveWorkspaceFile,
    renameWorkspaceDocument,
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

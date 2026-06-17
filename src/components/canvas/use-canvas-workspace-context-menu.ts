import { ref } from "vue"
import type { CanvasEditorWorkspaceTree } from "@/canvas/use-canvas-editor-workspace-tree"

export type CanvasWorkspaceContextMenuType = 'file' | 'folder'

export interface CanvasWorkspaceContextMenuOptions {
  copyPath: (path: string) => Promise<void>
  editor: Pick<
    CanvasEditorWorkspaceTree,
    | "copyWorkspaceDocument"
    | "createWorkspaceFolder"
    | "deleteWorkspaceDocument"
    | "deleteWorkspaceFolder"
    | "openInExplorer"
    | "renameWorkspaceDocument"
    | "renameWorkspaceFolder"
  > & {
    newCanvas: () => void | Promise<void>
  }
  showCopyPathSuccess: () => void
}

export function useCanvasWorkspaceContextMenu(options: CanvasWorkspaceContextMenuOptions) {
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuPath = ref("")
  const contextMenuType = ref<CanvasWorkspaceContextMenuType>('file')

  function onContextMenu(event: MouseEvent, path: string, type: CanvasWorkspaceContextMenuType) {
    contextMenuPath.value = path
    contextMenuType.value = type
    contextMenuX.value = event.clientX
    contextMenuY.value = event.clientY
    contextMenuVisible.value = true
  }

  function closeContextMenu() {
    contextMenuVisible.value = false
  }

  function contextMenuRename() {
    closeContextMenu()
    if (contextMenuType.value === 'file') {
      options.editor.renameWorkspaceDocument(contextMenuPath.value)
    } else {
      options.editor.renameWorkspaceFolder(contextMenuPath.value)
    }
  }

  function contextMenuCopy() {
    closeContextMenu()
    options.editor.copyWorkspaceDocument(contextMenuPath.value)
  }

  async function contextMenuCopyPath() {
    closeContextMenu()
    const filePath = contextMenuPath.value.startsWith('/') ? contextMenuPath.value : `/${contextMenuPath.value}`
    await options.copyPath(filePath)
    options.showCopyPathSuccess()
  }

  function contextMenuOpenInExplorer() {
    closeContextMenu()
    options.editor.openInExplorer(contextMenuPath.value)
  }

  function contextMenuNewSubfolder() {
    closeContextMenu()
    options.editor.createWorkspaceFolder()
  }

  function contextMenuNewDocument() {
    closeContextMenu()
    options.editor.newCanvas()
  }

  function contextMenuDelete() {
    closeContextMenu()
    if (contextMenuType.value === 'file') {
      options.editor.deleteWorkspaceDocument(contextMenuPath.value)
    } else {
      options.editor.deleteWorkspaceFolder(contextMenuPath.value)
    }
  }

  return {
    closeContextMenu,
    contextMenuCopy,
    contextMenuCopyPath,
    contextMenuDelete,
    contextMenuNewDocument,
    contextMenuNewSubfolder,
    contextMenuOpenInExplorer,
    contextMenuPath,
    contextMenuRename,
    contextMenuType,
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    onContextMenu,
  }
}

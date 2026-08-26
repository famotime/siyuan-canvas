import type { Ref } from 'vue'
import type { CanvasTabBootstrap } from '@/main'
import type {
  CanvasEditorFileSource,
  CanvasI18nTranslator,
} from '@/canvas/use-canvas-editor-shared'
import type {
  CanvasEditorEdgeReconnectDraftState,
} from '@/canvas/use-canvas-editor-gestures'
import type { CanvasEditorState } from '@/canvas/editor-state'
import type { CanvasRecentFile } from '@/canvas/plugin-data'

import { showMessage } from 'siyuan'
import { parseCanvasDocument } from '@/canvas/format'

interface InitializeCanvasEditorOptions {
  bootstrap: CanvasTabBootstrap
  fileSource: Ref<CanvasEditorFileSource>
  getFileName: (path: string) => string
  getRecentCanvasFiles?: () => CanvasRecentFile[]
  newCanvas: () => Promise<void>
  refreshFileNodeMetadata: () => Promise<void>
  refreshRecentFiles: () => void
  refreshWorkspaceDocuments: () => Promise<void>
  rememberRecentPath: (path: string, sourceType: 'workspace' | 'local') => Promise<void>
  resetViewport: () => void
  state: CanvasEditorState
  suggestedFilename: Ref<string>
  t: CanvasI18nTranslator
}

interface SyncCanvasEditorSelectionUiOptions {
  applySelectedNodeAsEdgeSource: () => void
  cancelEdgeLabelEditing: () => void
  clearEdgeReconnectDraft: () => void
  clearSelectionBox: () => void
  closeEdgePopover: () => void
  closeSelectionPopover: () => void
  edgeReconnectDraft: CanvasEditorEdgeReconnectDraftState
  state: CanvasEditorState
}

export async function initializeCanvasEditor(options: InitializeCanvasEditorOptions) {
  const {
    bootstrap,
    fileSource,
    getFileName,
    getRecentCanvasFiles,
    newCanvas,
    refreshFileNodeMetadata,
    refreshRecentFiles,
    refreshWorkspaceDocuments,
    rememberRecentPath,
    resetViewport,
    state,
    suggestedFilename,
    t,
  } = options

  if (bootstrap.raw) {
    const parsed = parseCanvasDocument(bootstrap.raw)
    if (parsed.document) {
      state.replaceDocument(parsed.document, bootstrap.path || '')
      state.issues = {
        errors: parsed.errors,
        warnings: parsed.warnings,
      }
    }
  } else if (bootstrap.path) {
    try {
      await state.open(bootstrap.path)
      suggestedFilename.value = getFileName(bootstrap.path)
      const isLocal = /^[a-zA-Z]:[/\\]/.test(bootstrap.path) || /^[/\\]+[a-zA-Z]:/.test(bootstrap.path) || bootstrap.path.startsWith('file://')
      const sourceType = isLocal ? 'local' : 'workspace'
      fileSource.value = sourceType
      await rememberRecentPath(bootstrap.path, sourceType)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t('messageUnableOpenCanvasFile'), 4000, 'error')
    }
  } else {
    let autoLoaded = false
    if (getRecentCanvasFiles) {
      const recentFiles = getRecentCanvasFiles()
      const lastFile = recentFiles.find(f => f.sourceType === 'workspace')
      if (lastFile) {
        try {
          await state.open(lastFile.path)
          suggestedFilename.value = getFileName(lastFile.path)
          fileSource.value = 'workspace'
          autoLoaded = true
        } catch {
          // 文件已不存在，回退到新建
        }
      }
    }
    if (!autoLoaded) {
      await newCanvas()
    }
  }

  refreshRecentFiles()
  await refreshWorkspaceDocuments()
  await refreshFileNodeMetadata()
  resetViewport()
}

export function syncCanvasEditorSelectionUi(options: SyncCanvasEditorSelectionUiOptions) {
  const {
    applySelectedNodeAsEdgeSource,
    cancelEdgeLabelEditing,
    clearEdgeReconnectDraft,
    clearSelectionBox,
    closeEdgePopover,
    closeSelectionPopover,
    edgeReconnectDraft,
    state,
  } = options

  applySelectedNodeAsEdgeSource()
  closeSelectionPopover()
  closeEdgePopover()
  cancelEdgeLabelEditing()
  clearSelectionBox()
  if (!edgeReconnectDraft.visible || edgeReconnectDraft.edgeId !== state.selectedEdgeId) {
    clearEdgeReconnectDraft()
  }
}

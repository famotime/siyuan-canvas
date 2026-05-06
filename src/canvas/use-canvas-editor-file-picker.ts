import type {
  ComputedRef,
  Ref,
} from 'vue'
import type { CanvasBoardMetrics } from '@/canvas/board'
import type { CanvasEditorState } from '@/canvas/editor-state'
import type {
  CanvasFilePickerOption,
  CanvasFilePickerGroups,
} from '@/canvas/file-picker-dialog'
import type { CanvasNode } from '@/canvas/types'
import type {
  CanvasEditorFileSource,
  CanvasI18nTranslator,
} from '@/canvas/use-canvas-editor-shared'

import { showMessage } from 'siyuan'
import { putFile } from '@/api'
import { createCanvasNode, upsertCanvasNode } from '@/canvas/document'
import { searchCanvasFilePickerTargets } from '@/canvas/file-picker-dialog'
import { writeWorkspaceImageFile } from '@/canvas/workspace-image-files'

interface CanvasEditorFilePickerDialogState {
  groups: CanvasFilePickerGroups
  query: string
  visible: boolean
}

interface CanvasEditorFilePickerActionsOptions {
  board: ComputedRef<CanvasBoardMetrics>
  commitDocument: (document: ReturnType<typeof upsertCanvasNode>) => void
  filePickerDialog: CanvasEditorFilePickerDialogState
  fileSource: Ref<CanvasEditorFileSource>
  refreshFileNodeMetadata: () => Promise<void>
  resolveBlockById: (blockId: string) => Promise<{
    hpath?: string
    id: string
    path: string
    rootId?: string
    title: string
  } | null>
  resolveBlocksByQuery: (query: string) => Promise<Array<{
    hpath?: string
    id: string
    path: string
    title: string
  }>>
  resolveDocumentByBlockId: (blockId: string) => Promise<{
    hpath?: string
    id: string
    path: string
    title: string
  } | null>
  resolveDocumentsByQuery: (query: string) => Promise<Array<{
    hpath?: string
    path: string
    title: string
  }>>
  resolveImageAssetByBlockId: (blockId: string) => Promise<{
    blockId: string
    name: string
    path: string
    title?: string
  } | null>
  resolveImageAssetsByQuery: (query: string) => Promise<Array<{
    blockId?: string
    name: string
    path: string
    title?: string
  }>>
  selectNode: (nodeId?: string) => void
  state: CanvasEditorState
  t: CanvasI18nTranslator
  viewport: {
    scale: number
    x: number
    y: number
  }
  workspaceDocuments: Ref<Array<
    | { type: 'file', path: string, name: string, updated?: number, created?: number }
    | { type: 'folder', path: string, name: string, children: any[] }
  >>
}

const SIYUAN_BLOCK_ID_PATTERN = /^\d{14}-[a-z0-9]{7}$/i

function createFileNodeAtViewport(
  board: CanvasBoardMetrics,
  viewport: {
    scale: number
    x: number
    y: number
  },
  stagePoint?: { x: number, y: number },
): Extract<CanvasNode, { type: 'file' }> {
  const node = createCanvasNode('file')
  const sx = stagePoint?.x ?? 200
  const sy = stagePoint?.y ?? 160
  node.x = Math.round((sx - viewport.x) / viewport.scale + board.left)
  node.y = Math.round((sy - viewport.y) / viewport.scale + board.top)
  return node
}

export { createFileNodeAtViewport }

export function createCanvasEditorFilePickerActions(options: CanvasEditorFilePickerActionsOptions) {
  const {
    board,
    commitDocument,
    filePickerDialog,
    fileSource,
    refreshFileNodeMetadata,
    resolveBlockById,
    resolveBlocksByQuery,
    resolveDocumentByBlockId,
    resolveDocumentsByQuery,
    resolveImageAssetByBlockId,
    resolveImageAssetsByQuery,
    selectNode,
    state,
    t,
    viewport,
    workspaceDocuments,
  } = options

  function resetFilePickerGroups() {
    filePickerDialog.groups = {
      blocks: [],
      canvases: [],
      documents: [],
      images: [],
    }
  }

  function openFilePickerDialog() {
    filePickerDialog.visible = true
  }

  function closeFilePickerDialog() {
    filePickerDialog.visible = false
    filePickerDialog.query = ''
    resetFilePickerGroups()
  }

  async function updateFilePickerQuery(value: string) {
    filePickerDialog.query = value
    const query = value.trim()

    if (!query) {
      resetFilePickerGroups()
      return
    }

    const exactBlock = SIYUAN_BLOCK_ID_PATTERN.test(query)
      ? await resolveBlockById(query)
      : null
    const exactDocument = SIYUAN_BLOCK_ID_PATTERN.test(query) && !exactBlock
      ? await resolveDocumentByBlockId(query)
      : null
    const imageByBlockId = SIYUAN_BLOCK_ID_PATTERN.test(query)
      ? await resolveImageAssetByBlockId(query)
      : null

    filePickerDialog.groups = await searchCanvasFilePickerTargets(query, {
      searchBlocks: async (keyword) => {
        const blocks = SIYUAN_BLOCK_ID_PATTERN.test(keyword)
          ? (exactBlock ? [exactBlock] : [])
          : await resolveBlocksByQuery(keyword)
        return blocks.map((block) => ({
          blockId: block.id,
          kind: 'block' as const,
          path: block.id,
          subtitle: block.hpath || block.path,
          title: block.title,
        }))
      },
      searchDocuments: async (keyword) => {
        const documents = SIYUAN_BLOCK_ID_PATTERN.test(keyword)
          ? (exactDocument ? [exactDocument] : [])
          : await resolveDocumentsByQuery(keyword)
        return documents.map((document) => ({
          kind: 'document' as const,
          path: document.path,
          subtitle: document.hpath || document.path,
          title: document.title,
        }))
      },
      searchImages: async (keyword) => {
        if (imageByBlockId) {
          return [{
            blockId: imageByBlockId.blockId,
            kind: 'image' as const,
            path: imageByBlockId.path,
            subtitle: imageByBlockId.path,
            title: imageByBlockId.title || imageByBlockId.name,
          }]
        }

        const images = await resolveImageAssetsByQuery(keyword)
        return images.map((image) => ({
          blockId: image.blockId,
          kind: 'image' as const,
          path: image.path,
          subtitle: image.path,
          title: image.title || image.name,
        }))
      },
      searchWorkspaceCanvasFiles: async (keyword) => {
        const normalizedQuery = keyword.trim().toLowerCase()

        function flattenTree(nodes: typeof workspaceDocuments.value): Array<{ path: string, name: string }> {
          const result: Array<{ path: string, name: string }> = []
          for (const node of nodes) {
            if (node.type === 'file') {
              result.push(node)
            } else {
              result.push(...flattenTree(node.children))
            }
          }
          return result
        }

        return flattenTree(workspaceDocuments.value)
          .filter((document) => {
            if (!normalizedQuery) {
              return true
            }

            return document.name.toLowerCase().includes(normalizedQuery)
              || document.path.toLowerCase().includes(normalizedQuery)
          })
          .map((document) => ({
            kind: 'canvas' as const,
            path: document.path,
            subtitle: document.path,
            title: document.name,
          }))
      },
    })
  }

  async function selectFilePickerResult(option: CanvasFilePickerOption) {
    const node = createFileNodeAtViewport(board.value, viewport)
    node.file = option.kind === 'block' && option.blockId
      ? option.blockId
      : option.path

    commitDocument(upsertCanvasNode(state.document, node))
    selectNode(node.id)
    closeFilePickerDialog()
    await refreshFileNodeMetadata()
  }

  async function handleClipboardImagePaste(file: File) {
    if (fileSource.value !== 'workspace' || !state.filePath.endsWith('.canvas')) {
      showMessage(t('messageUnablePasteImageWithoutWorkspaceCanvas'), 4000, 'warning')
      return
    }

    const path = await writeWorkspaceImageFile(state.filePath, file, putFile)
    const node = createFileNodeAtViewport(board.value, viewport)
    node.file = path

    commitDocument(upsertCanvasNode(state.document, node))
    selectNode(node.id)
    await refreshFileNodeMetadata()
  }

  return {
    closeFilePickerDialog,
    handleClipboardImagePaste,
    openFilePickerDialog,
    selectFilePickerResult,
    updateFilePickerQuery,
  }
}

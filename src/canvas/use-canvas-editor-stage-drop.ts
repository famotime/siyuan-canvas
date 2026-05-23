import type { ComputedRef, Ref } from 'vue'
import type { CanvasBoardMetrics } from '@/canvas/board'
import type { CanvasEditorState } from '@/canvas/editor-state'
import type { CanvasI18nTranslator } from '@/canvas/use-canvas-editor-shared'
import type { CanvasEditorFileSource } from '@/canvas/use-canvas-editor-shared'

import { showMessage } from 'siyuan'
import { upsertCanvasNode } from '@/canvas/document'
import { createFileNodeAtViewport } from '@/canvas/use-canvas-editor-file-picker'

const SIYUAN_DROP_FILE = 'application/siyuan-file'
const SIYUAN_DROP_GUTTER = 'application/siyuan-gutter'
const ZWSP = '​'
const SIYUAN_BLOCK_ID_PATTERN = /^\d{14}-[a-z0-9]{7}$/i

interface CanvasEditorStageDropOptions {
  board: ComputedRef<CanvasBoardMetrics>
  commitDocument: (document: ReturnType<typeof upsertCanvasNode>) => void
  fileSource: Ref<CanvasEditorFileSource>
  refreshFileNodeMetadata: () => Promise<void>
  selectNode: (nodeId?: string) => void
  state: CanvasEditorState
  t: CanvasI18nTranslator
  viewport: {
    scale: number
    x: number
    y: number
  }
}

export function createCanvasEditorStageDropActions(options: CanvasEditorStageDropOptions) {
  const {
    board,
    commitDocument,
    fileSource,
    refreshFileNodeMetadata,
    selectNode,
    state,
    t,
    viewport,
  } = options

  function handleStageDragOver(event: DragEvent) {
    const types = event.dataTransfer?.types
    if (!types)
      return

    const hasSiyuanDrop = types.includes(SIYUAN_DROP_FILE)
      || types.some(t => t.startsWith(SIYUAN_DROP_GUTTER))
    if (!hasSiyuanDrop)
      return

    event.preventDefault()
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = 'copy'
  }

  async function handleStageDrop(event: DragEvent) {
    let rawIds = event.dataTransfer?.getData(SIYUAN_DROP_FILE) ?? ''

    if (!rawIds) {
      const gutterType = event.dataTransfer?.types.find(t => t.startsWith(SIYUAN_DROP_GUTTER))
      if (gutterType) {
        const parts = gutterType.split(ZWSP)
        rawIds = parts[2] ?? ''
      }
    }

    if (!rawIds)
      return

    if (fileSource.value !== 'workspace' || !state.filePath.endsWith('.canvas')) {
      showMessage(t('messageUnableDropWithoutWorkspaceCanvas'), 4000, 'warning')
      return
    }

    event.preventDefault()

    const stageEl = (event.currentTarget as HTMLElement)
    const rect = stageEl.getBoundingClientRect()
    const stageX = event.clientX - rect.left
    const stageY = event.clientY - rect.top

    const ids = rawIds.split(',').filter(id => SIYUAN_BLOCK_ID_PATTERN.test(id.trim()))
    if (ids.length === 0)
      return

    const verticalGap = 360 * viewport.scale
    const startY = stageY - ((ids.length - 1) * verticalGap) / 2

    for (let i = 0; i < ids.length; i++) {
      const blockId = ids[i].trim()
      const node = createFileNodeAtViewport(
        board.value,
        viewport,
        { x: stageX, y: startY + i * verticalGap },
      )
      node.file = blockId
      commitDocument(upsertCanvasNode(state.document, node))
      if (i === ids.length - 1)
        selectNode(node.id)
    }

    await refreshFileNodeMetadata()
  }

  return {
    handleStageDragOver,
    handleStageDrop,
  }
}

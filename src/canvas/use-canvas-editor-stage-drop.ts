import type { ComputedRef, Ref } from 'vue'
import type { CanvasBoardMetrics } from '@/canvas/board'
import type { CanvasEditorState } from '@/canvas/editor-state'
import type { CanvasI18nTranslator } from '@/canvas/use-canvas-editor-shared'
import type { CanvasEditorFileSource } from '@/canvas/use-canvas-editor-shared'

import { showMessage } from 'siyuan'
import { putFile } from '@/api'
import { upsertCanvasNode, upsertCanvasEdge, createCanvasId } from '@/canvas/document'
import { createFileNodeAtViewport } from '@/canvas/use-canvas-editor-file-picker'
import { writeWorkspaceImageFile } from '@/canvas/workspace-image-files'

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
    const hasFiles = types.includes('Files')

    if (!hasSiyuanDrop && !hasFiles)
      return

    event.preventDefault()
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = 'copy'
  }

  async function handleStageDrop(event: DragEvent) {
    // 1. 优先获取思源原生的块/卡片拖拽 ID
    let rawIds = event.dataTransfer?.getData(SIYUAN_DROP_FILE) ?? ''

    if (!rawIds) {
      const gutterType = event.dataTransfer?.types.find(t => t.startsWith(SIYUAN_DROP_GUTTER))
      if (gutterType) {
        const parts = gutterType.split(ZWSP)
        rawIds = parts[2] ?? ''
      }
    }

    // 2. 如果是思源原生元素的拖拽，走原本的思源块添加流程
    if (rawIds) {
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

      const dragSourceNodeId = event.dataTransfer?.getData('application/siyuan-canvas-drag-source-node-id') ?? ''
      const verticalGap = 360 * viewport.scale
      const startY = stageY - ((ids.length - 1) * verticalGap) / 2

      let currentDoc = state.document
      for (let i = 0; i < ids.length; i++) {
        const blockId = ids[i].trim()
        const node = createFileNodeAtViewport(
          board.value,
          viewport,
          { x: stageX, y: startY + i * verticalGap },
        )
        node.file = blockId
        currentDoc = upsertCanvasNode(currentDoc, node)

        if (dragSourceNodeId) {
          const sourceNode = currentDoc.nodes.find(n => n.id === dragSourceNodeId)
          if (sourceNode) {
            const fromCenterX = sourceNode.x + sourceNode.width / 2
            const fromCenterY = sourceNode.y + sourceNode.height / 2
            const toCenterX = node.x + node.width / 2
            const toCenterY = node.y + node.height / 2

            const deltaX = toCenterX - fromCenterX
            const deltaY = toCenterY - fromCenterY

            let fromSide: 'bottom' | 'left' | 'right' | 'top' = 'right'
            let toSide: 'bottom' | 'left' | 'right' | 'top' = 'left'

            if (Math.abs(deltaX) >= Math.abs(deltaY)) {
              if (deltaX >= 0) {
                fromSide = 'right'
                toSide = 'left'
              } else {
                fromSide = 'left'
                toSide = 'right'
              }
            } else {
              if (deltaY >= 0) {
                fromSide = 'bottom'
                toSide = 'top'
              } else {
                fromSide = 'top'
                toSide = 'bottom'
              }
            }

            const edge = {
              id: createCanvasId('edge-'),
              fromNode: sourceNode.id,
              fromSide,
              toNode: node.id,
              toSide,
              endArrow: true,
            }
            currentDoc = upsertCanvasEdge(currentDoc, edge)
          }
        }

        if (i === ids.length - 1)
          selectNode(node.id)
      }

      commitDocument(currentDoc)
      await refreshFileNodeMetadata()
      return
    }

    // 3. 如果不是思源原生的拖拽，再检测是否有外部图片文件被拖入
    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
    const imageFiles = files.filter(f => f.type.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(f.name))

    if (imageFiles.length > 0) {
      if (fileSource.value !== 'workspace' || !state.filePath.endsWith('.canvas')) {
        showMessage(t('messageUnableDropWithoutWorkspaceCanvas'), 4000, 'warning')
        return
      }

      event.preventDefault()

      const stageEl = (event.currentTarget as HTMLElement)
      const rect = stageEl.getBoundingClientRect()
      const stageX = event.clientX - rect.left
      const stageY = event.clientY - rect.top

      const verticalGap = 260 * viewport.scale
      const startY = stageY - ((imageFiles.length - 1) * verticalGap) / 2

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        try {
          const imagePath = await writeWorkspaceImageFile(state.filePath, file, putFile)

          const node = createFileNodeAtViewport(
            board.value,
            viewport,
            { x: stageX, y: startY + i * verticalGap },
          )
          node.file = imagePath
          node.width = 320
          node.height = 240

          commitDocument(upsertCanvasNode(state.document, node))
          if (i === imageFiles.length - 1)
            selectNode(node.id)
        } catch (error) {
          console.error('Failed to upload drop image file', error)
        }
      }

      // 图片为静态资源，直接匹配路径后缀展示，无需立即向思源的 SQLite 数据库查询刷新元数据，避免并发数据库锁定冲突
      return
    }
  }

  return {
    handleStageDragOver,
    handleStageDrop,
  }
}

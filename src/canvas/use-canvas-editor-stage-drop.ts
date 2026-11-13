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
import { getDroppedFilePath } from '@/canvas/open-external-file'

const SIYUAN_DROP_FILE = 'application/siyuan-file'
const SIYUAN_DROP_GUTTER = 'application/siyuan-gutter'
const SIYUAN_WORKSPACE_FILE = 'application/siyuan-workspace-file'
const ZWSP = '​'
const SIYUAN_BLOCK_ID_PATTERN = /^\d{14}-[a-z0-9]{7}$/i

interface CanvasEditorStageDropOptions {
  board: ComputedRef<CanvasBoardMetrics>
  commitDocument: (document: ReturnType<typeof upsertCanvasNode>) => void
  fileSource: Ref<CanvasEditorFileSource>
  refreshFileNodeMetadata: (nodeIds?: string[]) => Promise<void>
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

    const typesArray = Array.from(types)
    const hasSiyuanDrop = typesArray.includes(SIYUAN_DROP_FILE)
      || typesArray.some(t => t.startsWith(SIYUAN_DROP_GUTTER))
    const hasWorkspaceFile = typesArray.includes(SIYUAN_WORKSPACE_FILE)
    const hasFiles = typesArray.includes('Files')

    if (!hasSiyuanDrop && !hasFiles && !hasWorkspaceFile)
      return

    event.preventDefault()
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = 'copy'
  }

  async function handleStageDrop(event: DragEvent) {
    // 1. 优先获取思源原生的块/卡片拖拽 ID
    let rawIds = event.dataTransfer?.getData(SIYUAN_DROP_FILE) ?? ''

    if (!rawIds) {
      const gutterType = event.dataTransfer?.types ? Array.from(event.dataTransfer.types).find(t => t.startsWith(SIYUAN_DROP_GUTTER)) : undefined
      if (gutterType) {
        const parts = gutterType.split(ZWSP)
        rawIds = parts[2] ?? ''
      }
    }

    // 2. 如果是思源原生元素的拖拽，走原本的思源块添加流程
    if (rawIds) {
      if (fileSource.value !== 'workspace' || !state.filePath.endsWith('.canvas')) {
        showMessage(t('messageUnableDropWithoutWorkspaceCanvas'), 4000, 'info')
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
      const newNodes: any[] = []
      for (let i = 0; i < ids.length; i++) {
        const blockId = ids[i].trim()
        const node = createFileNodeAtViewport(
          board.value,
          viewport,
          { x: stageX, y: startY + i * verticalGap },
        )
        node.file = blockId
        // Align drop position to card center instead of top-left
        node.x -= node.width / 2
        node.y -= node.height / 2
        currentDoc = upsertCanvasNode(currentDoc, node)
        newNodes.push(node)

        if (dragSourceNodeId) {
          currentDoc = autoConnectSourceEdge(currentDoc, dragSourceNodeId, node)
        }

        if (i === ids.length - 1)
          selectNode(node.id)
      }

      commitDocument(currentDoc)
      await refreshFileNodeMetadata(newNodes.map(n => n.id))
      return
    }

    // 3. 处理工作区文档树拖拽进入的文件（如 .canvas 文件）
    let workspaceFilePath = event.dataTransfer?.getData(SIYUAN_WORKSPACE_FILE) || ''
    if (!workspaceFilePath && event.dataTransfer?.types) {
      const typesArray = Array.from(event.dataTransfer.types)
      if (typesArray.includes('text/plain')) {
        const textData = event.dataTransfer.getData('text/plain')
        if (textData && (textData.endsWith('.canvas') || textData.includes('/'))) {
          workspaceFilePath = textData
        }
      }
    }

    if (workspaceFilePath) {
      if (fileSource.value !== 'workspace' || !state.filePath.endsWith('.canvas')) {
        showMessage(t('messageUnableDropWithoutWorkspaceCanvas'), 4000, 'info')
        return
      }

      event.preventDefault()

      const stageEl = (event.currentTarget as HTMLElement)
      const rect = stageEl.getBoundingClientRect()
      const stageX = event.clientX - rect.left
      const stageY = event.clientY - rect.top

      const dragSourceNodeId = event.dataTransfer?.getData('application/siyuan-canvas-drag-source-node-id') ?? ''

      const node = createFileNodeAtViewport(
        board.value,
        viewport,
        { x: stageX, y: stageY },
      )
      node.file = workspaceFilePath
      if (workspaceFilePath.endsWith('.canvas')) {
        node.width = 360
        node.height = 240
      } else {
        node.width = 320
        node.height = 160
      }
      node.x -= Math.round(node.width / 2)
      node.y -= Math.round(node.height / 2)

      let currentDoc = upsertCanvasNode(state.document, node)
      if (dragSourceNodeId) {
        currentDoc = autoConnectSourceEdge(currentDoc, dragSourceNodeId, node)
      }

      commitDocument(currentDoc)
      selectNode(node.id)
      await refreshFileNodeMetadata([node.id])
      return
    }

    // 3. 如果不是思源原生的拖拽，处理外部拖拽进入的文件（支持图片及各种本地文件）
    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
    if (files.length > 0) {
      if (fileSource.value !== 'workspace' || !state.filePath.endsWith('.canvas')) {
        showMessage(t('messageUnableDropWithoutWorkspaceCanvas'), 4000, 'info')
        return
      }

      event.preventDefault()

      const stageEl = (event.currentTarget as HTMLElement)
      const rect = stageEl.getBoundingClientRect()
      const stageX = event.clientX - rect.left
      const stageY = event.clientY - rect.top

      const dragSourceNodeId = event.dataTransfer?.getData('application/siyuan-canvas-drag-source-node-id') ?? ''
      const verticalGap = 260 * viewport.scale
      const startY = stageY - ((files.length - 1) * verticalGap) / 2

      let currentDoc = state.document
      const createdNodes: any[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const isImage = file.type.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(file.name)

        if (isImage) {
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

            currentDoc = upsertCanvasNode(currentDoc, node)
            if (dragSourceNodeId) {
              currentDoc = autoConnectSourceEdge(currentDoc, dragSourceNodeId, node)
            }
            createdNodes.push(node)
          } catch (error) {
            console.error('Failed to upload drop image file', error)
          }
        } else {
          const filePath = getDroppedFilePath(file)
          const node = createFileNodeAtViewport(
            board.value,
            viewport,
            { x: stageX, y: startY + i * verticalGap },
          )
          node.file = filePath
          node.width = 320
          node.height = 160
          node.x -= node.width / 2
          node.y -= node.height / 2

          currentDoc = upsertCanvasNode(currentDoc, node)
          if (dragSourceNodeId) {
            currentDoc = autoConnectSourceEdge(currentDoc, dragSourceNodeId, node)
          }
          createdNodes.push(node)
        }
      }

      if (createdNodes.length > 0) {
        commitDocument(currentDoc)
        selectNode(createdNodes[createdNodes.length - 1].id)
      }
      return
    }
  }

  return {
    handleStageDragOver,
    handleStageDrop,
  }
}

function autoConnectSourceEdge(doc: ReturnType<typeof upsertCanvasNode>, sourceNodeId: string, targetNode: any) {
  const sourceNode = doc.nodes.find(n => n.id === sourceNodeId)
  if (!sourceNode)
    return doc

  const fromCenterX = sourceNode.x + sourceNode.width / 2
  const fromCenterY = sourceNode.y + sourceNode.height / 2
  const toCenterX = targetNode.x + targetNode.width / 2
  const toCenterY = targetNode.y + targetNode.height / 2

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
    toNode: targetNode.id,
    toSide,
    endArrow: true,
  }
  return upsertCanvasEdge(doc, edge)
}

import type {
  ComputedRef,
  Ref,
} from 'vue'
import type { CanvasBoardMetrics } from '@/canvas/board'
import type { CanvasEditorState } from '@/canvas/editor-state'
import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasGeometryPatch,
  CanvasNode,
  CanvasNodeLayoutAction,
  CanvasSide,
} from '@/canvas/types'
import type { CanvasI18nTranslator } from '@/canvas/use-canvas-editor-shared'
import type { CanvasPluginSettings } from '@/canvas/plugin-data'

import { ref } from 'vue'
import { showMessage } from 'siyuan'
import {
  applyCanvasNodeLayout,
  createCanvasEdge,
  createCanvasGroupForNodes,
  createCanvasNode,
  relayoutConnectedNodes,
  removeCanvasEdge,
  removeCanvasNode,
  removeCanvasNodes,
  setCanvasEdgeColor,
  setCanvasEdgeDirection,
  setCanvasEdgeLabel,
  setCanvasNodesColor,
  upsertCanvasEdge,
  upsertCanvasNode,
} from '@/canvas/document'
import { renderMarkdownPreview } from '@/canvas/markdown-preview'
import { isWebUrl } from '@/canvas/url-detection'
import { centerViewportOnBounds } from '@/canvas/selection-toolbar'
import { clampViewportScale, scaleViewportAtPoint } from '@/canvas/viewport'
import { findNonOverlappingPosition } from '@/canvas/node-overlap'
import { findSproutRelations, type SproutRelationItem } from '@/canvas/siyuan-kernel-file-node-lookups'

const MIND_MAP_HORIZONTAL_GAP = 80
const MIND_MAP_VERTICAL_GAP = 40

interface CanvasEditorNodeEdgeActionsOptions {
  activateCanvasSurface: () => void
  board: ComputedRef<CanvasBoardMetrics>
  closeEdgePopover: () => void
  closeSelectionPopover: () => void
  commitDocument: (document: CanvasDocument) => void
  createEdgeDialog: {
    visible: boolean
  }
  edgeLabelDraft: Ref<string>
  editingEdgeLabelId: Ref<string>
  edgeToolbarPopover: Ref<'closed' | 'color' | 'direction'>
  fileFieldRefresh: () => Promise<void>
  getSettings?: () => CanvasPluginSettings
  newEdgeFromSide: Ref<CanvasSide>
  newEdgeLabel: Ref<string>
  newEdgeSourceId: Ref<string>
  newEdgeSourceQuery: Ref<string>
  newEdgeTargetId: Ref<string>
  newEdgeTargetQuery: Ref<string>
  newEdgeToSide: Ref<CanvasSide>
  presentationActive?: Ref<boolean>
  selectedEdge: ComputedRef<CanvasEdge | undefined>
  selectedEdgeAnchors: ComputedRef<{
    from: { x: number, y: number }
    to: { x: number, y: number }
  } | null>
  selectedNode: ComputedRef<CanvasNode | null>
  selectionBounds: ComputedRef<CanvasBounds | null>
  selectionToolbarPopover: Ref<'closed' | 'color' | 'layout'>
  stageRef: Ref<HTMLElement | undefined>
  state: CanvasEditorState
  t: CanvasI18nTranslator
  viewport: {
    scale: number
    x: number
    y: number
  }
}

export function createCanvasEditorNodeEdgeActions(options: CanvasEditorNodeEdgeActionsOptions) {
  const {
    activateCanvasSurface,
    board,
    closeEdgePopover,
    closeSelectionPopover,
    commitDocument,
    createEdgeDialog,
    edgeLabelDraft,
    editingEdgeLabelId,
    edgeToolbarPopover,
    fileFieldRefresh,
    newEdgeFromSide,
    newEdgeLabel,
    newEdgeSourceId,
    newEdgeSourceQuery,
    newEdgeTargetId,
    newEdgeTargetQuery,
    newEdgeToSide,
    selectedEdge,
    selectedEdgeAnchors,
    selectedNode,
    selectionBounds,
    selectionToolbarPopover,
    stageRef,
    state,
    t,
    viewport,
  } = options

  function selectNode(nodeId?: string, event?: MouseEvent) {
    state.selectNode(nodeId, {
      additive: Boolean(event?.ctrlKey || event?.metaKey || event?.shiftKey),
    })
  }

  function selectEdge(edgeId?: string) {
    state.selectEdge(edgeId)
  }

  function getRenderedMarkdown(text: string): string {
    return renderMarkdownPreview(text)
  }

  function addNode(type: CanvasNode['type']) {
    const node = createCanvasNode(type)
    const initialX = Math.round((200 - viewport.x) / viewport.scale + board.value.left)
    const initialY = Math.round((160 - viewport.y) / viewport.scale + board.value.top)
    const position = findNonOverlappingTextNodePosition(
      { x: initialX, y: initialY },
      state.document.nodes,
      node.height + 20,
    )
    node.x = position.x
    node.y = position.y
    commitDocument(upsertCanvasNode(state.document, node))
    state.selectNode(node.id)
  }

  function addNodeAtPosition(type: CanvasNode['type'], canvasX: number, canvasY: number) {
    const node = createCanvasNode(type)
    node.x = Math.round(canvasX)
    node.y = Math.round(canvasY)
    commitDocument(upsertCanvasNode(state.document, node))
    state.selectNode(node.id)
  }

  function findNonOverlappingTextNodePosition(
    initialPosition: { x: number, y: number },
    existingNodes: CanvasNode[],
    stepY: number,
  ): { x: number, y: number } {
    const candidate = createCanvasNode('text')
    return findNonOverlappingPosition(
      initialPosition.x, initialPosition.y,
      candidate.width, candidate.height,
      existingNodes, stepY,
    )
  }

  function createMindMapChildNode() {
    const currentNode = selectedNode.value
    if (!currentNode || state.selectedNodeIds.length !== 1) {
      return
    }

    const childNode = createCanvasNode('text')
    const position = findNonOverlappingTextNodePosition(
      {
        x: currentNode.x + currentNode.width + MIND_MAP_HORIZONTAL_GAP,
        y: currentNode.y,
      },
      state.document.nodes,
      currentNode.height + MIND_MAP_VERTICAL_GAP,
    )
    childNode.x = position.x
    childNode.y = position.y

    const edge = createCanvasEdge(currentNode.id, childNode.id)
    edge.fromSide = 'right'
    edge.toSide = 'left'

    commitDocument({
      ...state.document,
      edges: [...state.document.edges, edge],
      nodes: [...state.document.nodes, childNode],
    })
  }

  function createMindMapSiblingNode() {
    const currentNode = selectedNode.value
    if (!currentNode || state.selectedNodeIds.length !== 1) {
      return
    }

    const siblingNode = createCanvasNode('text')
    const position = findNonOverlappingTextNodePosition(
      {
        x: currentNode.x,
        y: currentNode.y + currentNode.height + MIND_MAP_VERTICAL_GAP,
      },
      state.document.nodes,
      currentNode.height + MIND_MAP_VERTICAL_GAP,
    )
    siblingNode.x = position.x
    siblingNode.y = position.y

    const parentEdge = state.document.edges.find((edge) => (
      edge.toNode === currentNode.id && edge.toSide === 'left'
    ))
    const siblingEdge = parentEdge
      ? {
          ...createCanvasEdge(parentEdge.fromNode, siblingNode.id),
          color: parentEdge.color,
          fromSide: parentEdge.fromSide,
          toSide: 'left' as const,
        }
      : null

    commitDocument({
      ...state.document,
      edges: siblingEdge ? [...state.document.edges, siblingEdge] : state.document.edges,
      nodes: [...state.document.nodes, siblingNode],
    })
  }

  function deleteSelection() {
    if (state.selectedNodeIds.length > 0) {
      commitDocument(
        state.selectedNodeIds.length === 1
          ? removeCanvasNode(state.document, state.selectedNodeIds[0]!)
          : removeCanvasNodes(state.document, state.selectedNodeIds),
      )
      state.selectNode()
      closeSelectionPopover()
      return
    }

    if (selectedEdge.value) {
      commitDocument(removeCanvasEdge(state.document, selectedEdge.value.id))
      state.selectEdge()
      closeSelectionPopover()
    }
  }

  function centerSelectionInViewport() {
    const stage = stageRef.value
    const bounds = selectionBounds.value

    if (!stage || !bounds) {
      return
    }

    const nextViewport = centerViewportOnBounds(
      viewport,
      {
        height: stage.clientHeight,
        width: stage.clientWidth,
      },
      bounds,
      {
        left: board.value.left,
        top: board.value.top,
      },
    )

    viewport.scale = nextViewport.scale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
    closeSelectionPopover()
  }

  function focusNodeById(nodeId: string): void {
    const stage = stageRef.value
    if (!stage) return

    const node = state.document.nodes.find(n => n.id === nodeId)
    if (!node) return

    state.selectNode(nodeId)

    const bounds: CanvasBounds = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }

    const isPresentation = options.presentationActive?.value
    const autoRatio = options.getSettings?.().presentationAutoRatio ?? true
    const targetScale = (isPresentation && autoRatio) ? 1.0 : viewport.scale

    const nextViewport = centerViewportOnBounds(
      { ...viewport, scale: targetScale },
      {
        height: stage.clientHeight,
        width: stage.clientWidth,
      },
      bounds,
      {
        left: board.value.left,
        top: board.value.top,
      },
    )

    // Offset viewport Y by 40px when presentation is active to account for bottom controller
    if (isPresentation) {
      nextViewport.y -= 40
    }

    viewport.scale = targetScale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
    closeSelectionPopover()
  }

  function centerEdgeInViewport() {
    const stage = stageRef.value
    const anchors = selectedEdgeAnchors.value

    if (!stage || !anchors) {
      return
    }

    const edgeBounds = {
      height: Math.max(1, Math.abs(anchors.to.y - anchors.from.y)),
      width: Math.max(1, Math.abs(anchors.to.x - anchors.from.x)),
      x: Math.min(anchors.from.x, anchors.to.x),
      y: Math.min(anchors.from.y, anchors.to.y),
    }

    const nextViewport = centerViewportOnBounds(
      viewport,
      {
        height: stage.clientHeight,
        width: stage.clientWidth,
      },
      edgeBounds,
      {
        left: board.value.left,
        top: board.value.top,
      },
    )

    viewport.scale = nextViewport.scale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
    closeEdgePopover()
  }

  function applySelectionColor(color: string) {
    if (!state.selectedNodeIds.length) {
      return
    }

    commitDocument(setCanvasNodesColor(state.document, state.selectedNodeIds, color))
    closeSelectionPopover()
  }

  function applyEdgeColor(color: string) {
    if (!selectedEdge.value) {
      return
    }

    commitDocument(setCanvasEdgeColor(state.document, selectedEdge.value.id, color))
    closeEdgePopover()
  }

  function createGroupFromSelection() {
    if (!state.selectedNodeIds.length) {
      return
    }

    const {
      document: nextDocument,
      groupId,
    } = createCanvasGroupForNodes(state.document, state.selectedNodeIds)

    commitDocument(nextDocument)
    state.selectNode(groupId)
    closeSelectionPopover()
  }

  function applySelectionLayout(action: CanvasNodeLayoutAction) {
    if (!state.selectedNodeIds.length) {
      return
    }

    commitDocument(applyCanvasNodeLayout(state.document, state.selectedNodeIds, action))
    closeSelectionPopover()
  }

  const isRelayouting = ref(false)

  async function relayoutConnectedNodesAction() {
    if (!selectedNode.value || isRelayouting.value) return

    const node = selectedNode.value
    const hasEdges = state.document.edges.some(
      e => e.fromNode === node.id || e.toNode === node.id,
    )
    if (!hasEdges) {
      showMessage(t("relayoutNoConnectedNodes"))
      return
    }

    isRelayouting.value = true
    closeSelectionPopover()

    try {
      // Yield to allow the loading overlay to render
      await new Promise(resolve => setTimeout(resolve, 50))

      const result = relayoutConnectedNodes(state.document, {
        selectedNodeId: node.id,
      })

      if (result.success) {
        commitDocument(result.document)

        // 聚焦到选中节点的新位置
        const stage = stageRef.value
        const movedNode = result.document.nodes.find(n => n.id === node.id)
        if (stage && movedNode) {
          const nextViewport = centerViewportOnBounds(
            viewport,
            {
              height: stage.clientHeight,
              width: stage.clientWidth,
            },
            {
              x: movedNode.x,
              y: movedNode.y,
              width: movedNode.width,
              height: movedNode.height,
            },
            {
              left: board.value.left,
              top: board.value.top,
            },
          )
          viewport.scale = nextViewport.scale
          viewport.x = nextViewport.x
          viewport.y = nextViewport.y
        }
      }
      else if (result.message) {
        showMessage(result.message)
      }
    }
    finally {
      isRelayouting.value = false
    }
  }

  function toggleSelectionPopover(popover: 'color' | 'layout') {
    if (!state.selectedNodeIds.length) {
      closeSelectionPopover()
      return
    }

    selectionToolbarPopover.value = selectionToolbarPopover.value === popover ? 'closed' : popover
  }

  function toggleEdgePopover(popover: 'color' | 'direction') {
    if (!selectedEdge.value) {
      closeEdgePopover()
      return
    }

    edgeToolbarPopover.value = edgeToolbarPopover.value === popover ? 'closed' : popover
  }

  function updateSelectedEdgeDirection(direction: 'both' | 'none' | 'single') {
    if (!selectedEdge.value) {
      return
    }

    const nextDirection = direction === 'both'
      ? { endArrow: true, startArrow: true }
      : direction === 'none'
        ? { endArrow: false, startArrow: false }
        : { endArrow: true, startArrow: false }

    commitDocument(setCanvasEdgeDirection(state.document, selectedEdge.value.id, nextDirection))
    closeEdgePopover()
  }

  function startEdgeLabelEditing() {
    if (!selectedEdge.value) {
      return
    }

    editingEdgeLabelId.value = selectedEdge.value.id
    edgeLabelDraft.value = selectedEdge.value.label || ''
    closeEdgePopover()
  }

  function updateEditingEdgeLabel(value: string) {
    if (!editingEdgeLabelId.value) {
      return
    }

    edgeLabelDraft.value = value
    commitDocument(setCanvasEdgeLabel(state.document, editingEdgeLabelId.value, value))
  }

  function submitEdgeLabelEditing() {
    if (!editingEdgeLabelId.value) {
      return
    }

    commitDocument(setCanvasEdgeLabel(state.document, editingEdgeLabelId.value, edgeLabelDraft.value))
    editingEdgeLabelId.value = ''
    edgeLabelDraft.value = ''
  }

  function cancelEdgeLabelEditing() {
    editingEdgeLabelId.value = ''
    edgeLabelDraft.value = ''
  }

  function updateNode(node: CanvasNode) {
    commitDocument(upsertCanvasNode(state.document, node))
  }

  function updateTextNodeContent(nodeId: string, text: string) {
    const node = state.document.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      return
    }

    if (node.type === 'text') {
      updateNode({
        ...node,
        text,
      })
      return
    }

    if (node.type === 'group') {
      updateNode({
        ...node,
        label: text,
      })
      return
    }

    if (node.type === 'link') {
      updateNode({
        ...node,
        url: text,
      })
    }
  }

  function convertTextToLink(nodeId: string, url: string) {
    const node = state.document.nodes.find((candidate) => candidate.id === nodeId)
    if (!node || node.type !== 'text') {
      return
    }

    commitDocument(upsertCanvasNode(state.document, {
      color: node.color,
      height: node.height,
      id: node.id,
      type: 'link',
      url,
      width: node.width,
      x: node.x,
      y: node.y,
    }))
  }

  function convertLinkToText(nodeId: string, text: string) {
    const node = state.document.nodes.find((candidate) => candidate.id === nodeId)
    if (!node || node.type !== 'link') {
      return
    }

    commitDocument(upsertCanvasNode(state.document, {
      color: node.color,
      height: node.height,
      id: node.id,
      text,
      type: 'text',
      width: node.width,
      x: node.x,
      y: node.y,
    }))
  }

  // 支持 2 个参数 (field, value) 或 3 个参数 (nodeId, field, value) 调用
  // 既可以更新当前选中的节点属性，也可以根据节点 ID 更新指定节点属性
  function updateNodeField(field: string, value: any): void
  function updateNodeField(nodeId: string, field: string, value: any): void
  function updateNodeField(nodeIdOrField: string, fieldOrValue: any, maybeValue?: any) {
    let nodeId: string | undefined
    let field: string
    let value: any

    if (arguments.length >= 3) {
      nodeId = nodeIdOrField
      field = fieldOrValue
      value = maybeValue
    } else {
      nodeId = selectedNode.value?.id
      field = nodeIdOrField
      value = fieldOrValue
    }

    if (!nodeId) {
      return
    }

    const node = state.document.nodes.find((n) => n.id === nodeId)
    if (!node) {
      return
    }

    updateNode({
      ...node,
      [field]: value,
    } as any)
  }

  function updateNumericNodeField(field: 'height' | 'width' | 'x' | 'y', value: string) {
    if (!selectedNode.value) {
      return
    }

    const numeric = Number.parseFloat(value)
    if (Number.isNaN(numeric)) {
      return
    }

    updateNode({
      ...selectedNode.value,
      [field]: numeric,
    })
  }

  function updateSelectedNodeZIndex(targetZIndex: number) {
    if (!selectedNode.value) {
      return
    }

    const nodes = [...state.document.nodes]
    const currentIndex = nodes.findIndex((n) => n.id === selectedNode.value!.id)
    if (currentIndex === -1) {
      return
    }

    const targetIndex = Math.max(0, Math.min(nodes.length - 1, targetZIndex - 1))
    if (targetIndex === currentIndex) {
      return
    }

    const [removed] = nodes.splice(currentIndex, 1)
    nodes.splice(targetIndex, 0, removed)

    commitDocument({
      ...state.document,
      nodes,
    })
  }

  function moveSelectedNodeZIndex(delta: number) {
    if (!selectedNode.value) {
      return
    }

    const nodes = state.document.nodes
    const currentIndex = nodes.findIndex((n) => n.id === selectedNode.value!.id)
    if (currentIndex === -1) {
      return
    }

    updateSelectedNodeZIndex(currentIndex + 1 + delta)
  }

  function moveSelectedNodeToBottom() {
    updateSelectedNodeZIndex(1)
  }

  function moveSelectedNodeToTop() {
    if (!state.document.nodes.length) {
      return
    }
    updateSelectedNodeZIndex(state.document.nodes.length)
  }

  function applySelectedNodeChanges(fields: CanvasGeometryPatch & { text?: string }) {
    if (!state.selectedNodeIds.length) {
      return
    }

    const selectedIds = new Set(state.selectedNodeIds)
    commitDocument({
      ...state.document,
      nodes: state.document.nodes.map((node) => {
        if (!selectedIds.has(node.id)) {
          return node
        }

        const nextNode: typeof node = {
          ...node,
          ...(fields.width != null && { width: fields.width }),
          ...(fields.height != null && { height: fields.height }),
          ...(fields.x != null && { x: fields.x }),
          ...(fields.y != null && { y: fields.y }),
        }

        if (fields.text != null) {
          if (node.type === 'text') {
            nextNode.text = fields.text
          } else if (node.type === 'group') {
            nextNode.label = fields.text
          } else if (node.type === 'link') {
            nextNode.url = fields.text
          } else if (node.type === 'file') {
            nextNode.file = fields.text
          }
        }

        return nextNode
      }),
    }, { coalesceKey: 'selection-node-draft' })
  }

  function updateEdge(edge: CanvasEdge) {
    commitDocument(upsertCanvasEdge(state.document, edge))
  }

  function updateEdgeField(field: 'label', value: string) {
    if (!selectedEdge.value) {
      return
    }

    updateEdge({
      ...selectedEdge.value,
      [field]: value,
    })
  }

  function updateEdgeSide(field: 'fromSide' | 'toSide', value: string) {
    if (!selectedEdge.value) {
      return
    }

    updateEdge({
      ...selectedEdge.value,
      [field]: value as CanvasSide,
    })
  }

  function setNewEdgeSourceId(nodeId: string) {
    newEdgeSourceId.value = nodeId

    if (newEdgeTargetId.value === nodeId) {
      newEdgeTargetId.value = ''
    }
  }

  function setNewEdgeTargetId(nodeId: string) {
    newEdgeTargetId.value = nodeId
  }

  function resetEdgeNodeQueries() {
    newEdgeSourceQuery.value = ''
    newEdgeTargetQuery.value = ''
  }

  function applySelectedNodeAsEdgeSource() {
    if (state.selectedNodeIds.length === 1 && selectedNode.value) {
      setNewEdgeSourceId(selectedNode.value.id)
      resetEdgeNodeQueries()
      return
    }

    newEdgeSourceId.value = ''
    resetEdgeNodeQueries()
  }

  function createEdgeFromSelection() {
    if (!newEdgeSourceId.value || !newEdgeTargetId.value) {
      showMessage(t('messageSelectTargetNodeFirst'), 2500, 'error')
      return
    }

    if (newEdgeSourceId.value === newEdgeTargetId.value) {
      showMessage(t('messageCannotConnectNodeToSelf'), 2500, 'error')
      return
    }

    const edge = createCanvasEdge(newEdgeSourceId.value, newEdgeTargetId.value)
    edge.label = newEdgeLabel.value || undefined
    edge.fromSide = newEdgeFromSide.value
    edge.toSide = newEdgeToSide.value
    commitDocument(upsertCanvasEdge(state.document, edge))
    state.selectEdge(edge.id)
    newEdgeLabel.value = ''
    newEdgeTargetId.value = ''
    resetEdgeNodeQueries()
  }

  function openCreateEdgeDialog() {
    if (state.selectedNodeIds.length !== 1 || !selectedNode.value) {
      showMessage(t('messageSelectSingleSourceNodeFirst'), 2500, 'warning')
      return
    }

    applySelectedNodeAsEdgeSource()
    activateCanvasSurface()
    createEdgeDialog.visible = true
  }

  function closeCreateEdgeDialog() {
    createEdgeDialog.visible = false
  }

  function submitCreateEdgeDialog() {
    const previousSelectedEdgeId = state.selectedEdgeId
    createEdgeFromSelection()
    if (state.selectedEdgeId && state.selectedEdgeId !== previousSelectedEdgeId) {
      closeCreateEdgeDialog()
    }
  }

  function zoomIn() {
    const stage = stageRef.value
    if (!stage) {
      viewport.scale = clampViewportScale(Number((viewport.scale + 0.1).toFixed(2)))
      return
    }
    const rect = stage.getBoundingClientRect()
    const center = { x: rect.width / 2, y: rect.height / 2 }
    const nextScale = clampViewportScale(Number((viewport.scale + 0.1).toFixed(2)))
    const nextViewport = scaleViewportAtPoint(viewport, center, nextScale)
    viewport.scale = nextViewport.scale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
  }

  // Sprout (扩散) 功能状态
  const sproutLoading = ref(false)
  const sproutRelations = ref<{
    inlinks: Array<SproutRelationItem & { checked: boolean }>
    outlinks: Array<SproutRelationItem & { checked: boolean }>
    children: Array<SproutRelationItem & { checked: boolean }>
  }>({
    inlinks: [],
    outlinks: [],
    children: [],
  })

  async function loadSproutRelations(docId: string) {
    if (!docId) return
    sproutLoading.value = true
    try {
      const res = await findSproutRelations(docId)
      sproutRelations.value = {
        inlinks: res.inlinks.map((item, idx) => ({ ...item, checked: idx < 10 })),
        outlinks: res.outlinks.map((item, idx) => ({ ...item, checked: idx < 10 })),
        children: res.children.map((item, idx) => ({ ...item, checked: idx < 10 })),
      }
    } catch (e) {
      console.error(e)
      showMessage(t('sproutNoLinks') || '读取关联文档失败', 2000, 'error')
    } finally {
      sproutLoading.value = false
    }
  }

  function toggleSproutItemSelect(type: 'inlinks' | 'outlinks' | 'children', id: string) {
    const list = sproutRelations.value[type]
    const item = list.find((i) => i.id === id)
    if (item) {
      item.checked = !item.checked
    }
  }

  function setAllSproutItemsSelected(type: 'inlinks' | 'outlinks' | 'children', selected: boolean) {
    const list = sproutRelations.value[type]
    list.forEach((item) => {
      item.checked = selected
    })
  }

  async function executeSprout() {
    const currentNode = selectedNode.value
    if (!currentNode || state.selectedNodeIds.length !== 1) {
      return
    }

    const docId = currentNode.type === 'file' ? currentNode.file : null
    if (!docId) return

    // 收集所有勾选的项
    const checkedInlinks = sproutRelations.value.inlinks.filter(i => i.checked)
    const checkedOutlinks = sproutRelations.value.outlinks.filter(i => i.checked)
    const checkedChildren = sproutRelations.value.children.filter(i => i.checked)

    if (checkedInlinks.length === 0 && checkedOutlinks.length === 0 && checkedChildren.length === 0) {
      showMessage(t('sproutNoLinks') || '请先勾选需要扩散的文档', 2000, 'info')
      return
    }

    const currentNodes = [...state.document.nodes]
    const currentEdges = [...state.document.edges]
    const addedNodeIds: string[] = []

    // 辅助函数：查找画布中是否已存在该文档节点
    const findExistingNode = (fileId: string) => {
      return currentNodes.find(node => node.type === 'file' && node.file === fileId)
    }

    // 1. 处理入链 (Inlinks) - 新创建节点在左侧垂直排列
    const newInlinksToCreate = checkedInlinks.filter(i => !findExistingNode(i.id))
    const inlinkHeight = 180
    const inlinkGap = 40
    const totalInlinkHeight = newInlinksToCreate.length * inlinkHeight + (newInlinksToCreate.length - 1) * inlinkGap
    const startInlinkY = (currentNode.y + currentNode.height / 2) - totalInlinkHeight / 2

    newInlinksToCreate.forEach((item, idx) => {
      const newNode = createCanvasNode('file') as Extract<CanvasNode, { type: 'file' }>
      newNode.file = item.id
      newNode.x = currentNode.x - 160 - newNode.width
      newNode.y = Math.round(startInlinkY + idx * (inlinkHeight + inlinkGap))
      currentNodes.push(newNode)
      addedNodeIds.push(newNode.id)
    })

    // 2. 处理出链 (Outlinks) - 新创建节点在右侧垂直排列
    const newOutlinksToCreate = checkedOutlinks.filter(i => !findExistingNode(i.id))
    const outlinkHeight = 180
    const outlinkGap = 40
    const totalOutlinkHeight = newOutlinksToCreate.length * outlinkHeight + (newOutlinksToCreate.length - 1) * outlinkGap
    const startOutlinkY = (currentNode.y + currentNode.height / 2) - totalOutlinkHeight / 2

    newOutlinksToCreate.forEach((item, idx) => {
      const newNode = createCanvasNode('file') as Extract<CanvasNode, { type: 'file' }>
      newNode.file = item.id
      newNode.x = currentNode.x + currentNode.width + 160
      newNode.y = Math.round(startOutlinkY + idx * (outlinkHeight + outlinkGap))
      currentNodes.push(newNode)
      addedNodeIds.push(newNode.id)
    })

    // 3. 处理子文档 (Children) - 新创建节点在下方水平排列
    const newChildrenToCreate = checkedChildren.filter(i => !findExistingNode(i.id))
    const childWidth = 320
    const childGap = 40
    const totalChildWidth = newChildrenToCreate.length * childWidth + (newChildrenToCreate.length - 1) * childGap
    const startChildX = (currentNode.x + currentNode.width / 2) - totalChildWidth / 2

    newChildrenToCreate.forEach((item, idx) => {
      const newNode = createCanvasNode('file') as Extract<CanvasNode, { type: 'file' }>
      newNode.file = item.id
      newNode.x = Math.round(startChildX + idx * (childWidth + childGap))
      newNode.y = currentNode.y + currentNode.height + 160
      currentNodes.push(newNode)
      addedNodeIds.push(newNode.id)
    })

    // 避让微调算法：针对每一个新生成的节点，检测与已有节点（或已定位的新节点）的重叠并推开
    const safetyGap = 40 // 节点之间的最小安全间距
    for (let iteration = 0; iteration < 8; iteration++) {
      let hasOverlap = false
      for (const nodeId of addedNodeIds) {
        const node = currentNodes.find(n => n.id === nodeId)
        if (!node) continue

        // 与画布上的所有其他节点进行碰撞检测
        for (const otherNode of currentNodes) {
          if (otherNode.id === node.id) continue

          // 检测两个节点的包围盒（加上 safetyGap 间距后）是否重合
          const isOverlapping = (node.x - safetyGap < otherNode.x + otherNode.width) &&
                                (node.x + node.width + safetyGap > otherNode.x) &&
                                (node.y - safetyGap < otherNode.y + otherNode.height) &&
                                (node.y + node.height + safetyGap > otherNode.y)

          if (isOverlapping) {
            hasOverlap = true
            // 计算重叠中心位置差异以确定推移方向
            const dx = (node.x + node.width / 2) - (otherNode.x + otherNode.width / 2)
            const dy = (node.y + node.height / 2) - (otherNode.y + otherNode.height / 2)

            // 如果中心点完全重合，加入随机微调防止同向死锁
            const moveX = dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : dx
            const moveY = dy === 0 ? (Math.random() > 0.5 ? 1 : -1) : dy

            const absMoveX = Math.abs(moveX)
            const absMoveY = Math.abs(moveY)

            // 沿着重叠相对较小的轴向外推移避让
            if (absMoveX < absMoveY) {
              const pushDistance = (otherNode.x + otherNode.width + safetyGap) - node.x
              const pushDistanceLeft = (node.x + node.width + safetyGap) - otherNode.x
              if (moveX > 0) {
                node.x += Math.round(pushDistance)
              } else {
                node.x -= Math.round(pushDistanceLeft)
              }
            } else {
              const pushDistance = (otherNode.y + otherNode.height + safetyGap) - node.y
              const pushDistanceUp = (node.y + node.height + safetyGap) - otherNode.y
              if (moveY > 0) {
                node.y += Math.round(pushDistance)
              } else {
                node.y -= Math.round(pushDistanceUp)
              }
            }
          }
        }
      }
      if (!hasOverlap) {
        break
      }
    }

    // 4. 创建连线 (Edges)
    const addEdgeIfNotExist = (fromId: string, fromSide: CanvasSide, toId: string, toSide: CanvasSide) => {
      const exists = currentEdges.some(e => e.fromNode === fromId && e.toNode === toId)
      if (!exists) {
        const edge = createCanvasEdge(fromId, toId)
        edge.fromSide = fromSide
        edge.toSide = toSide
        currentEdges.push(edge)
      }
    }

    // 连线入链：从入链指向原节点
    checkedInlinks.forEach(item => {
      const targetNode = findExistingNode(item.id) || currentNodes.find(n => n.type === 'file' && n.file === item.id)
      if (targetNode) {
        addEdgeIfNotExist(targetNode.id, 'right', currentNode.id, 'left')
      }
    })

    // 连线出链：从原节点指向出链
    checkedOutlinks.forEach(item => {
      const targetNode = findExistingNode(item.id) || currentNodes.find(n => n.type === 'file' && n.file === item.id)
      if (targetNode) {
        addEdgeIfNotExist(currentNode.id, 'right', targetNode.id, 'left')
      }
    })

    // 连线子文档：从原节点指向子文档
    checkedChildren.forEach(item => {
      const targetNode = findExistingNode(item.id) || currentNodes.find(n => n.type === 'file' && n.file === item.id)
      if (targetNode) {
        addEdgeIfNotExist(currentNode.id, 'bottom', targetNode.id, 'top')
      }
    })

    // 提交更改
    commitDocument({
      ...state.document,
      nodes: currentNodes,
      edges: currentEdges,
    })

    // 刷新新节点元数据
    if (addedNodeIds.length > 0) {
      await options.fileFieldRefresh(addedNodeIds)
    }

    // 关闭气泡
    closeSelectionPopover()
  }

  function zoomOut() {
    const stage = stageRef.value
    if (!stage) {
      viewport.scale = clampViewportScale(Number((viewport.scale - 0.1).toFixed(2)))
      return
    }
    const rect = stage.getBoundingClientRect()
    const center = { x: rect.width / 2, y: rect.height / 2 }
    const nextScale = clampViewportScale(Number((viewport.scale - 0.1).toFixed(2)))
    const nextViewport = scaleViewportAtPoint(viewport, center, nextScale)
    viewport.scale = nextViewport.scale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
  }

  return {
    addNode,
    addNodeAtPosition,
    applyEdgeColor,
    applySelectedNodeAsEdgeSource,
    applySelectionColor,
    applySelectionLayout,
    cancelEdgeLabelEditing,
    centerEdgeInViewport,
    centerSelectionInViewport,
    focusNodeById,
    convertTextToLink,
    convertLinkToText,
    closeCreateEdgeDialog,
    createEdgeFromSelection,
    createGroupFromSelection,
    createMindMapChildNode,
    createMindMapSiblingNode,
    deleteSelection,
    editingEdgeLabelId,
    getRenderedMarkdown,
    isRelayouting,
    openCreateEdgeDialog,
    relayoutConnectedNodes: relayoutConnectedNodesAction,
    selectEdge,
    selectNode,
    setNewEdgeSourceId,
    setNewEdgeTargetId,
    startEdgeLabelEditing,
    submitCreateEdgeDialog,
    submitEdgeLabelEditing,
    toggleEdgePopover,
    toggleSelectionPopover,
    updateEdgeField,
    updateEdgeSide,
    updateEditingEdgeLabel,
    updateNodeField,
    updateNumericNodeField,
    updateSelectedNodeZIndex,
    moveSelectedNodeZIndex,
    moveSelectedNodeToBottom,
    moveSelectedNodeToTop,
    applySelectedNodeChanges,
    updateSelectedEdgeDirection,
    updateTextNodeContent,
    zoomIn,
    zoomOut,
    sproutLoading,
    sproutRelations,
    loadSproutRelations,
    toggleSproutItemSelect,
    setAllSproutItemsSelected,
    executeSprout,
  }
}

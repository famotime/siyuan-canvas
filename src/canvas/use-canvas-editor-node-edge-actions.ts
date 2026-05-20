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

import { showMessage } from 'siyuan'
import {
  applyCanvasNodeLayout,
  createCanvasEdge,
  createCanvasGroupForNodes,
  createCanvasNode,
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
import { clampViewportScale } from '@/canvas/viewport'

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
  newEdgeFromSide: Ref<CanvasSide>
  newEdgeLabel: Ref<string>
  newEdgeSourceId: Ref<string>
  newEdgeSourceQuery: Ref<string>
  newEdgeTargetId: Ref<string>
  newEdgeTargetQuery: Ref<string>
  newEdgeToSide: Ref<CanvasSide>
  selectedEdge: ComputedRef<CanvasEdge | null>
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
    node.x = Math.round((200 - viewport.x) / viewport.scale + board.value.left)
    node.y = Math.round((160 - viewport.y) / viewport.scale + board.value.top)
    commitDocument(upsertCanvasNode(state.document, node))
    state.selectNode(node.id)
  }

  function doNodesOverlap(first: Pick<CanvasNode, 'height' | 'width' | 'x' | 'y'>, second: Pick<CanvasNode, 'height' | 'width' | 'x' | 'y'>): boolean {
    return first.x < second.x + second.width
      && first.x + first.width > second.x
      && first.y < second.y + second.height
      && first.y + first.height > second.y
  }

  function findNonOverlappingTextNodePosition(
    initialPosition: { x: number, y: number },
    existingNodes: CanvasNode[],
    stepY: number,
  ): { x: number, y: number } {
    const candidate = createCanvasNode('text')
    candidate.x = initialPosition.x
    candidate.y = initialPosition.y

    let attempts = 0
    while (
      attempts < 100
      && existingNodes.some((node) => doNodesOverlap(candidate, node))
    ) {
      candidate.y += stepY
      attempts += 1
    }

    return {
      x: candidate.x,
      y: candidate.y,
    }
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

  function updateNodeField(field: string, value: string) {
    if (!selectedNode.value) {
      return
    }

    updateNode({
      ...selectedNode.value,
      [field]: value,
    })
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
    viewport.scale = clampViewportScale(Number((viewport.scale + 0.1).toFixed(2)))
  }

  function zoomOut() {
    viewport.scale = clampViewportScale(Number((viewport.scale - 0.1).toFixed(2)))
  }

  return {
    addNode,
    applyEdgeColor,
    applySelectedNodeAsEdgeSource,
    applySelectionColor,
    applySelectionLayout,
    cancelEdgeLabelEditing,
    centerEdgeInViewport,
    centerSelectionInViewport,
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
    openCreateEdgeDialog,
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
    applySelectedNodeChanges,
    updateSelectedEdgeDirection,
    updateTextNodeContent,
    zoomIn,
    zoomOut,
  }
}

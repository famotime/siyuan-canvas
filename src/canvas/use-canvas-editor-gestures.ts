import type {
  ComputedRef,
  Ref,
} from "vue"
import { watch } from "vue"
import { CANVAS_GRID_SIZE, snapCanvasCoordinate } from "@/canvas/use-canvas-editor"

const RESIZE_STEP = 25
import { computeAlignment } from "@/canvas/alignment-guides"
import type { AlignmentGuideLine } from "@/canvas/alignment-guides"
import { computeResizeGuides } from "@/canvas/resize-guides"
import type { CanvasBoardMetrics } from "@/canvas/board"
import type { CanvasEditorState } from "@/canvas/editor-state"
import type {
  CanvasDocument,
  CanvasEdge,
  CanvasNode,
  CanvasSide,
} from "@/canvas/types"

import {
  toBoardX,
  toBoardY,
} from "@/canvas/board"
import {
  createCanvasEdge,
  createCanvasNode,
  setCanvasEdgeEndpoint,
  setCanvasNodeGeometry,
  upsertCanvasEdge,
  upsertCanvasNode,
} from "@/canvas/document"
import {
  CONNECTION_SNAP_DISTANCE,
  findNearestCanvasAnchor,
  getCanvasNodeAnchor,
  resizeCanvasNodeFromCorner,
  resizeCanvasNodeFromSide,
} from "@/canvas/node-interaction"
import {
  createBoundsFromPoints,
  createEdgeCurvePath,
  resolveDragNodeIds,
  resolveMarqueeSelectionEdgeIds,
  resolveMarqueeSelectionNodeIds,
} from "@/canvas/selection-toolbar"
import {
  clampViewportScale,
  scaleViewportAtPoint,
} from "@/canvas/viewport"

export interface CanvasEditorSelectionBoxState {
  height: number
  visible: boolean
  width: number
  x: number
  y: number
}

export interface CanvasEditorConnectionDraftState {
  fromNodeId: string
  fromSide: CanvasSide
  toNodeId: string
  toSide: CanvasSide
  toX: number
  toY: number
  visible: boolean
}

export interface CanvasEditorEdgeReconnectDraftState {
  edgeId: string
  endpoint: "" | "from" | "to"
  targetNodeId: string
  targetSide: "" | CanvasSide
  toX: number
  toY: number
  visible: boolean
}

export interface PendingCardCreation {
  canvasX: number
  canvasY: number
  fromNodeId: string
  fromSide: CanvasSide
  /** 边端点重连时的边 ID */
  reconnectEdgeId?: string
  /** 边端点重连时被拖拽的端点 */
  reconnectEndpoint?: "from" | "to"
}

interface CanvasEditorGestureOptions {
  alignmentGuides: {
    horizontal: AlignmentGuideLine[]
    vertical: AlignmentGuideLine[]
    visible: boolean
  }
  board: ComputedRef<CanvasBoardMetrics>
  commitDocument: (document: CanvasDocument, options?: { coalesceKey?: string }) => void
  connectionDraft: CanvasEditorConnectionDraftState
  edgeReconnectDraft: CanvasEditorEdgeReconnectDraftState
  getAnchor: (node: CanvasNode, side: CanvasSide) => { x: number, y: number }
  gridEnabled: Ref<boolean>
  pendingCardCreation: PendingCardCreation
  resizeGuides: {
    matchNodeIds: string[]
    labels: Array<{ nodeId: string, boardX: number, boardY: number, text: string }>
    widthLines: Array<{ nodeId: string, leftX: number, rightX: number, topY: number, bottomY: number }>
    heightLines: Array<{ nodeId: string, leftX: number, rightX: number, topY: number, bottomY: number }>
    visible: boolean
  }
  readonly: ComputedRef<boolean>
  selectionBox: CanvasEditorSelectionBoxState
  selectedEdge: ComputedRef<CanvasEdge | null>
  stageRef: Ref<HTMLElement | undefined>
  state: CanvasEditorState
  viewport: {
    scale: number
    x: number
    y: number
  }
  showNodeHeader: ComputedRef<boolean>
}

export function createCanvasEditorGestureHandlers(options: CanvasEditorGestureOptions) {
  const {
    alignmentGuides,
    board,
    commitDocument,
    connectionDraft,
    edgeReconnectDraft,
    getAnchor,
    gridEnabled,
    pendingCardCreation,
    readonly,
    resizeGuides,
    selectionBox,
    selectedEdge,
    stageRef,
    state,
    viewport,
    showNodeHeader,
  } = options

  function clearSelectionBox() {
    selectionBox.visible = false
    selectionBox.x = 0
    selectionBox.y = 0
    selectionBox.width = 0
    selectionBox.height = 0
  }

  function clearConnectionDraft() {
    connectionDraft.fromNodeId = ""
    connectionDraft.toNodeId = ""
    connectionDraft.toX = 0
    connectionDraft.toY = 0
    connectionDraft.visible = false
  }

  function clearEdgeReconnectDraft() {
    edgeReconnectDraft.edgeId = ""
    edgeReconnectDraft.endpoint = ""
    edgeReconnectDraft.targetNodeId = ""
    edgeReconnectDraft.targetSide = ""
    edgeReconnectDraft.toX = 0
    edgeReconnectDraft.toY = 0
    edgeReconnectDraft.visible = false
  }

  function startPointerGesture(
    event: PointerEvent,
    onMove: (dx: number, dy: number, moveEvent: PointerEvent) => void,
    handlers: {
      onEnd?: (dx: number, dy: number, upEvent: PointerEvent) => void
    } = {},
  ) {
    const startX = event.clientX
    const startY = event.clientY

    const handleMove = (moveEvent: PointerEvent) => {
      onMove(moveEvent.clientX - startX, moveEvent.clientY - startY, moveEvent)
    }
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      handlers.onEnd?.(upEvent.clientX - startX, upEvent.clientY - startY, upEvent)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
  }

  function handleWheelZoom(event: WheelEvent) {
    const stage = stageRef.value
    if (!stage) {
      return
    }

    const rect = stage.getBoundingClientRect()
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const nextScale = clampViewportScale(Number((viewport.scale * Math.exp(-event.deltaY * 0.0015)).toFixed(2)))
    const nextViewport = scaleViewportAtPoint(viewport, point, nextScale)

    viewport.scale = nextViewport.scale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
  }

  watch(() => stageRef.value, (stage) => {
    if (!stage) return

    let initialPinchDistance = 0
    let initialScale = 1
    let pinchCenter = { x: 0, y: 0 }

    stage.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        initialScale = viewport.scale
        
        const rect = stage.getBoundingClientRect()
        pinchCenter = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        }
      }
    }, { passive: false })

    stage.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        
        if (initialPinchDistance > 0) {
          const scaleRatio = distance / initialPinchDistance
          const nextScale = clampViewportScale(Number((initialScale * scaleRatio).toFixed(2)))
          const nextViewport = scaleViewportAtPoint(viewport, pinchCenter, nextScale)
          
          viewport.scale = nextViewport.scale
          viewport.x = nextViewport.x
          viewport.y = nextViewport.y
        }
      }
    }, { passive: false })

    stage.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        initialPinchDistance = 0
      }
    })
  })

  function isAdditiveSelectionGesture(event: MouseEvent | PointerEvent): boolean {
    // Shift 不在 pointerdown 阶段拦截：Shift+拖拽需要能启动拖拽（move 阶段约束轴向）
    return Boolean(event.ctrlKey || event.metaKey)
  }

  function isNodeGestureTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    // 排除节点上"应该消化点击"的元素：尺寸把手、连接锚点、可交互控件
    const excludeSelector = [
      ".canvas-node__resize-handle",
      ".canvas-node__resize-corner",
      ".canvas-node__anchor",
      "a",
      "button",
      "input",
      "textarea",
      "select",
    ]

    // 如果开启了显示标题栏，那么卡片主体（selectable区域）是不允许拖拽的，需要排除它
    if (showNodeHeader.value) {
      excludeSelector.push(".canvas-node__body--selectable")
    }

    return !target.closest(excludeSelector.join(", "))
  }

  function isStageGestureTarget(target: EventTarget | null): target is Element {
    if (!(target instanceof Element)) {
      return false
    }

    return !target.closest(".canvas-node, .selection-toolbar")
      && !target.closest(".stage__edge, .stage__edge-label")
      && !target.closest("a, button, input, textarea, select")
  }

  function toCanvasX(stageX: number): number {
    return (stageX - viewport.x) / viewport.scale + board.value.left
  }

  function toCanvasY(stageY: number): number {
    return (stageY - viewport.y) / viewport.scale + board.value.top
  }

  function updateSelectionBox(startPoint: { x: number, y: number }, currentPoint: { x: number, y: number }) {
    const bounds = createBoundsFromPoints(startPoint, currentPoint)

    selectionBox.visible = true
    selectionBox.x = bounds.x
    selectionBox.y = bounds.y
    selectionBox.width = bounds.width
    selectionBox.height = bounds.height
  }

  function finalizeSelectionBox(
    startPoint: { x: number, y: number },
    endPoint: { x: number, y: number },
    options: {
      additive: boolean
    },
  ) {
    const stageBounds = createBoundsFromPoints(startPoint, endPoint)

    clearSelectionBox()

    if (stageBounds.width < 3 && stageBounds.height < 3) {
      if (!options.additive) {
        state.selectNodes([])
      }
      return
    }

    const selectedNodeIds = resolveMarqueeSelectionNodeIds(state.document, {
      height: stageBounds.height / viewport.scale,
      width: stageBounds.width / viewport.scale,
      x: toCanvasX(stageBounds.x),
      y: toCanvasY(stageBounds.y),
    })

    if (selectedNodeIds.length > 0) {
      state.selectNodes(selectedNodeIds, { additive: options.additive })
      return
    }

    const selectedEdgeIds = resolveMarqueeSelectionEdgeIds(state.document, {
      height: stageBounds.height / viewport.scale,
      width: stageBounds.width / viewport.scale,
      x: toCanvasX(stageBounds.x),
      y: toCanvasY(stageBounds.y),
    })

    if (selectedEdgeIds.length > 0) {
      state.selectEdge(selectedEdgeIds[0])
      return
    }

    if (!options.additive) {
      state.selectNodes([])
    }
  }

  function startPan(event: PointerEvent) {
    if (event.button === 2 || (readonly.value && event.button === 0)) {
      event.preventDefault()
      const initialX = viewport.x
      const initialY = viewport.y
      startPointerGesture(event, (dx, dy) => {
        viewport.x = initialX + dx
        viewport.y = initialY + dy
      })
      return
    }

    if (event.button !== 0 || !isStageGestureTarget(event.target)) {
      return
    }

    const stage = stageRef.value
    if (!stage) {
      return
    }

    event.preventDefault()
    const rect = stage.getBoundingClientRect()
    const startPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const additive = isAdditiveSelectionGesture(event)

    updateSelectionBox(startPoint, startPoint)
    startPointerGesture(
      event,
      (_dx, _dy, moveEvent) => {
        updateSelectionBox(startPoint, {
          x: moveEvent.clientX - rect.left,
          y: moveEvent.clientY - rect.top,
        })
      },
      {
        onEnd: (_dx, _dy, upEvent) => {
          finalizeSelectionBox(
            startPoint,
            {
              x: upEvent.clientX - rect.left,
              y: upEvent.clientY - rect.top,
            },
            { additive },
          )
        },
      },
    )
  }

  function handleNodePointerDown(node: CanvasNode, event: PointerEvent) {
    if (event.button === 2) {
      startPan(event)
      return
    }

    if (event.button !== 0 || isAdditiveSelectionGesture(event)) {
      return
    }

    // 排除节点上"应该消化点击"的元素：尺寸把手、连接锚点、可交互控件（如链接、按钮、文本输入框等）
    const isInteractive = event.target instanceof HTMLElement && event.target.closest(
      "a, button, input, textarea, select, .canvas-node__resize-handle, .canvas-node__resize-corner, .canvas-node__anchor"
    )
    if (isInteractive) {
      return
    }

    if (readonly.value) {
      // 在只读模式下（如发布站），在卡片上的拖拽操作退化为移动画布（Pan）
      startPan(event)
      return
    }

    if (!isNodeGestureTarget(event.target)) {
      return
    }

    // Shift + 点击/拖拽：切换多选（不阻止拖拽启动，move 阶段约束轴向）
    if (event.shiftKey) {
      if (state.selectedNodeIds.includes(node.id)) {
        state.selectNodes(state.selectedNodeIds.filter(id => id !== node.id))
      } else {
        state.selectNode(node.id, { additive: true })
      }
    }

    // Alt/Option + 拖拽：复制出一张相同的卡片（原位复制，拖拽即分离）
    if (event.altKey) {
      const clonedNode = { ...node }
      clonedNode.id = `${node.id}-dup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      commitDocument(upsertCanvasNode(state.document, clonedNode))
      state.selectNode(clonedNode.id)
      startDrag(clonedNode, event)
      return
    }

    startDrag(node, event)
  }

  function startDrag(node: CanvasNode, event: PointerEvent) {
    if (readonly.value) return
    const selectedNodeIds = resolveDragNodeIds(state.document, node.id, state.selectedNodeIds)
    const initialPositions = new Map(
      state.document.nodes
        .filter((candidate) => selectedNodeIds.includes(candidate.id))
        .map((candidate) => [candidate.id, {
          x: candidate.x,
          y: candidate.y,
        }]),
    )
    if (!state.selectedNodeIds.includes(node.id)) {
      state.selectNode(node.id)
    }
    startPointerGesture(event, (dx, dy, moveEvent) => {
      let deltaX = Math.round(dx / viewport.scale)
      let deltaY = Math.round(dy / viewport.scale)
      // Shift 约束：仅支持垂直/水平方向移动
      if (moveEvent?.shiftKey) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          deltaY = 0
        } else {
          deltaX = 0
        }
      }

      // 智能对齐参考线：计算拖拽节点的合并边界，与静态节点对齐
      const draggedSet = new Set(selectedNodeIds)
      let draggedLeft = Infinity, draggedRight = -Infinity
      let draggedTop = Infinity, draggedBottom = -Infinity
      for (const candidate of state.document.nodes) {
        if (!draggedSet.has(candidate.id)) continue
        const initial = initialPositions.get(candidate.id)
        if (!initial) continue
        const nx = initial.x + deltaX
        const ny = initial.y + deltaY
        if (nx < draggedLeft) draggedLeft = nx
        if (nx + candidate.width > draggedRight) draggedRight = nx + candidate.width
        if (ny < draggedTop) draggedTop = ny
        if (ny + candidate.height > draggedBottom) draggedBottom = ny + candidate.height
      }
      if (Number.isFinite(draggedLeft)) {
        const draggedBounds = {
          bottom: draggedBottom,
          centerX: (draggedLeft + draggedRight) / 2,
          centerY: (draggedTop + draggedBottom) / 2,
          height: draggedBottom - draggedTop,
          left: draggedLeft,
          right: draggedRight,
          top: draggedTop,
          width: draggedRight - draggedLeft,
        }
        const result = computeAlignment(
          state.document, draggedBounds, draggedSet,
          board.value.left, board.value.top,
          deltaX, deltaY,
        )
        // 仅在未启用网格吸附时应用对齐吸附（网格吸附优先级更高）
        if (!gridEnabled.value) {
          deltaX = result.deltaX
          deltaY = result.deltaY
        }
        alignmentGuides.horizontal = result.horizontal
        alignmentGuides.vertical = result.vertical
        alignmentGuides.visible = result.horizontal.length > 0 || result.vertical.length > 0
      } else {
        alignmentGuides.visible = false
        alignmentGuides.horizontal = []
        alignmentGuides.vertical = []
      }

      if (gridEnabled.value) {
        deltaX = snapCanvasCoordinate(deltaX, CANVAS_GRID_SIZE)
        deltaY = snapCanvasCoordinate(deltaY, CANVAS_GRID_SIZE)
      }
      const movedDocument = state.document.nodes.reduce((document, candidate) => {
        const initial = initialPositions.get(candidate.id)
        if (!initial) {
          return document
        }

        return setCanvasNodeGeometry(document, candidate.id, {
          x: initial.x + deltaX,
          y: initial.y + deltaY,
        })
      }, state.document)

      commitDocument(movedDocument, { coalesceKey: `drag-${node.id}` })
    }, {
      onEnd: () => {
        alignmentGuides.visible = false
        alignmentGuides.horizontal = []
        alignmentGuides.vertical = []
      },
    })
  }

  function getStagePoint(event: PointerEvent) {
    const stage = stageRef.value
    if (!stage) {
      return null
    }

    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return null
    }

    const rect = stage.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function updateConnectionTarget(event: PointerEvent) {
    const stagePoint = getStagePoint(event)
    if (!stagePoint) {
      return
    }

    const canvasPoint = {
      x: toCanvasX(stagePoint.x),
      y: toCanvasY(stagePoint.y),
    }
    const target = findNearestCanvasAnchor(state.document.nodes, canvasPoint, {
      excludeNodeId: connectionDraft.fromNodeId,
      maxDistance: CONNECTION_SNAP_DISTANCE,
    })

    connectionDraft.toNodeId = target?.nodeId || ""
    connectionDraft.toSide = target?.side || "left"
    connectionDraft.toX = target?.x ?? canvasPoint.x
    connectionDraft.toY = target?.y ?? canvasPoint.y
  }

  function getConnectionDraftPath() {
    if (!connectionDraft.visible) {
      return ""
    }

    const fromNode = state.document.nodes.find((node) => node.id === connectionDraft.fromNodeId)
    if (!fromNode) {
      return ""
    }

    const from = getAnchor(fromNode, connectionDraft.fromSide)
    const to = {
      x: toBoardX(board.value, connectionDraft.toX),
      y: toBoardY(board.value, connectionDraft.toY),
    }
    const toSide = connectionDraft.toNodeId
      ? connectionDraft.toSide
      : oppositeSide(connectionDraft.fromSide)

    return createEdgeCurvePath(from, connectionDraft.fromSide, to, toSide)
  }

  function isConnectionTarget(nodeId: string, side: CanvasSide) {
    const isCreationTarget = connectionDraft.visible
      && connectionDraft.toNodeId === nodeId
      && connectionDraft.toSide === side
    const isReconnectTarget = edgeReconnectDraft.visible
      && edgeReconnectDraft.targetNodeId === nodeId
      && edgeReconnectDraft.targetSide === side

    return isCreationTarget || isReconnectTarget
  }

  function getEdgeReconnectDraftPath() {
    if (!edgeReconnectDraft.visible || !edgeReconnectDraft.edgeId || !edgeReconnectDraft.endpoint) {
      return ""
    }

    const edge = state.document.edges.find((candidate) => candidate.id === edgeReconnectDraft.edgeId)
    if (!edge) {
      return ""
    }

    const fixedNode = state.document.nodes.find((node) =>
      node.id === (edgeReconnectDraft.endpoint === "from" ? edge.toNode : edge.fromNode),
    )
    if (!fixedNode) {
      return ""
    }

    const fixedSide = edgeReconnectDraft.endpoint === "from" ? edge.toSide : edge.fromSide
    const movingSide = edgeReconnectDraft.endpoint === "from" ? edge.fromSide : edge.toSide
    const fixedPoint = getAnchor(fixedNode, fixedSide)
    const movingPoint = {
      x: edgeReconnectDraft.toX,
      y: edgeReconnectDraft.toY,
    }

    if (edgeReconnectDraft.endpoint === "from") {
      return createEdgeCurvePath(movingPoint, movingSide, fixedPoint, fixedSide)
    }

    return createEdgeCurvePath(fixedPoint, fixedSide, movingPoint, movingSide)
  }

  function oppositeSide(side: CanvasSide): CanvasSide {
    switch (side) {
      case "top": return "bottom"
      case "bottom": return "top"
      case "left": return "right"
      case "right": return "left"
    }
  }

  function finishConnectionDrag() {
    if (!connectionDraft.fromNodeId) {
      clearConnectionDraft()
      return
    }

    if (!connectionDraft.toNodeId) {
      // 释放到空白画布：弹出菜单选择卡片类型，连线草稿保持可见
      pendingCardCreation.canvasX = connectionDraft.toX
      pendingCardCreation.canvasY = connectionDraft.toY
      pendingCardCreation.fromNodeId = connectionDraft.fromNodeId
      pendingCardCreation.fromSide = connectionDraft.fromSide
      pendingCardCreation.reconnectEdgeId = undefined
      pendingCardCreation.reconnectEndpoint = undefined
      return
    }

    const edge = createCanvasEdge(connectionDraft.fromNodeId, connectionDraft.toNodeId)
    edge.fromSide = connectionDraft.fromSide
    edge.toSide = connectionDraft.toSide
    commitDocument(upsertCanvasEdge(state.document, edge))
    state.selectEdge(edge.id)
    clearConnectionDraft()
  }

  function startConnectionDrag(node: CanvasNode, side: CanvasSide, event: PointerEvent) {
    if (event.button !== 0 || readonly.value) {
      return
    }

    event.preventDefault?.()
    const canvasAnchor = getCanvasNodeAnchor(node, side)
    connectionDraft.fromNodeId = node.id
    connectionDraft.fromSide = side
    connectionDraft.toNodeId = ""
    connectionDraft.toSide = "left"
    connectionDraft.toX = canvasAnchor.x
    connectionDraft.toY = canvasAnchor.y
    connectionDraft.visible = true

    startPointerGesture(
      event,
      (_dx, _dy, moveEvent) => {
        updateConnectionTarget(moveEvent)
      },
      {
        onEnd: (_dx, _dy, upEvent) => {
          updateConnectionTarget(upEvent)
          finishConnectionDrag()
        },
      },
    )
  }

  function updateEdgeReconnectTarget(edge: CanvasEdge, endpoint: "from" | "to", event: PointerEvent) {
    const stagePoint = getStagePoint(event)
    if (!stagePoint) {
      return
    }

    const canvasPoint = {
      x: toCanvasX(stagePoint.x),
      y: toCanvasY(stagePoint.y),
    }
    const oppositeNodeId = endpoint === "from" ? edge.toNode : edge.fromNode
    const target = findNearestCanvasAnchor(state.document.nodes, canvasPoint, {
      maxDistance: CONNECTION_SNAP_DISTANCE,
    })

    edgeReconnectDraft.edgeId = edge.id
    edgeReconnectDraft.endpoint = endpoint
    edgeReconnectDraft.targetNodeId = target?.nodeId || ""
    edgeReconnectDraft.targetSide = target?.side || ""
    edgeReconnectDraft.toX = target ? toBoardX(board.value, target.x) : toBoardX(board.value, canvasPoint.x)
    edgeReconnectDraft.toY = target ? toBoardY(board.value, target.y) : toBoardY(board.value, canvasPoint.y)
    edgeReconnectDraft.visible = true

    if (target?.nodeId === oppositeNodeId) {
      edgeReconnectDraft.targetNodeId = ""
      edgeReconnectDraft.targetSide = ""
      edgeReconnectDraft.toX = toBoardX(board.value, canvasPoint.x)
      edgeReconnectDraft.toY = toBoardY(board.value, canvasPoint.y)
    }
  }

  function finishEdgeEndpointDrag(edge: CanvasEdge, endpoint: "from" | "to") {
    if (!edgeReconnectDraft.targetNodeId || !edgeReconnectDraft.targetSide) {
      // 释放到空白画布：弹出菜单选择卡片类型
      pendingCardCreation.canvasX = edgeReconnectDraft.toX + board.value.left
      pendingCardCreation.canvasY = edgeReconnectDraft.toY + board.value.top
      pendingCardCreation.fromNodeId = endpoint === "from" ? edge.toNode : edge.fromNode
      pendingCardCreation.fromSide = endpoint === "from" ? edge.toSide : edge.fromSide
      pendingCardCreation.reconnectEdgeId = edge.id
      pendingCardCreation.reconnectEndpoint = endpoint
      // 连线草稿保持可见，菜单选择后再清理
      return
    }

    commitDocument(setCanvasEdgeEndpoint(state.document, edge.id, endpoint, {
      nodeId: edgeReconnectDraft.targetNodeId,
      side: edgeReconnectDraft.targetSide,
    }))
    state.selectEdge(edge.id)
    clearEdgeReconnectDraft()
  }

  function startEdgeEndpointDrag(endpoint: "from" | "to", event: PointerEvent) {
    if (event.button !== 0 || readonly.value) {
      return
    }

    const edge = selectedEdge.value
    if (!edge) {
      return
    }

    event.preventDefault?.()
    clearEdgeReconnectDraft()

    startPointerGesture(
      event,
      (_dx, _dy, moveEvent) => {
        updateEdgeReconnectTarget(edge, endpoint, moveEvent)
      },
      {
        onEnd: (_dx, _dy, upEvent) => {
          updateEdgeReconnectTarget(edge, endpoint, upEvent)
          finishEdgeEndpointDrag(edge, endpoint)
        },
      },
    )
  }

  function startResize(node: CanvasNode, side: CanvasSide, event: PointerEvent) {
    if (event.button !== 0 || readonly.value) {
      return
    }

    event.preventDefault?.()
    startPointerGesture(event, (dx, dy) => {
      let scaleDeltaX = dx / viewport.scale
      let scaleDeltaY = dy / viewport.scale
      if (gridEnabled.value) {
        scaleDeltaX = snapCanvasCoordinate(scaleDeltaX, CANVAS_GRID_SIZE)
        scaleDeltaY = snapCanvasCoordinate(scaleDeltaY, CANVAS_GRID_SIZE)
      }
      // 每次增减以 25px 为步长
      scaleDeltaX = snapCanvasCoordinate(scaleDeltaX, RESIZE_STEP)
      scaleDeltaY = snapCanvasCoordinate(scaleDeltaY, RESIZE_STEP)
      const geom = resizeCanvasNodeFromSide(node, side, scaleDeltaX, scaleDeltaY)
      // 缩小时最后一步不足 25px，直接到最小值 50px
      if (geom.width > 50 && geom.width < 75) geom.width = 50
      if (geom.height > 50 && geom.height < 75) geom.height = 50
      // 等宽/等高参考线检测
      const result = computeResizeGuides(state.document, node, geom.width, geom.height, board.value)
      resizeGuides.matchNodeIds = result.matchNodeIds
      resizeGuides.labels = result.labels
      resizeGuides.widthLines = result.widthLines
      resizeGuides.heightLines = result.heightLines
      resizeGuides.visible = result.matchNodeIds.length > 0

      commitDocument(
        setCanvasNodeGeometry(state.document, node.id, geom),
        { coalesceKey: `resize-${node.id}-${side}` },
      )
    }, {
      onEnd: () => {
        resizeGuides.visible = false
        resizeGuides.matchNodeIds = []
        resizeGuides.labels = []
        resizeGuides.widthLines = []
        resizeGuides.heightLines = []
      },
    })
  }

  function startCornerResize(node: CanvasNode, event: PointerEvent) {
    if (event.button !== 0 || readonly.value) {
      return
    }

    event.preventDefault?.()
    startPointerGesture(event, (dx, dy) => {
      let scaleDeltaX = dx / viewport.scale
      let scaleDeltaY = dy / viewport.scale
      if (gridEnabled.value) {
        scaleDeltaX = snapCanvasCoordinate(scaleDeltaX, CANVAS_GRID_SIZE)
        scaleDeltaY = snapCanvasCoordinate(scaleDeltaY, CANVAS_GRID_SIZE)
      }
      scaleDeltaX = snapCanvasCoordinate(scaleDeltaX, RESIZE_STEP)
      scaleDeltaY = snapCanvasCoordinate(scaleDeltaY, RESIZE_STEP)
      const geom = resizeCanvasNodeFromCorner(node, scaleDeltaX, scaleDeltaY)
      if (geom.width > 50 && geom.width < 75) geom.width = 50
      if (geom.height > 50 && geom.height < 75) geom.height = 50
      // 等宽/等高参考线检测
      const result = computeResizeGuides(state.document, node, geom.width, geom.height, board.value)
      resizeGuides.matchNodeIds = result.matchNodeIds
      resizeGuides.labels = result.labels
      resizeGuides.widthLines = result.widthLines
      resizeGuides.heightLines = result.heightLines
      resizeGuides.visible = result.matchNodeIds.length > 0

      commitDocument(
        setCanvasNodeGeometry(state.document, node.id, geom),
        { coalesceKey: `resize-corner-${node.id}` },
      )
    }, {
      onEnd: () => {
        resizeGuides.visible = false
        resizeGuides.matchNodeIds = []
        resizeGuides.labels = []
        resizeGuides.widthLines = []
        resizeGuides.heightLines = []
      },
    })
  }

  function startEdgePointerDown(edge: CanvasEdge, event: PointerEvent): boolean {
    if (event.button !== 0 || readonly.value) {
      return false
    }

    const fromNode = state.document.nodes.find((n) => n.id === edge.fromNode)
    const toNode = state.document.nodes.find((n) => n.id === edge.toNode)
    if (!fromNode || !toNode) {
      return false
    }

    const stage = stageRef.value
    if (!stage) {
      return false
    }

    const rect = stage.getBoundingClientRect()
    const stageX = event.clientX - rect.left
    const stageY = event.clientY - rect.top

    // 转换为 board 坐标
    const boardPoint = {
      x: (stageX - viewport.x) / viewport.scale,
      y: (stageY - viewport.y) / viewport.scale,
    }

    const fromBoard = getAnchor(fromNode, edge.fromSide)
    const toBoard = getAnchor(toNode, edge.toSide)

    const distToFrom = Math.hypot(boardPoint.x - fromBoard.x, boardPoint.y - fromBoard.y)
    const distToTo = Math.hypot(boardPoint.x - toBoard.x, boardPoint.y - toBoard.y)
    const totalDist = Math.hypot(toBoard.x - fromBoard.x, toBoard.y - fromBoard.y)
    const threshold = Math.max(50, totalDist * 0.3)

    // 参考 siyuan-canvas-widget：点击靠近端点时直接启动端点拖拽重连
    if (distToFrom < threshold && distToFrom <= distToTo) {
      state.selectEdge(edge.id)
      startEdgeEndpointDrag("from", event)
      return true
    }

    if (distToTo < threshold) {
      state.selectEdge(edge.id)
      startEdgeEndpointDrag("to", event)
      return true
    }

    return false
  }

  return {
    clearConnectionDraft,
    clearEdgeReconnectDraft,
    clearSelectionBox,
    finishConnectionDrag,
    getConnectionDraftPath,
    getEdgeReconnectDraftPath,
    handleNodePointerDown,
    handleWheelZoom,
    isConnectionTarget,
    startEdgeEndpointDrag,
    startEdgePointerDown,
    startConnectionDrag,
    startCornerResize,
    startDrag,
    startPan,
    startResize,
    finishPendingCardCreation(type: "file" | "text", filePath?: string) {
      if (!pendingCardCreation.fromNodeId) {
        return
      }

      const newNode = createCanvasNode(type)
      newNode.x = Math.round(pendingCardCreation.canvasX - newNode.width / 2)
      newNode.y = Math.round(pendingCardCreation.canvasY - newNode.height / 2)
      if (type === "file" && filePath) {
        newNode.file = filePath
      }

      if (pendingCardCreation.reconnectEdgeId) {
        // 边端点重连
        const edge = state.document.edges.find((e) => e.id === pendingCardCreation.reconnectEdgeId)
        if (!edge) {
          clearPendingCardCreation()
          return
        }
        const newNodeSide = oppositeSide(
          pendingCardCreation.reconnectEndpoint === "from" ? edge.toSide : edge.fromSide,
        )
        commitDocument(setCanvasEdgeEndpoint(
          upsertCanvasNode(state.document, newNode),
          edge.id,
          pendingCardCreation.reconnectEndpoint!,
          { nodeId: newNode.id, side: newNodeSide },
        ))
      } else {
        // 新连线
        const edge = createCanvasEdge(pendingCardCreation.fromNodeId, newNode.id)
        edge.fromSide = pendingCardCreation.fromSide
        edge.toSide = oppositeSide(pendingCardCreation.fromSide)
        commitDocument(upsertCanvasEdge(
          upsertCanvasNode(state.document, newNode),
          edge,
        ))
      }
      state.selectNode(newNode.id)
      const wasReconnect = !!pendingCardCreation.reconnectEdgeId
      clearPendingCardCreation()
      if (wasReconnect) {
        clearEdgeReconnectDraft()
      } else {
        clearConnectionDraft()
      }
    },
    clearPendingCardCreation() {
      clearConnectionDraft()
      clearEdgeReconnectDraft()
      pendingCardCreation.canvasX = 0
      pendingCardCreation.canvasY = 0
      pendingCardCreation.fromNodeId = ""
      pendingCardCreation.fromSide = "left"
      pendingCardCreation.reconnectEdgeId = undefined
      pendingCardCreation.reconnectEndpoint = undefined
    },
  }
}

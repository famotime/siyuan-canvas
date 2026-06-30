import type {
  ComputedRef,
  Ref,
} from "vue"
import { watch } from "vue"
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
import type { CanvasAlignmentGuide } from "@/canvas/alignment-guides"
import { resolveCanvasAlignmentGuides } from "@/canvas/alignment-guides"
import { cloneCanvasDocument } from "@/canvas/canvas-history"
import {
  createCanvasEdge,
  createCanvasNode,
  removeCanvasEdge,
  setCanvasEdgeEndpoint,
  setCanvasNodeGeometry,
  upsertCanvasEdge,
  upsertCanvasNode,
} from "@/canvas/document"
import {
  CONNECTION_SNAP_DISTANCE,
  findNearestCanvasAnchor,
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

export interface CanvasEditorAlignmentGuideState {
  guides: CanvasAlignmentGuide[]
  visible: boolean
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

interface CanvasEditorGestureOptions {
  alignmentGuides: CanvasEditorAlignmentGuideState
  board: ComputedRef<CanvasBoardMetrics>
  commitDocument: (document: CanvasDocument, options?: { coalesceKey?: string }) => void
  connectionDraft: CanvasEditorConnectionDraftState
  edgeReconnectDraft: CanvasEditorEdgeReconnectDraftState
  getAnchor: (node: CanvasNode, side: CanvasSide) => { x: number, y: number }
  readonly: ComputedRef<boolean>
  selectionBox: CanvasEditorSelectionBoxState
  selectedEdge: ComputedRef<CanvasEdge | null>
  showDragAlignmentGuides: ComputedRef<boolean>
  autoCreateTextCardOnDrag: ComputedRef<boolean>
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
    readonly,
    selectionBox,
    selectedEdge,
    showDragAlignmentGuides,
    autoCreateTextCardOnDrag,
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

  function clearAlignmentGuides() {
    alignmentGuides.guides = []
    alignmentGuides.visible = false
  }

  watch(showDragAlignmentGuides, (enabled) => {
    if (!enabled) {
      clearAlignmentGuides()
    }
  }, { flush: "sync" })

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
    let initialWorldCenter = { x: 0, y: 0 }

    stage.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        initialPinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        initialScale = viewport.scale
        
        const rect = stage.getBoundingClientRect()
        const initialPinchCenter = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        }
        initialWorldCenter = {
          x: (initialPinchCenter.x - viewport.x) / viewport.scale,
          y: (initialPinchCenter.y - viewport.y) / viewport.scale,
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
          
          const rect = stage.getBoundingClientRect()
          const currentPinchCenter = {
            x: (t1.clientX + t2.clientX) / 2 - rect.left,
            y: (t1.clientY + t2.clientY) / 2 - rect.top,
          }
          
          viewport.scale = nextScale
          viewport.x = currentPinchCenter.x - initialWorldCenter.x * nextScale
          viewport.y = currentPinchCenter.y - initialWorldCenter.y * nextScale
        }
      }
    }, { passive: false })

    stage.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        initialPinchDistance = 0
      }
    })
  }, { immediate: true })

  function isAdditiveSelectionGesture(event: MouseEvent | PointerEvent): boolean {
    return Boolean(event.ctrlKey || event.metaKey || event.shiftKey)
  }

  function isCopyDragGesture(event: MouseEvent | PointerEvent): boolean {
    return Boolean(event.ctrlKey || event.metaKey)
  }

  function createCopiedNodeId(nodeId: string): string {
    return `${nodeId}-copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  }

  function resolveDragDelta(dx: number, dy: number, options: { lockAxis: boolean }) {
    const deltaX = Math.round(dx / viewport.scale)
    const deltaY = Math.round(dy / viewport.scale)

    if (!options.lockAxis) {
      return { deltaX, deltaY }
    }

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return { deltaX, deltaY: 0 }
    }

    return { deltaX: 0, deltaY }
  }

  function resolveAlignmentDragDelta(options: {
    deltaX: number
    deltaY: number
    movingNodeIds: string[]
    nodes: CanvasNode[]
  }) {
    if (!showDragAlignmentGuides.value) {
      clearAlignmentGuides()
      return {
        deltaX: options.deltaX,
        deltaY: options.deltaY,
        guides: [],
      }
    }

    // 基于当前视口缩放比例自适应调整吸附阈值，确保在不同缩放比例下，屏幕上物理吸附距离保持约 8 像素
    const resolved = resolveCanvasAlignmentGuides({
      ...options,
      threshold: 8 / viewport.scale,
    })
    alignmentGuides.guides = resolved.guides
    alignmentGuides.visible = resolved.guides.length > 0
    return resolved
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

    if (event.button !== 0) {
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

    if (isCopyDragGesture(event)) {
      startCopyDrag(node, event)
      return
    }

    if (isAdditiveSelectionGesture(event)) {
      return
    }

    startDrag(node, event)
  }

  function startDrag(node: CanvasNode, event: PointerEvent) {
    if (readonly.value) return
    const selectedNodeIds = resolveDragNodeIds(state.document, node.id, state.selectedNodeIds)
    // 锁存拖拽开始前的初始节点状态，避免拖动过程中的 commit 导致对齐基准抖动
    const initialNodes = [...state.document.nodes]
    const initialPositions = new Map(
      initialNodes
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
      const rawDelta = resolveDragDelta(dx, dy, { lockAxis: moveEvent.shiftKey })
      const {
        deltaX,
        deltaY,
      } = resolveAlignmentDragDelta({
        deltaX: rawDelta.deltaX,
        deltaY: rawDelta.deltaY,
        movingNodeIds: selectedNodeIds,
        nodes: initialNodes,
      })
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
      onEnd: clearAlignmentGuides,
    })
  }

  function startCopyDrag(node: CanvasNode, event: PointerEvent) {
    if (readonly.value) return
    const selectedNodeIds = resolveDragNodeIds(state.document, node.id, state.selectedNodeIds)
    const copiedNodes = state.document.nodes
      .filter(candidate => selectedNodeIds.includes(candidate.id))
      .map((candidate) => {
        const copiedNode = cloneCanvasDocument({ nodes: [candidate], edges: [] }).nodes[0]
        return {
          ...copiedNode,
          id: createCopiedNodeId(candidate.id),
        } as CanvasNode
      })

    if (copiedNodes.length === 0) {
      return
    }

    const copiedNodeIds = copiedNodes.map(candidate => candidate.id)
    const initialPositions = new Map(copiedNodes.map(candidate => [candidate.id, {
      x: candidate.x,
      y: candidate.y,
    }]))
    // 锁存拖拽开始前的初始非移动节点列表，避免拖动过程中的 commit 导致对齐基准抖动
    const initialTargetNodes = state.document.nodes.filter(candidate =>
      !copiedNodeIds.includes(candidate.id) && !selectedNodeIds.includes(candidate.id),
    )
    let hasCopied = false

    startPointerGesture(event, (dx, dy, moveEvent) => {
      const rawDelta = resolveDragDelta(dx, dy, { lockAxis: moveEvent.shiftKey })
      const {
        deltaX,
        deltaY,
      } = resolveAlignmentDragDelta({
        deltaX: rawDelta.deltaX,
        deltaY: rawDelta.deltaY,
        movingNodeIds: copiedNodeIds,
        nodes: [
          ...initialTargetNodes,
          ...copiedNodes,
        ],
      })
      if (deltaX === 0 && deltaY === 0) {
        return
      }
      const movedCopiedNodes = copiedNodes.map((candidate) => {
        const initial = initialPositions.get(candidate.id)!
        return {
          ...candidate,
          x: initial.x + deltaX,
          y: initial.y + deltaY,
        }
      })
      const movedDocument: CanvasDocument = {
        ...state.document,
        nodes: [
          ...state.document.nodes.filter(candidate => !copiedNodeIds.includes(candidate.id)),
          ...movedCopiedNodes,
        ],
      }

      commitDocument(movedDocument, { coalesceKey: `copy-drag-${node.id}` })
      if (!hasCopied) {
        state.selectNodes(copiedNodeIds)
        hasCopied = true
      }
    }, {
      onEnd: clearAlignmentGuides,
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

    return createEdgeCurvePath(from, connectionDraft.fromSide, to, connectionDraft.toSide)
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
    const movingSide = edgeReconnectDraft.targetSide || "left"
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

  function finishConnectionDrag() {
    if (!connectionDraft.fromNodeId) {
      clearConnectionDraft()
      return
    }

    if (!connectionDraft.toNodeId) {
      if (autoCreateTextCardOnDrag.value) {
        const fromNode = state.document.nodes.find((node) => node.id === connectionDraft.fromNodeId)
        if (fromNode) {
          const newNode = createCanvasNode("text")
          const W = newNode.width
          const H = newNode.height
          const fromSide = connectionDraft.fromSide
          let toSide: CanvasSide = "left"

          if (fromSide === "right") {
            toSide = "left"
            newNode.x = Math.round(connectionDraft.toX)
            newNode.y = Math.round(connectionDraft.toY - H / 2)
          } else if (fromSide === "left") {
            toSide = "right"
            newNode.x = Math.round(connectionDraft.toX - W)
            newNode.y = Math.round(connectionDraft.toY - H / 2)
          } else if (fromSide === "bottom") {
            toSide = "top"
            newNode.x = Math.round(connectionDraft.toX - W / 2)
            newNode.y = Math.round(connectionDraft.toY)
          } else if (fromSide === "top") {
            toSide = "bottom"
            newNode.x = Math.round(connectionDraft.toX - W / 2)
            newNode.y = Math.round(connectionDraft.toY - H)
          }

          const edge = createCanvasEdge(connectionDraft.fromNodeId, newNode.id)
          edge.fromSide = fromSide
          edge.toSide = toSide

          let updatedDoc = upsertCanvasNode(state.document, newNode)
          updatedDoc = upsertCanvasEdge(updatedDoc, edge)
          commitDocument(updatedDoc)

          state.selectNode(newNode.id)
          state.pendingEditNodeId = newNode.id
        }
      }
      clearConnectionDraft()
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
    const anchor = getAnchor(node, side)
    connectionDraft.fromNodeId = node.id
    connectionDraft.fromSide = side
    connectionDraft.toNodeId = ""
    connectionDraft.toSide = "left"
    connectionDraft.toX = anchor.x
    connectionDraft.toY = anchor.y
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
      commitDocument(removeCanvasEdge(state.document, edge.id))
      state.selectEdge()
      clearEdgeReconnectDraft()
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
      commitDocument(
        setCanvasNodeGeometry(
          state.document,
          node.id,
          resizeCanvasNodeFromSide(node, side, dx / viewport.scale, dy / viewport.scale),
        ),
        { coalesceKey: `resize-${node.id}-${side}` },
      )
    })
  }

  function startCornerResize(node: CanvasNode, event: PointerEvent) {
    if (event.button !== 0 || readonly.value) {
      return
    }

    event.preventDefault?.()
    startPointerGesture(event, (dx, dy) => {
      commitDocument(
        setCanvasNodeGeometry(
          state.document,
          node.id,
          resizeCanvasNodeFromCorner(node, dx / viewport.scale, dy / viewport.scale),
        ),
        { coalesceKey: `resize-corner-${node.id}` },
      )
    })
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
    startConnectionDrag,
    startCornerResize,
    startDrag,
    startPan,
    startResize,
  }
}

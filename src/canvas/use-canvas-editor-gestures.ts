import type {
  ComputedRef,
  Ref,
} from "vue"
import type { CanvasBoardMetrics } from "@/canvas/board"
import type { CanvasEditorState } from "@/canvas/editor-state"
import type {
  CanvasDocument,
  CanvasNode,
  CanvasSide,
} from "@/canvas/types"

import {
  toBoardX,
  toBoardY,
} from "@/canvas/board"
import {
  createCanvasEdge,
  setCanvasNodeGeometry,
  upsertCanvasEdge,
} from "@/canvas/document"
import {
  CONNECTION_SNAP_DISTANCE,
  findNearestCanvasAnchor,
  resizeCanvasNodeFromCorner,
  resizeCanvasNodeFromSide,
} from "@/canvas/node-interaction"
import {
  createBoundsFromPoints,
  resolveDragNodeIds,
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

interface CanvasEditorGestureOptions {
  board: ComputedRef<CanvasBoardMetrics>
  commitDocument: (document: CanvasDocument) => void
  connectionDraft: CanvasEditorConnectionDraftState
  getAnchor: (node: CanvasNode, side: CanvasSide) => { x: number, y: number }
  selectionBox: CanvasEditorSelectionBoxState
  stageRef: Ref<HTMLElement | undefined>
  state: CanvasEditorState
  viewport: {
    scale: number
    x: number
    y: number
  }
}

export function createCanvasEditorGestureHandlers(options: CanvasEditorGestureOptions) {
  const {
    board,
    commitDocument,
    connectionDraft,
    getAnchor,
    selectionBox,
    stageRef,
    state,
    viewport,
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

  function isAdditiveSelectionGesture(event: MouseEvent | PointerEvent): boolean {
    return Boolean(event.ctrlKey || event.metaKey || event.shiftKey)
  }

  function isNodeGestureTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return !target.closest(".canvas-node__resize-handle, .canvas-node__resize-corner, .canvas-node__anchor, a, button, input, textarea, select")
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

    state.selectNodes(selectedNodeIds, { additive: options.additive })
  }

  function startPan(event: PointerEvent) {
    if (event.button === 2) {
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

    if (event.button !== 0 || isAdditiveSelectionGesture(event) || !isNodeGestureTarget(event.target)) {
      return
    }

    startDrag(node, event)
  }

  function startDrag(node: CanvasNode, event: PointerEvent) {
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
    startPointerGesture(event, (dx, dy) => {
      const deltaX = Math.round(dx / viewport.scale)
      const deltaY = Math.round(dy / viewport.scale)
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

      commitDocument(movedDocument)
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
    const midX = (from.x + to.x) / 2

    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`
  }

  function isConnectionTarget(nodeId: string, side: CanvasSide) {
    return connectionDraft.visible
      && connectionDraft.toNodeId === nodeId
      && connectionDraft.toSide === side
  }

  function finishConnectionDrag() {
    if (!connectionDraft.fromNodeId || !connectionDraft.toNodeId) {
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
    if (event.button !== 0) {
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

  function startResize(node: CanvasNode, side: CanvasSide, event: PointerEvent) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault?.()
    startPointerGesture(event, (dx, dy) => {
      commitDocument(setCanvasNodeGeometry(
        state.document,
        node.id,
        resizeCanvasNodeFromSide(node, side, dx / viewport.scale, dy / viewport.scale),
      ))
    })
  }

  function startCornerResize(node: CanvasNode, event: PointerEvent) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault?.()
    startPointerGesture(event, (dx, dy) => {
      commitDocument(setCanvasNodeGeometry(
        state.document,
        node.id,
        resizeCanvasNodeFromCorner(node, dx / viewport.scale, dy / viewport.scale),
      ))
    })
  }

  return {
    clearConnectionDraft,
    clearSelectionBox,
    finishConnectionDrag,
    getConnectionDraftPath,
    handleNodePointerDown,
    handleWheelZoom,
    isConnectionTarget,
    startConnectionDrag,
    startCornerResize,
    startDrag,
    startPan,
    startResize,
  }
}

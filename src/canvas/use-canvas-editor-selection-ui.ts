import type {
  ComputedRef,
  Ref,
} from "vue"
import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasNode,
  CanvasSide,
} from "@/canvas/types"
import type { CanvasBoardMetrics } from "@/canvas/board"

import {
  computed,
  reactive,
  ref,
} from "vue"
import {
  toBoardX,
  toBoardY,
} from "@/canvas/board"
import {
  getEdgeMidpointPosition,
  resolveEdgeToolbarPosition,
  resolveSelectionToolbarPosition,
} from "@/canvas/selection-toolbar"

const DEFAULT_SELECTION_TOOLBAR_SIZE = {
  height: 48,
  width: 220,
}

export interface CanvasEditorSelectionUiState {
  document: CanvasDocument
  selectedNodeIds: string[]
}

export interface CanvasEditorSelectionUiOptions {
  board: ComputedRef<CanvasBoardMetrics>
  getCanvasNodeAnchor: (node: CanvasNode, side: CanvasSide) => { x: number, y: number }
  selectedEdge: ComputedRef<CanvasEdge | null>
  selectionBounds: ComputedRef<CanvasBounds | null>
  stageRef: Ref<HTMLElement | undefined>
  state: CanvasEditorSelectionUiState
  viewport: { scale: number, x: number, y: number }
}

export function createCanvasEditorSelectionUi(options: CanvasEditorSelectionUiOptions) {
  const selectionToolbarPopover = ref<"closed" | "color" | "layout">("closed")
  const edgeToolbarPopover = ref<"closed" | "color" | "direction">("closed")
  const selectionToolbarSize = reactive({
    height: DEFAULT_SELECTION_TOOLBAR_SIZE.height,
    width: DEFAULT_SELECTION_TOOLBAR_SIZE.width,
  })
  const edgeToolbarSize = reactive({
    height: DEFAULT_SELECTION_TOOLBAR_SIZE.height,
    width: 240,
  })

  const selectedEdgeAnchors = computed(() => {
    if (!options.selectedEdge.value) {
      return null
    }

    const fromNode = options.state.document.nodes.find((node) => node.id === options.selectedEdge.value?.fromNode)
    const toNode = options.state.document.nodes.find((node) => node.id === options.selectedEdge.value?.toNode)
    if (!fromNode || !toNode) {
      return null
    }

    return {
      from: options.getCanvasNodeAnchor(fromNode, options.selectedEdge.value.fromSide),
      to: options.getCanvasNodeAnchor(toNode, options.selectedEdge.value.toSide),
    }
  })

  const edgeToolbar = computed(() => {
    const stage = options.stageRef.value
    const anchors = selectedEdgeAnchors.value

    if (!stage || !options.selectedEdge.value || !anchors || options.state.selectedNodeIds.length > 0) {
      return {
        placement: "top" as const,
        visible: false,
        x: 0,
        y: 0,
      }
    }

    const midpoint = getEdgeMidpointPosition(
      {
        x: toBoardX(options.board.value, anchors.from.x),
        y: toBoardY(options.board.value, anchors.from.y),
      },
      options.selectedEdge.value.fromSide,
      {
        x: toBoardX(options.board.value, anchors.to.x),
        y: toBoardY(options.board.value, anchors.to.y),
      },
      options.selectedEdge.value.toSide,
    )

    return {
      ...resolveEdgeToolbarPosition(
        {
          x: midpoint.x * options.viewport.scale + options.viewport.x,
          y: midpoint.y * options.viewport.scale + options.viewport.y,
        },
        {
          height: stage.clientHeight,
          width: stage.clientWidth,
        },
        edgeToolbarSize,
      ),
      visible: true,
    }
  })

  const selectedEdgeHandlePositions = computed(() => {
    if (!options.selectedEdge.value || !selectedEdgeAnchors.value) {
      return null
    }

    return {
      from: {
        x: toBoardX(options.board.value, selectedEdgeAnchors.value.from.x) * options.viewport.scale + options.viewport.x,
        y: toBoardY(options.board.value, selectedEdgeAnchors.value.from.y) * options.viewport.scale + options.viewport.y,
      },
      to: {
        x: toBoardX(options.board.value, selectedEdgeAnchors.value.to.x) * options.viewport.scale + options.viewport.x,
        y: toBoardY(options.board.value, selectedEdgeAnchors.value.to.y) * options.viewport.scale + options.viewport.y,
      },
    }
  })

  const selectionToolbar = computed(() => {
    const stage = options.stageRef.value
    const bounds = options.selectionBounds.value

    if (!stage || !bounds || options.selectedEdge.value) {
      return {
        placement: "top" as const,
        visible: false,
        x: 0,
        y: 0,
      }
    }

    const selectionRect = {
      height: bounds.height * options.viewport.scale,
      width: bounds.width * options.viewport.scale,
      x: toBoardX(options.board.value, bounds.x) * options.viewport.scale + options.viewport.x,
      y: toBoardY(options.board.value, bounds.y) * options.viewport.scale + options.viewport.y,
    }

    return {
      ...resolveSelectionToolbarPosition(
        selectionRect,
        {
          height: stage.clientHeight,
          width: stage.clientWidth,
        },
        selectionToolbarSize,
      ),
      visible: options.state.selectedNodeIds.length > 0,
    }
  })

  function closeSelectionPopover() {
    selectionToolbarPopover.value = "closed"
  }

  function closeEdgePopover() {
    edgeToolbarPopover.value = "closed"
  }

  function setSelectionToolbarSize(size: { height: number, width: number }) {
    if (size.width > 0) {
      selectionToolbarSize.width = size.width
    }

    if (size.height > 0) {
      selectionToolbarSize.height = size.height
    }
  }

  function setEdgeToolbarSize(size: { height: number, width: number }) {
    if (size.width > 0) {
      edgeToolbarSize.width = size.width
    }

    if (size.height > 0) {
      edgeToolbarSize.height = size.height
    }
  }

  return {
    closeEdgePopover,
    closeSelectionPopover,
    edgeToolbar,
    edgeToolbarPopover,
    selectedEdgeAnchors,
    selectedEdgeHandlePositions,
    selectionToolbar,
    selectionToolbarPopover,
    setEdgeToolbarSize,
    setSelectionToolbarSize,
  }
}

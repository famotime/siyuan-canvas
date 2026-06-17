/* @vitest-environment jsdom */

import type { CanvasBounds, CanvasDocument, CanvasEdge } from "@/canvas/types"
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  computed,
  reactive,
  ref,
} from "vue"

import { createCanvasEditorSelectionUi } from "@/canvas/use-canvas-editor-selection-ui"

function createStage(width = 800, height = 600): HTMLElement {
  const stage = document.createElement("div")
  Object.defineProperty(stage, "clientWidth", { value: width, configurable: true })
  Object.defineProperty(stage, "clientHeight", { value: height, configurable: true })
  return stage
}

describe("canvas editor selection ui", () => {
  it("positions the selection toolbar from selected bounds and updates when size changes", () => {
    const state = reactive({
      document: { nodes: [], edges: [] } as CanvasDocument,
      selectedNodeIds: ["a"],
    })
    const stageRef = ref<HTMLElement | undefined>(createStage())
    const viewport = reactive({ scale: 1, x: 10, y: 20 })
    const board = computed(() => ({ height: 100, minX: 0, minY: 0, width: 100 }))
    const selectionBounds = computed<CanvasBounds | null>(() => ({
      height: 100,
      width: 200,
      x: 100,
      y: 120,
    }))
    const selectedEdge = computed<CanvasEdge | null>(() => null)

    const ui = createCanvasEditorSelectionUi({
      board,
      getCanvasNodeAnchor: () => ({ x: 0, y: 0 }),
      selectedEdge,
      selectionBounds,
      stageRef,
      state,
      viewport,
    })

    expect(ui.selectionToolbar.value.visible).toBe(true)
    const initialX = ui.selectionToolbar.value.x
    ui.setSelectionToolbarSize({ height: 48, width: 320 })
    expect(ui.selectionToolbar.value.x).toBe(initialX - 50)
  })

  it("hides the edge toolbar when nodes are selected and closes popovers", () => {
    const edge: CanvasEdge = {
      fromNode: "a",
      fromSide: "right",
      id: "edge-1",
      toNode: "b",
      toSide: "left",
    }
    const state = reactive({
      document: {
        edges: [edge],
        nodes: [
          { height: 100, id: "a", type: "text", text: "A", width: 100, x: 0, y: 0 },
          { height: 100, id: "b", type: "text", text: "B", width: 100, x: 300, y: 0 },
        ],
      } as CanvasDocument,
      selectedNodeIds: ["a"],
    })
    const ui = createCanvasEditorSelectionUi({
      board: computed(() => ({ height: 100, minX: 0, minY: 0, width: 400 })),
      getCanvasNodeAnchor: node => ({ x: node.x, y: node.y }),
      selectedEdge: computed(() => edge),
      selectionBounds: computed(() => null),
      stageRef: ref<HTMLElement | undefined>(createStage()),
      state,
      viewport: reactive({ scale: 1, x: 0, y: 0 }),
    })

    ui.selectionToolbarPopover.value = "color"
    ui.edgeToolbarPopover.value = "direction"

    expect(ui.edgeToolbar.value.visible).toBe(false)
    ui.closeSelectionPopover()
    ui.closeEdgePopover()
    expect(ui.selectionToolbarPopover.value).toBe("closed")
    expect(ui.edgeToolbarPopover.value).toBe("closed")
  })
})

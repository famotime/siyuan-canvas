/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { ref } from "vue"
import { createCanvasEditorNodeEdgeActions } from "@/canvas/use-canvas-editor-node-edge-actions"

import {
  MIN_VIEWPORT_SCALE,
  clampViewportScale,
  scaleViewportAtPoint,
} from "@/canvas/viewport"

describe("canvas viewport helpers", () => {
  it("keeps the cursor focus anchored while zooming", () => {
    const nextViewport = scaleViewportAtPoint(
      { scale: 1, x: 10, y: 20 },
      { x: 110, y: 120 },
      2,
    )

    const worldXBefore = (110 - 10) / 1
    const worldYBefore = (120 - 20) / 1
    const worldXAfter = (110 - nextViewport.x) / nextViewport.scale
    const worldYAfter = (120 - nextViewport.y) / nextViewport.scale

    expect(worldXAfter).toBe(worldXBefore)
    expect(worldYAfter).toBe(worldYBefore)
  })

  it("allows zooming out below thirty percent while still enforcing a floor", () => {
    expect(MIN_VIEWPORT_SCALE).toBe(0.1)
    expect(clampViewportScale(0.18)).toBe(0.18)
    expect(clampViewportScale(0.04)).toBe(0.1)
  })
})

describe("canvas focusNodeById presentation scale logic", () => {
  it("forces scale to 1.0 when presentation is active and presentationAutoRatio is true", () => {
    const stage = document.createElement("div")
    Object.defineProperty(stage, "clientWidth", { value: 1000 })
    Object.defineProperty(stage, "clientHeight", { value: 800 })

    const viewport = {
      scale: 0.5,
      x: 0,
      y: 0,
    }

    const state = {
      document: {
        nodes: [
          { id: "node-1", x: 100, y: 100, width: 200, height: 100 }
        ],
        edges: [],
      },
      selectNode: vi.fn(),
    }

    const actions = createCanvasEditorNodeEdgeActions({
      activateCanvasSurface: vi.fn(),
      board: ref({ left: 0, top: 0, width: 5000, height: 5000 }),
      closeEdgePopover: vi.fn(),
      closeSelectionPopover: vi.fn(),
      commitDocument: vi.fn(),
      createEdgeDialog: { visible: false },
      edgeLabelDraft: ref(""),
      editingEdgeLabelId: ref(""),
      edgeToolbarPopover: ref("closed"),
      fileFieldRefresh: vi.fn(async () => {}),
      getSettings: vi.fn(() => ({
        presentationAutoRatio: true,
        presentationMaskOpacity: 60,
      } as any)),
      newEdgeFromSide: ref("right"),
      newEdgeLabel: ref(""),
      newEdgeSourceId: ref(""),
      newEdgeSourceQuery: ref(""),
      newEdgeTargetId: ref(""),
      newEdgeTargetQuery: ref(""),
      newEdgeToSide: ref("left"),
      presentationActive: ref(true),
      selectedEdge: ref(undefined) as any,
      selectedEdgeAnchors: ref(null) as any,
      selectedNode: ref(null) as any,
      selectionBounds: ref(null) as any,
      selectionToolbarPopover: ref("closed") as any,
      stageRef: ref(stage) as any,
      state: state as any,
      t: vi.fn((key) => key) as any,
      viewport,
    })

    actions.focusNodeById("node-1")

    expect(viewport.scale).toBe(1.0)
    expect(viewport.x).toBe(300)
    expect(viewport.y).toBe(210)
  })

  it("keeps original scale when presentationAutoRatio is false", () => {
    const stage = document.createElement("div")
    Object.defineProperty(stage, "clientWidth", { value: 1000 })
    Object.defineProperty(stage, "clientHeight", { value: 800 })

    const viewport = {
      scale: 0.5,
      x: 0,
      y: 0,
    }

    const state = {
      document: {
        nodes: [
          { id: "node-1", x: 100, y: 100, width: 200, height: 100 }
        ],
        edges: [],
      },
      selectNode: vi.fn(),
    }

    const actions = createCanvasEditorNodeEdgeActions({
      activateCanvasSurface: vi.fn(),
      board: ref({ left: 0, top: 0, width: 5000, height: 5000 }),
      closeEdgePopover: vi.fn(),
      closeSelectionPopover: vi.fn(),
      commitDocument: vi.fn(),
      createEdgeDialog: { visible: false },
      edgeLabelDraft: ref(""),
      editingEdgeLabelId: ref(""),
      edgeToolbarPopover: ref("closed"),
      fileFieldRefresh: vi.fn(async () => {}),
      getSettings: vi.fn(() => ({
        presentationAutoRatio: false,
        presentationMaskOpacity: 60,
      } as any)),
      newEdgeFromSide: ref("right"),
      newEdgeLabel: ref(""),
      newEdgeSourceId: ref(""),
      newEdgeSourceQuery: ref(""),
      newEdgeTargetId: ref(""),
      newEdgeTargetQuery: ref(""),
      newEdgeToSide: ref("left"),
      presentationActive: ref(true),
      selectedEdge: ref(undefined) as any,
      selectedEdgeAnchors: ref(null) as any,
      selectedNode: ref(null) as any,
      selectionBounds: ref(null) as any,
      selectionToolbarPopover: ref("closed") as any,
      stageRef: ref(stage) as any,
      state: state as any,
      t: vi.fn((key) => key) as any,
      viewport,
    })

    actions.focusNodeById("node-1")

    expect(viewport.scale).toBe(0.5)
    expect(viewport.x).toBe(400)
    expect(viewport.y).toBe(285)
  })
})


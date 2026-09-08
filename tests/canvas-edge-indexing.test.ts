/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest"
import { computed, reactive, ref } from "vue"
import { createCanvasEditorSelectionUi } from "@/canvas/use-canvas-editor-selection-ui"
import type { CanvasDocument, CanvasEdge, CanvasNode, CanvasSide } from "@/canvas/types"

describe("Canvas Edge Indexing & Lookup Optimization", () => {
  function createTestNode(id: string, x = 100, y = 100): CanvasNode {
    return {
      id,
      type: "text",
      x,
      y,
      width: 200,
      height: 100,
      text: `Content ${id}`,
    }
  }

  it("prioritizes getNodeById in selection UI for O(1) node lookup", () => {
    const nodeA = createTestNode("node-a", 100, 100)
    const nodeB = createTestNode("node-b", 400, 100)
    const edge: CanvasEdge = {
      id: "edge-1",
      fromNode: "node-a",
      fromSide: "right",
      toNode: "node-b",
      toSide: "left",
    }

    const state = reactive<{ document: CanvasDocument, selectedNodeIds: string[] }>({
      document: {
        nodes: [nodeA, nodeB],
        edges: [edge],
      },
      selectedNodeIds: [],
    })

    const nodeMap = computed(() => {
      const map = new Map<string, CanvasNode>()
      for (const node of state.document.nodes) {
        map.set(node.id, node)
      }
      return map
    })

    let customLookupCalled = 0
    const getNodeById = (id: string) => {
      customLookupCalled++
      return nodeMap.value.get(id)
    }

    const selectedEdge = computed(() => edge)
    const selectionBounds = computed(() => null)
    const stageRef = ref(document.createElement("div"))
    const board = computed(() => ({
      height: 2000,
      left: 0,
      top: 0,
      width: 2000,
    }))
    const getCanvasNodeAnchor = (node: CanvasNode, side: CanvasSide) => ({
      x: side === "right" ? node.x + node.width : node.x,
      y: node.y + node.height / 2,
    })

    const selectionUi = createCanvasEditorSelectionUi({
      board,
      getCanvasNodeAnchor,
      getNodeById,
      selectedEdge,
      selectionBounds,
      stageRef,
      state,
      viewport: { scale: 1, x: 0, y: 0 },
    })

    expect(selectionUi.selectedEdgeHandlePositions.value).not.toBeNull()
    expect(customLookupCalled).toBeGreaterThanOrEqual(2)
    expect(selectionUi.selectedEdgeHandlePositions.value?.from).toEqual({ x: 300, y: 150 })
    expect(selectionUi.selectedEdgeHandlePositions.value?.to).toEqual({ x: 400, y: 150 })
  })

  it("handles missing edge nodes safely using O(1) lookup", () => {
    const nodeA = createTestNode("node-a", 100, 100)
    const orphanedEdge: CanvasEdge = {
      id: "edge-missing",
      fromNode: "node-a",
      fromSide: "right",
      toNode: "node-nonexistent",
      toSide: "left",
    }

    const state = reactive<{ document: CanvasDocument, selectedNodeIds: string[] }>({
      document: {
        nodes: [nodeA],
        edges: [orphanedEdge],
      },
      selectedNodeIds: [],
    })

    const nodeMap = computed(() => new Map(state.document.nodes.map(n => [n.id, n])))
    const selectedEdge = computed(() => orphanedEdge)
    const stageRef = ref(document.createElement("div"))

    const selectionUi = createCanvasEditorSelectionUi({
      board: computed(() => ({ height: 1000, left: 0, top: 0, width: 1000 })),
      getCanvasNodeAnchor: (node) => ({ x: node.x, y: node.y }),
      getNodeById: (id) => nodeMap.value.get(id),
      selectedEdge,
      selectionBounds: computed(() => null),
      stageRef,
      state,
      viewport: { scale: 1, x: 0, y: 0 },
    })

    expect(selectionUi.selectedEdgeHandlePositions.value).toBeNull()
  })
})

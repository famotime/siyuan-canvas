/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"
import { defineComponent, h, nextTick, ref } from "vue"
import { useCanvasEditor } from "@/canvas/use-canvas-editor"
import { createDefaultCanvasPluginSettings } from "@/canvas/plugin-data"

function createPlugin(settingsOverrides = {}) {
  const settings = {
    ...createDefaultCanvasPluginSettings(),
    ...settingsOverrides,
  }

  return {
    getCanvasSettings: vi.fn(() => settings),
    updateCanvasSettings: vi.fn(async (patch) => Object.assign(settings, patch)),
    getRecentCanvasFiles: vi.fn(() => []),
    isMobile: false,
    i18n: {},
  }
}

function createBootstrap(docOverrides = {}) {
  return {
    path: "/test.canvas",
    raw: JSON.stringify({
      nodes: [
        { id: "node-A", type: "text", text: "A", x: 0, y: 0, width: 100, height: 100 },
        { id: "node-B", type: "text", text: "B", x: 200, y: 0, width: 100, height: 100 },
        { id: "node-C", type: "text", text: "C", x: 0, y: 200, width: 100, height: 100 },
        { id: "node-D", type: "text", text: "D", x: 400, y: 400, width: 100, height: 100 },
      ],
      edges: [
        { id: "edge-AB", fromNode: "node-A", fromSide: "right", toNode: "node-B", toSide: "left" },
        { id: "edge-CA", fromNode: "node-C", fromSide: "right", toNode: "node-A", toSide: "left" },
        { id: "edge-BD", fromNode: "node-B", fromSide: "right", toNode: "node-D", toSide: "left" },
      ],
      ...docOverrides,
    }),
  }
}

describe("useCanvasEditor Relation Highlighting Logic", () => {
  it("does not compute related edges/nodes when enableRelationHighlightOnSelect is false", async () => {
    let editor: any
    const plugin = createPlugin({ enableRelationHighlightOnSelect: false })
    const bootstrap = createBootstrap()

    const Harness = defineComponent({
      setup() {
        editor = useCanvasEditor(plugin as any, bootstrap as any, vi.fn())
        return () => h("div")
      },
    })

    mount(Harness)
    await nextTick()

    // Select node-A
    editor.state.selectedNodeIds = ["node-A"]
    await nextTick()

    expect(editor.relatedEdgeIds.size).toBe(0)
    expect(editor.relatedNodeIds.size).toBe(0)
    expect(editor.isRelatedEdge("edge-AB")).toBe(false)
    expect(editor.isRelatedNode("node-B")).toBe(false)
  })

  it("computes 1-degree connected edges and neighbor nodes when enabled and single node selected", async () => {
    let editor: any
    const plugin = createPlugin({ enableRelationHighlightOnSelect: true })
    const bootstrap = createBootstrap()

    const Harness = defineComponent({
      setup() {
        editor = useCanvasEditor(plugin as any, bootstrap as any, vi.fn())
        return () => h("div")
      },
    })

    mount(Harness)
    await nextTick()

    // No selection
    editor.state.selectedNodeIds = []
    await nextTick()
    expect(editor.relatedEdgeIds.size).toBe(0)
    expect(editor.relatedNodeIds.size).toBe(0)

    // Select node-A (outgoing to B, incoming from C)
    editor.state.selectedNodeIds = ["node-A"]
    await nextTick()

    expect(editor.relatedEdgeIds.has("edge-AB")).toBe(true)
    expect(editor.relatedEdgeIds.has("edge-CA")).toBe(true)
    expect(editor.relatedEdgeIds.has("edge-BD")).toBe(false)

    expect(editor.relatedNodeIds.has("node-B")).toBe(true)
    expect(editor.relatedNodeIds.has("node-C")).toBe(true)
    expect(editor.relatedNodeIds.has("node-D")).toBe(false)
    expect(editor.relatedNodeIds.has("node-A")).toBe(false) // Selected node is not its own neighbor

    expect(editor.isRelatedEdge("edge-AB")).toBe(true)
    expect(editor.isRelatedEdge("edge-BD")).toBe(false)
    expect(editor.isRelatedNode("node-B")).toBe(true)
    expect(editor.isRelatedNode("node-D")).toBe(false)
    expect(editor.isRelatedNode("node-A")).toBe(false)
  })

  it("clears related highlights when multiple nodes are selected", async () => {
    let editor: any
    const plugin = createPlugin({ enableRelationHighlightOnSelect: true })
    const bootstrap = createBootstrap()

    const Harness = defineComponent({
      setup() {
        editor = useCanvasEditor(plugin as any, bootstrap as any, vi.fn())
        return () => h("div")
      },
    })

    mount(Harness)
    await nextTick()

    // Select both node-A and node-B
    editor.state.selectedNodeIds = ["node-A", "node-B"]
    await nextTick()

    expect(editor.relatedEdgeIds.size).toBe(0)
    expect(editor.relatedNodeIds.size).toBe(0)
    expect(editor.isRelatedEdge("edge-AB")).toBe(false)
    expect(editor.isRelatedNode("node-C")).toBe(false)
  })

  it("handles self-referential edges correctly without self as neighbor", async () => {
    let editor: any
    const plugin = createPlugin({ enableRelationHighlightOnSelect: true })
    const bootstrap = createBootstrap({
      edges: [
        { id: "edge-self", fromNode: "node-A", fromSide: "right", toNode: "node-A", toSide: "top" },
      ],
    })

    const Harness = defineComponent({
      setup() {
        editor = useCanvasEditor(plugin as any, bootstrap as any, vi.fn())
        return () => h("div")
      },
    })

    mount(Harness)
    await nextTick()

    editor.state.selectedNodeIds = ["node-A"]
    await nextTick()

    expect(editor.relatedEdgeIds.has("edge-self")).toBe(true)
    expect(editor.relatedNodeIds.has("node-A")).toBe(false)
  })
})

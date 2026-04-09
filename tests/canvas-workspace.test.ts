/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"
import { ref } from "vue"

import CanvasWorkspace from "@/components/canvas/CanvasWorkspace.vue"

let currentEditor: Record<string, any>

vi.mock("@/canvas/use-canvas-editor", () => ({
  useCanvasEditor: () => currentEditor,
}))

function createTextNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "text-1",
    type: "text",
    text: "### 定义\n\n- 从有限的例子中找出规律",
    x: 0,
    y: 0,
    width: 320,
    height: 180,
    ...overrides,
  }
}

function createEditorMock(node = createTextNode()) {
  return {
    addNode: vi.fn(),
    activateNode: vi.fn(),
    board: {
      height: 800,
      width: 1200,
    },
    canDelete: false,
    createEdgeFromSelection: vi.fn(),
    deleteSelection: vi.fn(),
    displayNodes: [node],
    edgeTargets: [],
    exportCanvas: vi.fn(),
    fileInputRef: ref<HTMLInputElement>(),
    getEdgeLabelPosition: vi.fn(() => ({ x: 0, y: 0 })),
    getEdgePath: vi.fn(() => ""),
    getFileNodePreview: vi.fn(() => ({
      badge: "doc",
      detail: "",
      headline: "",
      helper: "",
      imageSrc: "",
    })),
    getNodeStyle: vi.fn(() => ({
      height: "180px",
      left: "0px",
      top: "0px",
      width: "320px",
    })),
    getNodeTitle: vi.fn(() => "Text"),
    getRenderedMarkdown: vi.fn((text: string) => `<p>${text}</p>`),
    handleNodePointerDown: vi.fn(),
    handleWheelZoom: vi.fn(),
    importCanvas: vi.fn(),
    inspectorExpanded: true,
    loadConflictVersion: vi.fn(),
    newCanvas: vi.fn(),
    newEdgeFromSide: "right",
    newEdgeLabel: "",
    newEdgeTargetId: "",
    newEdgeToSide: "left",
    openPath: vi.fn(),
    openRecentPath: vi.fn(),
    openSettings: vi.fn(),
    overwriteConflictVersion: vi.fn(),
    recentFiles: [],
    resetViewport: vi.fn(),
    save: vi.fn(),
    selectEdge: vi.fn(),
    selectedEdge: null,
    selectedNode: null,
    selectedNodeCount: 0,
    selectNode: vi.fn(),
    sides: ["top", "right", "bottom", "left"],
    stageRef: ref<HTMLElement>(),
    startPan: vi.fn(),
    startResize: vi.fn(),
    state: {
      conflict: null,
      document: {
        edges: [],
        nodes: [node],
      },
      filePath: "",
      isDirty: false,
      issues: {
        errors: [],
        warnings: [],
      },
      selectedEdgeId: "",
      selectedNodeIds: [],
    },
    suggestedFilename: "Untitled.canvas",
    toggleInspector: vi.fn(),
    triggerImport: vi.fn(),
    updateEdgeField: vi.fn(),
    updateEdgeSide: vi.fn(),
    updateNodeField: vi.fn(),
    updateNumericNodeField: vi.fn(),
    updateTextNodeContent: vi.fn(),
    viewport: {
      scale: 1,
      x: 0,
      y: 0,
    },
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }
}

describe("CanvasWorkspace", () => {
  it("renders cards without the top metadata header", () => {
    currentEditor = createEditorMock()

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find(".canvas-node__header").exists()).toBe(false)
    expect(wrapper.find(".markdown-preview").exists()).toBe(true)
  })

  it("lets a text card enter inline markdown editing and saves on blur", async () => {
    const node = createTextNode()
    currentEditor = createEditorMock(node)

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    await wrapper.find(".canvas-node").trigger("dblclick")

    const textarea = wrapper.find(".canvas-node__editor")
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe(node.text)

    await textarea.setValue("## 已修改")
    await textarea.trigger("blur")

    expect(currentEditor.updateTextNodeContent).toHaveBeenCalledWith(node.id, "## 已修改")
    expect(wrapper.find(".canvas-node__editor").exists()).toBe(false)
  })

  it("renders edges with a color-matched arrow marker that stays attached to the line", () => {
    currentEditor = createEditorMock()
    currentEditor.state.document.edges = [
      {
        fromNode: "text-1",
        fromSide: "right",
        id: "edge-1",
        label: "",
        toNode: "text-2",
        toSide: "left",
      },
    ]
    currentEditor.getEdgePath = vi.fn(() => "M 0 0 L 100 0")

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    const marker = wrapper.find("#canvas-edge-arrow")

    expect(marker.exists()).toBe(true)
    expect(marker.attributes("viewBox")).toBe("0 0 14 14")
    expect(marker.find("path").attributes("fill")).toBe("context-stroke")
    expect(wrapper.find(".stage__edge").attributes("marker-end")).toBe("url(#canvas-edge-arrow)")
  })
})

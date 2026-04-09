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

function createLinkNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "link-1",
    type: "link",
    url: "https://example.com",
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
    applySelectionColor: vi.fn(),
    applySelectionLayout: vi.fn(),
    board: {
      height: 800,
      width: 1200,
    },
    canDelete: false,
    centerSelectionInViewport: vi.fn(),
    createGroupFromSelection: vi.fn(),
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
    selectedNode: node,
    selectedNodeCount: 1,
    selectionColors: ["1", "2", "3"],
    selectionLayoutActions: [
      { action: "left-align", label: "Left align" },
      { action: "arrange-row", label: "Arrange row" },
    ],
    selectionToolbar: {
      placement: "top",
      visible: false,
      x: 0,
      y: 0,
    },
    selectionToolbarPopover: "closed",
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
    toggleSelectionPopover: vi.fn(),
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

  it("renders a single-selection floating toolbar with edit and no create-group action", async () => {
    const node = createTextNode()
    currentEditor = createEditorMock(node)
    currentEditor.selectionToolbar = {
      placement: "top",
      visible: true,
      x: 144,
      y: 88,
    }
    currentEditor.state.selectedNodeIds = [node.id]

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    const toolbar = wrapper.find("[data-testid='selection-toolbar']")

    expect(toolbar.exists()).toBe(true)
    expect(toolbar.attributes("style")).toContain("left: 144px;")
    expect(toolbar.attributes("style")).toContain("top: 88px;")
    expect(wrapper.find("[data-testid='selection-toolbar-edit']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='selection-toolbar-create-group']").exists()).toBe(false)

    await wrapper.find("[data-testid='selection-toolbar-color']").trigger("click")

    expect(currentEditor.toggleSelectionPopover).toHaveBeenCalledWith("color")
  })

  it("renders a multi-selection floating toolbar with create-group and align menu", async () => {
    const firstNode = createTextNode()
    const secondNode = createTextNode({
      id: "text-2",
      text: "second node",
      x: 380,
    })
    currentEditor = createEditorMock(firstNode)
    currentEditor.displayNodes = [firstNode, secondNode]
    currentEditor.state.document.nodes = [firstNode, secondNode]
    currentEditor.selectedNode = firstNode
    currentEditor.selectedNodeCount = 2
    currentEditor.selectionToolbar = {
      placement: "top",
      visible: true,
      x: 220,
      y: 116,
    }
    currentEditor.selectionToolbarPopover = "layout"
    currentEditor.state.selectedNodeIds = [firstNode.id, secondNode.id]

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='selection-toolbar-create-group']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='selection-toolbar-edit']").exists()).toBe(false)
    expect(wrapper.find("[data-testid='selection-toolbar-align']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='selection-layout-menu']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='selection-layout-action-left-align']").exists()).toBe(true)

    await wrapper.find("[data-testid='selection-layout-action-left-align']").trigger("click")

    expect(currentEditor.applySelectionLayout).toHaveBeenCalledWith("left-align")
  })

  it("lets the floating toolbar edit button enter inline markdown editing", async () => {
    const node = createTextNode()
    currentEditor = createEditorMock(node)
    currentEditor.selectionToolbar = {
      placement: "top",
      visible: true,
      x: 144,
      y: 88,
    }
    currentEditor.state.selectedNodeIds = [node.id]

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    await wrapper.find("[data-testid='selection-toolbar-edit']").trigger("click")

    const textarea = wrapper.find(".canvas-node__editor")
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe(node.text)

    await textarea.setValue("## Toolbar edit")
    await textarea.trigger("blur")

    expect(currentEditor.updateTextNodeContent).toHaveBeenCalledWith(node.id, "## Toolbar edit")
  })

  it("reuses the existing activate flow when the floating toolbar edits a non-text node", async () => {
    const node = createLinkNode()
    currentEditor = createEditorMock(node)
    currentEditor.selectionToolbar = {
      placement: "top",
      visible: true,
      x: 144,
      y: 88,
    }
    currentEditor.state.selectedNodeIds = [node.id]

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    await wrapper.find("[data-testid='selection-toolbar-edit']").trigger("click")

    expect(currentEditor.activateNode).toHaveBeenCalledWith(node)
    expect(wrapper.find(".canvas-node__editor").exists()).toBe(false)
  })

  it("renders a visible card color from node.color using the shared selection color mapping", () => {
    const node = createTextNode({ color: "2" })
    currentEditor = createEditorMock(node)

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    const card = wrapper.find(".canvas-node").element as HTMLElement

    expect(card.style.borderColor).toBe("rgb(38, 166, 154)")
    expect(card.style.backgroundColor).toBe("rgba(38, 166, 154, 0.18)")
  })
})

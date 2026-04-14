/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"
import {
  nextTick,
  reactive,
  ref,
} from "vue"
import zhCN from "@/i18n/zh_CN.json"

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

function createGroupNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    type: "group",
    label: "意义为什么好好说话是一件很困难很复杂的事？",
    x: 0,
    y: 0,
    width: 480,
    height: 240,
    ...overrides,
  }
}

function createEditorMock(node = createTextNode()) {
  return reactive({
    addNode: vi.fn(),
    activateNode: vi.fn(),
    activateCanvasSurface: vi.fn(),
    applySelectionColor: vi.fn(),
    applySelectionLayout: vi.fn(),
    board: {
      height: 800,
      width: 1200,
    },
    bottomToolbarVisible: false,
    canDelete: false,
    centerSelectionInViewport: vi.fn(),
    centerEdgeInViewport: vi.fn(),
    closeCreateEdgeDialog: vi.fn(),
    closeFilePickerDialog: vi.fn(),
    closeSelectionPopover: vi.fn(),
    closeEdgePopover: vi.fn(),
    createEdgeDialog: {
      visible: false,
    },
    filePickerDialog: {
      groups: {
        blocks: [],
        canvases: [],
        documents: [],
        images: [],
      },
      query: "",
      visible: false,
    },
    createGroupFromSelection: vi.fn(),
    createEdgeFromSelection: vi.fn(),
    connectionDraft: {
      toX: 0,
      toY: 0,
      visible: false,
    },
    deactivateCanvasSurface: vi.fn(),
    deleteSelection: vi.fn(),
    displayNodes: [node],
    edgeColorOptions: ["1", "2", "3"],
    edgeLabelDraft: "",
    edgeLabelEditorPosition: null,
    edgeReconnectDraft: {
      edgeId: "",
      endpoint: "",
      targetNodeId: "",
      targetSide: "",
      toX: 0,
      toY: 0,
      visible: false,
    },
    edgeToolbar: {
      placement: "top",
      visible: false,
      x: 0,
      y: 0,
    },
    edgeToolbarPopover: "closed",
    edgeTargets: [],
    edgeSources: [node],
    exportCanvas: vi.fn(),
    fileInputRef: ref<HTMLInputElement>(),
    getConnectionDraftPath: vi.fn(() => ""),
    getEdgeReconnectDraftPath: vi.fn(() => ""),
    getEdgeLabelPosition: vi.fn(() => ({ x: 0, y: 0 })),
    getEdgePath: vi.fn(() => ""),
    getFileNodePreview: vi.fn(() => ({
      badge: "doc",
      detail: "",
      headline: "",
      helper: "",
      kind: "file",
      imageSrc: "",
    })),
    getNodeStyle: vi.fn(() => ({
      height: "180px",
      left: "0px",
      top: "0px",
      width: "320px",
    })),
    getNodeTitle: vi.fn((candidate: any) => candidate.text || candidate.label || candidate.url || candidate.id || "Text"),
    getRenderedMarkdown: vi.fn((text: string) => `<p>${text}</p>`),
    handleNodePointerDown: vi.fn(),
    handleWheelZoom: vi.fn(),
    isConnectionTarget: vi.fn(() => false),
    importCanvas: vi.fn(),
    inspectorExpanded: true,
    inspectorSectionState: {
      createEdge: true,
      document: true,
      edge: true,
      node: true,
      recent: true,
      selection: true,
    },
    loadConflictVersion: vi.fn(),
    newCanvas: vi.fn(),
    newEdgeFromSide: "right",
    newEdgeLabel: "",
    newEdgeSourceId: node.id,
    newEdgeSourceQuery: "",
    newEdgeTargetId: "",
    newEdgeTargetQuery: "",
    newEdgeToSide: "left",
    openCreateEdgeDialog: vi.fn(),
    openFilePickerDialog: vi.fn(),
    openRecentFile: vi.fn(),
    openPath: vi.fn(),
    openRecentPath: vi.fn(),
    openSettings: vi.fn(),
    openWorkspacePath: vi.fn(),
    overwriteConflictVersion: vi.fn(),
    recentFiles: [],
    resetViewport: vi.fn(),
    save: vi.fn(),
    selectedEdgeHandlePositions: null,
    selectEdge: vi.fn(),
    selectedEdge: null,
    selectedEdgeDirectionMode: "single",
    selectedNode: node,
    selectedNodeCount: 1,
    selectionBox: {
      height: 0,
      visible: false,
      width: 0,
      x: 0,
      y: 0,
    },
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
    setSelectionToolbarSize: vi.fn(),
    setEdgeToolbarSize: vi.fn(),
    sides: ["top", "right", "bottom", "left"],
    stageRef: ref<HTMLElement>(),
    startEdgeEndpointDrag: vi.fn(),
    startEdgeLabelEditing: vi.fn(),
    startConnectionDrag: vi.fn(),
    startCornerResize: vi.fn(),
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
    submitCreateEdgeDialog: vi.fn(),
    submitEdgeLabelEditing: vi.fn(),
    cancelEdgeLabelEditing: vi.fn(),
    setNewEdgeSourceId: vi.fn(),
    setNewEdgeTargetId: vi.fn(),
    toggleInspector: vi.fn(),
    toggleInspectorSection: vi.fn(),
    toggleEdgePopover: vi.fn(),
    toggleSelectionPopover: vi.fn(),
    triggerImport: vi.fn(),
    updateEditingEdgeLabel: vi.fn(),
    updateSelectedEdgeDirection: vi.fn(),
    applyEdgeColor: vi.fn(),
    updateFilePickerQuery: vi.fn(),
    updateEdgeField: vi.fn(),
    updateEdgeSide: vi.fn(),
    updateNodeField: vi.fn(),
    updateNumericNodeField: vi.fn(),
    updateTextNodeContent: vi.fn(),
    workspaceDocuments: [],
    viewport: {
      scale: 1,
      x: 0,
      y: 0,
    },
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  })
}

function createPluginMock() {
  return {
    i18n: zhCN,
  }
}

describe("CanvasWorkspace", () => {
  it("renders a stable canvas root for host theme attributes", () => {
    currentEditor = createEditorMock()

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='canvas-shell']").exists()).toBe(true)
  })

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
    expect(wrapper.find(".stage__edge").attributes("marker-end")).toBe("url(#canvas-edge-arrow-end)")
  })

  it("provides a hoverable edge hit area above groups so the edge can be selected", async () => {
    const groupNode = createGroupNode()
    currentEditor = createEditorMock(groupNode)
    currentEditor.state.document.edges = [
      {
        fromNode: "text-1",
        fromSide: "right",
        id: "edge-1",
        label: "Group edge",
        toNode: "text-2",
        toSide: "left",
      },
    ]
    currentEditor.getEdgePath = vi.fn(() => "M 120 120 C 200 120, 280 120, 360 120")

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    const hitArea = wrapper.find("[data-testid='edge-hit-area-edge-1']")
    expect(hitArea.exists()).toBe(true)

    await hitArea.trigger("mouseenter")
    expect(wrapper.find("[data-testid='edge-overlay-edge-1']").classes()).toContain("stage__edge--hovered")

    await hitArea.trigger("click")
    expect(currentEditor.selectEdge).toHaveBeenCalledWith("edge-1")

    await hitArea.trigger("mouseleave")
    expect(wrapper.find("[data-testid='edge-overlay-edge-1']").classes()).not.toContain("stage__edge--hovered")
  })

  it("renders four edge resize handles, one corner resize handle, and four connection anchors for each card", () => {
    const node = createTextNode()
    currentEditor = createEditorMock(node)

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.findAll("[data-testid^='node-resize-']")).toHaveLength(5)
    expect(wrapper.findAll("[data-testid^='node-anchor-']")).toHaveLength(4)
    expect(wrapper.find("[data-testid='node-resize-corner']").exists()).toBe(true)
  })

  it("wires edge handles and anchors to the side-aware editor actions", async () => {
    const node = createTextNode()
    currentEditor = createEditorMock(node)

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    await wrapper.find("[data-testid='node-resize-left']").trigger("pointerdown")
    await wrapper.find("[data-testid='node-resize-right']").trigger("pointerdown")
    await wrapper.find("[data-testid='node-resize-corner']").trigger("pointerdown")
    await wrapper.find("[data-testid='node-anchor-top']").trigger("pointerdown")
    await wrapper.find("[data-testid='node-anchor-bottom']").trigger("pointerdown")

    expect(currentEditor.startResize).toHaveBeenNthCalledWith(1, node, "left", expect.anything())
    expect(currentEditor.startResize).toHaveBeenNthCalledWith(2, node, "right", expect.anything())
    expect(currentEditor.startCornerResize).toHaveBeenCalledWith(node, expect.anything())
    expect(currentEditor.startConnectionDrag).toHaveBeenNthCalledWith(1, node, "top", expect.anything())
    expect(currentEditor.startConnectionDrag).toHaveBeenNthCalledWith(2, node, "bottom", expect.anything())
  })

  it("removes retired top toolbar buttons and keeps file controls", () => {
    currentEditor = createEditorMock()

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    const toolbarText = wrapper.find(".toolbar").text()

    expect(toolbarText).toContain("新建")
    expect(toolbarText).toContain("打开")
    expect(toolbarText).toContain("保存")
    expect(toolbarText).not.toContain("导出")
    expect(toolbarText).not.toContain("设置")
    expect(toolbarText).not.toContain("文本")
    expect(toolbarText).not.toContain("文件")
    expect(toolbarText).not.toContain("链接")
    expect(toolbarText).not.toContain("分组")
    expect(toolbarText).not.toContain("删除")
  })

  it("wires stage interaction to canvas-surface activation and renders the bottom toolbar when active", async () => {
    currentEditor = createEditorMock()
    currentEditor.bottomToolbarVisible = true

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    await wrapper.find(".stage").trigger("pointerdown")

    expect(currentEditor.activateCanvasSurface).toHaveBeenCalled()
    expect(wrapper.find("[data-testid='bottom-toolbar']").exists()).toBe(true)
  })

  it("does not zoom the canvas when wheeling inside a selected node", async () => {
    const node = createTextNode()
    currentEditor = createEditorMock(node)
    currentEditor.state.selectedNodeIds = [node.id]

    const wrapper = mount(CanvasWorkspace, {
      attachTo: document.body,
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    wrapper.find(".canvas-node__body").element.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    }))
    await nextTick()

    expect(currentEditor.handleWheelZoom).not.toHaveBeenCalled()
  })

  it("keeps canvas zoom enabled when wheeling over an unselected node", async () => {
    const node = createTextNode()
    currentEditor = createEditorMock(node)

    const wrapper = mount(CanvasWorkspace, {
      attachTo: document.body,
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    wrapper.find(".canvas-node__body").element.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    }))
    await nextTick()

    expect(currentEditor.handleWheelZoom).toHaveBeenCalledTimes(1)
  })

  it("opens the create-edge dialog from the bottom toolbar", async () => {
    currentEditor = createEditorMock()
    currentEditor.bottomToolbarVisible = true

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    await wrapper.find("[data-testid='bottom-toolbar-connect']").trigger("click")

    expect(currentEditor.openCreateEdgeDialog).toHaveBeenCalledTimes(1)
  })

  it("opens the file picker from the bottom toolbar file button", async () => {
    currentEditor = createEditorMock()
    currentEditor.bottomToolbarVisible = true

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    await wrapper.find("[data-testid='bottom-toolbar-file']").trigger("click")

    expect(currentEditor.openFilePickerDialog).toHaveBeenCalledTimes(1)
  })

  it("renders the file picker dialog and rich document preview card", () => {
    currentEditor = createEditorMock({
      id: "file-1",
      file: "/data/roadmap.sy",
      type: "file",
    })
    currentEditor.filePickerDialog.visible = true
    currentEditor.filePickerDialog.groups.documents = [{
      kind: "document",
      path: "/data/roadmap.sy",
      subtitle: "/Projects/Roadmap",
      title: "Roadmap",
    }]
    currentEditor.getFileNodePreview = vi.fn(() => ({
      badge: "Document",
      clampMode: "viewport",
      detail: "/Projects/Roadmap",
      headline: "Roadmap",
      helper: "Opens in SiYuan",
      kind: "document",
      previewHtml: "<p>Preview</p>",
    }))

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='file-picker-dialog']").exists()).toBe(true)
    expect(wrapper.find(".file-card__document-preview").html()).toContain("Preview")
  })

  it("renders all file picker result kinds in the dialog", () => {
    currentEditor = createEditorMock()
    currentEditor.filePickerDialog.visible = true
    currentEditor.filePickerDialog.groups.documents = [{
      kind: "document",
      path: "/data/roadmap.sy",
      subtitle: "/Projects/Roadmap",
      title: "Roadmap",
    }]
    currentEditor.filePickerDialog.groups.blocks = [{
      blockId: "20260412094047-block01",
      kind: "block",
      path: "20260412094047-block01",
      subtitle: "/Projects/Roadmap",
      title: "Road block",
    }]
    currentEditor.filePickerDialog.groups.canvases = [{
      kind: "canvas",
      path: "/data/storage/siyuan-canvas/road.canvas",
      subtitle: "/data/storage/siyuan-canvas/road.canvas",
      title: "road.canvas",
    }]
    currentEditor.filePickerDialog.groups.images = [{
      kind: "image",
      path: "assets/road.png",
      subtitle: "assets/road.png",
      title: "road.png",
    }]

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='file-picker-option-document']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='file-picker-option-block']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='file-picker-option-canvas']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='file-picker-option-image']").exists()).toBe(true)
  })

  it("renders a block preview card without title or path and exposes the path as a tooltip", () => {
    currentEditor = createEditorMock({
      id: "file-block-1",
      file: "20260412094047-block01",
      type: "file",
    })
    currentEditor.getFileNodePreview = vi.fn(() => ({
      badge: "Block",
      clampMode: "viewport",
      detail: "/Projects/Roadmap",
      headline: "Road block",
      helper: "Opens block in SiYuan",
      kind: "block",
      previewHtml: "<ul><li>第一项</li></ul>",
    }))

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    const fileCard = wrapper.find(".file-card")

    expect(fileCard.attributes("title")).toBe("/Projects/Roadmap")
    expect(wrapper.find(".file-card__document-preview").html()).toContain("第一项")
    expect(fileCard.text()).not.toContain("Road block")
    expect(fileCard.text()).not.toContain("/Projects/Roadmap")
  })

  it("renders a document preview card with the title and content while moving the path to a tooltip", () => {
    currentEditor = createEditorMock({
      id: "file-document-1",
      file: "/data/spec.sy",
      type: "file",
    })
    currentEditor.getFileNodePreview = vi.fn(() => ({
      badge: "Document",
      clampMode: "viewport",
      detail: "/Projects/Canvas/Spec",
      headline: "Spec",
      helper: "Opens in SiYuan",
      kind: "document",
      previewHtml: "<p>Document preview</p>",
    }))

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    const fileCard = wrapper.find(".file-card")

    expect(fileCard.attributes("title")).toBe("/Projects/Canvas/Spec")
    expect(fileCard.text()).toContain("Spec")
    expect(fileCard.text()).not.toContain("/Projects/Canvas/Spec")
    expect(wrapper.find(".file-card__document-preview").html()).toContain("Document preview")
  })

  it("keeps mouse wheel events inside the file picker dialog instead of zooming the canvas", async () => {
    currentEditor = createEditorMock()
    currentEditor.filePickerDialog.visible = true
    currentEditor.filePickerDialog.groups.documents = [{
      kind: "document",
      path: "/data/roadmap.sy",
      subtitle: "/Projects/Roadmap",
      title: "Roadmap",
    }]

    const wrapper = mount(CanvasWorkspace, {
      attachTo: document.body,
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    wrapper.find("[data-testid='file-picker-dialog'] .canvas-dialog").element.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    }))
    await nextTick()

    expect(currentEditor.handleWheelZoom).not.toHaveBeenCalled()
  })

  it("renders a canvas thumbnail preview for nested canvas file cards", () => {
    currentEditor = createEditorMock({
      id: "file-canvas-1",
      file: "/data/storage/siyuan-canvas/road.canvas",
      type: "file",
    })
    currentEditor.getFileNodePreview = vi.fn(() => ({
      badge: "Canvas",
      detail: "/data/storage/siyuan-canvas/road.canvas",
      headline: "road.canvas",
      helper: "Opens nested canvas",
      kind: "canvas",
      thumbnail: {
        edges: [{
          fromX: 40,
          fromY: 50,
          toX: 180,
          toY: 140,
        }],
        nodes: [
          {
            height: 72,
            width: 120,
            x: 0,
            y: 0,
          },
          {
            height: 72,
            width: 120,
            x: 140,
            y: 104,
          },
        ],
      },
    }))

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find(".file-card__canvas-preview").exists()).toBe(true)
    expect(wrapper.findAll(".file-card__thumbnail-node")).toHaveLength(2)
    expect(wrapper.findAll(".file-card__thumbnail-edge")).toHaveLength(1)
  })

  it("falls back to an alternate asset path when an image file preview fails to load", async () => {
    currentEditor = createEditorMock({
      id: "file-image-1",
      file: "assets/road.png",
      type: "file",
    })
    currentEditor.getFileNodePreview = vi.fn(() => ({
      badge: "Image",
      detail: "assets/road.png",
      headline: "road.png",
      helper: "Image file",
      imageSrc: "/data/assets/road.png",
      kind: "image",
    }))

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    const image = wrapper.find(".file-card__image")
    expect(image.exists()).toBe(true)
    expect(image.attributes("src")).toBe("/data/assets/road.png")

    await image.trigger("error")

    expect(wrapper.find(".file-card__image").attributes("src")).toBe("/assets/road.png")
  })

  it("renders the create-edge dialog when requested", () => {
    currentEditor = createEditorMock()
    currentEditor.createEdgeDialog.visible = true
    const sourceNode = createTextNode({ id: "source-1", text: "#### 为说而听" })
    const targetNode = createTextNode({ id: "target-1", text: "关系——情况这么复杂，任务这么困难，我们应该如何应对？" })
    currentEditor.state.document.nodes = [sourceNode, targetNode]
    currentEditor.displayNodes = [sourceNode, targetNode]
    currentEditor.edgeSources = [sourceNode]
    currentEditor.edgeTargets = [targetNode]
    currentEditor.newEdgeSourceId = "source-1"
    currentEditor.newEdgeTargetId = "target-1"

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='create-edge-dialog']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='create-edge-source-trigger']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='create-edge-target-trigger']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='create-edge-source-query']").exists()).toBe(false)
    expect(wrapper.find("[data-testid='create-edge-target-query']").exists()).toBe(false)
    expect(wrapper.find("[data-testid='create-edge-source-trigger']").text()).toContain("#### 为说而听")
    expect(wrapper.find("[data-testid='create-edge-target-trigger']").text()).toContain("关系——情况这么复杂")
  })

  it("opens the embedded source search field inside the dropdown panel", async () => {
    currentEditor = createEditorMock()
    currentEditor.createEdgeDialog.visible = true
    const firstSource = createTextNode({ id: "source-1", text: "#### 为说而听" })
    const secondSource = createTextNode({ id: "source-2", text: "Another node" })
    currentEditor.state.document.nodes = [firstSource, secondSource]
    currentEditor.displayNodes = [firstSource, secondSource]
    currentEditor.edgeSources = [firstSource, secondSource]
    currentEditor.newEdgeSourceId = "source-1"

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    await wrapper.find("[data-testid='create-edge-source-trigger']").trigger("click")

    expect(wrapper.find("[data-testid='create-edge-source-query']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='create-edge-source-options']").exists()).toBe(true)
    expect(wrapper.findAll("[data-testid='create-edge-source-option']")).toHaveLength(2)
  })

  it("hides a collapsed inspector section body and wires the section toggle", async () => {
    currentEditor = createEditorMock()
    currentEditor.inspectorSectionState.document = false

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='inspector-section-document-body']").exists()).toBe(false)

    await wrapper.find("[data-testid='inspector-section-document-toggle']").trigger("click")

    expect(currentEditor.toggleInspectorSection).toHaveBeenCalledWith("document")
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
    expect(wrapper.find("[data-testid='selection-toolbar-delete']").attributes("title")).toBe("删除")
    expect(wrapper.find("[data-testid='selection-toolbar-delete']").attributes("aria-label")).toBe("删除")
    expect(wrapper.find("[data-testid='selection-toolbar-delete'] .selection-toolbar__icon").exists()).toBe(true)
    expect(wrapper.find("[data-testid='selection-toolbar-delete']").text()).toBe("")
    expect(wrapper.find("[data-testid='selection-toolbar-color']").attributes("title")).toBe("颜色")
    expect(wrapper.find("[data-testid='selection-toolbar-center']").attributes("title")).toBe("聚焦")
    expect(wrapper.find("[data-testid='selection-toolbar-edit']").attributes("title")).toBe("编辑")

    await wrapper.find("[data-testid='selection-toolbar-color']").trigger("click")

    expect(currentEditor.toggleSelectionPopover).toHaveBeenCalledWith("color")
  })

  it("updates the floating toolbar theme class when the canvas theme mode changes", async () => {
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
      attachTo: document.body,
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    const shell = wrapper.find("[data-testid='canvas-shell']").element as HTMLElement
    shell.setAttribute("data-theme-mode", "dark")
    await nextTick()
    await Promise.resolve()

    expect(wrapper.find("[data-testid='selection-toolbar']").classes()).toContain("selection-toolbar--dark")

    shell.setAttribute("data-theme-mode", "light")
    await nextTick()
    await Promise.resolve()

    expect(wrapper.find("[data-testid='selection-toolbar']").classes()).toContain("selection-toolbar--light")
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
    expect(wrapper.find("[data-testid='selection-toolbar-create-group']").attributes("title")).toBe("创建分组")
    expect(wrapper.find("[data-testid='selection-toolbar-align']").attributes("title")).toBe("对齐")
    expect(wrapper.find("[data-testid='selection-layout-menu']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='selection-layout-action-left-align']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='selection-layout-action-left-align']").attributes("title")).toBe("Left align")
    expect(wrapper.find("[data-testid='selection-layout-action-left-align'] .selection-toolbar__menu-icon").exists()).toBe(true)

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

    expect(card.style.borderColor).toBe("rgb(249, 115, 22)")
    expect(card.style.backgroundColor).toBe("rgba(249, 115, 22, 0.18)")
  })

  it("renders a visible group label text color from node.color using the shared selection color mapping", () => {
    const node = createGroupNode({ color: "1" })
    currentEditor = createEditorMock(node)

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    const label = wrapper.find(".canvas-node__content").element as HTMLElement

    expect(label.style.color).toBe("rgb(239, 68, 68)")
  })

  it("renders a clear swatch first and marks the current selection color as active", async () => {
    const node = createTextNode({ color: "1" })
    currentEditor = createEditorMock(node)
    currentEditor.selectionColors = ["1", "2", "3", "4", "5", "6"]
    currentEditor.selectionToolbar = {
      placement: "top",
      visible: true,
      x: 144,
      y: 88,
    }
    currentEditor.selectionToolbarPopover = "color"
    currentEditor.state.selectedNodeIds = [node.id]

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    const swatches = wrapper.findAll(".selection-toolbar__swatch")

    expect(swatches).toHaveLength(7)
    expect(swatches[0]?.attributes("data-testid")).toBe("selection-color-clear")
    expect(wrapper.find("[data-testid='selection-color-clear']").classes()).not.toContain("selection-toolbar__swatch--active")
    expect(wrapper.find("[data-testid='selection-color-1']").classes()).toContain("selection-toolbar__swatch--active")

    await wrapper.find("[data-testid='selection-color-clear']").trigger("click")

    expect(currentEditor.applySelectionColor).toHaveBeenCalledWith("")
  })

  it("closes the open selection popover when clicking outside the toolbar", async () => {
    currentEditor = createEditorMock()
    currentEditor.selectionToolbar = {
      placement: "top",
      visible: true,
      x: 144,
      y: 88,
    }
    currentEditor.selectionToolbarPopover = "color"
    currentEditor.state.selectedNodeIds = ["text-1"]

    mount(CanvasWorkspace, {
      attachTo: document.body,
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))

    expect(currentEditor.closeSelectionPopover).toHaveBeenCalledTimes(1)
  })

  it("renders a floating edge toolbar with an icon-triggered direction dropdown", async () => {
    currentEditor = createEditorMock()
    currentEditor.state.document.edges = [{
      color: "2",
      endArrow: true,
      fromNode: "text-1",
      fromSide: "bottom",
      id: "edge-1",
      label: "flow",
      startArrow: false,
      toNode: "text-2",
      toSide: "top",
    }]
    currentEditor.state.selectedEdgeId = "edge-1"
    currentEditor.selectedEdge = currentEditor.state.document.edges[0]
    currentEditor.edgeToolbar = {
      placement: "top",
      visible: true,
      x: 200,
      y: 120,
    }
    currentEditor.edgeToolbarPopover = "direction"

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='edge-toolbar']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='edge-toolbar-delete']").attributes("title")).toBe("删除")
    expect(wrapper.find("[data-testid='edge-toolbar-color']").attributes("title")).toBe("颜色")
    expect(wrapper.find("[data-testid='edge-toolbar-center']").attributes("title")).toBe("聚焦")
    expect(wrapper.find("[data-testid='edge-toolbar-direction-trigger']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='edge-direction-menu']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='edge-toolbar-edit-label']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='edge-toolbar-direction-single']").classes()).toContain("selection-toolbar__menu-button--active")
    expect(wrapper.find("[data-testid='edge-toolbar-direction-none']").classes()).not.toContain("selection-toolbar__menu-button--active")

    await wrapper.find("[data-testid='edge-toolbar-direction-trigger']").trigger("click")
    expect(currentEditor.toggleEdgePopover).toHaveBeenCalledWith("direction")

    await wrapper.find("[data-testid='edge-toolbar-direction-both']").trigger("click")

    expect(currentEditor.updateSelectedEdgeDirection).toHaveBeenCalledWith("both")
  })

  it("highlights the current edge direction in the dropdown for a legacy single-direction edge", () => {
    currentEditor = createEditorMock()
    currentEditor.state.document.edges = [{
      fromNode: "text-1",
      fromSide: "right",
      id: "edge-1",
      toNode: "text-2",
      toSide: "left",
    }]
    currentEditor.state.selectedEdgeId = "edge-1"
    currentEditor.selectedEdge = currentEditor.state.document.edges[0]
    currentEditor.selectedEdgeDirectionMode = "single"
    currentEditor.edgeToolbar = {
      placement: "top",
      visible: true,
      x: 200,
      y: 120,
    }
    currentEditor.edgeToolbarPopover = "direction"

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='edge-toolbar-direction-single']").classes()).toContain("selection-toolbar__menu-button--active")
    expect(wrapper.find("[data-testid='edge-toolbar-direction-none']").classes()).not.toContain("selection-toolbar__menu-button--active")
  })

  it("renders selected edge endpoint handles and wires them to edge endpoint dragging", async () => {
    currentEditor = createEditorMock()
    currentEditor.state.document.edges = [{
      fromNode: "text-1",
      fromSide: "right",
      id: "edge-1",
      toNode: "text-2",
      toSide: "left",
    }]
    currentEditor.state.selectedEdgeId = "edge-1"
    currentEditor.selectedEdge = currentEditor.state.document.edges[0]
    currentEditor.selectedEdgeHandlePositions = {
      from: { x: 280, y: 140 },
      to: { x: 420, y: 180 },
    }

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='edge-endpoint-from']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='edge-endpoint-to']").exists()).toBe(true)

    await wrapper.find("[data-testid='edge-endpoint-to']").trigger("pointerdown")

    expect(currentEditor.startEdgeEndpointDrag).toHaveBeenCalledWith("to", expect.anything())
  })

  it("renders dual edge markers and persists inline edge label edits on input", async () => {
    currentEditor = createEditorMock()
    currentEditor.state.document.edges = [{
      color: "4",
      endArrow: true,
      fromNode: "text-1",
      fromSide: "bottom",
      id: "edge-1",
      label: "old",
      startArrow: true,
      toNode: "text-2",
      toSide: "top",
    }]
    currentEditor.state.selectedEdgeId = "edge-1"
    currentEditor.selectedEdge = currentEditor.state.document.edges[0]
    currentEditor.edgeLabelDraft = "old"
    currentEditor.editingEdgeLabelId = "edge-1"
    currentEditor.edgeLabelEditorPosition = { x: 320, y: 180 }
    currentEditor.getEdgeLabelPosition = vi.fn(() => ({ x: 320, y: 180 }))
    currentEditor.getEdgePath = vi.fn(() => "M 100 100 C 140 140, 280 220, 320 260")

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find(".stage__edge").attributes("marker-start")).toBe("url(#canvas-edge-arrow-start)")
    expect(wrapper.find(".stage__edge").attributes("marker-end")).toBe("url(#canvas-edge-arrow-end)")
    expect(wrapper.find("[data-testid='edge-label-editor']").exists()).toBe(true)

    await wrapper.find("[data-testid='edge-label-editor']").setValue("updated")

    expect(currentEditor.updateEditingEdgeLabel).toHaveBeenCalledWith("updated")

    await wrapper.find("[data-testid='edge-label-editor']").trigger("blur")

    expect(currentEditor.submitEdgeLabelEditing).toHaveBeenCalledTimes(1)
  })

  it("renders a reconnect preview line while dragging an edge endpoint", () => {
    currentEditor = createEditorMock()
    currentEditor.edgeReconnectDraft = {
      edgeId: "edge-1",
      endpoint: "to",
      targetNodeId: "",
      targetSide: "",
      toX: 340,
      toY: 280,
      visible: true,
    }
    currentEditor.getEdgeReconnectDraftPath = vi.fn(() => "M 280 140 C 320 140, 340 280, 340 280")

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find("[data-testid='edge-reconnect-draft']").exists()).toBe(true)
    expect(wrapper.find("[data-testid='edge-reconnect-draft']").attributes("d")).toContain("340 280")
  })

  it("removes the extra right-side gutter when the inspector is collapsed", () => {
    currentEditor = createEditorMock()
    currentEditor.inspectorExpanded = false

    const wrapper = mount(CanvasWorkspace, {
      attachTo: document.body,
      props: {
        bootstrap: {},
        plugin: {},
        setTitle: vi.fn(),
      },
    })

    expect(wrapper.find(".workspace").attributes("style")).toContain("grid-template-columns: 1fr 0px;")
    expect(wrapper.find(".workspace__inspector-handle").attributes("style")).toContain("right: 8px;")
  })

  it("renders toolbar and sidebar labels in Chinese from plugin i18n", () => {
    currentEditor = createEditorMock()
    currentEditor.suggestedFilename = ""
    currentEditor.bottomToolbarVisible = true

    const wrapper = mount(CanvasWorkspace, {
      props: {
        bootstrap: {},
        plugin: createPluginMock(),
        setTitle: vi.fn(),
      },
    })

    const toolbarText = wrapper.find(".toolbar").text()
    const inspectorText = wrapper.find(".inspector").text()

    expect(toolbarText).toContain("新建")
    expect(toolbarText).toContain("打开")
    expect(toolbarText).toContain("保存")
    expect(toolbarText).toContain("未命名.canvas")
    expect(toolbarText).toContain("1 个节点 / 0 条连线")
    expect(toolbarText).toContain("已保存")
    expect(wrapper.find("[data-testid='bottom-toolbar-text']").attributes("title")).toBe("文本")
    expect(wrapper.find("[data-testid='bottom-toolbar-file']").attributes("title")).toBe("文件")
    expect(wrapper.find("[data-testid='bottom-toolbar-connect']").attributes("title")).toBe("创建连线")
    expect(wrapper.find("[data-testid='bottom-toolbar-group']").attributes("title")).toBe("分组")
    expect(wrapper.find(".workspace__inspector-handle").attributes("title")).toBe("收起侧栏")
    expect(inspectorText).toContain("文档")
    expect(inspectorText).toContain("未保存的工作区路径")
    expect(inspectorText).toContain("已同步")
    expect(inspectorText).toContain("当前工作区目录下暂无 Canvas 文件。")
    expect(inspectorText).toContain("最近打开")
    expect(inspectorText).toContain("暂无最近打开的工作区文件。")
    expect(inspectorText).toContain("节点")
    expect(inspectorText).toContain("创建连线")
  })
})

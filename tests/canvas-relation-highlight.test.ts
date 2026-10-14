/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"
import {
  reactive,
  ref,
  nextTick,
} from "vue"
import CanvasWorkspace from "@/components/canvas/CanvasWorkspace.vue"
import { createDefaultCanvasPluginSettings } from "@/canvas/plugin-data"

let currentEditor: Record<string, any>

vi.mock("@/canvas/use-canvas-editor", () => ({
  useCanvasEditor: () => currentEditor,
}))

function createTextNode(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "text",
    text: `Content of ${id}`,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...overrides,
  }
}

function createEditorMock(nodes = [createTextNode("node-1")]) {
  return reactive({
    addNode: vi.fn(),
    activateNode: vi.fn(),
    activateCanvasSurface: vi.fn(),
    applySelectionColor: vi.fn(),
    applySelectionLayout: vi.fn(),
    alignmentGuides: {
      guides: [],
      visible: false,
    },
    board: ref({
      height: 4200,
      left: -2800,
      top: -2100,
      width: 5600,
    }),
    bottomToolbarVisible: false,
    canDelete: false,
    canRefreshSelectedSiyuanNode: false,
    centerSelectionInViewport: vi.fn(),
    centerEdgeInViewport: vi.fn(),
    closeCreateEdgeDialog: vi.fn(),
    closeFilePickerDialog: vi.fn(),
    closeSelectionPopover: vi.fn(),
    closeEdgePopover: vi.fn(),
    createEdgeDialog: { visible: false },
    filePickerDialog: {
      groups: { blocks: [], canvases: [], documents: [], images: [] },
      query: "",
      visible: false,
    },
    createGroupFromSelection: vi.fn(),
    createEdgeFromSelection: vi.fn(),
    connectionDraft: { toX: 0, toY: 0, visible: false },
    deactivateCanvasSurface: vi.fn(),
    deleteSelection: vi.fn(),
    displayNodes: nodes,
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
    edgeToolbar: { placement: "top", visible: false, x: 0, y: 0 },
    edgeToolbarPopover: "closed",
    edgeTargets: [],
    edgeSources: nodes,
    editingEdgeLabelId: "",
    exportCanvas: vi.fn(),
    exportCanvasPng: vi.fn(),
    finishConnectionDrag: vi.fn(),
    getEdgeLabelPosition: vi.fn(() => ({ x: 50, y: 50 })),
    getEdgePath: vi.fn(() => "M 0 0 L 100 100"),
    getConnectionDraftPath: vi.fn(() => "M 0 0 L 100 100"),
    getEdgeReconnectDraftPath: vi.fn(() => "M 0 0 L 100 100"),
    getFileName: vi.fn(() => "mock.canvas"),
    getFileNodeDescription: vi.fn(() => ""),
    getFileNodeKind: vi.fn(() => "document"),
    getFileNodePreview: vi.fn(() => ({})),
    getNodeStyle: vi.fn(() => ({
      height: "100px",
      left: "0px",
      top: "0px",
      width: "200px",
    })),
    getNodeTitle: vi.fn((candidate: any) => candidate.text || candidate.id || "Text"),
    getPluginSettings: vi.fn(() => createDefaultCanvasPluginSettings()),
    getRenderedMarkdown: vi.fn((text: string) => `<p>${text}</p>`),
    handleNodePointerDown: vi.fn(),
    handleStageWheel: vi.fn(),
    isConnectionTarget: vi.fn(() => false),
    isRelatedEdge: vi.fn((edgeId: string) => edgeId === "edge-1"),
    isRelatedNode: vi.fn((nodeId: string) => nodeId === "node-2"),
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
    newEdgeSourceId: nodes[0]?.id || "",
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
    searchDecorations: [],
    refreshSelectedSiyuanNode: vi.fn(),
    resetViewport: vi.fn(),
    save: vi.fn(),
    selectedEdgeHandlePositions: null,
    selectEdge: vi.fn(),
    selectedEdge: null,
    selectedEdgeDirectionMode: "single",
    selectedNode: nodes[0] || null,
    selectedNodeCount: 1,
    selectionBox: { height: 0, visible: false, width: 0, x: 0, y: 0 },
    selectionColors: ["1", "2", "3"],
    selectionLayoutActions: [],
    selectionToolbar: { placement: "top", visible: false, x: 0, y: 0 },
    selectionToolbarPopover: "closed",
    selectFilePickerResult: vi.fn(),
    selectNode: vi.fn(),
    setNewEdgeSourceId: vi.fn(),
    setNewEdgeTargetId: vi.fn(),
    setSelectionToolbarSize: vi.fn(),
    setEdgeToolbarSize: vi.fn(),
    startConnectionDrag: vi.fn(),
    startCornerResize: vi.fn(),
    startDrag: vi.fn(),
    startEdgeEndpointDrag: vi.fn(),
    startEdgeLabelEditing: vi.fn(),
    submitEdgeLabelEditing: vi.fn(),
    cancelEdgeLabelEditing: vi.fn(),
    updateEditingEdgeLabel: vi.fn(),
    startPan: vi.fn(),
    startResize: vi.fn(),
    state: {
      conflict: null,
      document: {
        edges: [
          { id: "edge-1", fromNode: "node-1", fromSide: "right", toNode: "node-2", toSide: "left", label: "Rel-1" },
          { id: "edge-2", fromNode: "node-2", fromSide: "right", toNode: "node-3", toSide: "left", label: "Rel-2" },
        ],
        nodes,
      },
      filePath: "/test.canvas",
      isDirty: false,
      issues: { errors: [], warnings: [] },
      lastSavedRaw: "{}",
      pendingEditNodeId: "",
      selectedEdgeId: "",
      selectedNodeId: "node-1",
      selectedNodeIds: ["node-1"],
    },
    submitCreateEdgeDialog: vi.fn(),
    suggestedFilename: "test.canvas",
    toggleInspectorSection: vi.fn(),
    updateFilePickerQuery: vi.fn(),
    updateTextNodeContent: vi.fn(),
    convertTextToLink: vi.fn(),
    convertLinkToText: vi.fn(),
    convertSelectionToDocument: vi.fn(),
    convertSelectionToText: vi.fn(),
    updateEdgeField: vi.fn(),
    updateEdgeSide: vi.fn(),
    applySelectedNodeChanges: vi.fn(),
    updateNodeField: vi.fn(),
    updateNumericNodeField: vi.fn(),
    updateSelectedNodeZIndex: vi.fn(),
    moveSelectedNodeZIndex: vi.fn(),
    moveSelectedNodeToBottom: vi.fn(),
    moveSelectedNodeToTop: vi.fn(),
    viewport: ref({ x: 0, y: 0, zoom: 1 }),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomToActualSize: vi.fn(),
    zoomToFit: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    readonly: false,
    isSaving: false,
    duplicateSelection: vi.fn(),
    handleClipboardImagePaste: vi.fn(),
    handleStageDragOver: vi.fn(),
    handleStageDrop: vi.fn(),
    decomposeSelectedDocument: vi.fn(),
    expandAllFolders: vi.fn(),
    collapseAllFolders: vi.fn(),
    allFoldersExpanded: false,
    expandedFolders: [],
    setWorkspaceSortDirection: vi.fn(),
    setWorkspaceSortField: vi.fn(),
    toggleFolderExpand: vi.fn(),
    workspaceDocuments: [],
    workspaceSortDirection: "asc",
    workspaceSortField: "title",
    colorThemeId: "classic",
    colorThemes: [],
    currentColorStyles: {},
    setColorTheme: vi.fn(),
    toggleInspector: vi.fn(),
    toggleGroupCollapse: vi.fn(),
    toggleEdgePopover: vi.fn(),
    toggleSelectionPopover: vi.fn(),
    updateSelectedEdgeDirection: vi.fn(),
    presentation: {
      isActive: false,
      currentNodeId: null,
      availableNextNodes: [],
      pathHistory: [],
    },
    relatedEdgeIds: new Set(["edge-1"]),
    relatedNodeIds: new Set(["node-2"]),
    settings: createDefaultCanvasPluginSettings(),
    defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas",
  })
}

function mountWorkspace(editor = currentEditor) {
  const pluginMock = {
    getCanvasSettings: () => editor.settings,
    updateCanvasSettings: vi.fn(),
    getRecentCanvasFiles: () => [],
    i18n: {},
  }

  return mount(CanvasWorkspace, {
    props: {
      bootstrap: {} as any,
      plugin: pluginMock as any,
      setTitle: vi.fn(),
    },
  })
}

describe("Canvas Node & Edge Relationship Highlighting", () => {
  it("renders stage__edge--related and stage__edge-label--related for related edges", async () => {
    const nodes = [
      createTextNode("node-1"),
      createTextNode("node-2"),
      createTextNode("node-3"),
    ]
    currentEditor = createEditorMock(nodes)
    currentEditor.isRelatedEdge = vi.fn((id: string) => id === "edge-1")
    currentEditor.isRelatedNode = vi.fn((id: string) => id === "node-2")

    const wrapper = mountWorkspace()
    await nextTick()

    // Base edge 1 should have stage__edge--related
    const edgePaths = wrapper.findAll(".stage__edges path.stage__edge")
    const edge1Path = edgePaths.find(p => p.attributes("class")?.includes("stage__edge--related"))
    expect(edge1Path).toBeDefined()

    // Base edge label for edge-1 should have stage__edge-label--related
    const labels = wrapper.findAll(".stage__edge-label")
    const edge1Label = labels.find(l => l.text() === "Rel-1")
    expect(edge1Label?.classes()).toContain("stage__edge-label--related")

    // Edge 2 should NOT have stage__edge-label--related
    const edge2Label = labels.find(l => l.text() === "Rel-2")
    expect(edge2Label?.classes()).not.toContain("stage__edge-label--related")
  })

  it("renders canvas-node--neighbor-highlight for adjacent connected nodes", async () => {
    const nodes = [
      createTextNode("node-1"),
      createTextNode("node-2"),
      createTextNode("node-3"),
    ]
    currentEditor = createEditorMock(nodes)
    currentEditor.isRelatedEdge = vi.fn((id: string) => id === "edge-1")
    currentEditor.isRelatedNode = vi.fn((id: string) => id === "node-2")

    const wrapper = mountWorkspace()
    await nextTick()

    const node1 = wrapper.find('[data-canvas-node-id="node-1"]')
    const node2 = wrapper.find('[data-canvas-node-id="node-2"]')
    const node3 = wrapper.find('[data-canvas-node-id="node-3"]')

    // node-1 is selected, so it has canvas-node--selected
    expect(node1.classes()).toContain("canvas-node--selected")
    expect(node1.classes()).not.toContain("canvas-node--neighbor-highlight")

    // node-2 is neighbor, so it has canvas-node--neighbor-highlight
    expect(node2.classes()).toContain("canvas-node--neighbor-highlight")
    expect(node2.classes()).not.toContain("canvas-node--selected")

    // node-3 is unrelated, has neither
    expect(node3.classes()).not.toContain("canvas-node--neighbor-highlight")
    expect(node3.classes()).not.toContain("canvas-node--selected")
  })

  it("renders interactive overlay edge with stage__edge--related and stage__edge--visible", async () => {
    const nodes = [
      createTextNode("node-1"),
      createTextNode("node-2"),
    ]
    currentEditor = createEditorMock(nodes)
    currentEditor.isRelatedEdge = vi.fn((id: string) => id === "edge-1")

    const wrapper = mountWorkspace()
    await nextTick()

    const overlayEdge1 = wrapper.find('[data-testid="edge-overlay-edge-1"]')
    expect(overlayEdge1.exists()).toBe(true)
    expect(overlayEdge1.classes()).toContain("stage__edge--related")
    expect(overlayEdge1.classes()).toContain("stage__edge--visible")

    const overlayEdge2 = wrapper.find('[data-testid="edge-overlay-edge-2"]')
    expect(overlayEdge2.exists()).toBe(true)
    expect(overlayEdge2.classes()).not.toContain("stage__edge--related")
  })
})

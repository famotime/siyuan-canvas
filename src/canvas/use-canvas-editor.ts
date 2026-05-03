import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasNodeLayoutAction,
  CanvasNode,
  CanvasSide,
} from "@/canvas/types"
import type { CanvasTabBootstrap } from "@/main"
import type {
  CanvasPluginUiState,
  CanvasPluginSettings,
  CanvasRecentFile,
} from "@/canvas/plugin-data"
import type { ResolvedCanvasFileTarget } from "@/canvas/file-target-resolution"
import type { CanvasFileTargetPreview } from "@/canvas/file-target-preview"
import type { CanvasPluginBridge } from "@/canvas/use-canvas-editor-shared"
import type { CanvasEditorFileSource } from "@/canvas/use-canvas-editor-shared"

import {
  openTab,
  showMessage,
} from "siyuan"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue"
import {
  readDir,
} from "@/api"
import {
  createCanvasBoardMetrics,
  toBoardX,
  toBoardY,
} from "@/canvas/board"
import {
  getCanvasSelectionBounds,
  setCanvasEdgeEndpoint,
  upsertCanvasEdge,
} from "@/canvas/document"
import { createCanvasEditorBindings } from "@/canvas/editor-bindings"
import { CanvasEditorState } from "@/canvas/editor-state"
import { createCanvasEditorFileActions } from "@/canvas/use-canvas-editor-file-actions"
import { createCanvasEditorFilePickerActions } from "@/canvas/use-canvas-editor-file-picker"
import { createCanvasEditorFileNodeHelpers } from "@/canvas/use-canvas-editor-file-nodes"
import {
  createCanvasEditorGestureHandlers,
  type CanvasEditorConnectionDraftState,
  type CanvasEditorEdgeReconnectDraftState,
  type CanvasEditorSelectionBoxState,
} from "@/canvas/use-canvas-editor-gestures"
import { initializeCanvasEditor, syncCanvasEditorSelectionUi } from "@/canvas/use-canvas-editor-lifecycle"
import { createCanvasEditorNodeActivationActions } from "@/canvas/use-canvas-editor-node-activation"
import { createCanvasEditorNodeEdgeActions } from "@/canvas/use-canvas-editor-node-edge-actions"
import { createCanvasEditorKeyboardHandler } from "@/canvas/use-canvas-editor-shortcuts"
import {
  getCanvasFileName,
} from "@/canvas/use-canvas-editor-shared"
import {
  CANVAS_DEFAULT_DIRECTORY,
  createDefaultCanvasPluginSettings,
  createDefaultCanvasPluginUiState,
} from "@/canvas/plugin-data"
import { CanvasFileService } from "@/canvas/file-service"
import {
  findSiyuanBlockById,
  findSiyuanDocumentByBlockId,
  findSiyuanBlocksByQuery,
  findSiyuanDocumentsByQuery,
  findSiyuanImageAssetByBlockId,
  findSiyuanImageAssetsByQuery,
} from "@/canvas/siyuan-kernel-file-node-lookups"
import {
  validateCanvasDocument,
} from "@/canvas/format"
import { createCanvasI18n } from "@/i18n/canvas"
import { getCanvasNodeAnchor } from "@/canvas/node-interaction"
import { SiyuanCanvasTextGateway } from "@/canvas/siyuan-text-gateway"
import {
  createEdgeCurvePath,
  getEdgeMidpointPosition,
  resolveEdgeToolbarPosition,
  resolveSelectionToolbarPosition,
} from "@/canvas/selection-toolbar"

const SIDES: CanvasSide[] = ["top", "right", "bottom", "left"]
const DEFAULT_SELECTION_TOOLBAR_SIZE = {
  height: 48,
  width: 220,
}
const SELECTION_COLORS = ["1", "2", "3", "4", "5", "6"] as const

export function useCanvasEditor(
  plugin: CanvasPluginBridge,
  bootstrap: CanvasTabBootstrap,
  setTitle: (title: string) => void,
) {
  const t = createCanvasI18n(plugin.i18n)
  const fileService = new CanvasFileService(new SiyuanCanvasTextGateway())
  const state = reactive(new CanvasEditorState(fileService))
  const viewport = reactive({
    scale: 1,
    x: 0,
    y: 0,
  })
  const fileInputRef = ref<HTMLInputElement>()
  const fileNodeMeta = ref<Record<string, ResolvedCanvasFileTarget & {
    detail: string
    excerptHtml?: string
    imageSrc?: string
    thumbnail?: CanvasFileTargetPreview["thumbnail"]
  }>>({})
  const fileSource = ref<CanvasEditorFileSource>(bootstrap.path ? "workspace" : "unsaved")
  const stageRef = ref<HTMLElement>()
  const recentFiles = ref<CanvasRecentFile[]>([])
  const workspaceDocuments = ref<Array<{ path: string, title: string }>>([])
  const suggestedFilename = ref(bootstrap.title || t("untitledCanvas"))
  const selectionToolbarPopover = ref<"closed" | "color" | "layout">("closed")
  const edgeToolbarPopover = ref<"closed" | "color" | "direction">("closed")
  const bottomToolbarVisible = ref(false)
  const createEdgeDialog = reactive({
    visible: false,
  })
  const filePickerDialog = reactive({
    groups: {
      blocks: [] as CanvasFilePickerOption[],
      canvases: [] as CanvasFilePickerOption[],
      documents: [] as CanvasFilePickerOption[],
      images: [] as CanvasFilePickerOption[],
    },
    query: "",
    visible: false,
  })
  const inspectorSectionState = reactive({
    ...(
      plugin.getCanvasUiState?.().inspectorSections
      ?? createDefaultCanvasPluginUiState().inspectorSections
    ),
  })
  const selectionToolbarSize = reactive({
    height: DEFAULT_SELECTION_TOOLBAR_SIZE.height,
    width: DEFAULT_SELECTION_TOOLBAR_SIZE.width,
  })
  const selectionBox = reactive<CanvasEditorSelectionBoxState>({
    height: 0,
    visible: false,
    width: 0,
    x: 0,
    y: 0,
  })
  const connectionDraft = reactive<CanvasEditorConnectionDraftState>({
    fromNodeId: "",
    fromSide: "right" as CanvasSide,
    toNodeId: "",
    toSide: "left" as CanvasSide,
    toX: 0,
    toY: 0,
    visible: false,
  })
  const edgeReconnectDraft = reactive<CanvasEditorEdgeReconnectDraftState>({
    edgeId: "",
    endpoint: "",
    targetNodeId: "",
    targetSide: "",
    toX: 0,
    toY: 0,
    visible: false,
  })
  const newEdgeFromSide = ref<CanvasSide>("right")
  const newEdgeLabel = ref("")
  const newEdgeSourceId = ref("")
  const newEdgeSourceQuery = ref("")
  const newEdgeTargetId = ref("")
  const newEdgeTargetQuery = ref("")
  const newEdgeToSide = ref<CanvasSide>("left")
  const inspectorExpanded = ref(true)
  const edgeToolbarSize = reactive({
    height: DEFAULT_SELECTION_TOOLBAR_SIZE.height,
    width: 240,
  })
  const editingEdgeLabelId = ref("")
  const edgeLabelDraft = ref("")

  const displayNodes = computed(() =>
    [...state.document.nodes].sort((left, right) => {
      if (left.type === right.type) {
        return 0
      }

      return left.type === "group" ? -1 : 1
    }),
  )
  const selectedNode = computed(
    () => state.document.nodes.find((node) => node.id === state.selectedNodeId) || null,
  )
  const selectedNodeCount = computed(() => state.selectedNodeIds.length)
  const selectedEdge = computed(
    () => state.document.edges.find((edge) => edge.id === state.selectedEdgeId) || null,
  )
  const selectionBounds = computed<CanvasBounds | null>(() =>
    getCanvasSelectionBounds(state.document, state.selectedNodeIds),
  )
  const edgeSourceNode = computed(
    () => state.document.nodes.find((node) => node.id === newEdgeSourceId.value) || null,
  )
  const edgeTargets = computed(() =>
    filterEdgeNodeOptions(
      state.document.nodes.filter((node) => node.id !== newEdgeSourceId.value),
      newEdgeTargetQuery.value,
    ),
  )
  const edgeSources = computed(() =>
    filterEdgeNodeOptions(state.document.nodes, newEdgeSourceQuery.value),
  )
  const board = computed(() => createCanvasBoardMetrics(state.document.nodes))
  const canDelete = computed(() => Boolean(state.selectedNodeIds.length || selectedEdge.value))
  const selectedEdgeAnchors = computed(() => {
    if (!selectedEdge.value) {
      return null
    }

    const fromNode = state.document.nodes.find((node) => node.id === selectedEdge.value?.fromNode)
    const toNode = state.document.nodes.find((node) => node.id === selectedEdge.value?.toNode)
    if (!fromNode || !toNode) {
      return null
    }

    return {
      from: getCanvasNodeAnchor(fromNode, selectedEdge.value.fromSide),
      to: getCanvasNodeAnchor(toNode, selectedEdge.value.toSide),
    }
  })
  const edgeToolbar = computed(() => {
    const stage = stageRef.value
    const anchors = selectedEdgeAnchors.value

    if (!stage || !selectedEdge.value || !anchors || state.selectedNodeIds.length > 0) {
      return {
        placement: "top" as const,
        visible: false,
        x: 0,
        y: 0,
      }
    }

    const midpoint = getEdgeMidpointPosition(
      {
        x: toBoardX(board.value, anchors.from.x),
        y: toBoardY(board.value, anchors.from.y),
      },
      selectedEdge.value.fromSide,
      {
        x: toBoardX(board.value, anchors.to.x),
        y: toBoardY(board.value, anchors.to.y),
      },
      selectedEdge.value.toSide,
    )

    return {
      ...resolveEdgeToolbarPosition(
        {
          x: midpoint.x * viewport.scale + viewport.x,
          y: midpoint.y * viewport.scale + viewport.y,
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
    if (!selectedEdge.value || !selectedEdgeAnchors.value) {
      return null
    }

    return {
      from: {
        x: toBoardX(board.value, selectedEdgeAnchors.value.from.x) * viewport.scale + viewport.x,
        y: toBoardY(board.value, selectedEdgeAnchors.value.from.y) * viewport.scale + viewport.y,
      },
      to: {
        x: toBoardX(board.value, selectedEdgeAnchors.value.to.x) * viewport.scale + viewport.x,
        y: toBoardY(board.value, selectedEdgeAnchors.value.to.y) * viewport.scale + viewport.y,
      },
    }
  })
  const selectedEdgeDirectionMode = computed<"both" | "none" | "single">(() => {
    if (!selectedEdge.value) {
      return "single"
    }

    const startArrow = selectedEdge.value.startArrow ?? false
    const endArrow = selectedEdge.value.endArrow ?? true

    if (startArrow && endArrow) {
      return "both"
    }

    if (!startArrow && !endArrow) {
      return "none"
    }

    return "single"
  })
  const edgeLabelEditorPosition = computed(() => {
    const edge = state.document.edges.find((candidate) => candidate.id === editingEdgeLabelId.value)
    if (!edge) {
      return null
    }

    const fromNode = state.document.nodes.find((node) => node.id === edge.fromNode)
    const toNode = state.document.nodes.find((node) => node.id === edge.toNode)
    const stage = stageRef.value
    if (!fromNode || !toNode || !stage) {
      return null
    }

    const midpoint = getEdgeMidpointPosition(
      {
        x: toBoardX(board.value, getCanvasNodeAnchor(fromNode, edge.fromSide).x),
        y: toBoardY(board.value, getCanvasNodeAnchor(fromNode, edge.fromSide).y),
      },
      edge.fromSide,
      {
        x: toBoardX(board.value, getCanvasNodeAnchor(toNode, edge.toSide).x),
        y: toBoardY(board.value, getCanvasNodeAnchor(toNode, edge.toSide).y),
      },
      edge.toSide,
    )

    return {
      x: midpoint.x * viewport.scale + viewport.x,
      y: midpoint.y * viewport.scale + viewport.y,
    }
  })
  const selectionToolbar = computed(() => {
    const stage = stageRef.value
    const bounds = selectionBounds.value

    if (!stage || !bounds || selectedEdge.value) {
      return {
        placement: "top" as const,
        visible: false,
        x: 0,
        y: 0,
      }
    }

    const selectionRect = {
      height: bounds.height * viewport.scale,
      width: bounds.width * viewport.scale,
      x: toBoardX(board.value, bounds.x) * viewport.scale + viewport.x,
      y: toBoardY(board.value, bounds.y) * viewport.scale + viewport.y,
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
      visible: state.selectedNodeIds.length > 0,
    }
  })
  const selectionColors = computed(() => [...SELECTION_COLORS])
  const selectionLayoutActions = computed<Array<{ action: CanvasNodeLayoutAction, label: string }>>(() => [
    { action: "left-align", label: t("layoutLeftAlign") },
    { action: "center-horizontal", label: t("layoutCenterHorizontal") },
    { action: "right-align", label: t("layoutRightAlign") },
    { action: "top-align", label: t("layoutTopAlign") },
    { action: "center-vertical", label: t("layoutCenterVertical") },
    { action: "bottom-align", label: t("layoutBottomAlign") },
    { action: "arrange-row", label: t("layoutArrangeRow") },
    { action: "arrange-column", label: t("layoutArrangeColumn") },
    { action: "arrange-grid", label: t("layoutArrangeGrid") },
    { action: "distribute-horizontal", label: t("layoutDistributeHorizontal") },
    { action: "distribute-vertical", label: t("layoutDistributeVertical") },
    { action: "stretch-horizontal", label: t("layoutStretchHorizontal") },
    { action: "stretch-vertical", label: t("layoutStretchVertical") },
  ])
  const getFileName = getCanvasFileName

  function getPluginSettings(): CanvasPluginSettings {
    return plugin.getCanvasSettings?.() ?? createDefaultCanvasPluginSettings()
  }

  function filterEdgeNodeOptions(nodes: CanvasNode[], query: string) {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return nodes
    }

    return nodes.filter((node) => {
      const title = getNodeTitle(node).toLowerCase()
      return title.includes(normalizedQuery) || node.id.toLowerCase().includes(normalizedQuery)
    })
  }

  function refreshRecentFiles() {
    recentFiles.value = plugin.getRecentCanvasFiles?.() ?? []
  }

  function activateCanvasSurface() {
    bottomToolbarVisible.value = true
  }

  function deactivateCanvasSurface() {
    bottomToolbarVisible.value = false
  }

  async function refreshWorkspaceDocuments() {
    const directory = CANVAS_DEFAULT_DIRECTORY

    try {
      const entries = await readDir(directory) as Array<{
        isDir: boolean
        name: string
      }> | null

      workspaceDocuments.value = (Array.isArray(entries) ? entries : [])
        .filter((entry) => !entry.isDir && entry.name.endsWith(".canvas"))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => ({
          path: `${directory}/${entry.name}`,
          title: entry.name,
        }))
    } catch {
      workspaceDocuments.value = []
    }
  }

  async function openDocumentAtBlock(blockId: string, documentId?: string) {
    const targetDocumentId = documentId || (await findSiyuanDocumentByBlockId(blockId))?.id

    if (targetDocumentId) {
      await openTab({
        app: plugin.app,
        doc: {
          id: targetDocumentId,
        },
        keepCursor: true,
        openNewTab: true,
      })
    }

    plugin.eventBus?.emit("open-siyuan-url-block", {
      exist: false,
      focus: true,
      id: blockId,
      url: `siyuan://blocks/${blockId}`,
    })
  }

  watch(
    () => [state.filePath, state.isDirty, suggestedFilename.value],
    () => {
      const title = getFileName(state.filePath) || suggestedFilename.value || t("untitledCanvas")
      setTitle(`${state.isDirty ? "● " : ""}${title}`)
    },
    { immediate: true },
  )

  const {
    getFileNodeDescription,
    getFileNodeKind,
    getFileNodePreview,
    getNodeTitle,
    getResolvedFileNode,
    refreshFileNodeMetadata,
  } = createCanvasEditorFileNodeHelpers({
    fileNodeMeta,
    state,
    t,
  })

  function getNodeStyle(node: CanvasNode) {
    return {
      height: `${node.height}px`,
      left: `${toBoardX(board.value, node.x)}px`,
      top: `${toBoardY(board.value, node.y)}px`,
      width: `${node.width}px`,
    }
  }

  function getAnchor(node: CanvasNode, side: CanvasSide) {
    const anchor = getCanvasNodeAnchor(node, side)
    return {
      x: toBoardX(board.value, anchor.x),
      y: toBoardY(board.value, anchor.y),
    }
  }

  function getEdgePath(edge: CanvasEdge): string {
    const fromNode = state.document.nodes.find((node) => node.id === edge.fromNode)
    const toNode = state.document.nodes.find((node) => node.id === edge.toNode)
    if (!fromNode || !toNode) {
      return ""
    }

    const from = getAnchor(fromNode, edge.fromSide)
    const to = getAnchor(toNode, edge.toSide)
    return createEdgeCurvePath(from, edge.fromSide, to, edge.toSide)
  }

  function getEdgeLabelPosition(edge: CanvasEdge) {
    const fromNode = state.document.nodes.find((node) => node.id === edge.fromNode)
    const toNode = state.document.nodes.find((node) => node.id === edge.toNode)
    if (!fromNode || !toNode) {
      return {
        x: 0,
        y: 0,
      }
    }

    const from = getAnchor(fromNode, edge.fromSide)
    const to = getAnchor(toNode, edge.toSide)
    return getEdgeMidpointPosition(from, edge.fromSide, to, edge.toSide)
  }

  function resetViewport() {
    const stage = stageRef.value
    if (!stage || state.document.nodes.length === 0) {
      viewport.scale = 1
      viewport.x = 0
      viewport.y = 0
      return
    }

    const minX = Math.min(...state.document.nodes.map((node) => node.x))
    const minY = Math.min(...state.document.nodes.map((node) => node.y))
    const maxX = Math.max(...state.document.nodes.map((node) => node.x + node.width))
    const maxY = Math.max(...state.document.nodes.map((node) => node.y + node.height))
    const centerX = toBoardX(board.value, (minX + maxX) / 2)
    const centerY = toBoardY(board.value, (minY + maxY) / 2)
    viewport.scale = 1
    viewport.x = stage.clientWidth / 2 - centerX
    viewport.y = stage.clientHeight / 2 - centerY
  }

  function commitDocument(nextDocument: CanvasDocument) {
    state.patchDocument(nextDocument)
    state.issues = validateCanvasDocument(nextDocument)
  }

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

  const {
    ensureCanvasPath,
    exportCanvas,
    importCanvas,
    loadConflictVersion,
    newCanvas,
    openPath,
    openRecentFile,
    openRecentPath,
    openSettings,
    openWorkspacePath,
    overwriteConflictVersion,
    rememberRecentPath,
    save,
    triggerImport,
  } = createCanvasEditorFileActions({
    fileInputRef,
    fileSource,
    getPluginSettings,
    plugin,
    refreshRecentFiles,
    refreshWorkspaceDocuments,
    resetViewport,
    state,
    suggestedFilename,
    t,
  })
  const {
    addNode,
    applyEdgeColor,
    applySelectedNodeAsEdgeSource,
    applySelectionColor,
    applySelectionLayout,
    cancelEdgeLabelEditing,
    centerEdgeInViewport,
    centerSelectionInViewport,
    closeCreateEdgeDialog,
    createEdgeFromSelection,
    createGroupFromSelection,
    deleteSelection,
    getRenderedMarkdown,
    openCreateEdgeDialog,
    selectEdge,
    selectNode,
    setNewEdgeSourceId,
    setNewEdgeTargetId,
    startEdgeLabelEditing,
    submitCreateEdgeDialog,
    submitEdgeLabelEditing,
    toggleEdgePopover,
    toggleSelectionPopover,
    updateEdgeField,
    updateEdgeSide,
    updateEditingEdgeLabel,
    updateNodeField,
    updateNumericNodeField,
    updateSelectedEdgeDirection,
    updateTextNodeContent,
    zoomIn,
    zoomOut,
  } = createCanvasEditorNodeEdgeActions({
    activateCanvasSurface,
    board,
    closeEdgePopover,
    closeSelectionPopover,
    commitDocument,
    createEdgeDialog,
    edgeLabelDraft,
    editingEdgeLabelId,
    edgeToolbarPopover,
    fileFieldRefresh: refreshFileNodeMetadata,
    newEdgeFromSide,
    newEdgeLabel,
    newEdgeSourceId,
    newEdgeSourceQuery,
    newEdgeTargetId,
    newEdgeTargetQuery,
    newEdgeToSide,
    selectedEdge,
    selectedEdgeAnchors,
    selectedNode,
    selectionBounds,
    selectionToolbarPopover,
    stageRef,
    state,
    t,
    viewport,
  })

  const {
    closeFilePickerDialog,
    handleClipboardImagePaste,
    openFilePickerDialog,
    selectFilePickerResult,
    updateFilePickerQuery,
  } = createCanvasEditorFilePickerActions({
    board,
    commitDocument,
    filePickerDialog,
    fileSource,
    refreshFileNodeMetadata,
    resolveBlockById: findSiyuanBlockById,
    resolveBlocksByQuery: findSiyuanBlocksByQuery,
    resolveDocumentByBlockId: findSiyuanDocumentByBlockId,
    resolveDocumentsByQuery: findSiyuanDocumentsByQuery,
    resolveImageAssetByBlockId: findSiyuanImageAssetByBlockId,
    resolveImageAssetsByQuery: findSiyuanImageAssetsByQuery,
    selectNode,
    state,
    t,
    viewport,
    workspaceDocuments,
  })

  function toggleInspector() {
    inspectorExpanded.value = !inspectorExpanded.value
  }

  async function toggleInspectorSection(section: keyof CanvasPluginUiState["inspectorSections"]) {
    const nextValue = !inspectorSectionState[section]
    inspectorSectionState[section] = nextValue
    await plugin.updateCanvasUiState?.({
      inspectorSections: {
        [section]: nextValue,
      },
    })
  }

  const { activateNode } = createCanvasEditorNodeActivationActions({
    ensureCanvasPath,
    getResolvedFileNode,
    openDocumentByBlockId: openDocumentAtBlock,
    plugin,
  })
  const {
    clearConnectionDraft,
    clearEdgeReconnectDraft,
    clearSelectionBox,
    finishConnectionDrag,
    getConnectionDraftPath,
    getEdgeReconnectDraftPath,
    handleNodePointerDown,
    handleWheelZoom,
    isConnectionTarget,
    startEdgeEndpointDrag,
    startConnectionDrag,
    startCornerResize,
    startDrag,
    startPan,
    startResize,
  } = createCanvasEditorGestureHandlers({
    board,
    commitDocument,
    connectionDraft,
    edgeReconnectDraft,
    getAnchor,
    selectionBox,
    selectedEdge,
    stageRef,
    state,
    viewport,
  })

  const { handleKeydown } = createCanvasEditorKeyboardHandler({
    canDelete: () => canDelete.value,
    cancelEdgeLabelEditing,
    closeEdgePopover,
    closeSelectionPopover,
    deleteSelection,
    getEdgeToolbarPopover: () => edgeToolbarPopover.value,
    getEditingEdgeLabelId: () => editingEdgeLabelId.value,
    getSelectionToolbarPopover: () => selectionToolbarPopover.value,
    save,
    selectAllNodes: () => state.selectAllNodes(),
    selectEdge: () => state.selectEdge(),
    selectNode: () => state.selectNode(),
  })

  onMounted(async () => {
    await initializeCanvasEditor({
      bootstrap,
      fileSource,
      getFileName,
      newCanvas,
      refreshFileNodeMetadata,
      refreshRecentFiles,
      refreshWorkspaceDocuments,
      rememberRecentPath,
      resetViewport,
      state,
      suggestedFilename,
      t,
    })
    window.addEventListener("keydown", handleKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeydown)
  })

  watch(
    () => state.document.nodes
      .filter((node) => node.type === "file")
      .map((node) => `${node.id}:${node.file}`),
    () => {
      void refreshFileNodeMetadata()
    },
    { deep: false },
  )

  watch(
    () => `${state.selectedEdgeId}|${state.selectedNodeIds.join(",")}`,
    () => {
      syncCanvasEditorSelectionUi({
        applySelectedNodeAsEdgeSource,
        cancelEdgeLabelEditing,
        clearEdgeReconnectDraft,
        clearSelectionBox,
        closeEdgePopover,
        closeSelectionPopover,
        edgeReconnectDraft,
        state,
      })
    },
  )

  return createCanvasEditorBindings(
    {
      applySelectionColor,
      applyEdgeColor,
      applySelectionLayout,
      activateCanvasSurface,
      board,
      bottomToolbarVisible,
      canDelete,
      centerEdgeInViewport,
      centerSelectionInViewport,
      closeCreateEdgeDialog,
      closeEdgePopover,
      closeSelectionPopover,
      createGroupFromSelection,
      createEdgeDialog,
      filePickerDialog,
      displayNodes,
      deactivateCanvasSurface,
      connectionDraft,
      edgeColorOptions: selectionColors,
      edgeLabelDraft,
      edgeLabelEditorPosition,
      edgeReconnectDraft,
      edgeSources,
      edgeToolbar,
      edgeToolbarPopover,
      edgeTargets,
      editingEdgeLabelId,
      exportCanvas,
      fileInputRef,
      finishConnectionDrag,
      getEdgeLabelPosition,
      getEdgePath,
      getConnectionDraftPath,
      getEdgeReconnectDraftPath,
      getFileName,
      getFileNodeDescription,
      getFileNodeKind,
      getFileNodePreview,
      getNodeStyle,
      getNodeTitle,
      importCanvas,
      isConnectionTarget,
      newCanvas,
      newEdgeFromSide,
      newEdgeLabel,
      newEdgeSourceId,
      newEdgeSourceQuery,
      newEdgeTargetId,
      newEdgeTargetQuery,
      newEdgeToSide,
      openCreateEdgeDialog,
      openFilePickerDialog,
      openPath,
      openRecentFile,
      resetViewport,
      save,
      closeFilePickerDialog,
      selectFilePickerResult,
      selectEdge,
      selectNode,
      selectedEdge,
      selectedNode,
      selectedNodeCount,
      selectionBox,
      sides: SIDES,
      stageRef,
      startConnectionDrag,
      startCornerResize,
      startDrag,
      startPan,
      startResize,
      state,
      submitCreateEdgeDialog,
      suggestedFilename,
      setNewEdgeSourceId,
      setNewEdgeTargetId,
      triggerImport,
      toggleInspectorSection,
      updateFilePickerQuery,
      updateTextNodeContent,
      updateEdgeField,
      updateEdgeSide,
      updateNodeField,
      updateNumericNodeField,
      viewport,
      zoomIn,
      zoomOut,
      getRenderedMarkdown,
      handleClipboardImagePaste,
      handleNodePointerDown,
      handleWheelZoom,
      inspectorExpanded,
      inspectorSectionState,
      addNode,
      createEdgeFromSelection,
      deleteSelection,
      activateNode,
      loadConflictVersion,
      openRecentPath,
      openSettings,
      openWorkspacePath,
      overwriteConflictVersion,
      recentFiles,
      workspaceDocuments,
      selectionColors,
      selectionLayoutActions,
      selectionToolbar,
      selectionToolbarPopover,
      selectedEdgeHandlePositions,
      setSelectionToolbarSize,
      setEdgeToolbarSize,
      startEdgeEndpointDrag,
      startEdgeLabelEditing,
      submitEdgeLabelEditing,
      cancelEdgeLabelEditing,
      updateEditingEdgeLabel,
      toggleInspector,
      toggleEdgePopover,
      toggleSelectionPopover,
      updateSelectedEdgeDirection,
      selectedEdgeDirectionMode,
    },
    ["fileInputRef", "stageRef"],
  )
}

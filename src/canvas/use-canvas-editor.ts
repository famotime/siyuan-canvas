import type { CanvasColorThemeId } from "@/canvas/canvas-color-themes"
import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasFileNode,
  CanvasNodeLayoutAction,
  CanvasNode,
  CanvasSide,
  CanvasTextNode,
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
  buildColorStyles,
  CANVAS_COLOR_THEMES,
  getColorThemeById,
} from "@/canvas/canvas-color-themes"
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
  putFile,
  readDir,
  removeFile,
} from "@/api"
import { createCanvasEditorWorkspaceTree } from "@/canvas/use-canvas-editor-workspace-tree"
import {
  createCanvasBoardMetrics,
  toBoardX,
  toBoardY,
} from "@/canvas/board"
import { computeAlignment } from "@/canvas/alignment-guides"
import type { AlignmentGuideLine } from "@/canvas/alignment-guides"
import {
  getCanvasSelectionBounds,
  setCanvasEdgeEndpoint,
  upsertCanvasEdge,
} from "@/canvas/document"
import { createCanvasEditorBindings } from "@/canvas/editor-bindings"
import { CanvasEditorState } from "@/canvas/editor-state"
import { CanvasHistoryStack, cloneCanvasDocument } from "@/canvas/canvas-history"
import { createCanvasEditorFileActions } from "@/canvas/use-canvas-editor-file-actions"
import { createCanvasEditorFilePickerActions } from "@/canvas/use-canvas-editor-file-picker"
import { createCanvasEditorFileNodeHelpers } from "@/canvas/use-canvas-editor-file-nodes"
import { createCanvasEditorStageDropActions } from "@/canvas/use-canvas-editor-stage-drop"

import {
  createCanvasEditorGestureHandlers,
  type CanvasEditorConnectionDraftState,
  type CanvasEditorEdgeReconnectDraftState,
  type CanvasEditorSelectionBoxState,
  type PendingCardCreation,
} from "@/canvas/use-canvas-editor-gestures"
import { initializeCanvasEditor, syncCanvasEditorSelectionUi } from "@/canvas/use-canvas-editor-lifecycle"
import { createCanvasEditorNodeActivationActions } from "@/canvas/use-canvas-editor-node-activation"
import { createCanvasEditorNodeEdgeActions } from "@/canvas/use-canvas-editor-node-edge-actions"
import { createCanvasEditorKeyboardHandler } from "@/canvas/use-canvas-editor-shortcuts"
import {
  createCanvasEditorSelectionExport,
} from "@/canvas/use-canvas-editor-selection-export"
import { createCanvasEditorSelectionUi } from "@/canvas/use-canvas-editor-selection-ui"
import { createDebugLog } from "@/canvas/debug-log"
import { createCanvasBlockJumpHighlighter } from "@/canvas/block-jump-highlight"
import { BLOCK_NAVIGATION_ACTIONS } from "@/canvas/protyle-navigation"
import {
  getCanvasFileName,
} from "@/canvas/use-canvas-editor-shared"
import {
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
} from "@/canvas/selection-toolbar"
import {
  collectCanvasSearchTargets,
  createCanvasSearchRevision,
  parseCanvasTargetId,
  registerCanvasSearchHost,
  replaceCanvasTextTargetRanges,
  type CanvasSearchDecoration,
} from "@/canvas/search-bridge"


import { useCanvasPresentation } from "@/canvas/use-canvas-presentation"

const SIDES: CanvasSide[] = ["top", "right", "bottom", "left"]
const SELECTION_COLORS = ["1", "2", "3", "4", "5", "6"] as const
export const CANVAS_GRID_SIZE = 20

export function snapCanvasCoordinate(value: number, gridSize = CANVAS_GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize
}

export function useCanvasEditor(
  plugin: CanvasPluginBridge,
  bootstrap: CanvasTabBootstrap,
  setTitle: (title: string) => void,
) {
  const t = createCanvasI18n(plugin.i18n)
  const blockJumpHighlighter = createCanvasBlockJumpHighlighter(plugin)
  const fileService = new CanvasFileService(new SiyuanCanvasTextGateway())
  const state = reactive(new CanvasEditorState(fileService))
  const history = new CanvasHistoryStack({ capacity: 100 })
  // Vue 反应式不能感知 class 内部状态，这里靠版本号触发 canUndo/canRedo 的 computed 重算
  const historyVersion = ref(0)
  const isSaving = ref(false)
  const gridEnabled = ref(false)
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
  const searchDecorations = ref<CanvasSearchDecoration[]>([])
  const recentFiles = ref<CanvasRecentFile[]>([])
  const colorThemeId = ref<CanvasColorThemeId>(
    getPluginSettings().colorTheme ?? "classic",
  )
  const currentColorStyles = computed(() =>
    buildColorStyles(getColorThemeById(colorThemeId.value)),
  )
  const searchListeners = new Set<() => void>()
  let unregisterCanvasSearchHost: (() => void) | null = null

  const workspaceTree = createCanvasEditorWorkspaceTree({
    readDir: (path) => readDir(path) as Promise<Array<{ name: string, isDir: boolean, updated?: number }>>,
    putFile,
    removeFile,
    showMessage,
    getSettings: getPluginSettings,
    plugin,
    refreshRecentFiles,
    onFilePathUpdate: (path) => { state.filePath = path },
    labels: {
      copyTitle: t("contextMenuCopy"),
      deleteCanvasDescription: path => t("workspaceDeleteCanvasDescription", { path }),
      deleteCanvasTitle: t("workspaceDeleteCanvasTitle"),
      deleteFolderDescription: name => t("workspaceDeleteFolderDescription", { name }),
      deleteFolderTitle: t("contextMenuDeleteFolderConfirm"),
      dialogCancel: t("dialogCancel"),
      dialogConfirm: t("dialogConfirm"),
      fileAlreadyExistsMessage: t("messageFileAlreadyExists"),
      folderNameTitle: t("workspaceFolderNameTitle"),
      messageFileCopied: name => t("workspaceFileCopied", { name }),
      messageFileMoved: (name, folder) => t("messageFileMoved", { folder, name }),
      messageFileRenamed: name => t("messageFileRenamed", { name }),
      messageFolderRenamed: name => t("workspaceFolderRenamed", { name }),
      newFolderMessage: name => t("workspaceNewFolder", { name }),
      notAvailableInBrowserMessage: t("workspaceNotAvailableInBrowser"),
      renameFolderTitle: t("workspaceRenameFolderTitle"),
      renameTitle: t("contextMenuRename"),
      unableToCopyFileMessage: t("workspaceUnableCopyFile"),
      unableToGetWorkspacePathMessage: t("workspaceUnableGetWorkspacePath"),
      unableToMoveFileMessage: t("messageUnableMoveFile"),
      unableToOpenFolderMessage: t("workspaceUnableOpenFolder"),
      unableToRenameFileMessage: t("messageUnableRenameFile"),
      unableToRenameFolderMessage: t("workspaceUnableRenameFolder"),
      unableToSaveMessage: t("messageUnableSaveCanvas"),
    },
  })

  const suggestedFilename = ref(bootstrap.title || t("untitledCanvas"))
  const floatLayerActive = ref(false)
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
  const selectionBox = reactive<CanvasEditorSelectionBoxState>({
    height: 0,
    visible: false,
    width: 0,
    x: 0,
    y: 0,
  })
  const alignmentGuides = reactive<{
    horizontal: Array<{ position: number, spanStart: number, spanEnd: number }>
    vertical: Array<{ position: number, spanStart: number, spanEnd: number }>
    visible: boolean
  }>({
    horizontal: [],
    vertical: [],
    visible: false,
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
  const pendingCardCreation = reactive<PendingCardCreation>({
    canvasX: 0,
    canvasY: 0,
    fromNodeId: "",
    fromSide: "left",
  })
  const newEdgeFromSide = ref<CanvasSide>("right")
  const newEdgeLabel = ref("")
  const newEdgeSourceId = ref("")
  const newEdgeSourceQuery = ref("")
  const newEdgeTargetId = ref("")
  const newEdgeTargetQuery = ref("")
  const newEdgeToSide = ref<CanvasSide>("left")
  const inspectorExpanded = ref(false)
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
  const canRefreshSelectedSiyuanNode = computed(() => {
    if (selectedNodeCount.value !== 1 || selectedNode.value?.type !== 'file') {
      return false
    }

    const resolved = getResolvedFileNode(selectedNode.value)
    return resolved.kind === 'block'
      || resolved.kind === 'document'
      || (resolved.kind === 'image' && Boolean(resolved.blockId))
  })
  const canDecomposeSelectedDocument = computed(() => {
    if (selectedNodeCount.value !== 1) {
      return false
    }

    if (selectedNode.value?.type === 'text') {
      return true
    }

    if (selectedNode.value?.type === 'file') {
      return getResolvedFileNode(selectedNode.value).kind === 'document'
    }

    return false
  })
  const canRelayoutConnectedNodes = computed(() => {
    if (selectedNodeCount.value !== 1 || !selectedNode.value) {
      return false
    }
    return state.document.edges.some(
      e => e.fromNode === selectedNode.value!.id || e.toNode === selectedNode.value!.id,
    )
  })
  const canConvertSelectionToDocument = computed(() => {
    if (state.selectedNodeIds.length === 0) return false
    return state.selectedNodeIds.every(id => {
      const node = state.document.nodes.find(n => n.id === id)
      return node?.type === 'text'
    })
  })
  const canConvertSelectionToText = computed(() => {
    if (state.selectedNodeIds.length === 0) return false
    return state.selectedNodeIds.every(id => {
      const node = state.document.nodes.find(n => n.id === id)
      return node?.type === 'file'
    })
  })
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
  const {
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
  } = createCanvasEditorSelectionUi({
    board,
    getCanvasNodeAnchor,
    selectedEdge,
    selectionBounds,
    stageRef,
    state,
    viewport,
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

  async function setColorTheme(themeId: CanvasColorThemeId) {
    colorThemeId.value = themeId
    await plugin.updateCanvasSettings?.({ colorTheme: themeId })
  }

  function notifyCanvasSearchChanged() {
    searchListeners.forEach(listener => listener())
  }

  function handleExternalSettingsChange() {
    const settings = getPluginSettings()
    if (settings.colorTheme && settings.colorTheme !== colorThemeId.value) {
      colorThemeId.value = settings.colorTheme
    }
  }

  function activateCanvasSurface() {
    bottomToolbarVisible.value = true
  }

  function deactivateCanvasSurface() {
    bottomToolbarVisible.value = false
  }

  async function expandAllInspectorSections() {
    const allKeys = Object.keys(inspectorSectionState) as Array<keyof typeof inspectorSectionState>
    for (const key of allKeys) {
      inspectorSectionState[key] = true
    }
    await plugin.updateCanvasUiState?.({
      inspectorSections: {
        createEdge: true,
        document: true,
        edge: true,
        node: true,
        nodeEdges: true,
        recent: true,
        selection: true,
      },
    })
    if (workspaceTree.allFoldersExpanded.value) {
      workspaceTree.collapseAllFolders()
    } else {
      workspaceTree.expandAllFolders()
    }
  }

  function removeRecentFileRecord(path: string) {
    return workspaceTree.removeRecentFileRecord(path)
  }

  async function openDocumentAtBlock(blockId: string, documentId?: string) {
    blockJumpHighlighter.requestBlockHighlight(blockId)
    if (blockId) {
      await openTab({
        app: plugin.app,
        doc: {
          action: BLOCK_NAVIGATION_ACTIONS,
          id: blockId,
        },
        keepCursor: false,
        openNewTab: true,
      })
    }
  }

  async function refreshSelectedSiyuanNode() {
    if (!canRefreshSelectedSiyuanNode.value || selectedNode.value?.type !== 'file') {
      return
    }

    try {
      await refreshFileNodeMetadata([selectedNode.value.id])
    } catch {
      showMessage(t('messageUnableRefreshSiyuanNode'), 4000, 'error')
    }
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

  // 选区导出/合并逻辑已提取到 use-canvas-editor-selection-export.ts
  const selectionExport = createCanvasEditorSelectionExport({
    state,
    commitDocument,
    refreshFileNodeMetadata,
    getResolvedFileNode,
    getPluginSettings,
    fileSource,
    t,
  })

  async function decomposeSelectedDocument() {
    return selectionExport.decomposeSelectedDocument(selectedNode.value, canDecomposeSelectedDocument.value)
  }

  async function convertSelectionToDocument() {
    if (!canConvertSelectionToDocument.value) return
    return selectionExport.convertSelectionToDocument(state.selectedNodeIds)
  }

  async function convertSelectionToText() {
    if (!canConvertSelectionToText.value) return
    return selectionExport.convertSelectionToText(state.selectedNodeIds)
  }

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

  function toggleGrid() {
    gridEnabled.value = !gridEnabled.value
  }

  function commitDocument(nextDocument: CanvasDocument, options: { coalesceKey?: string } = {}) {
    // 在变更前抓快照入历史栈，undo 时可还原文档与选区
    history.record(
      {
        document: cloneCanvasDocument(state.document),
        selectedNodeIds: [...state.selectedNodeIds],
        selectedNodeId: state.selectedNodeId,
        selectedEdgeId: state.selectedEdgeId,
      },
      { coalesceKey: options.coalesceKey },
    )
    historyVersion.value++
    state.patchDocument(nextDocument)
    state.issues = validateCanvasDocument(nextDocument)
    notifyCanvasSearchChanged()
  }

  function applyHistorySnapshot(snapshot: ReturnType<typeof cloneCanvasDocument> extends infer _T ? import("@/canvas/canvas-history").CanvasHistorySnapshot : never) {
    state.document = snapshot.document
    state.selectedNodeIds = [...snapshot.selectedNodeIds]
    state.selectedNodeId = snapshot.selectedNodeId
    state.selectedEdgeId = snapshot.selectedEdgeId
    state.isDirty = true
    state.issues = validateCanvasDocument(snapshot.document)
  }

  function undo() {
    const current = {
      document: cloneCanvasDocument(state.document),
      selectedNodeIds: [...state.selectedNodeIds],
      selectedNodeId: state.selectedNodeId,
      selectedEdgeId: state.selectedEdgeId,
    }
    const previous = history.undo(current)
    if (!previous) {
      return
    }
    applyHistorySnapshot(previous)
    historyVersion.value++
  }

  function redo() {
    const current = {
      document: cloneCanvasDocument(state.document),
      selectedNodeIds: [...state.selectedNodeIds],
      selectedNodeId: state.selectedNodeId,
      selectedEdgeId: state.selectedEdgeId,
    }
    const next = history.redo(current)
    if (!next) {
      return
    }
    applyHistorySnapshot(next)
    historyVersion.value++
  }

  function duplicateSelection() {
    if (state.selectedNodeIds.length === 0) {
      return
    }
    const idMap = new Map<string, string>()
    const offset = 24
    const newNodes: CanvasNode[] = []
    for (const node of state.document.nodes) {
      if (!state.selectedNodeIds.includes(node.id)) {
        continue
      }
      const newId = `${node.id}-copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      idMap.set(node.id, newId)
      newNodes.push({
        ...cloneCanvasDocument({ nodes: [node], edges: [] }).nodes[0],
        id: newId,
        x: node.x + offset,
        y: node.y + offset,
      } as CanvasNode)
    }
    if (newNodes.length === 0) {
      return
    }

    const nextDocument: CanvasDocument = {
      ...state.document,
      nodes: [...state.document.nodes, ...newNodes],
    }
    commitDocument(nextDocument)
    state.selectNodes([...idMap.values()])
  }

  function zoomToActualSize() {
    viewport.scale = 1
  }

  function zoomToFit() {
    resetViewport()
  }

  function closeFloatLayer() {
    const panels = (window as any).siyuan?.blockPanels
    if (Array.isArray(panels)) {
      for (const panel of [...panels]) {
        panel.destroy?.()
      }
    }
    floatLayerActive.value = false
  }

  const debugLog = createDebugLog(getPluginSettings)

  function showFloatLayerForSelection() {
    const node = selectedNode.value
    if (!node || node.type !== 'file') {
      debugLog('float layer skipped: no file node selected')
      return
    }

    const meta = fileNodeMeta.value[node.id]
    if (!meta) {
      debugLog('float layer skipped: no meta for node', node.id)
      return
    }

    let refID: string | undefined
    if (meta.kind === 'block') {
      refID = meta.id
    } else if (meta.kind === 'document') {
      refID = meta.id
    } else if (meta.kind === 'image' && meta.blockId) {
      refID = meta.blockId
    }
    if (!refID) {
      debugLog('float layer skipped: no refID for kind', meta.kind)
      return
    }

    debugLog('showFloatLayer', { refID, kind: meta.kind })
    closeFloatLayer()

    const stage = stageRef.value
    const targetElement = stage?.querySelector(`[data-canvas-node-id="${node.id}"]`) as HTMLElement | undefined
    plugin.addFloatLayer({
      refDefs: [{ refID }],
      isBacklink: false,
      ...(targetElement ? { targetElement } : {}),
    })
    floatLayerActive.value = true
  }

  const {
    ensureCanvasPath,
    exportCanvas,
    exportCanvasPng,
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
    save: saveImpl,
    silentSave: silentSaveImpl,
    triggerImport,
  } = createCanvasEditorFileActions({
    board,
    fileInputRef,
    fileSource,
    getPluginSettings,
    plugin,
    refreshRecentFiles,
    refreshWorkspaceDocuments: workspaceTree.refreshWorkspaceDocuments,
    resetViewport,
    stageRef,
    state,
    suggestedFilename,
    t,
    viewport,
  })

  /**
   * 保存包装：维护 isSaving 标志，让顶栏徽标可以呈现 saving 态。
   * 同时在打开新文件 / 新建画布时清空历史栈，避免跨文档 undo 出诡异结果。
   */
  async function save() {
    if (isSaving.value) {
      return
    }
    isSaving.value = true
    try {
      await saveImpl()
    } finally {
      isSaving.value = false
    }
  }

  /**
   * 静默保存包装：复用 isSaving 守卫，不弹对话框直接写入当前文件路径。
   */
  async function silentSave() {
    if (isSaving.value) {
      return
    }
    isSaving.value = true
    try {
      await silentSaveImpl()
    } finally {
      isSaving.value = false
    }
  }

  // 自动保存：文档变脏后 1 秒静默保存到当前路径
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    () => state.isDirty,
    (dirty) => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
      }
      if (dirty) {
        autoSaveTimer = setTimeout(() => {
          autoSaveTimer = null
          void silentSave()
        }, 1000)
      }
    },
  )

  function clearHistory() {
    history.clear()
    historyVersion.value++
  }

  let focusNodeByIdFn: (id: string) => void

  const presentation = useCanvasPresentation({
    getDocument: () => state.document,
    getSettings: getPluginSettings,
    clearSelection: () => {
      state.selectedEdgeId = ""
      state.selectedNodeIds = []
    },
    selectNode: (nodeId: string) => {
      state.selectedNodeIds = [nodeId]
    },
    focusNode: (nodeId: string) => {
      focusNodeByIdFn?.(nodeId)
    },
    saveRecordedPath: (path: string[]) => {
      commitDocument({
        ...state.document,
        presentation: {
          ...((state.document.presentation as Record<string, unknown> | undefined) ?? {}),
          recordedPath: path,
        },
      })
    },
  })

  // 跟踪 filePath 变化（newCanvas / open* 都会改 filePath），切换文档时清空历史
  watch(
    () => state.filePath,
    () => {
      clearHistory()
    },
  )

  const canUndo = computed(() => {
    // 读 historyVersion 触发重算
    void historyVersion.value
    return history.canUndo
  })
  const canRedo = computed(() => {
    void historyVersion.value
    return history.canRedo
  })
  const readonly = computed(() => Boolean(state.conflict || plugin.isMobile || presentation.isActive))
  const {
    addNode,
    addNodeAtPosition,
    applyEdgeColor,
    applySelectedNodeAsEdgeSource,
    applySelectionColor,
    applySelectionLayout,
    cancelEdgeLabelEditing,
    centerEdgeInViewport,
    centerSelectionInViewport,
    focusNodeById,
    closeCreateEdgeDialog,
    createEdgeFromSelection,
    createMindMapChildNode,
    createMindMapSiblingNode,
    createGroupFromSelection,
    deleteSelection,
    getRenderedMarkdown,
    isRelayouting,
    openCreateEdgeDialog,
    relayoutConnectedNodes,
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
    applySelectedNodeChanges,
    updateEditingEdgeLabel,
    updateNodeField,
    updateNumericNodeField,
    updateSelectedEdgeDirection,
    updateTextNodeContent,
    zoomIn,
    zoomOut,
    convertTextToLink,
    convertLinkToText,
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
    getSettings: getPluginSettings,
    newEdgeFromSide,
    newEdgeLabel,
    newEdgeSourceId,
    newEdgeSourceQuery,
    newEdgeTargetId,
    newEdgeTargetQuery,
    newEdgeToSide,
    presentationActive: computed(() => presentation.isActive),
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

  focusNodeByIdFn = focusNodeById

  // 文件选择器回调 — 用于从添加笔记菜单进入文件选择流程
  const fileSelectCallback = ref<((option: { blockId?: string, kind: string, path: string }) => void) | null>(null)

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
    onFileSelect: (option) => {
      const cb = fileSelectCallback.value
      if (cb) {
        try {
          cb(option)
        }
        catch (e) {
          console.error('Canvas file select callback error:', e)
        }
        return true
      }
      return false
    },
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
    workspaceDocuments: workspaceTree.workspaceDocuments,
  })

  const {
    handleStageDragOver,
    handleStageDrop,
  } = createCanvasEditorStageDropActions({
    board,
    commitDocument,
    fileSource,
    refreshFileNodeMetadata,
    selectNode,
    state,
    t,
    viewport,
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
    t,
  })
  const {
    clearConnectionDraft,
    clearEdgeReconnectDraft,
    clearSelectionBox,
    finishConnectionDrag,
    finishPendingCardCreation,
    clearPendingCardCreation,
    getConnectionDraftPath,
    getEdgeReconnectDraftPath,
    handleNodePointerDown,
    handleWheelZoom,
    isConnectionTarget,
    startEdgeEndpointDrag,
    startEdgePointerDown,
    startConnectionDrag,
    startCornerResize,
    startDrag,
    startPan,
    startResize,
  } = createCanvasEditorGestureHandlers({
    alignmentGuides,
    board,
    commitDocument,
    connectionDraft,
    edgeReconnectDraft,
    getAnchor,
    gridEnabled,
    pendingCardCreation,
    readonly,
    selectionBox,
    selectedEdge,
    stageRef,
    state,
    viewport,
    showNodeHeader: computed(() => getPluginSettings().showNodeHeader),
  })

  const { handleKeydown } = createCanvasEditorKeyboardHandler({
    canDelete: () => canDelete.value,
    cancelEdgeLabelEditing,
    closeEdgePopover,
    closeFloatLayer,
    closeSelectionPopover,
    createMindMapChildNode,
    createMindMapSiblingNode,
    deleteSelection,
    duplicateSelection,
    getEdgeToolbarPopover: () => edgeToolbarPopover.value,
    getEditingEdgeLabelId: () => editingEdgeLabelId.value,
    getSelectionToolbarPopover: () => selectionToolbarPopover.value,
    hasFloatLayer: () => floatLayerActive.value,
    openFilePickerDialog,
    redo,
    save,
    silentSave,
    selectAllNodes: () => state.selectAllNodes(),
    selectEdge: () => state.selectEdge(),
    selectNode: () => state.selectNode(),
    showFloatLayerForSelection,
    undo,
    zoomIn,
    zoomOut,
    zoomToActualSize,
    zoomToFit,
  })

  function getCanvasSearchTitle() {
    return getFileName(state.filePath) || suggestedFilename.value || t("untitledCanvas")
  }

  function getFileNodeSearchTextById() {
    const textById = new Map<string, string>()
    for (const node of state.document.nodes) {
      if (node.type !== "file") {
        continue
      }

      const resolved = getResolvedFileNode(node)
      textById.set(node.id, [
        resolved.title,
        resolved.path,
        resolved.detail,
        resolved.excerptHtml?.replace(/<[^>]+>/g, " "),
      ].filter(Boolean).join("\n"))
    }

    return textById
  }

  function createCanvasSearchHost(root: HTMLElement) {
    return {
      version: 1 as const,
      root,
      getContext: () => ({
        filePath: state.filePath,
        id: `canvas:${state.filePath || getCanvasSearchTitle()}`,
        readonly: readonly.value,
        title: getCanvasSearchTitle(),
      }),
      getSnapshot: async () => ({
        revision: createCanvasSearchRevision(
          state.filePath || getCanvasSearchTitle(),
          state.document.nodes.length,
          JSON.stringify(state.document),
        ),
        targets: collectCanvasSearchTargets({
          document: state.document,
          fileNodeTextById: getFileNodeSearchTextById(),
        }),
      }),
      replaceTextRanges: async (
        targetId: string,
        ranges: Array<{ end: number, start: number, text: string }>,
      ) => {
        const result = replaceCanvasTextTargetRanges({
          document: state.document,
          ranges,
          targetId,
        })
        if (result.appliedCount > 0) {
          commitDocument(result.document)
        }

        return {
          appliedCount: result.appliedCount,
          revision: createCanvasSearchRevision(
            state.filePath || getCanvasSearchTitle(),
            result.document.nodes.length,
            JSON.stringify(result.document),
          ),
        }
      },
      reveal: async (targetId: string) => {
        const parsed = parseCanvasTargetId(targetId)
        if (!parsed || parsed.type !== "node") {
          return false
        }

        state.selectNode(parsed.id)
        centerSelectionInViewport()
        return true
      },
      subscribe: (listener: () => void) => {
        searchListeners.add(listener)
        return () => {
          searchListeners.delete(listener)
        }
      },
      syncDecorations: (decorations: CanvasSearchDecoration[]) => {
        searchDecorations.value = decorations
      },
    }
  }

  onMounted(async () => {
    await initializeCanvasEditor({
      bootstrap,
      fileSource,
      getFileName,
      newCanvas,
      refreshFileNodeMetadata,
      refreshRecentFiles,
      refreshWorkspaceDocuments: workspaceTree.refreshWorkspaceDocuments,
      rememberRecentPath,
      resetViewport,
      state,
      suggestedFilename,
      t,
    })
    window.addEventListener("keydown", handleKeydown)
    window.addEventListener("siyuan-canvas-settings-changed", handleExternalSettingsChange)
    const hostRoot = stageRef.value?.closest<HTMLElement>(".siyuan-canvas__tab")
      ?? stageRef.value
    if (hostRoot) {
      unregisterCanvasSearchHost = registerCanvasSearchHost(createCanvasSearchHost(hostRoot))
    }
  })

  onBeforeUnmount(() => {
    closeFloatLayer()
    unregisterCanvasSearchHost?.()
    unregisterCanvasSearchHost = null
    window.removeEventListener("keydown", handleKeydown)
    window.removeEventListener("siyuan-canvas-settings-changed", handleExternalSettingsChange)
    blockJumpHighlighter.dispose()
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
      relayoutConnectedNodes,
      activateCanvasSurface,
      board,
      bottomToolbarVisible,
      canDelete,
      canDecomposeSelectedDocument,
      canConvertSelectionToDocument,
      canConvertSelectionToText,
      canRefreshSelectedSiyuanNode,
      canRelayoutConnectedNodes,
      centerEdgeInViewport,
      centerSelectionInViewport,
      focusNodeById,
      closeCreateEdgeDialog,
      closeEdgePopover,
      closeSelectionPopover,
      createGroupFromSelection,
      createEdgeDialog,
      filePickerDialog,
      displayNodes,
      deactivateCanvasSurface,
      createWorkspaceFolder: workspaceTree.createWorkspaceFolder,
      deleteWorkspaceDocument: workspaceTree.deleteWorkspaceDocument,
      deleteWorkspaceFolder: workspaceTree.deleteWorkspaceFolder,
      openInExplorer: workspaceTree.openInExplorer,
      moveWorkspaceFile: workspaceTree.moveWorkspaceFile,
      renameWorkspaceDocument: workspaceTree.renameWorkspaceDocument,
      renameWorkspaceFolder: workspaceTree.renameWorkspaceFolder,
      copyWorkspaceDocument: workspaceTree.copyWorkspaceDocument,
      expandAllInspectorSections,
      removeRecentFileRecord,
      connectionDraft,
      pendingCardCreation,
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
      exportCanvasPng,
      fileInputRef,
      finishConnectionDrag,
      finishPendingCardCreation,
      clearPendingCardCreation,
      getEdgeLabelPosition,
      getEdgePath,
      getConnectionDraftPath,
      getEdgeReconnectDraftPath,
      getFileName,
      getFileNodeDescription,
      getFileNodeKind,
      getFileNodePreview,
      getPluginSettings,
      getNodeStyle,
      getNodeTitle,
      importCanvas,
      isConnectionTarget,
      isRelayouting,
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
      fileSelectCallback,
      openPath,
      openRecentFile,
      resetViewport,
      save,
      silentSave,
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
      convertTextToLink,
      convertLinkToText,
      convertSelectionToDocument,
      convertSelectionToText,
      updateEdgeField,
      updateEdgeSide,
      applySelectedNodeChanges,
      updateNodeField,
      updateNumericNodeField,
      viewport,
      zoomIn,
      zoomOut,
      zoomToActualSize,
      alignmentGuides,
      gridEnabled,
      toggleGrid,
      zoomToFit,
      undo,
      redo,
      canUndo,
      canRedo,
      readonly,
      isSaving,
      duplicateSelection,
      getRenderedMarkdown,
      handleClipboardImagePaste,
      handleStageDragOver,
      handleStageDrop,
      handleNodePointerDown,
      handleWheelZoom,
      inspectorExpanded,
      inspectorSectionState,
      addNode,
      addNodeAtPosition,
      createEdgeFromSelection,
      deleteSelection,
      activateNode,
      loadConflictVersion,
      openRecentPath,
      openSettings,
      openWorkspacePath,
      overwriteConflictVersion,
      recentFiles,
      searchDecorations,
      refreshSelectedSiyuanNode,
      decomposeSelectedDocument,
      expandAllFolders: workspaceTree.expandAllFolders,
      collapseAllFolders: workspaceTree.collapseAllFolders,
      allFoldersExpanded: workspaceTree.allFoldersExpanded,
      expandedFolders: workspaceTree.expandedFolders,
      setWorkspaceSortDirection: workspaceTree.setWorkspaceSortDirection,
      setWorkspaceSortField: workspaceTree.setWorkspaceSortField,
      toggleFolderExpand: workspaceTree.toggleFolderExpand,
      workspaceDocuments: workspaceTree.workspaceDocuments,
      workspaceSortDirection: workspaceTree.workspaceSortDirection,
      workspaceSortField: workspaceTree.workspaceSortField,
      selectionColors,
      colorThemeId,
      colorThemes: CANVAS_COLOR_THEMES,
      currentColorStyles,
      setColorTheme,
      selectionLayoutActions,
      selectionToolbar,
      selectionToolbarPopover,
      selectedEdgeHandlePositions,
      setSelectionToolbarSize,
      setEdgeToolbarSize,
      startEdgeEndpointDrag,
      startEdgePointerDown,
      startEdgeLabelEditing,
      submitEdgeLabelEditing,
      cancelEdgeLabelEditing,
      updateEditingEdgeLabel,
      toggleInspector,
      toggleEdgePopover,
      toggleSelectionPopover,
      updateSelectedEdgeDirection,
      selectedEdgeDirectionMode,
      presentation,
      defaultCanvasDirectory: computed(() => getPluginSettings().defaultCanvasDirectory),
    },
    ["fileInputRef", "stageRef"],
  )
}

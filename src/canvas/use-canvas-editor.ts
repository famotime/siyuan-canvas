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
  CanvasPluginSettings,
  CanvasRecentFile,
} from "@/canvas/plugin-data"
import type { ResolvedCanvasFileNode } from "@/canvas/file-node-resolution"
import type { CanvasPluginBridge } from "@/canvas/use-canvas-editor-shared"

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
  createCanvasBoardMetrics,
  toBoardX,
  toBoardY,
} from "@/canvas/board"
import {
  applyCanvasNodeLayout,
  createCanvasGroupForNodes,
  createCanvasEdge,
  createCanvasNode,
  getCanvasSelectionBounds,
  setCanvasNodesColor,
  removeCanvasEdge,
  removeCanvasNode,
  removeCanvasNodes,
  upsertCanvasEdge,
  upsertCanvasNode,
} from "@/canvas/document"
import { createCanvasEditorBindings } from "@/canvas/editor-bindings"
import { CanvasEditorState } from "@/canvas/editor-state"
import { createCanvasEditorFileActions } from "@/canvas/use-canvas-editor-file-actions"
import { createCanvasEditorFileNodeHelpers } from "@/canvas/use-canvas-editor-file-nodes"
import {
  createCanvasEditorGestureHandlers,
  type CanvasEditorConnectionDraftState,
  type CanvasEditorSelectionBoxState,
} from "@/canvas/use-canvas-editor-gestures"
import {
  getCanvasFileName,
} from "@/canvas/use-canvas-editor-shared"
import { renderMarkdownPreview } from "@/canvas/markdown-preview"
import { createDefaultCanvasPluginSettings } from "@/canvas/plugin-data"
import { CanvasFileService } from "@/canvas/file-service"
import {
  parseCanvasDocument,
  validateCanvasDocument,
} from "@/canvas/format"
import { createCanvasI18n } from "@/i18n/canvas"
import { getCanvasNodeAnchor } from "@/canvas/node-interaction"
import { SiyuanCanvasTextGateway } from "@/canvas/siyuan-text-gateway"
import { clampViewportScale } from "@/canvas/viewport"
import {
  centerViewportOnBounds,
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
  const fileNodeMeta = ref<Record<string, ResolvedCanvasFileNode>>({})
  const stageRef = ref<HTMLElement>()
  const recentFiles = ref<CanvasRecentFile[]>([])
  const suggestedFilename = ref(bootstrap.title || t("untitledCanvas"))
  const selectionToolbarPopover = ref<"closed" | "color" | "layout">("closed")
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
  const newEdgeFromSide = ref<CanvasSide>("right")
  const newEdgeLabel = ref("")
  const newEdgeTargetId = ref("")
  const newEdgeToSide = ref<CanvasSide>("left")
  const inspectorExpanded = ref(true)

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
  const edgeTargets = computed(() =>
    state.document.nodes.filter((node) => node.id !== state.selectedNodeId),
  )
  const board = computed(() => createCanvasBoardMetrics(state.document.nodes))
  const canDelete = computed(() => Boolean(state.selectedNodeIds.length || selectedEdge.value))
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

  function refreshRecentFiles() {
    recentFiles.value = plugin.getRecentCanvasFiles?.() ?? []
  }

  watch(
    () => [state.filePath, state.isDirty, suggestedFilename.value],
    () => {
      const title = state.filePath.split("/").pop() || suggestedFilename.value || t("untitledCanvas")
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

  function getCurvePath(
    from: { x: number, y: number },
    to: { x: number, y: number },
  ) {
    const midX = (from.x + to.x) / 2
    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`
  }

  function getEdgePath(edge: CanvasEdge): string {
    const fromNode = state.document.nodes.find((node) => node.id === edge.fromNode)
    const toNode = state.document.nodes.find((node) => node.id === edge.toNode)
    if (!fromNode || !toNode) {
      return ""
    }

    const from = getAnchor(fromNode, edge.fromSide)
    const to = getAnchor(toNode, edge.toSide)
    return getCurvePath(from, to)
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
    return {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - 8,
    }
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

  function setSelectionToolbarSize(size: { height: number, width: number }) {
    if (size.width > 0) {
      selectionToolbarSize.width = size.width
    }

    if (size.height > 0) {
      selectionToolbarSize.height = size.height
    }
  }

  const {
    ensureCanvasPath,
    exportCanvas,
    importCanvas,
    loadConflictVersion,
    newCanvas,
    openPath,
    openRecentPath,
    openSettings,
    overwriteConflictVersion,
    rememberRecentPath,
    save,
    triggerImport,
  } = createCanvasEditorFileActions({
    fileInputRef,
    getPluginSettings,
    plugin,
    refreshRecentFiles,
    resetViewport,
    state,
    suggestedFilename,
    t,
  })

  function selectNode(nodeId: string, event?: MouseEvent) {
    state.selectNode(nodeId, {
      additive: Boolean(event?.ctrlKey || event?.metaKey || event?.shiftKey),
    })
  }

  function selectEdge(edgeId: string) {
    state.selectEdge(edgeId)
  }

  function getRenderedMarkdown(text: string): string {
    return renderMarkdownPreview(text)
  }

  function addNode(type: CanvasNode["type"]) {
    const node = createCanvasNode(type)
    node.x = Math.round((200 - viewport.x) / viewport.scale + board.value.left)
    node.y = Math.round((160 - viewport.y) / viewport.scale + board.value.top)
    commitDocument(upsertCanvasNode(state.document, node))
    state.selectNode(node.id)
  }

  function deleteSelection() {
    if (state.selectedNodeIds.length > 0) {
      commitDocument(
        state.selectedNodeIds.length === 1
          ? removeCanvasNode(state.document, state.selectedNodeIds[0]!)
          : removeCanvasNodes(state.document, state.selectedNodeIds),
      )
      state.selectNode()
      closeSelectionPopover()
      return
    }

    if (selectedEdge.value) {
      commitDocument(removeCanvasEdge(state.document, selectedEdge.value.id))
      state.selectEdge()
      closeSelectionPopover()
    }
  }

  function centerSelectionInViewport() {
    const stage = stageRef.value
    const bounds = selectionBounds.value

    if (!stage || !bounds) {
      return
    }

    const nextViewport = centerViewportOnBounds(
      viewport,
      {
        height: stage.clientHeight,
        width: stage.clientWidth,
      },
      bounds,
      {
        left: board.value.left,
        top: board.value.top,
      },
    )

    viewport.scale = nextViewport.scale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
    closeSelectionPopover()
  }

  function applySelectionColor(color: string) {
    if (!state.selectedNodeIds.length) {
      return
    }

    commitDocument(setCanvasNodesColor(state.document, state.selectedNodeIds, color))
    closeSelectionPopover()
  }

  function createGroupFromSelection() {
    if (!state.selectedNodeIds.length) {
      return
    }

    const {
      document: nextDocument,
      groupId,
    } = createCanvasGroupForNodes(state.document, state.selectedNodeIds)

    commitDocument(nextDocument)
    state.selectNode(groupId)
    closeSelectionPopover()
  }

  function applySelectionLayout(action: CanvasNodeLayoutAction) {
    if (!state.selectedNodeIds.length) {
      return
    }

    commitDocument(applyCanvasNodeLayout(state.document, state.selectedNodeIds, action))
    closeSelectionPopover()
  }

  function toggleSelectionPopover(popover: "color" | "layout") {
    if (!state.selectedNodeIds.length) {
      closeSelectionPopover()
      return
    }

    selectionToolbarPopover.value = selectionToolbarPopover.value === popover ? "closed" : popover
  }

  function updateNode(node: CanvasNode) {
    commitDocument(upsertCanvasNode(state.document, node))
    if (node.type === "file") {
      void refreshFileNodeMetadata()
    }
  }

  function updateTextNodeContent(nodeId: string, text: string) {
    const node = state.document.nodes.find((candidate) => candidate.id === nodeId)
    if (!node || node.type !== "text") {
      return
    }

    updateNode({
      ...node,
      text,
    })
  }

  function updateNodeField(field: string, value: string) {
    if (!selectedNode.value) {
      return
    }

    updateNode({
      ...selectedNode.value,
      [field]: value,
    })
  }

  function updateNumericNodeField(field: "height" | "width" | "x" | "y", value: string) {
    if (!selectedNode.value) {
      return
    }

    const numeric = Number.parseFloat(value)
    if (Number.isNaN(numeric)) {
      return
    }

    updateNode({
      ...selectedNode.value,
      [field]: numeric,
    })
  }

  function updateEdge(edge: CanvasEdge) {
    commitDocument(upsertCanvasEdge(state.document, edge))
  }

  function updateEdgeField(field: "label", value: string) {
    if (!selectedEdge.value) {
      return
    }

    updateEdge({
      ...selectedEdge.value,
      [field]: value,
    })
  }

  function updateEdgeSide(field: "fromSide" | "toSide", value: string) {
    if (!selectedEdge.value) {
      return
    }

    updateEdge({
      ...selectedEdge.value,
      [field]: value as CanvasSide,
    })
  }

  function createEdgeFromSelection() {
    if (!selectedNode.value || !newEdgeTargetId.value) {
      showMessage(t("messageSelectTargetNodeFirst"), 2500, "error")
      return
    }

    const edge = createCanvasEdge(selectedNode.value.id, newEdgeTargetId.value)
    edge.label = newEdgeLabel.value || undefined
    edge.fromSide = newEdgeFromSide.value
    edge.toSide = newEdgeToSide.value
    commitDocument(upsertCanvasEdge(state.document, edge))
    state.selectEdge(edge.id)
    newEdgeLabel.value = ""
    newEdgeTargetId.value = ""
  }

  function zoomIn() {
    viewport.scale = clampViewportScale(Number((viewport.scale + 0.1).toFixed(2)))
  }

  function zoomOut() {
    viewport.scale = clampViewportScale(Number((viewport.scale - 0.1).toFixed(2)))
  }

  function toggleInspector() {
    inspectorExpanded.value = !inspectorExpanded.value
  }

  function activateNode(node: CanvasNode) {
    if (node.type === "link") {
      window.open(node.url, "_blank", "noopener,noreferrer")
      return
    }

    if (node.type === "file") {
      const resolved = getResolvedFileNode(node)
      if (resolved.kind === "canvas") {
        const path = ensureCanvasPath(node.file)
        void plugin.openCanvasTab?.({ path })
        return
      }

      if (resolved.kind === "document" && resolved.document) {
        void openTab({
          app: plugin.app,
          doc: {
            id: resolved.document.id,
          },
          keepCursor: true,
          openNewTab: true,
        })
        return
      }

      if (resolved.kind === "asset" && resolved.asset) {
        void openTab({
          app: plugin.app,
          asset: {
            path: resolved.asset.openPath,
          },
          keepCursor: true,
          openNewTab: true,
        })
        return
      }

      showMessage(resolved.description || node.file, 2500, "info")
      return
    }

    showMessage(getNodeTitle(node), 2500, "info")
  }
  const {
    clearConnectionDraft,
    clearSelectionBox,
    finishConnectionDrag,
    getConnectionDraftPath,
    handleNodePointerDown,
    handleWheelZoom,
    isConnectionTarget,
    startConnectionDrag,
    startCornerResize,
    startDrag,
    startPan,
    startResize,
  } = createCanvasEditorGestureHandlers({
    board,
    commitDocument,
    connectionDraft,
    getAnchor,
    selectionBox,
    stageRef,
    state,
    viewport,
  })

  function isEditingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isEditingTarget(event.target)) {
      return
    }

    const key = event.key.toLowerCase()
    const isAccelerator = event.ctrlKey || event.metaKey

    if ((event.key === "Delete" || event.key === "Backspace") && canDelete.value) {
      event.preventDefault()
      deleteSelection()
      return
    }

    if (event.key === "Escape") {
      if (selectionToolbarPopover.value !== "closed") {
        closeSelectionPopover()
        return
      }

      state.selectNode()
      state.selectEdge()
      return
    }

    if (isAccelerator && key === "a") {
      event.preventDefault()
      state.selectAllNodes()
      return
    }

    if (isAccelerator && key === "s") {
      event.preventDefault()
      void save()
    }
  }

  onMounted(async () => {
    if (bootstrap.raw) {
      const parsed = parseCanvasDocument(bootstrap.raw)
      if (parsed.document) {
        state.replaceDocument(parsed.document, bootstrap.path || "")
        state.issues = {
          errors: parsed.errors,
          warnings: parsed.warnings,
        }
      }
    } else if (bootstrap.path) {
      try {
        await state.open(bootstrap.path)
        suggestedFilename.value = getFileName(bootstrap.path)
        await rememberRecentPath(bootstrap.path)
      } catch (error) {
        showMessage(error instanceof Error ? error.message : t("messageUnableOpenCanvasFile"), 4000, "error")
      }
    } else {
      newCanvas()
    }

    refreshRecentFiles()
    await refreshFileNodeMetadata()
    resetViewport()
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
      closeSelectionPopover()
      clearSelectionBox()
    },
  )

  return createCanvasEditorBindings(
    {
      applySelectionColor,
      applySelectionLayout,
      board,
      canDelete,
      centerSelectionInViewport,
      closeSelectionPopover,
      createGroupFromSelection,
      displayNodes,
      connectionDraft,
      edgeTargets,
      exportCanvas,
      fileInputRef,
      finishConnectionDrag,
      getEdgeLabelPosition,
      getEdgePath,
      getConnectionDraftPath,
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
      newEdgeTargetId,
      newEdgeToSide,
      openPath,
      resetViewport,
      save,
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
      suggestedFilename,
      triggerImport,
      updateTextNodeContent,
      updateEdgeField,
      updateEdgeSide,
      updateNodeField,
      updateNumericNodeField,
      viewport,
      zoomIn,
      zoomOut,
      getRenderedMarkdown,
      handleNodePointerDown,
      handleWheelZoom,
      inspectorExpanded,
      addNode,
      createEdgeFromSelection,
      deleteSelection,
      activateNode,
      loadConflictVersion,
      openRecentPath,
      openSettings,
      overwriteConflictVersion,
      recentFiles,
      selectionColors,
      selectionLayoutActions,
      selectionToolbar,
      selectionToolbarPopover,
      setSelectionToolbarSize,
      toggleInspector,
      toggleSelectionPopover,
    },
    ["fileInputRef", "stageRef"],
  )
}

import type { Plugin } from "siyuan"
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
  findSiyuanAssetByPath,
  findSiyuanDocumentByPath,
} from "@/api"
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
  createEmptyCanvasDocument,
  getCanvasSelectionBounds,
  setCanvasNodesColor,
  removeCanvasEdge,
  removeCanvasNode,
  removeCanvasNodes,
  setCanvasNodeGeometry,
  upsertCanvasEdge,
  upsertCanvasNode,
} from "@/canvas/document"
import { createCanvasEditorBindings } from "@/canvas/editor-bindings"
import { CanvasEditorState } from "@/canvas/editor-state"
import { createCanvasFileNodePreview } from "@/canvas/file-node-preview"
import {
  createFallbackCanvasFileNode,
  resolveCanvasFileNode,
} from "@/canvas/file-node-resolution"
import { renderMarkdownPreview } from "@/canvas/markdown-preview"
import { createDefaultCanvasPluginSettings } from "@/canvas/plugin-data"
import { CanvasFileService } from "@/canvas/file-service"
import {
  parseCanvasDocument,
  validateCanvasDocument,
} from "@/canvas/format"
import { createCanvasI18n } from "@/i18n/canvas"
import {
  CONNECTION_SNAP_DISTANCE,
  findNearestCanvasAnchor,
  getCanvasNodeAnchor,
  resizeCanvasNodeFromCorner,
  resizeCanvasNodeFromSide,
} from "@/canvas/node-interaction"
import { SiyuanCanvasTextGateway } from "@/canvas/siyuan-text-gateway"
import {
  clampViewportScale,
  scaleViewportAtPoint,
} from "@/canvas/viewport"
import {
  createBoundsFromPoints,
  centerViewportOnBounds,
  resolveMarqueeSelectionNodeIds,
  resolveDragNodeIds,
  resolveSelectionToolbarPosition,
} from "@/canvas/selection-toolbar"

interface CanvasPlugin extends Plugin {
  app: unknown
  getCanvasSettings?: () => CanvasPluginSettings
  getRecentCanvasFiles?: () => CanvasRecentFile[]
  i18n?: Record<string, string>
  rememberRecentCanvas?: (path: string, title?: string) => Promise<void>
  openCanvasSettings?: () => void
  openCanvasTab?: (bootstrap?: CanvasTabBootstrap) => Promise<void>
}

const SIDES: CanvasSide[] = ["top", "right", "bottom", "left"]
const DEFAULT_SELECTION_TOOLBAR_SIZE = {
  height: 48,
  width: 220,
}
const SELECTION_COLORS = ["1", "2", "3", "4", "5", "6"] as const

export function useCanvasEditor(
  plugin: CanvasPlugin,
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
  const selectionBox = reactive({
    height: 0,
    visible: false,
    width: 0,
    x: 0,
    y: 0,
  })
  const connectionDraft = reactive({
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
  let fileNodeResolveVersion = 0

  function getPluginSettings(): CanvasPluginSettings {
    return (plugin as CanvasPlugin).getCanvasSettings?.() ?? createDefaultCanvasPluginSettings()
  }

  function refreshRecentFiles() {
    recentFiles.value = (plugin as CanvasPlugin).getRecentCanvasFiles?.() ?? []
  }

  watch(
    () => [state.filePath, state.isDirty, suggestedFilename.value],
    () => {
      const title = state.filePath.split("/").pop() || suggestedFilename.value || t("untitledCanvas")
      setTitle(`${state.isDirty ? "● " : ""}${title}`)
    },
    { immediate: true },
  )

  function getFileName(path: string): string {
    return path.split("/").pop() || path
  }

  function getResolvedFileNode(node: CanvasNode): ResolvedCanvasFileNode {
    if (node.type !== "file") {
      throw new Error("Resolved file-node metadata requested for a non-file node.")
    }

    return fileNodeMeta.value[node.id] || createFallbackCanvasFileNode(node.file)
  }

  function getNodeTitle(node: CanvasNode): string {
    switch (node.type) {
      case "file":
        return getResolvedFileNode(node).title
      case "group":
        return node.label || t("nodeDefaultGroupLabel")
      case "link":
        return t("nodeKindExternalLink")
      case "text":
        return node.text.split("\n")[0] || t("nodeKindText")
      default:
        return node.type
    }
  }

  function getFileNodeDescription(node: CanvasNode): string {
    if (node.type !== "file") {
      return ""
    }

    return getResolvedFileNode(node).description
  }

  function getFileNodeKind(node: CanvasNode): string {
    if (node.type !== "file") {
      return ""
    }

    return getResolvedFileNode(node).kind
  }

  function getFileNodePreview(node: CanvasNode) {
    if (node.type !== "file") {
      throw new Error("File-node preview requested for a non-file node.")
    }

    return createCanvasFileNodePreview(getResolvedFileNode(node))
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

  function clearSelectionBox() {
    selectionBox.visible = false
    selectionBox.x = 0
    selectionBox.y = 0
    selectionBox.width = 0
    selectionBox.height = 0
  }

  function clearConnectionDraft() {
    connectionDraft.fromNodeId = ""
    connectionDraft.fromSide = "right"
    connectionDraft.toNodeId = ""
    connectionDraft.toSide = "left"
    connectionDraft.toX = 0
    connectionDraft.toY = 0
    connectionDraft.visible = false
  }

  function ensureCanvasPath(input: string): string {
    const trimmed = input.trim()
    if (!trimmed) {
      return ""
    }

    const normalized = trimmed.endsWith(".canvas") ? trimmed : `${trimmed}.canvas`
    const baseDirectory = getPluginSettings().defaultCanvasDirectory
    return normalized.startsWith("/") ? normalized : `${baseDirectory}/${normalized}`
  }

  async function rememberRecentPath(path: string) {
    await (plugin as CanvasPlugin).rememberRecentCanvas?.(path, getFileName(path))
    refreshRecentFiles()
  }

  async function refreshFileNodeMetadata() {
    const version = ++fileNodeResolveVersion
    const fileNodes = state.document.nodes.filter((node): node is Extract<CanvasNode, { type: "file" }> => node.type === "file")
    const nextEntries = await Promise.all(fileNodes.map(async (node) => {
      const resolved = await resolveCanvasFileNode(node.file, {
        resolveAssetByPath: findSiyuanAssetByPath,
        resolveDocumentByPath: findSiyuanDocumentByPath,
      })
      return [node.id, resolved] as const
    }))

    if (version !== fileNodeResolveVersion) {
      return
    }

    fileNodeMeta.value = Object.fromEntries(nextEntries)
  }

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

  function newCanvas() {
    state.replaceDocument(createEmptyCanvasDocument(), "")
    suggestedFilename.value = t("untitledCanvas")
    resetViewport()
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

  async function openPath() {
    // eslint-disable-next-line no-alert
    const input = window.prompt(
      t("promptWorkspacePath"),
      state.filePath || `${getPluginSettings().defaultCanvasDirectory}/${t("untitledCanvas")}`,
    )
    const path = ensureCanvasPath(input || "")
    if (!path) {
      return
    }

    try {
      await state.open(path)
      suggestedFilename.value = getFileName(path)
      await rememberRecentPath(path)
      resetViewport()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOpenCanvasFile"), 4000, "error")
    }
  }

  function triggerImport() {
    fileInputRef.value?.click()
  }

  async function importCanvas(file: File) {
    const raw = await file.text()
    const parsed = parseCanvasDocument(raw)
    if (!parsed.document) {
      showMessage(parsed.errors[0]?.message || t("messageInvalidCanvasFile"), 4000, "error")
      return
    }

    suggestedFilename.value = file.name
    state.replaceDocument(parsed.document, "")
    state.issues = {
      errors: parsed.errors,
      warnings: parsed.warnings,
    }
    resetViewport()
  }

  async function save() {
    // eslint-disable-next-line no-alert
    const input = window.prompt(
      t("promptWorkspaceSavePath"),
      state.filePath || `${getPluginSettings().defaultCanvasDirectory}/${suggestedFilename.value || t("untitledCanvas")}`,
    )
    const path = ensureCanvasPath(input || "")
    if (!path) {
      return
    }

    try {
      await state.save(path, {
        detectExternalChanges: getPluginSettings().detectExternalChanges,
      })
      suggestedFilename.value = getFileName(path)
      await rememberRecentPath(path)
      showMessage(t("messageCanvasSavedToWorkspace"), 2500, "info")
    } catch (error) {
      if (state.conflict) {
        showMessage(t("messageCanvasFileChangedOnDisk"), 5000, "error")
        return
      }

      showMessage(error instanceof Error ? error.message : t("messageUnableSaveCanvas"), 4000, "error")
    }
  }

  async function openRecentPath(path: string) {
    try {
      await state.open(path)
      suggestedFilename.value = getFileName(path)
      await rememberRecentPath(path)
      resetViewport()
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOpenRecentCanvasFile"), 4000, "error")
    }
  }

  async function overwriteConflictVersion() {
    if (!state.filePath) {
      return
    }

    try {
      await state.save(state.filePath, {
        detectExternalChanges: getPluginSettings().detectExternalChanges,
        force: true,
      })
      await rememberRecentPath(state.filePath)
      showMessage(t("messageCanvasSavedByOverwritingDiskVersion"), 2500, "info")
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("messageUnableOverwriteDiskVersion"), 4000, "error")
    }
  }

  function loadConflictVersion() {
    const conflictPath = state.conflict?.path || state.filePath
    state.loadConflictVersion()
    suggestedFilename.value = getFileName(conflictPath)
    showMessage(t("messageLoadedNewerCanvasVersionFromDisk"), 2500, "info")
  }

  function openSettings() {
    ;(plugin as CanvasPlugin).openCanvasSettings?.()
  }

  function exportCanvas() {
    const blob = new Blob([`${JSON.stringify(state.document, null, "\t")}\n`], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = suggestedFilename.value || state.filePath.split("/").pop() || "canvas-export.canvas"
    anchor.click()
    URL.revokeObjectURL(url)
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
        void (plugin as CanvasPlugin).openCanvasTab?.({ path })
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

  function startPointerGesture(
    event: PointerEvent,
    onMove: (dx: number, dy: number, moveEvent: PointerEvent) => void,
    options: {
      onEnd?: (dx: number, dy: number, upEvent: PointerEvent) => void
    } = {},
  ) {
    const startX = event.clientX
    const startY = event.clientY

    const handleMove = (moveEvent: PointerEvent) => {
      onMove(moveEvent.clientX - startX, moveEvent.clientY - startY, moveEvent)
    }
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      options.onEnd?.(upEvent.clientX - startX, upEvent.clientY - startY, upEvent)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
  }

  function handleWheelZoom(event: WheelEvent) {
    const stage = stageRef.value
    if (!stage) {
      return
    }

    event.preventDefault()
    const rect = stage.getBoundingClientRect()
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const nextScale = clampViewportScale(Number((viewport.scale * Math.exp(-event.deltaY * 0.0015)).toFixed(2)))
    const nextViewport = scaleViewportAtPoint(viewport, point, nextScale)

    viewport.scale = nextViewport.scale
    viewport.x = nextViewport.x
    viewport.y = nextViewport.y
  }

  function isAdditiveSelectionGesture(event: MouseEvent | PointerEvent): boolean {
    return Boolean(event.ctrlKey || event.metaKey || event.shiftKey)
  }

  function isNodeGestureTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    return !target.closest(".canvas-node__resize-handle, .canvas-node__resize-corner, .canvas-node__anchor, a, button, input, textarea, select")
  }

  function isStageGestureTarget(target: EventTarget | null): target is Element {
    if (!(target instanceof Element)) {
      return false
    }

    return !target.closest(".canvas-node, .selection-toolbar")
      && !target.closest(".stage__edge, .stage__edge-label")
      && !target.closest("a, button, input, textarea, select")
  }

  function toCanvasX(stageX: number): number {
    return (stageX - viewport.x) / viewport.scale + board.value.left
  }

  function toCanvasY(stageY: number): number {
    return (stageY - viewport.y) / viewport.scale + board.value.top
  }

  function updateSelectionBox(startPoint: { x: number, y: number }, currentPoint: { x: number, y: number }) {
    const bounds = createBoundsFromPoints(startPoint, currentPoint)

    selectionBox.visible = true
    selectionBox.x = bounds.x
    selectionBox.y = bounds.y
    selectionBox.width = bounds.width
    selectionBox.height = bounds.height
  }

  function finalizeSelectionBox(
    startPoint: { x: number, y: number },
    endPoint: { x: number, y: number },
    options: {
      additive: boolean
    },
  ) {
    const stageBounds = createBoundsFromPoints(startPoint, endPoint)

    clearSelectionBox()

    if (stageBounds.width < 3 && stageBounds.height < 3) {
      if (!options.additive) {
        state.selectNodes([])
      }
      return
    }

    const selectedNodeIds = resolveMarqueeSelectionNodeIds(state.document, {
      height: stageBounds.height / viewport.scale,
      width: stageBounds.width / viewport.scale,
      x: toCanvasX(stageBounds.x),
      y: toCanvasY(stageBounds.y),
    })

    state.selectNodes(selectedNodeIds, { additive: options.additive })
  }

  function startPan(event: PointerEvent) {
    if (event.button === 2) {
      event.preventDefault()
      const initialX = viewport.x
      const initialY = viewport.y
      startPointerGesture(event, (dx, dy) => {
        viewport.x = initialX + dx
        viewport.y = initialY + dy
      })
      return
    }

    if (event.button !== 0 || !isStageGestureTarget(event.target)) {
      return
    }

    const stage = stageRef.value
    if (!stage) {
      return
    }

    event.preventDefault()
    const rect = stage.getBoundingClientRect()
    const startPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    const additive = isAdditiveSelectionGesture(event)

    updateSelectionBox(startPoint, startPoint)
    startPointerGesture(
      event,
      (_dx, _dy, moveEvent) => {
        updateSelectionBox(startPoint, {
          x: moveEvent.clientX - rect.left,
          y: moveEvent.clientY - rect.top,
        })
      },
      {
        onEnd: (_dx, _dy, upEvent) => {
          finalizeSelectionBox(
            startPoint,
            {
              x: upEvent.clientX - rect.left,
              y: upEvent.clientY - rect.top,
            },
            { additive },
          )
        },
      },
    )
  }

  function handleNodePointerDown(node: CanvasNode, event: PointerEvent) {
    if (event.button === 2) {
      startPan(event)
      return
    }

    if (event.button !== 0 || isAdditiveSelectionGesture(event) || !isNodeGestureTarget(event.target)) {
      return
    }

    startDrag(node, event)
  }

  function startDrag(node: CanvasNode, event: PointerEvent) {
    const selectedNodeIds = resolveDragNodeIds(state.document, node.id, state.selectedNodeIds)
    const initialPositions = new Map(
      state.document.nodes
        .filter((candidate) => selectedNodeIds.includes(candidate.id))
        .map((candidate) => [candidate.id, {
          x: candidate.x,
          y: candidate.y,
        }]),
    )
    if (!state.selectedNodeIds.includes(node.id)) {
      state.selectNode(node.id)
    }
    startPointerGesture(event, (dx, dy) => {
      const deltaX = Math.round(dx / viewport.scale)
      const deltaY = Math.round(dy / viewport.scale)
      const movedDocument = state.document.nodes.reduce((document, candidate) => {
        const initial = initialPositions.get(candidate.id)
        if (!initial) {
          return document
        }

        return setCanvasNodeGeometry(document, candidate.id, {
          x: initial.x + deltaX,
          y: initial.y + deltaY,
        })
      }, state.document)

      commitDocument(movedDocument)
    })
  }

  function getStagePoint(event: PointerEvent) {
    const stage = stageRef.value
    if (!stage) {
      return null
    }

    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return null
    }

    const rect = stage.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function updateConnectionTarget(event: PointerEvent) {
    const stagePoint = getStagePoint(event)
    if (!stagePoint) {
      return
    }

    const canvasPoint = {
      x: toCanvasX(stagePoint.x),
      y: toCanvasY(stagePoint.y),
    }
    const target = findNearestCanvasAnchor(state.document.nodes, canvasPoint, {
      excludeNodeId: connectionDraft.fromNodeId,
      maxDistance: CONNECTION_SNAP_DISTANCE,
    })

    connectionDraft.toNodeId = target?.nodeId || ""
    connectionDraft.toSide = target?.side || "left"
    connectionDraft.toX = target?.x ?? canvasPoint.x
    connectionDraft.toY = target?.y ?? canvasPoint.y
  }

  function getConnectionDraftPath() {
    if (!connectionDraft.visible) {
      return ""
    }

    const fromNode = state.document.nodes.find((node) => node.id === connectionDraft.fromNodeId)
    if (!fromNode) {
      return ""
    }

    const from = getAnchor(fromNode, connectionDraft.fromSide)
    const to = {
      x: toBoardX(board.value, connectionDraft.toX),
      y: toBoardY(board.value, connectionDraft.toY),
    }

    return getCurvePath(from, to)
  }

  function isConnectionTarget(nodeId: string, side: CanvasSide) {
    return connectionDraft.visible
      && connectionDraft.toNodeId === nodeId
      && connectionDraft.toSide === side
  }

  function finishConnectionDrag() {
    if (!connectionDraft.fromNodeId || !connectionDraft.toNodeId) {
      clearConnectionDraft()
      return
    }

    const edge = createCanvasEdge(connectionDraft.fromNodeId, connectionDraft.toNodeId)
    edge.fromSide = connectionDraft.fromSide
    edge.toSide = connectionDraft.toSide
    commitDocument(upsertCanvasEdge(state.document, edge))
    state.selectEdge(edge.id)
    clearConnectionDraft()
  }

  function startConnectionDrag(node: CanvasNode, side: CanvasSide, event: PointerEvent) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault?.()
    const anchor = getCanvasNodeAnchor(node, side)
    connectionDraft.fromNodeId = node.id
    connectionDraft.fromSide = side
    connectionDraft.toNodeId = ""
    connectionDraft.toSide = "left"
    connectionDraft.toX = anchor.x
    connectionDraft.toY = anchor.y
    connectionDraft.visible = true

    startPointerGesture(
      event,
      (_dx, _dy, moveEvent) => {
        updateConnectionTarget(moveEvent)
      },
      {
        onEnd: (_dx, _dy, upEvent) => {
          updateConnectionTarget(upEvent)
          finishConnectionDrag()
        },
      },
    )
  }

  function startResize(node: CanvasNode, side: CanvasSide, event: PointerEvent) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault?.()
    startPointerGesture(event, (dx, dy) => {
      commitDocument(setCanvasNodeGeometry(
        state.document,
        node.id,
        resizeCanvasNodeFromSide(node, side, dx / viewport.scale, dy / viewport.scale),
      ))
    })
  }

  function startCornerResize(node: CanvasNode, event: PointerEvent) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault?.()
    startPointerGesture(event, (dx, dy) => {
      commitDocument(setCanvasNodeGeometry(
        state.document,
        node.id,
        resizeCanvasNodeFromCorner(node, dx / viewport.scale, dy / viewport.scale),
      ))
    })
  }

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

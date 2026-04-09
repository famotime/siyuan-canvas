import type {
  CanvasBounds,
  CanvasDocument,
  CanvasEdge,
  CanvasNodeLayoutAction,
  CanvasNode,
  CanvasSide,
} from "@/canvas/types"
import type {
  CanvasPluginSettings,
  CanvasRecentFile,
} from "@/canvas/plugin-data"
import type { ResolvedCanvasFileNode } from "@/canvas/file-node-resolution"

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
import { SiyuanCanvasTextGateway } from "@/canvas/siyuan-text-gateway"
import { scaleViewportAtPoint } from "@/canvas/viewport"
import {
  centerViewportOnBounds,
  resolveDragNodeIds,
  resolveSelectionToolbarPosition,
} from "@/canvas/selection-toolbar"

interface CanvasTabBootstrap {
  path?: string
  raw?: string
  title?: string
}

interface CanvasPlugin {
  app: unknown
  getCanvasSettings?: () => CanvasPluginSettings
  getRecentCanvasFiles?: () => CanvasRecentFile[]
  rememberRecentCanvas?: (path: string, title?: string) => Promise<void>
  openCanvasSettings?: () => void
  openCanvasTab?: (bootstrap?: CanvasTabBootstrap) => Promise<void>
}

const SIDES: CanvasSide[] = ["top", "right", "bottom", "left"]
const SELECTION_TOOLBAR_SIZE = {
  height: 48,
  width: 220,
}
const SELECTION_COLORS = ["1", "2", "3", "4", "5", "6"] as const
const SELECTION_LAYOUT_ACTIONS: Array<{ action: CanvasNodeLayoutAction, label: string }> = [
  { action: "left-align", label: "左对齐" },
  { action: "center-horizontal", label: "水平居中" },
  { action: "right-align", label: "右对齐" },
  { action: "top-align", label: "顶部对齐" },
  { action: "center-vertical", label: "垂直居中" },
  { action: "bottom-align", label: "底部对齐" },
  { action: "arrange-row", label: "排列成行" },
  { action: "arrange-column", label: "排列成列" },
  { action: "arrange-grid", label: "排列成网格" },
  { action: "distribute-horizontal", label: "水平分布" },
  { action: "distribute-vertical", label: "垂直分布" },
  { action: "stretch-horizontal", label: "水平拉伸" },
  { action: "stretch-vertical", label: "垂直拉伸" },
]
let siyuanRuntimePromise: Promise<{
  openTab?: (options: Record<string, unknown>) => unknown
  showMessage?: (message: string, timeout?: number, type?: string) => unknown
}> | null = null
let canvasApiPromise: Promise<{
  findSiyuanAssetByPath?: (path: string) => Promise<unknown>
  findSiyuanDocumentByPath?: (path: string) => Promise<unknown>
}> | null = null

function getSiyuanRuntime() {
  if (!siyuanRuntimePromise) {
    const moduleId = ["si", "yuan"].join("")
    siyuanRuntimePromise = import(/* @vite-ignore */ moduleId).catch(() => ({}))
  }

  return siyuanRuntimePromise
}

function getCanvasApiRuntime() {
  if (!canvasApiPromise) {
    canvasApiPromise = import("@/api").catch(() => ({}))
  }

  return canvasApiPromise
}

function showSiyuanMessage(message: string, timeout?: number, type?: string) {
  void getSiyuanRuntime().then((runtime) => {
    runtime.showMessage?.(message, timeout, type)
  })
}

function openSiyuanTab(options: Record<string, unknown>) {
  void getSiyuanRuntime().then((runtime) => {
    runtime.openTab?.(options)
  })
}

export function useCanvasEditor(
  plugin: CanvasPlugin,
  bootstrap: CanvasTabBootstrap,
  setTitle: (title: string) => void,
) {
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
  const suggestedFilename = ref(bootstrap.title || "Untitled.canvas")
  const selectionToolbarPopover = ref<"closed" | "color" | "layout">("closed")
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
        SELECTION_TOOLBAR_SIZE,
      ),
      visible: state.selectedNodeIds.length > 0,
    }
  })
  const selectionColors = computed(() => [...SELECTION_COLORS])
  const selectionLayoutActions = computed(() => [...SELECTION_LAYOUT_ACTIONS])
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
      const title = state.filePath.split("/").pop() || suggestedFilename.value || "Untitled.canvas"
      setTitle(`${state.isDirty ? "● " : ""}${title}`)
    },
    { immediate: true },
  )

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
  }

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
        return node.label || "Group"
      case "link":
        return "External link"
      case "text":
        return node.text.split("\n")[0] || "Text"
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
    const x = toBoardX(board.value, node.x)
    const y = toBoardY(board.value, node.y)

    switch (side) {
      case "top":
        return {
          x: x + node.width / 2,
          y,
        }
      case "right":
        return {
          x: x + node.width,
          y: y + node.height / 2,
        }
      case "bottom":
        return {
          x: x + node.width / 2,
          y: y + node.height,
        }
      case "left":
        return {
          x,
          y: y + node.height / 2,
        }
      default:
        return {
          x,
          y,
        }
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
    const midX = (from.x + to.x) / 2
    return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`
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
    if (fileNodes.length === 0) {
      fileNodeMeta.value = {}
      return
    }

    const apiRuntime = await getCanvasApiRuntime()
    const nextEntries = await Promise.all(fileNodes.map(async (node) => {
      const resolved = await resolveCanvasFileNode(node.file, {
        resolveAssetByPath: apiRuntime.findSiyuanAssetByPath,
        resolveDocumentByPath: apiRuntime.findSiyuanDocumentByPath,
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
    suggestedFilename.value = "Untitled.canvas"
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
      showSiyuanMessage("Select a target node first.", 2500, "error")
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
    viewport.scale = clamp(Number((viewport.scale + 0.1).toFixed(2)), 0.3, 2.5)
  }

  function zoomOut() {
    viewport.scale = clamp(Number((viewport.scale - 0.1).toFixed(2)), 0.3, 2.5)
  }

  function toggleInspector() {
    inspectorExpanded.value = !inspectorExpanded.value
  }

  async function openPath() {
    // eslint-disable-next-line no-alert
    const input = window.prompt(
      "Workspace path",
      state.filePath || `${getPluginSettings().defaultCanvasDirectory}/untitled.canvas`,
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
      showSiyuanMessage(error instanceof Error ? error.message : "Unable to open canvas file.", 4000, "error")
    }
  }

  function triggerImport() {
    fileInputRef.value?.click()
  }

  async function importCanvas(file: File) {
    const raw = await file.text()
    const parsed = parseCanvasDocument(raw)
    if (!parsed.document) {
      showSiyuanMessage(parsed.errors[0]?.message || "Invalid canvas file.", 4000, "error")
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
      "Workspace save path",
      state.filePath || `${getPluginSettings().defaultCanvasDirectory}/${suggestedFilename.value || "untitled.canvas"}`,
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
      showSiyuanMessage("Canvas saved to workspace.", 2500, "info")
    } catch (error) {
      if (state.conflict) {
        showSiyuanMessage("Canvas file changed on disk. Review the conflict panel before saving again.", 5000, "error")
        return
      }

      showSiyuanMessage(error instanceof Error ? error.message : "Unable to save canvas.", 4000, "error")
    }
  }

  async function openRecentPath(path: string) {
    try {
      await state.open(path)
      suggestedFilename.value = getFileName(path)
      await rememberRecentPath(path)
      resetViewport()
    } catch (error) {
      showSiyuanMessage(error instanceof Error ? error.message : "Unable to open recent canvas file.", 4000, "error")
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
      showSiyuanMessage("Canvas saved by overwriting the disk version.", 2500, "info")
    } catch (error) {
      showSiyuanMessage(error instanceof Error ? error.message : "Unable to overwrite the disk version.", 4000, "error")
    }
  }

  function loadConflictVersion() {
    const conflictPath = state.conflict?.path || state.filePath
    state.loadConflictVersion()
    suggestedFilename.value = getFileName(conflictPath)
    showSiyuanMessage("Loaded the newer canvas version from disk.", 2500, "info")
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
        openSiyuanTab({
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
        openSiyuanTab({
          app: plugin.app,
          asset: {
            path: resolved.asset.openPath,
          },
          keepCursor: true,
          openNewTab: true,
        })
        return
      }

      showSiyuanMessage(resolved.description || node.file, 2500, "info")
      return
    }

    showSiyuanMessage(getNodeTitle(node), 2500, "info")
  }

  function startPointerGesture(event: PointerEvent, onMove: (dx: number, dy: number) => void) {
    const startX = event.clientX
    const startY = event.clientY

    const handleMove = (moveEvent: PointerEvent) => {
      onMove(moveEvent.clientX - startX, moveEvent.clientY - startY)
    }
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
  }

  function startPan(event: PointerEvent) {
    if (event.button !== 2) {
      return
    }

    event.preventDefault()
    const initialX = viewport.x
    const initialY = viewport.y
    startPointerGesture(event, (dx, dy) => {
      viewport.x = initialX + dx
      viewport.y = initialY + dy
    })
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
    const nextScale = clamp(
      Number((viewport.scale * Math.exp(-event.deltaY * 0.0015)).toFixed(2)),
      0.3,
      2.5,
    )
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

    return !target.closest(".canvas-node__resize, a, button, input, textarea, select")
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

  function startResize(node: CanvasNode, event: PointerEvent) {
    const initialWidth = node.width
    const initialHeight = node.height
    startPointerGesture(event, (dx, dy) => {
      commitDocument(setCanvasNodeGeometry(state.document, node.id, {
        width: Math.max(180, Math.round(initialWidth + dx / viewport.scale)),
        height: Math.max(node.type === "group" ? 120 : 100, Math.round(initialHeight + dy / viewport.scale)),
      }))
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
      closeSelectionPopover()
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
        showSiyuanMessage(error instanceof Error ? error.message : "Unable to open canvas file.", 4000, "error")
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
    },
  )

  return createCanvasEditorBindings(
    {
      applySelectionColor,
      applySelectionLayout,
      board,
      canDelete,
      centerSelectionInViewport,
      createGroupFromSelection,
      displayNodes,
      edgeTargets,
      exportCanvas,
      fileInputRef,
      getEdgeLabelPosition,
      getEdgePath,
      getFileName,
      getFileNodeDescription,
      getFileNodeKind,
      getFileNodePreview,
      getNodeStyle,
      getNodeTitle,
      importCanvas,
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
      sides: SIDES,
      stageRef,
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
      toggleInspector,
      toggleSelectionPopover,
    },
    ["fileInputRef", "stageRef"],
  )
}

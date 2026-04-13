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
  putFile,
  readDir,
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
  getCanvasSelectionBounds,
  setCanvasNodesColor,
  removeCanvasEdge,
  removeCanvasNode,
  removeCanvasNodes,
  upsertCanvasEdge,
  upsertCanvasNode,
} from "@/canvas/document"
import { createCanvasEditorBindings } from "@/canvas/editor-bindings"
import {
  searchCanvasFilePickerTargets,
  type CanvasFilePickerOption,
} from "@/canvas/file-picker-dialog"
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
import {
  createDefaultCanvasPluginSettings,
  createDefaultCanvasPluginUiState,
} from "@/canvas/plugin-data"
import { CanvasFileService } from "@/canvas/file-service"
import { writeWorkspaceImageFile } from "@/canvas/workspace-image-files"
import {
  findSiyuanBlockById,
  findSiyuanBlocksByQuery,
  findSiyuanDocumentsByQuery,
  findSiyuanImageAssetByBlockId,
  findSiyuanImageAssetsByQuery,
} from "@/canvas/siyuan-kernel-file-node-lookups"
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
const SIYUAN_BLOCK_ID_PATTERN = /^\d{14}-[a-z0-9]{7}$/i

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
  const newEdgeFromSide = ref<CanvasSide>("right")
  const newEdgeLabel = ref("")
  const newEdgeSourceId = ref("")
  const newEdgeSourceQuery = ref("")
  const newEdgeTargetId = ref("")
  const newEdgeTargetQuery = ref("")
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
    const directory = getPluginSettings().defaultCanvasDirectory

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

  function setNewEdgeSourceId(nodeId: string) {
    newEdgeSourceId.value = nodeId

    if (newEdgeTargetId.value === nodeId) {
      newEdgeTargetId.value = ""
    }
  }

  function setNewEdgeTargetId(nodeId: string) {
    newEdgeTargetId.value = nodeId
  }

  function resetEdgeNodeQueries() {
    newEdgeSourceQuery.value = ""
    newEdgeTargetQuery.value = ""
  }

  function applySelectedNodeAsEdgeSource() {
    if (state.selectedNodeIds.length === 1 && selectedNode.value) {
      setNewEdgeSourceId(selectedNode.value.id)
      resetEdgeNodeQueries()
      return
    }

    newEdgeSourceId.value = ""
    resetEdgeNodeQueries()
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
    if (!newEdgeSourceId.value || !newEdgeTargetId.value) {
      showMessage(t("messageSelectTargetNodeFirst"), 2500, "error")
      return
    }

    if (newEdgeSourceId.value === newEdgeTargetId.value) {
      showMessage(t("messageCannotConnectNodeToSelf"), 2500, "error")
      return
    }

    const edge = createCanvasEdge(newEdgeSourceId.value, newEdgeTargetId.value)
    edge.label = newEdgeLabel.value || undefined
    edge.fromSide = newEdgeFromSide.value
    edge.toSide = newEdgeToSide.value
    commitDocument(upsertCanvasEdge(state.document, edge))
    state.selectEdge(edge.id)
    newEdgeLabel.value = ""
    newEdgeTargetId.value = ""
    resetEdgeNodeQueries()
  }

  function openCreateEdgeDialog() {
    if (state.selectedNodeIds.length !== 1 || !selectedNode.value) {
      showMessage(t("messageSelectSingleSourceNodeFirst"), 2500, "warning")
      return
    }

    applySelectedNodeAsEdgeSource()
    activateCanvasSurface()
    createEdgeDialog.visible = true
  }

  function openFilePickerDialog() {
    filePickerDialog.visible = true
  }

  function closeFilePickerDialog() {
    filePickerDialog.visible = false
    filePickerDialog.query = ""
    filePickerDialog.groups = {
      blocks: [],
      canvases: [],
      documents: [],
      images: [],
    }
  }

  async function updateFilePickerQuery(value: string) {
    filePickerDialog.query = value
    const query = value.trim()

    if (!query) {
      filePickerDialog.groups = {
        blocks: [],
        canvases: [],
        documents: [],
        images: [],
      }
      return
    }

    const imageByBlockId = SIYUAN_BLOCK_ID_PATTERN.test(query)
      ? await findSiyuanImageAssetByBlockId(query)
      : null

    filePickerDialog.groups = await searchCanvasFilePickerTargets(query, {
      searchBlocks: async (keyword) => {
        const blocks = SIYUAN_BLOCK_ID_PATTERN.test(keyword)
          ? await findSiyuanBlockById(keyword).then((block) => block ? [block] : [])
          : await findSiyuanBlocksByQuery(keyword)
        return blocks.map((block) => ({
          blockId: block.id,
          kind: "block" as const,
          path: block.id,
          subtitle: block.hpath || block.path,
          title: block.title,
        }))
      },
      searchDocuments: async (keyword) => {
        const documents = await findSiyuanDocumentsByQuery(keyword)
        return documents.map((document) => ({
          kind: "document" as const,
          path: document.path,
          subtitle: document.hpath || document.path,
          title: document.title,
        }))
      },
      searchImages: async (keyword) => {
        if (imageByBlockId) {
          return [{
            blockId: imageByBlockId.blockId,
            kind: "image" as const,
            path: imageByBlockId.path,
            subtitle: imageByBlockId.path,
            title: imageByBlockId.title || imageByBlockId.name,
          }]
        }

        const images = await findSiyuanImageAssetsByQuery(keyword)
        return images.map((image) => ({
          blockId: image.blockId,
          kind: "image" as const,
          path: image.path,
          subtitle: image.path,
          title: image.title || image.name,
        }))
      },
      searchWorkspaceCanvasFiles: async (keyword) => {
        const normalizedQuery = keyword.trim().toLowerCase()
        return workspaceDocuments.value
          .filter((document) => {
            if (!normalizedQuery) {
              return true
            }

            return document.title.toLowerCase().includes(normalizedQuery)
              || document.path.toLowerCase().includes(normalizedQuery)
          })
          .map((document) => ({
            kind: "canvas" as const,
            path: document.path,
            subtitle: document.path,
            title: document.title,
          }))
      },
    })
  }

  async function selectFilePickerResult(option: CanvasFilePickerOption) {
    const node = createCanvasNode("file")
    node.x = Math.round((200 - viewport.x) / viewport.scale + board.value.left)
    node.y = Math.round((160 - viewport.y) / viewport.scale + board.value.top)
    node.file = option.blockId
      ? option.blockId
      : option.path

    commitDocument(upsertCanvasNode(state.document, node))
    state.selectNode(node.id)
    closeFilePickerDialog()
    await refreshFileNodeMetadata()
  }

  async function handleClipboardImagePaste(file: File) {
    if (fileSource.value !== "workspace" || !state.filePath.endsWith(".canvas")) {
      showMessage(t("messageUnablePasteImageWithoutWorkspaceCanvas"), 4000, "warning")
      return
    }

    const path = await writeWorkspaceImageFile(state.filePath, file, putFile)
    const node = createCanvasNode("file")
    node.x = Math.round((200 - viewport.x) / viewport.scale + board.value.left)
    node.y = Math.round((160 - viewport.y) / viewport.scale + board.value.top)
    node.file = path

    commitDocument(upsertCanvasNode(state.document, node))
    state.selectNode(node.id)
    await refreshFileNodeMetadata()
  }

  function closeCreateEdgeDialog() {
    createEdgeDialog.visible = false
  }

  function submitCreateEdgeDialog() {
    const previousSelectedEdgeId = state.selectedEdgeId
    createEdgeFromSelection()
    if (state.selectedEdgeId && state.selectedEdgeId !== previousSelectedEdgeId) {
      closeCreateEdgeDialog()
    }
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

  async function toggleInspectorSection(section: keyof CanvasPluginUiState["inspectorSections"]) {
    const nextValue = !inspectorSectionState[section]
    inspectorSectionState[section] = nextValue
    await plugin.updateCanvasUiState?.({
      inspectorSections: {
        [section]: nextValue,
      },
    })
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

      if (resolved.kind === "document") {
        void openTab({
          app: plugin.app,
          doc: {
            id: resolved.id,
          },
          keepCursor: true,
          openNewTab: true,
        })
        return
      }

      if (resolved.kind === "block") {
        plugin.eventBus.emit("open-siyuan-url-block", {
          exist: false,
          focus: true,
          id: resolved.id,
          url: `siyuan://blocks/${resolved.id}`,
        })
        return
      }

      if (resolved.kind === "image") {
        void openTab({
          app: plugin.app,
          asset: {
            path: resolved.openPath,
          },
          keepCursor: true,
          openNewTab: true,
        })
        return
      }

      showMessage(resolved.detail || node.file, 2500, "info")
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
        fileSource.value = "workspace"
        await rememberRecentPath(bootstrap.path, "workspace")
      } catch (error) {
        showMessage(error instanceof Error ? error.message : t("messageUnableOpenCanvasFile"), 4000, "error")
      }
    } else {
      newCanvas()
    }

    refreshRecentFiles()
    await refreshWorkspaceDocuments()
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
      applySelectedNodeAsEdgeSource()
      closeSelectionPopover()
      clearSelectionBox()
    },
  )

  return createCanvasEditorBindings(
    {
      applySelectionColor,
      applySelectionLayout,
      activateCanvasSurface,
      board,
      bottomToolbarVisible,
      canDelete,
      centerSelectionInViewport,
      closeCreateEdgeDialog,
      closeSelectionPopover,
      createGroupFromSelection,
      createEdgeDialog,
      filePickerDialog,
      displayNodes,
      deactivateCanvasSurface,
      connectionDraft,
      edgeSources,
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
      setSelectionToolbarSize,
      toggleInspector,
      toggleSelectionPopover,
    },
    ["fileInputRef", "stageRef"],
  )
}

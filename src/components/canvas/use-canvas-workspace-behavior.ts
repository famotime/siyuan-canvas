import type { CanvasNode } from "@/canvas/types"

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import { getNodeSelectionColorValue } from "@/components/canvas/canvas-workspace-display"
import { isWebUrl } from "@/canvas/url-detection"

interface CanvasWorkspaceEditor {
  activateNode: (node: CanvasNode) => void
  closeEdgePopover: () => void
  closeSelectionPopover: () => void
  convertTextToLink: (nodeId: string, url: string) => void
  convertLinkToText: (nodeId: string, text: string) => void
  edgeToolbar: {
    visible: boolean
  }
  edgeToolbarPopover: "closed" | "color" | "direction"
  importCanvas: (file: File) => Promise<void>
  readonly?: boolean
  selectNode: (nodeId: string) => void
  selectedNode: CanvasNode | null
  selectedNodeCount: number
  setEdgeToolbarSize: (size: { height: number, width: number }) => void
  selectionToolbar: {
    visible: boolean
  }
  selectionToolbarPopover: "closed" | "color" | "layout" | "sprout"
  setSelectionToolbarSize: (size: { height: number, width: number }) => void
  state: {
    document: {
      nodes: CanvasNode[]
    }
    isDirty: boolean
    selectedNodeIds: string[]
    pendingEditNodeId?: string
  }
  updateNodeField?: (nodeId: string, field: string, value: unknown) => void
  updateTextNodeContent: (nodeId: string, text: string) => void
  toggleGroupCollapse: (nodeId: string) => void
}

interface CanvasWorkspaceBehaviorOptions {
  onStartQueryEditing?: (node: CanvasNode) => void
}

export function useCanvasWorkspaceBehavior(
  editor: CanvasWorkspaceEditor,
  options: CanvasWorkspaceBehaviorOptions = {},
) {
  const editingMarkdown = ref("")
  const editingNodeId = ref("")
  const editingOriginalText = ref("")
  const editingTextareaRef = ref<HTMLTextAreaElement>()
  const canvasShellRef = ref<HTMLElement>()
  const edgeToolbarRef = ref<HTMLElement>()
  const selectionToolbarRef = ref<HTMLElement>()
  const selectionToolbarThemeMode = ref<"dark" | "light">("light")

  let canvasThemeObserver: MutationObserver | null = null
  let edgeToolbarResizeObserver: ResizeObserver | null = null
  let selectionToolbarResizeObserver: ResizeObserver | null = null

  const activeSelectionColor = computed(() => {
    if (!editor.state.selectedNodeIds.length) {
      return null
    }

    const selectedNodeIds = new Set(editor.state.selectedNodeIds)
    const selectedNodes = editor.state.document.nodes.filter((node) => selectedNodeIds.has(node.id))

    if (!selectedNodes.length) {
      return null
    }

    const firstColor = getNodeSelectionColorValue(selectedNodes[0])

    return selectedNodes.every((node) => getNodeSelectionColorValue(node) === firstColor)
      ? firstColor
      : null
  })

  function setEditingTextareaRef(value: Element | null) {
    editingTextareaRef.value = value instanceof HTMLTextAreaElement ? value : undefined
  }

  function syncSelectionToolbarThemeMode() {
    selectionToolbarThemeMode.value = canvasShellRef.value?.dataset.themeMode === "dark" ? "dark" : "light"
  }

  function syncSelectionToolbarSize() {
    if (!selectionToolbarRef.value) {
      return
    }

    const { height, width } = selectionToolbarRef.value.getBoundingClientRect()
    editor.setSelectionToolbarSize({
      height: Math.round(height),
      width: Math.round(width),
    })
  }

  function observeSelectionToolbar() {
    selectionToolbarResizeObserver?.disconnect()
    selectionToolbarResizeObserver = null

    if (!selectionToolbarRef.value || typeof ResizeObserver === "undefined") {
      return
    }

    selectionToolbarResizeObserver = new ResizeObserver(() => {
      syncSelectionToolbarSize()
    })
    selectionToolbarResizeObserver.observe(selectionToolbarRef.value)
  }

  function syncEdgeToolbarSize() {
    if (!edgeToolbarRef.value) {
      return
    }

    const { height, width } = edgeToolbarRef.value.getBoundingClientRect()
    editor.setEdgeToolbarSize({
      height: Math.round(height),
      width: Math.round(width),
    })
  }

  function observeEdgeToolbar() {
    edgeToolbarResizeObserver?.disconnect()
    edgeToolbarResizeObserver = null

    if (!edgeToolbarRef.value || typeof ResizeObserver === "undefined") {
      return
    }

    edgeToolbarResizeObserver = new ResizeObserver(() => {
      syncEdgeToolbarSize()
    })
    edgeToolbarResizeObserver.observe(edgeToolbarRef.value)
  }

  function setSelectionToolbarRef(value: Element | null) {
    selectionToolbarRef.value = value instanceof HTMLElement ? value : undefined
    observeSelectionToolbar()
    syncSelectionToolbarSize()
  }

  function setEdgeToolbarRef(value: Element | null) {
    edgeToolbarRef.value = value instanceof HTMLElement ? value : undefined
    observeEdgeToolbar()
    syncEdgeToolbarSize()
  }

  function handleToolbarEdit() {
    if (!editor.selectedNode || editor.selectedNodeCount !== 1) {
      return
    }

    handleNodeDoubleClick(editor.selectedNode)
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!(event.target instanceof HTMLElement)) {
      if (editor.selectionToolbarPopover !== "closed") {
        editor.closeSelectionPopover()
      }
      if (editor.edgeToolbarPopover !== "closed") {
        editor.closeEdgePopover()
      }
      return
    }

    if (editor.selectionToolbarPopover !== "closed" && !event.target.closest(".selection-toolbar")) {
      editor.closeSelectionPopover()
    }

    if (editor.edgeToolbarPopover !== "closed" && !event.target.closest(".edge-toolbar")) {
      editor.closeEdgePopover()
    }
  }

  function handleNodeDoubleClick(node: CanvasNode) {
    if (node.type === "group" && node.collapsed) {
      editor.toggleGroupCollapse(node.id)
      return
    }
    if (!["group", "text", "link", "query"].includes(node.type)) {
      editor.activateNode(node)
      return
    }

    if (editor.readonly) {
      return
    }

    if (node.type === "query") {
      editor.selectNode(node.id)
      options.onStartQueryEditing?.(node)
      return
    }

    editor.selectNode(node.id)
    editingNodeId.value = node.id
    const initialText: string = node.type === "group"
      ? (node.label || "")
      : node.type === "text"
        ? (node.text || "")
        : node.type === "link"
          ? (node.url || "")
          : ""
    editingMarkdown.value = initialText
    editingOriginalText.value = initialText
    void nextTick(() => {
      editingTextareaRef.value?.focus()
      if (initialText === "New note") {
        editingTextareaRef.value?.select()
      } else {
        editingTextareaRef.value?.setSelectionRange(editingMarkdown.value.length, editingMarkdown.value.length)
      }
    })
  }

  function commitTextNodeEditing() {
    if (!editingNodeId.value) {
      return
    }

    const node = editor.state.document.nodes.find((candidate) => candidate.id === editingNodeId.value)
    // query 节点通过独立 SQL 表单显式保存/取消，避免画布点击失焦时误将 SQL 覆写为文本草稿
    if (node?.type === "query") {
      return
    }

    if (editingMarkdown.value !== editingOriginalText.value) {
      const trimmed = editingMarkdown.value.trim()
      if (node?.type === "text" && isWebUrl(trimmed)) {
        editor.convertTextToLink(editingNodeId.value, trimmed)
      } else if (node?.type === "link") {
        if (isWebUrl(trimmed)) {
          editor.updateTextNodeContent(editingNodeId.value, trimmed)
        } else {
          editor.convertLinkToText(editingNodeId.value, editingMarkdown.value)
        }
      } else {
        editor.updateTextNodeContent(editingNodeId.value, editingMarkdown.value)
      }
    }

    editingNodeId.value = ""
    editingMarkdown.value = ""
    editingOriginalText.value = ""
  }

  watch(
    () => editor.state.pendingEditNodeId,
    (newId) => {
      if (newId) {
        const node = editor.state.document.nodes.find((candidate) => candidate.id === newId)
        if (node) {
          handleNodeDoubleClick(node)
        }
        editor.state.pendingEditNodeId = ""
      }
    },
  )

  async function handleImport(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) {
      return
    }

    await editor.importCanvas(file)
    input.value = ""
  }

  onMounted(() => {
    syncSelectionToolbarThemeMode()
    window.addEventListener("pointerdown", handleWindowPointerDown)

    if (canvasShellRef.value && typeof MutationObserver !== "undefined") {
      canvasThemeObserver = new MutationObserver(() => {
        syncSelectionToolbarThemeMode()
      })
      canvasThemeObserver.observe(canvasShellRef.value, {
        attributeFilter: ["data-theme-mode"],
        attributes: true,
      })
    }
  })

  onBeforeUnmount(() => {
    canvasThemeObserver?.disconnect()
    window.removeEventListener("pointerdown", handleWindowPointerDown)
    edgeToolbarResizeObserver?.disconnect()
    selectionToolbarResizeObserver?.disconnect()
  })

  watch(
    () => `${editor.selectionToolbar.visible}|${editor.selectedNodeCount}`,
    async () => {
      await nextTick()
      syncSelectionToolbarSize()
    },
  )

  watch(
    () => editor.edgeToolbar.visible,
    async () => {
      await nextTick()
      syncEdgeToolbarSize()
    },
  )

  return {
    activeSelectionColor,
    canvasShellRef,
    commitTextNodeEditing,
    editingMarkdown,
    editingNodeId,
    setEdgeToolbarRef,
    handleImport,
    handleNodeDoubleClick,
    handleToolbarEdit,
    selectionToolbarThemeMode,
    setEditingTextareaRef,
    setSelectionToolbarRef,
  }
}

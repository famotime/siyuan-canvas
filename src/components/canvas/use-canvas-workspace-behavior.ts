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

interface CanvasWorkspaceEditor {
  activateNode: (node: CanvasNode) => void
  closeSelectionPopover: () => void
  importCanvas: (file: File) => Promise<void>
  selectNode: (nodeId: string) => void
  selectedNode: CanvasNode | null
  selectedNodeCount: number
  selectionToolbar: {
    visible: boolean
  }
  selectionToolbarPopover: "closed" | "color" | "layout"
  setSelectionToolbarSize: (size: { height: number, width: number }) => void
  state: {
    document: {
      nodes: CanvasNode[]
    }
    selectedNodeIds: string[]
  }
  updateTextNodeContent: (nodeId: string, text: string) => void
}

export function useCanvasWorkspaceBehavior(editor: CanvasWorkspaceEditor) {
  const editingMarkdown = ref("")
  const editingNodeId = ref("")
  const editingTextareaRef = ref<HTMLTextAreaElement>()
  const canvasShellRef = ref<HTMLElement>()
  const selectionToolbarRef = ref<HTMLElement>()
  const selectionToolbarThemeMode = ref<"dark" | "light">("light")

  let canvasThemeObserver: MutationObserver | null = null
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

  function setSelectionToolbarRef(value: Element | null) {
    selectionToolbarRef.value = value instanceof HTMLElement ? value : undefined
    observeSelectionToolbar()
    syncSelectionToolbarSize()
  }

  function handleToolbarEdit() {
    if (!editor.selectedNode || editor.selectedNodeCount !== 1) {
      return
    }

    handleNodeDoubleClick(editor.selectedNode)
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (editor.selectionToolbarPopover === "closed") {
      return
    }

    if (event.target instanceof HTMLElement && event.target.closest(".selection-toolbar")) {
      return
    }

    editor.closeSelectionPopover()
  }

  function handleNodeDoubleClick(node: CanvasNode) {
    if (node.type !== "text") {
      editor.activateNode(node)
      return
    }

    editor.selectNode(node.id)
    editingNodeId.value = node.id
    editingMarkdown.value = node.text
    void nextTick(() => {
      editingTextareaRef.value?.focus()
      editingTextareaRef.value?.setSelectionRange(editingMarkdown.value.length, editingMarkdown.value.length)
    })
  }

  function commitTextNodeEditing() {
    if (!editingNodeId.value) {
      return
    }

    editor.updateTextNodeContent(editingNodeId.value, editingMarkdown.value)
    editingNodeId.value = ""
    editingMarkdown.value = ""
  }

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
    selectionToolbarResizeObserver?.disconnect()
  })

  watch(
    () => `${editor.selectionToolbar.visible}|${editor.selectedNodeCount}`,
    async () => {
      await nextTick()
      syncSelectionToolbarSize()
    },
  )

  return {
    activeSelectionColor,
    canvasShellRef,
    commitTextNodeEditing,
    editingMarkdown,
    editingNodeId,
    handleImport,
    handleNodeDoubleClick,
    handleToolbarEdit,
    selectionToolbarThemeMode,
    setEditingTextareaRef,
    setSelectionToolbarRef,
  }
}

interface CanvasEditorKeyboardHandlerOptions {
  canDelete: () => boolean
  cancelEdgeLabelEditing: () => void
  closeEdgePopover: () => void
  closeSelectionPopover: () => void
  deleteSelection: () => void
  duplicateSelection?: () => void
  getEdgeToolbarPopover: () => 'closed' | 'color' | 'direction'
  getEditingEdgeLabelId: () => string
  getSelectionToolbarPopover: () => 'closed' | 'color' | 'layout'
  redo?: () => void
  save: () => void | Promise<void>
  selectAllNodes: () => void
  selectEdge: () => void
  selectNode: () => void
  undo?: () => void
  zoomIn?: () => void
  zoomOut?: () => void
  zoomToActualSize?: () => void
  zoomToFit?: () => void
}

export function isCanvasEditorEditingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
}

export function createCanvasEditorKeyboardHandler(options: CanvasEditorKeyboardHandlerOptions) {
  const {
    canDelete,
    cancelEdgeLabelEditing,
    closeEdgePopover,
    closeSelectionPopover,
    deleteSelection,
    duplicateSelection,
    getEdgeToolbarPopover,
    getEditingEdgeLabelId,
    getSelectionToolbarPopover,
    redo,
    save,
    selectAllNodes,
    selectEdge,
    selectNode,
    undo,
    zoomIn,
    zoomOut,
    zoomToActualSize,
    zoomToFit,
  } = options

  function handleKeydown(event: KeyboardEvent) {
    if (isCanvasEditorEditingTarget(event.target)) {
      return
    }

    const key = event.key.toLowerCase()
    const isAccelerator = event.ctrlKey || event.metaKey

    if ((event.key === 'Delete' || event.key === 'Backspace') && canDelete()) {
      event.preventDefault()
      deleteSelection()
      return
    }

    if (event.key === 'Escape') {
      if (getEditingEdgeLabelId()) {
        cancelEdgeLabelEditing()
        return
      }

      if (getEdgeToolbarPopover() !== 'closed') {
        closeEdgePopover()
        return
      }

      if (getSelectionToolbarPopover() !== 'closed') {
        closeSelectionPopover()
        return
      }

      selectNode()
      selectEdge()
      return
    }

    if (isAccelerator && key === 'a') {
      event.preventDefault()
      selectAllNodes()
      return
    }

    if (isAccelerator && key === 's') {
      event.preventDefault()
      void save()
      return
    }

    // 撤销 / 重做：Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z
    if (isAccelerator && key === 'z' && !event.shiftKey) {
      if (undo) {
        event.preventDefault()
        undo()
      }
      return
    }

    if (isAccelerator && (key === 'y' || (key === 'z' && event.shiftKey))) {
      if (redo) {
        event.preventDefault()
        redo()
      }
      return
    }

    // 复制选中节点：Ctrl+D（避免与浏览器 Ctrl+C/V 抢占系统剪贴板）
    if (isAccelerator && key === 'd') {
      if (duplicateSelection) {
        event.preventDefault()
        duplicateSelection()
      }
      return
    }

    // 缩放快捷键
    if (isAccelerator && (key === '=' || key === '+')) {
      if (zoomIn) {
        event.preventDefault()
        zoomIn()
      }
      return
    }

    if (isAccelerator && key === '-') {
      if (zoomOut) {
        event.preventDefault()
        zoomOut()
      }
      return
    }

    if (isAccelerator && key === '0') {
      if (zoomToActualSize) {
        event.preventDefault()
        zoomToActualSize()
      }
      return
    }

    // F：适应内容（fit），不与 Ctrl 组合，便于不持修饰键直接按
    if (!isAccelerator && key === 'f' && !event.shiftKey && !event.altKey) {
      if (zoomToFit) {
        event.preventDefault()
        zoomToFit()
      }
    }
  }

  return {
    handleKeydown,
  }
}

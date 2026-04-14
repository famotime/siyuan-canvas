interface CanvasEditorKeyboardHandlerOptions {
  canDelete: () => boolean
  cancelEdgeLabelEditing: () => void
  closeEdgePopover: () => void
  closeSelectionPopover: () => void
  deleteSelection: () => void
  getEdgeToolbarPopover: () => 'closed' | 'color' | 'direction'
  getEditingEdgeLabelId: () => string
  getSelectionToolbarPopover: () => 'closed' | 'color' | 'layout'
  save: () => void | Promise<void>
  selectAllNodes: () => void
  selectEdge: () => void
  selectNode: () => void
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
    getEdgeToolbarPopover,
    getEditingEdgeLabelId,
    getSelectionToolbarPopover,
    save,
    selectAllNodes,
    selectEdge,
    selectNode,
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
    }
  }

  return {
    handleKeydown,
  }
}

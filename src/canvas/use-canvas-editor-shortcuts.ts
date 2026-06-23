interface CanvasEditorKeyboardHandlerOptions {
  canDelete: () => boolean
  cancelEdgeLabelEditing: () => void
  closeEdgePopover: () => void
  closeFloatLayer?: () => void
  closeSelectionPopover: () => void
  deleteSelection: () => void
  duplicateSelection?: () => void
  createMindMapChildNode?: () => void
  createMindMapSiblingNode?: () => void
  getEdgeToolbarPopover: () => 'closed' | 'color' | 'direction'
  getEditingEdgeLabelId: () => string
  getSelectionToolbarPopover: () => 'closed' | 'color' | 'layout'
  hasFloatLayer?: () => boolean
  openFilePickerDialog?: () => void
  redo?: () => void
  save: () => void | Promise<void>
  silentSave: () => void | Promise<void>
  selectAllNodes: () => void
  selectEdge: () => void
  selectNode: () => void
  showFloatLayerForSelection?: () => void
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
    closeFloatLayer,
    closeSelectionPopover,
    deleteSelection,
    duplicateSelection,
    createMindMapChildNode,
    createMindMapSiblingNode,
    getEdgeToolbarPopover,
    getEditingEdgeLabelId,
    getSelectionToolbarPopover,
    hasFloatLayer,
    openFilePickerDialog,
    redo,
    save,
    silentSave,
    selectAllNodes,
    selectEdge,
    selectNode,
    showFloatLayerForSelection,
    undo,
    zoomIn,
    zoomOut,
    zoomToActualSize,
    zoomToFit,
  } = options

  let lastBracketPressTime = 0

  function handleKeydown(event: KeyboardEvent) {
    if (isCanvasEditorEditingTarget(event.target)) {
      return
    }

    const key = event.key.toLowerCase()
    const isAccelerator = event.ctrlKey || event.metaKey

    if (!isAccelerator && !event.shiftKey && !event.altKey && event.key === 'Tab') {
      if (createMindMapChildNode) {
        event.preventDefault()
        createMindMapChildNode()
      }
      return
    }

    if (!isAccelerator && !event.shiftKey && !event.altKey && event.key === 'Enter') {
      if (createMindMapSiblingNode) {
        event.preventDefault()
        createMindMapSiblingNode()
      }
      return
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && canDelete()) {
      event.preventDefault()
      deleteSelection()
      return
    }

    // Space：浮窗预览选中的思源文档/块节点
    if (event.key === ' ' && !isAccelerator && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      showFloatLayerForSelection?.()
      return
    }

    if (event.key === 'Escape') {
      if (hasFloatLayer?.()) {
        closeFloatLayer?.()
        return
      }

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
      void silentSave()
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

    // 缩放快捷键（Ctrl+Shift 避免与思源内置快捷键冲突）
    if (isAccelerator && event.shiftKey && (key === '=' || key === '+')) {
      if (zoomIn) {
        event.preventDefault()
        zoomIn()
      }
      return
    }

    if (isAccelerator && event.shiftKey && key === '-') {
      if (zoomOut) {
        event.preventDefault()
        zoomOut()
      }
      return
    }

    if (isAccelerator && event.shiftKey && key === '0') {
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

    // [[ 或 【【：无选中内容时打开文件选择器
    if (!isAccelerator && !event.shiftKey && !event.altKey
      && (event.key === '[' || event.key === '【')
      && !canDelete()
      && openFilePickerDialog) {
      const now = Date.now()
      if (now - lastBracketPressTime < 500) {
        event.preventDefault()
        openFilePickerDialog()
        lastBracketPressTime = 0
      } else {
        lastBracketPressTime = now
      }
    }
  }

  return {
    handleKeydown,
  }
}

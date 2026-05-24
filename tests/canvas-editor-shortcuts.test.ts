/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { createCanvasEditorKeyboardHandler } from '@/canvas/use-canvas-editor-shortcuts'

function createKeyboardEvent(key: string, options: {
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  target?: EventTarget | null
} = {}) {
  const event = {
    altKey: options.altKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    key,
    metaKey: options.metaKey ?? false,
    preventDefault: vi.fn(),
    shiftKey: options.shiftKey ?? false,
    target: options.target ?? null,
  } as unknown as KeyboardEvent

  return event
}

function createBaseHandlerOptions() {
  return {
    canDelete: () => false,
    cancelEdgeLabelEditing: vi.fn(),
    closeEdgePopover: vi.fn(),
    closeFloatLayer: vi.fn(),
    closeSelectionPopover: vi.fn(),
    deleteSelection: vi.fn(),
    duplicateSelection: vi.fn(),
    getEdgeToolbarPopover: () => 'closed' as const,
    getEditingEdgeLabelId: () => '',
    getSelectionToolbarPopover: () => 'closed' as const,
    hasFloatLayer: () => false,
    openFilePickerDialog: vi.fn(),
    redo: vi.fn(),
    save: vi.fn(),
    selectAllNodes: vi.fn(),
    selectEdge: vi.fn(),
    selectNode: vi.fn(),
    showFloatLayerForSelection: vi.fn(),
    undo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomToActualSize: vi.fn(),
    zoomToFit: vi.fn(),
  }
}

describe('canvas editor keyboard handler', () => {
  it('ignores shortcuts while the user is editing form fields', () => {
    const deleteSelection = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      canDelete: () => true,
      cancelEdgeLabelEditing: vi.fn(),
      closeEdgePopover: vi.fn(),
      closeSelectionPopover: vi.fn(),
      deleteSelection,
      getEdgeToolbarPopover: () => 'closed',
      getEditingEdgeLabelId: () => '',
      getSelectionToolbarPopover: () => 'closed',
      save: vi.fn(),
      selectAllNodes: vi.fn(),
      selectEdge: vi.fn(),
      selectNode: vi.fn(),
    })
    const input = document.createElement('input')

    handler.handleKeydown(createKeyboardEvent('Delete', { target: input }))

    expect(deleteSelection).not.toHaveBeenCalled()
  })

  it('deletes the current selection when delete is pressed', () => {
    const deleteSelection = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      canDelete: () => true,
      cancelEdgeLabelEditing: vi.fn(),
      closeEdgePopover: vi.fn(),
      closeSelectionPopover: vi.fn(),
      deleteSelection,
      getEdgeToolbarPopover: () => 'closed',
      getEditingEdgeLabelId: () => '',
      getSelectionToolbarPopover: () => 'closed',
      save: vi.fn(),
      selectAllNodes: vi.fn(),
      selectEdge: vi.fn(),
      selectNode: vi.fn(),
    })
    const event = createKeyboardEvent('Delete')

    handler.handleKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(deleteSelection).toHaveBeenCalledOnce()
  })

  it('prioritizes closing editing UI before clearing the selection on escape', () => {
    const cancelEdgeLabelEditing = vi.fn()
    const closeEdgePopover = vi.fn()
    const closeSelectionPopover = vi.fn()
    const selectNode = vi.fn()
    const selectEdge = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      canDelete: () => false,
      cancelEdgeLabelEditing,
      closeEdgePopover,
      closeSelectionPopover,
      deleteSelection: vi.fn(),
      getEdgeToolbarPopover: () => 'closed',
      getEditingEdgeLabelId: () => 'edge-1',
      getSelectionToolbarPopover: () => 'closed',
      save: vi.fn(),
      selectAllNodes: vi.fn(),
      selectEdge,
      selectNode,
    })

    handler.handleKeydown(createKeyboardEvent('Escape'))

    expect(cancelEdgeLabelEditing).toHaveBeenCalledOnce()
    expect(closeEdgePopover).not.toHaveBeenCalled()
    expect(closeSelectionPopover).not.toHaveBeenCalled()
    expect(selectNode).not.toHaveBeenCalled()
    expect(selectEdge).not.toHaveBeenCalled()
  })

  it('selects all nodes on accelerator+a', () => {
    const selectAllNodes = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      canDelete: () => false,
      cancelEdgeLabelEditing: vi.fn(),
      closeEdgePopover: vi.fn(),
      closeSelectionPopover: vi.fn(),
      deleteSelection: vi.fn(),
      getEdgeToolbarPopover: () => 'closed',
      getEditingEdgeLabelId: () => '',
      getSelectionToolbarPopover: () => 'closed',
      save: vi.fn(),
      selectAllNodes,
      selectEdge: vi.fn(),
      selectNode: vi.fn(),
    })
    const event = createKeyboardEvent('a', { ctrlKey: true })

    handler.handleKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(selectAllNodes).toHaveBeenCalledOnce()
  })

  it('saves on accelerator+s', () => {
    const save = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      canDelete: () => false,
      cancelEdgeLabelEditing: vi.fn(),
      closeEdgePopover: vi.fn(),
      closeSelectionPopover: vi.fn(),
      deleteSelection: vi.fn(),
      getEdgeToolbarPopover: () => 'closed',
      getEditingEdgeLabelId: () => '',
      getSelectionToolbarPopover: () => 'closed',
      save,
      selectAllNodes: vi.fn(),
      selectEdge: vi.fn(),
      selectNode: vi.fn(),
    })
    const event = createKeyboardEvent('s', { metaKey: true })

    handler.handleKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledOnce()
  })

  it('undoes on accelerator+z', () => {
    const undo = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      undo,
    })
    const event = createKeyboardEvent('z', { ctrlKey: true })

    handler.handleKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(undo).toHaveBeenCalledOnce()
  })

  it('redoes on accelerator+y', () => {
    const redo = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      redo,
    })
    const event = createKeyboardEvent('y', { ctrlKey: true })

    handler.handleKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(redo).toHaveBeenCalledOnce()
  })

  it('redoes on accelerator+shift+z', () => {
    const redo = vi.fn()
    const undo = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      redo,
      undo,
    })
    const event = createKeyboardEvent('z', { ctrlKey: true, shiftKey: true })

    handler.handleKeydown(event)

    expect(redo).toHaveBeenCalledOnce()
    expect(undo).not.toHaveBeenCalled()
  })

  it('duplicates the selection on accelerator+d', () => {
    const duplicateSelection = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      duplicateSelection,
    })
    const event = createKeyboardEvent('d', { ctrlKey: true })

    handler.handleKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(duplicateSelection).toHaveBeenCalledOnce()
  })

  it('zooms in on accelerator+= and out on accelerator+-', () => {
    const zoomIn = vi.fn()
    const zoomOut = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      zoomIn,
      zoomOut,
    })

    handler.handleKeydown(createKeyboardEvent('=', { ctrlKey: true }))
    handler.handleKeydown(createKeyboardEvent('-', { ctrlKey: true }))

    expect(zoomIn).toHaveBeenCalledOnce()
    expect(zoomOut).toHaveBeenCalledOnce()
  })

  it('returns to actual size on accelerator+0 and fits on F', () => {
    const zoomToActualSize = vi.fn()
    const zoomToFit = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      zoomToActualSize,
      zoomToFit,
    })

    handler.handleKeydown(createKeyboardEvent('0', { ctrlKey: true }))
    handler.handleKeydown(createKeyboardEvent('f'))

    expect(zoomToActualSize).toHaveBeenCalledOnce()
    expect(zoomToFit).toHaveBeenCalledOnce()
  })

  it('opens file picker on double [ when nothing is selected', () => {
    vi.useFakeTimers()
    const openFilePickerDialog = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      openFilePickerDialog,
    })

    handler.handleKeydown(createKeyboardEvent('['))
    expect(openFilePickerDialog).not.toHaveBeenCalled()

    handler.handleKeydown(createKeyboardEvent('['))
    expect(openFilePickerDialog).toHaveBeenCalledOnce()

    vi.useRealTimers()
  })

  it('opens file picker on double 【 when nothing is selected', () => {
    vi.useFakeTimers()
    const openFilePickerDialog = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      openFilePickerDialog,
    })

    handler.handleKeydown(createKeyboardEvent('【'))
    handler.handleKeydown(createKeyboardEvent('【'))

    expect(openFilePickerDialog).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('does not open file picker on [[ when something is selected', () => {
    vi.useFakeTimers()
    const openFilePickerDialog = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      canDelete: () => true,
      openFilePickerDialog,
    })

    handler.handleKeydown(createKeyboardEvent('['))
    handler.handleKeydown(createKeyboardEvent('['))

    expect(openFilePickerDialog).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not open file picker when [ presses are more than 500ms apart', () => {
    vi.useFakeTimers()
    const openFilePickerDialog = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      openFilePickerDialog,
    })

    handler.handleKeydown(createKeyboardEvent('['))
    vi.advanceTimersByTime(600)
    handler.handleKeydown(createKeyboardEvent('['))

    expect(openFilePickerDialog).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('triggers float layer preview on space key', () => {
    const showFloatLayerForSelection = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      showFloatLayerForSelection,
    })
    const event = createKeyboardEvent(' ')

    handler.handleKeydown(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(showFloatLayerForSelection).toHaveBeenCalledOnce()
  })

  it('closes float layer on escape when float layer is active', () => {
    const closeFloatLayer = vi.fn()
    const selectNode = vi.fn()
    const selectEdge = vi.fn()
    const handler = createCanvasEditorKeyboardHandler({
      ...createBaseHandlerOptions(),
      closeFloatLayer,
      hasFloatLayer: () => true,
      selectEdge,
      selectNode,
    })

    handler.handleKeydown(createKeyboardEvent('Escape'))

    expect(closeFloatLayer).toHaveBeenCalledOnce()
    expect(selectNode).not.toHaveBeenCalled()
    expect(selectEdge).not.toHaveBeenCalled()
  })
})

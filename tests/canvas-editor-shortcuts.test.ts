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
  target?: EventTarget | null
} = {}) {
  const event = {
    ctrlKey: options.ctrlKey ?? false,
    key,
    metaKey: options.metaKey ?? false,
    preventDefault: vi.fn(),
    target: options.target ?? null,
  } as unknown as KeyboardEvent

  return event
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
})

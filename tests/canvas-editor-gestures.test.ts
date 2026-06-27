/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  computed,
  ref,
} from 'vue'

import { createEmptyCanvasDocument } from '@/canvas/document'
import { createCanvasEditorGestureHandlers } from '@/canvas/use-canvas-editor-gestures'
import type { CanvasNode } from '@/canvas/types'

function createGestureHarness(
  nodes: CanvasNode[],
  selectedNodeIds: string[] = [],
  options: { showDragAlignmentGuides?: boolean } = {},
) {
  const stage = document.createElement('div')
  const viewport = { scale: 1, x: 0, y: 0 }
  const alignmentGuides = {
    guides: [],
    visible: false,
  }
  const showDragAlignmentGuides = ref(options.showDragAlignmentGuides ?? true)
  const state = {
    document: {
      nodes: [...nodes],
      edges: [],
    },
    selectNode: vi.fn((id: string) => {
      state.selectedNodeIds = [id]
    }),
    selectNodes: vi.fn((ids: string[]) => {
      state.selectedNodeIds = [...ids]
    }),
    selectedNodeIds: [...selectedNodeIds],
  }
  const commitDocument = vi.fn((document) => {
    state.document = document
  })
  const handlers = createCanvasEditorGestureHandlers({
    board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
    alignmentGuides,
    commitDocument,
    connectionDraft: {} as any,
    edgeReconnectDraft: {} as any,
    getAnchor: vi.fn(),
    readonly: computed(() => false),
    selectionBox: {} as any,
    selectedEdge: computed(() => null),
    stageRef: ref(stage),
    state: state as any,
    viewport,
    showDragAlignmentGuides: computed(() => showDragAlignmentGuides.value),
    showNodeHeader: computed(() => false),
  })

  return {
    commitDocument,
    alignmentGuides,
    handlers,
    stage,
    state,
    viewport,
    showDragAlignmentGuides,
  }
}

describe('canvas editor gesture handlers', () => {
  it('zooms around the cursor without cancelling the wheel event', () => {
    const stage = document.createElement('div')
    stage.getBoundingClientRect = vi.fn(() => ({
      bottom: 440,
      height: 400,
      left: 40,
      right: 640,
      top: 40,
      width: 600,
      x: 40,
      y: 40,
      toJSON: () => ({}),
    }))

    const viewport = {
      scale: 1,
      x: 10,
      y: 20,
    }
    const event = {
      clientX: 190,
      clientY: 160,
      deltaY: 120,
      preventDefault: vi.fn(),
    } as unknown as WheelEvent

    const handlers = createCanvasEditorGestureHandlers({
      alignmentGuides: {
        guides: [],
        visible: false,
      },
      board: computed(() => ({
        height: 2400,
        left: 0,
        top: 0,
        width: 3200,
      })),
      commitDocument: vi.fn(),
      connectionDraft: {
        fromNodeId: '',
        fromSide: 'left',
        toNodeId: '',
        toSide: 'left',
        toX: 0,
        toY: 0,
        visible: false,
      },
      getAnchor: vi.fn(),
      selectionBox: {
        height: 0,
        visible: false,
        width: 0,
        x: 0,
        y: 0,
      },
      stageRef: ref(stage),
      state: {
        document: createEmptyCanvasDocument(),
        selectEdge: vi.fn(),
        selectNodes: vi.fn(),
      } as any,
      viewport,
      readonly: computed(() => false),
      selectedEdge: computed(() => null),
      showDragAlignmentGuides: computed(() => true),
      showNodeHeader: computed(() => true),
    })

    handlers.handleWheelZoom(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(viewport.scale).toBe(0.84)
    expect((150 - viewport.x) / viewport.scale).toBeCloseTo(140)
    expect((120 - viewport.y) / viewport.scale).toBeCloseTo(100)
  })

  it('pans the canvas in readonly mode when dragging a node', () => {
    const stage = document.createElement('div')
    const viewport = { scale: 1, x: 0, y: 0 }
    const commitDocument = vi.fn()

    const handlers = createCanvasEditorGestureHandlers({
      alignmentGuides: {
        guides: [],
        visible: false,
      },
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument,
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => true),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
      showDragAlignmentGuides: computed(() => true),
      stageRef: ref(stage),
      state: {
        document: {
          nodes: [],
          edges: [],
        },
        selectNode: vi.fn(),
        selectedNodeIds: [],
      } as any,
      viewport,
      showNodeHeader: computed(() => true),
    })

    const target = document.createElement('div')
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    const node = { id: 'node-1', type: 'text', x: 50, y: 50, width: 100, height: 100 }
    handlers.handleNodePointerDown(node as any, pointerDownEvent)

    // Simulate pointermove
    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 150,
      clientY: 170,
    })
    window.dispatchEvent(pointerMoveEvent)

    // In readonly mode, it should start pan, modifying viewport offset
    expect(viewport.x).toBe(50)
    expect(viewport.y).toBe(70)
    expect(commitDocument).not.toHaveBeenCalled()
  })

  it('drags the node when showNodeHeader is false and clicking on selectable body', () => {
    const stage = document.createElement('div')
    const viewport = { scale: 1, x: 0, y: 0 }
    const commitDocument = vi.fn()
    const node = { id: 'node-1', type: 'text', x: 50, y: 50, width: 100, height: 100 }

    const handlers = createCanvasEditorGestureHandlers({
      alignmentGuides: {
        guides: [],
        visible: false,
      },
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument,
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => false),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
      showDragAlignmentGuides: computed(() => true),
      stageRef: ref(stage),
      state: {
        document: {
          nodes: [node],
          edges: [],
        },
        selectNode: vi.fn(),
        selectedNodeIds: [],
      } as any,
      viewport,
      showNodeHeader: computed(() => false),
    })

    // Click target has selectable class
    const target = document.createElement('div')
    target.className = 'canvas-node__body--selectable'
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    handlers.handleNodePointerDown(node as any, pointerDownEvent)

    // Simulate pointermove
    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 150,
      clientY: 170,
    })
    window.dispatchEvent(pointerMoveEvent)

    // When showNodeHeader is false, selectable body is not excluded, so it should drag the node
    expect(commitDocument).toHaveBeenCalled()
    expect(viewport.x).toBe(0) // Viewport should not pan
  })

  it('does not drag the node when showNodeHeader is true and clicking on selectable body', () => {
    const stage = document.createElement('div')
    const viewport = { scale: 1, x: 0, y: 0 }
    const commitDocument = vi.fn()
    const node = { id: 'node-1', type: 'text', x: 50, y: 50, width: 100, height: 100 }

    const handlers = createCanvasEditorGestureHandlers({
      alignmentGuides: {
        guides: [],
        visible: false,
      },
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument,
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => false),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
      showDragAlignmentGuides: computed(() => true),
      stageRef: ref(stage),
      state: {
        document: {
          nodes: [node],
          edges: [],
        },
        selectNode: vi.fn(),
        selectedNodeIds: [],
      } as any,
      viewport,
      showNodeHeader: computed(() => true),
    })

    // Click target has selectable class
    const target = document.createElement('div')
    target.className = 'canvas-node__body--selectable'
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    handlers.handleNodePointerDown(node as any, pointerDownEvent)

    // Simulate pointermove
    const pointerMoveEvent = new PointerEvent('pointermove', {
      clientX: 150,
      clientY: 170,
    })
    window.dispatchEvent(pointerMoveEvent)

    // When showNodeHeader is true, selectable body is excluded, so it should neither drag nor pan
    expect(commitDocument).not.toHaveBeenCalled()
    expect(viewport.x).toBe(0)
  })

  it('copies the dragged card when holding ctrl', () => {
    const node = { id: 'node-1', type: 'text', x: 50, y: 60, width: 100, height: 80 } as CanvasNode
    const { commitDocument, handlers, state } = createGestureHarness([node])
    const target = document.createElement('div')
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    handlers.handleNodePointerDown(node, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 140,
      clientY: 130,
      ctrlKey: true,
    }))

    expect(commitDocument).toHaveBeenCalled()
    expect(state.document.nodes).toHaveLength(2)
    expect(state.document.nodes[0]).toMatchObject({ id: 'node-1', x: 50, y: 60 })
    expect(state.document.nodes[1]).toMatchObject({ x: 90, y: 90 })
    expect(state.document.nodes[1]?.id).not.toBe('node-1')
    expect(state.selectedNodeIds).toEqual([state.document.nodes[1]?.id])
  })

  it('does not copy or change selection when ctrl-clicking a card without dragging', () => {
    const node = { id: 'node-1', type: 'text', x: 50, y: 60, width: 100, height: 80 } as CanvasNode
    const { commitDocument, handlers, state } = createGestureHarness([node], ['node-1'])
    const target = document.createElement('div')
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    handlers.handleNodePointerDown(node, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
    }))

    expect(commitDocument).not.toHaveBeenCalled()
    expect(state.document.nodes).toHaveLength(1)
    expect(state.selectedNodeIds).toEqual(['node-1'])
  })

  it('copies the selected card group when ctrl-dragging one selected card', () => {
    const firstNode = { id: 'node-1', type: 'text', x: 50, y: 60, width: 100, height: 80 } as CanvasNode
    const secondNode = { id: 'node-2', type: 'text', x: 220, y: 90, width: 100, height: 80 } as CanvasNode
    const { handlers, state } = createGestureHarness([firstNode, secondNode], ['node-1', 'node-2'])
    const target = document.createElement('div')
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    handlers.handleNodePointerDown(firstNode, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 140,
      clientY: 130,
      ctrlKey: true,
    }))

    expect(state.document.nodes).toHaveLength(4)
    expect(state.document.nodes[0]).toMatchObject({ id: 'node-1', x: 50, y: 60 })
    expect(state.document.nodes[1]).toMatchObject({ id: 'node-2', x: 220, y: 90 })
    expect(state.document.nodes[2]).toMatchObject({ x: 90, y: 90 })
    expect(state.document.nodes[3]).toMatchObject({ x: 260, y: 120 })
    expect(state.selectedNodeIds).toEqual([
      state.document.nodes[2]?.id,
      state.document.nodes[3]?.id,
    ])
  })

  it('copies the dragged card horizontally when holding ctrl and shift with wider x movement', () => {
    const node = { id: 'node-1', type: 'text', x: 50, y: 60, width: 100, height: 80 } as CanvasNode
    const { handlers, state } = createGestureHarness([node])
    const target = document.createElement('div')
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    handlers.handleNodePointerDown(node, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 180,
      clientY: 130,
      ctrlKey: true,
      shiftKey: true,
    }))

    expect(state.document.nodes).toHaveLength(2)
    expect(state.document.nodes[1]).toMatchObject({ x: 130, y: 60 })
  })

  it('copies the dragged card vertically when holding ctrl and shift with taller y movement', () => {
    const node = { id: 'node-1', type: 'text', x: 50, y: 60, width: 100, height: 80 } as CanvasNode
    const { handlers, state } = createGestureHarness([node])
    const target = document.createElement('div')
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: target })

    handlers.handleNodePointerDown(node, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 125,
      clientY: 170,
      ctrlKey: true,
      shiftKey: true,
    }))

    expect(state.document.nodes).toHaveLength(2)
    expect(state.document.nodes[1]).toMatchObject({ x: 50, y: 130 })
  })

  it('snaps a dragged card to nearby vertical alignment guides', () => {
    const moving = { id: 'moving', type: 'text', x: 106, y: 220, width: 100, height: 80 } as CanvasNode
    const target = { id: 'target', type: 'text', x: 100, y: 20, width: 100, height: 80 } as CanvasNode
    const { alignmentGuides, handlers, state } = createGestureHarness([moving, target])
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: document.createElement('div') })

    handlers.handleNodePointerDown(moving, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 97,
      clientY: 100,
    }))

    expect(state.document.nodes[0]).toMatchObject({ x: 100, y: 220 })
    expect(alignmentGuides.visible).toBe(true)
    expect(alignmentGuides.guides).toEqual([
      { axis: 'x', kind: 'left', position: 100 },
    ])

    window.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 97,
      clientY: 100,
    }))

    expect(alignmentGuides.visible).toBe(false)
    expect(alignmentGuides.guides).toEqual([])
  })

  it('does not snap or show guides when drag alignment guides are disabled', () => {
    const moving = { id: 'moving', type: 'text', x: 106, y: 220, width: 100, height: 80 } as CanvasNode
    const target = { id: 'target', type: 'text', x: 100, y: 20, width: 100, height: 80 } as CanvasNode
    const { alignmentGuides, handlers, state } = createGestureHarness([moving, target], [], {
      showDragAlignmentGuides: false,
    })
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: document.createElement('div') })

    handlers.handleNodePointerDown(moving, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 97,
      clientY: 100,
    }))

    expect(state.document.nodes[0]).toMatchObject({ x: 103, y: 220 })
    expect(alignmentGuides.visible).toBe(false)
    expect(alignmentGuides.guides).toEqual([])
  })

  it('snaps selected group bounds while dragging multiple cards', () => {
    const firstNode = { id: 'node-1', type: 'text', x: 306, y: 60, width: 100, height: 80 } as CanvasNode
    const secondNode = { id: 'node-2', type: 'text', x: 456, y: 80, width: 100, height: 80 } as CanvasNode
    const target = { id: 'target', type: 'text', x: 300, y: 280, width: 120, height: 80 } as CanvasNode
    const { alignmentGuides, handlers, state } = createGestureHarness([firstNode, secondNode, target], ['node-1', 'node-2'])
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: document.createElement('div') })

    handlers.handleNodePointerDown(firstNode, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 97,
      clientY: 100,
    }))

    expect(state.document.nodes[0]).toMatchObject({ x: 300, y: 60 })
    expect(state.document.nodes[1]).toMatchObject({ x: 450, y: 80 })
    expect(alignmentGuides.guides).toEqual([
      { axis: 'x', kind: 'left', position: 300 },
    ])
  })

  it('snaps copied cards to alignment guides while ctrl-dragging', () => {
    const moving = { id: 'moving', type: 'text', x: 106, y: 220, width: 100, height: 80 } as CanvasNode
    const target = { id: 'target', type: 'text', x: 100, y: 20, width: 100, height: 80 } as CanvasNode
    const { alignmentGuides, handlers, state } = createGestureHarness([moving, target])
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: document.createElement('div') })

    handlers.handleNodePointerDown(moving, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 97,
      clientY: 100,
      ctrlKey: true,
    }))

    expect(state.document.nodes).toHaveLength(3)
    expect(state.document.nodes[2]).toMatchObject({ x: 100, y: 220 })
    expect(alignmentGuides.guides).toEqual([
      { axis: 'x', kind: 'left', position: 100 },
    ])
  })


  it('reacts to drag alignment guide setting changes in the current canvas', () => {
    const moving = { id: 'moving', type: 'text', x: 106, y: 220, width: 100, height: 80 } as CanvasNode
    const target = { id: 'target', type: 'text', x: 100, y: 20, width: 100, height: 80 } as CanvasNode
    const { alignmentGuides, handlers, showDragAlignmentGuides, state } = createGestureHarness([moving, target], [], {
      showDragAlignmentGuides: false,
    })
    const pointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(pointerDownEvent, 'target', { value: document.createElement('div') })

    handlers.handleNodePointerDown(moving, pointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 97,
      clientY: 100,
    }))

    expect(state.document.nodes[0]).toMatchObject({ x: 103, y: 220 })
    expect(alignmentGuides.visible).toBe(false)

    showDragAlignmentGuides.value = true
    window.dispatchEvent(new PointerEvent('pointerup', {
      clientX: 97,
      clientY: 100,
    }))

    const secondPointerDownEvent = new PointerEvent('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      bubbles: true,
    })
    Object.defineProperty(secondPointerDownEvent, 'target', { value: document.createElement('div') })
    handlers.handleNodePointerDown(moving, secondPointerDownEvent)
    window.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 97,
      clientY: 100,
    }))

    expect(state.document.nodes[0]).toMatchObject({ x: 100, y: 220 })
    expect(alignmentGuides.visible).toBe(true)
    expect(alignmentGuides.guides).toEqual([
      { axis: 'x', kind: 'left', position: 100 },
    ])

    showDragAlignmentGuides.value = false

    expect(alignmentGuides.visible).toBe(false)
    expect(alignmentGuides.guides).toEqual([])
  })

  it('performs pinch-to-zoom and pan correctly on touch devices', () => {
    const stage = document.createElement('div')
    stage.getBoundingClientRect = vi.fn(() => ({
      bottom: 400,
      height: 400,
      left: 0,
      right: 400,
      top: 0,
      width: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }))

    const viewport = ref({ scale: 1, x: 0, y: 0 })

    createCanvasEditorGestureHandlers({
      alignmentGuides: {
        guides: [],
        visible: false,
      },
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument: vi.fn(),
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => false),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
      showDragAlignmentGuides: computed(() => true),
      stageRef: ref(stage),
      state: {
        document: {
          nodes: [],
          edges: [],
        },
        selectNode: vi.fn(),
        selectedNodeIds: [],
      } as any,
      viewport: viewport.value,
      showNodeHeader: computed(() => true),
    })

    // 1. Simulate TouchStart with 2 fingers
    const touchStartEvent = new Event('touchstart', { bubbles: true }) as any
    touchStartEvent.touches = [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 200 },
    ]
    touchStartEvent.preventDefault = vi.fn()
    stage.dispatchEvent(touchStartEvent)

    expect(touchStartEvent.preventDefault).toHaveBeenCalled()

    // 2. Simulate TouchMove moving fingers apart (scale up from distance ~141.42 to ~282.84, which is ratio 2.0)
    // Keep fingers center at (150, 150)
    const touchMoveEvent1 = new Event('touchmove', { bubbles: true }) as any
    touchMoveEvent1.touches = [
      { clientX: 50, clientY: 50 },
      { clientX: 250, clientY: 250 },
    ]
    touchMoveEvent1.preventDefault = vi.fn()
    stage.dispatchEvent(touchMoveEvent1)

    expect(touchMoveEvent1.preventDefault).toHaveBeenCalled()
    expect(viewport.value.scale).toBe(2)
    // initialWorldCenter was (150, 150). currentCenter is (150, 150).
    // viewport.x = 150 - 150 * 2 = -150
    expect(viewport.value.x).toBe(-150)
    expect(viewport.value.y).toBe(-150)

    // 3. Simulate TouchMove moving fingers apart AND panning (shift center to (200, 200))
    // fingers at (100, 100) and (300, 300), distance ~282.84, center (200, 200)
    const touchMoveEvent2 = new Event('touchmove', { bubbles: true }) as any
    touchMoveEvent2.touches = [
      { clientX: 100, clientY: 100 },
      { clientX: 300, clientY: 300 },
    ]
    stage.dispatchEvent(touchMoveEvent2)

    expect(viewport.value.scale).toBe(2)
    // viewport.x = currentCenter.x - initialWorldCenter.x * scale = 200 - 150 * 2 = -100
    expect(viewport.value.x).toBe(-100)
    expect(viewport.value.y).toBe(-100)

    // 4. Simulate TouchEnd releasing fingers
    const touchEndEvent = new Event('touchend', { bubbles: true }) as any
    touchEndEvent.touches = []
    stage.dispatchEvent(touchEndEvent)

    // No longer scaling if fingers touched again in single touch
    const touchMoveEvent3 = new Event('touchmove', { bubbles: true }) as any
    touchMoveEvent3.touches = [
      { clientX: 100, clientY: 100 },
    ]
    stage.dispatchEvent(touchMoveEvent3)
    // Viewport should remain same since it's not 2 touches
    expect(viewport.value.scale).toBe(2)
    expect(viewport.value.x).toBe(-100)
  })
})

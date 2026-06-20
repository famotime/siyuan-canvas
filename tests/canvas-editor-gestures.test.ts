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
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument,
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => true),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
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
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument,
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => false),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
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
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument,
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => false),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
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
      board: computed(() => ({ height: 2400, left: 0, top: 0, width: 3200 })),
      commitDocument: vi.fn(),
      connectionDraft: {} as any,
      edgeReconnectDraft: {} as any,
      getAnchor: vi.fn(),
      readonly: computed(() => false),
      selectionBox: {} as any,
      selectedEdge: computed(() => null),
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


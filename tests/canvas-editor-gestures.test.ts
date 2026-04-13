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
    })

    handlers.handleWheelZoom(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(viewport.scale).toBe(0.84)
    expect((150 - viewport.x) / viewport.scale).toBeCloseTo(140)
    expect((120 - viewport.y) / viewport.scale).toBeCloseTo(100)
  })
})

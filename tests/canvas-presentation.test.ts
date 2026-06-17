/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useCanvasPresentation } from '@/canvas/use-canvas-presentation'
import type { CanvasDocument } from '@/canvas/types'

function createNode(id: string, x = 0, y = 0) {
  return {
    height: 100,
    id,
    text: id,
    type: 'text' as const,
    width: 160,
    x,
    y,
  }
}

function createPresentation(document: CanvasDocument) {
  document = reactive(document) as CanvasDocument
  const selected: string[] = []
  const focused: string[] = []
  const savedPaths: string[][] = []

  const presentation = useCanvasPresentation({
    clearSelection: vi.fn(() => {
      selected.length = 0
    }),
    focusNode: vi.fn((nodeId: string) => {
      focused.push(nodeId)
    }),
    getDocument: () => document,
    getSettings: () => ({ presentationAutoPlayInterval: 1 } as any),
    saveRecordedPath: vi.fn((path: string[]) => {
      savedPaths.push([...path])
      document.presentation = {
        ...((document.presentation as Record<string, unknown> | undefined) ?? {}),
        recordedPath: [...path],
      }
    }),
    selectNode: vi.fn((nodeId: string) => {
      selected.push(nodeId)
    }),
  })

  return { focused, presentation, savedPaths, selected }
}

describe('useCanvasPresentation', () => {
  it('records the visited nodes and saves them when recording stops', () => {
    const document: CanvasDocument = {
      edges: [],
      nodes: [createNode('a'), createNode('b')],
    }
    const { presentation, savedPaths } = createPresentation(document)

    presentation.start('a')
    presentation.toggleRecording()
    presentation.goTo('b')
    presentation.toggleRecording()

    expect(savedPaths).toEqual([['a', 'b']])
    expect(presentation.hasRecordedPath).toBe(true)
    expect(presentation.isRecording).toBe(false)
  })

  it('pauses recording autoplay at branch nodes so the user can choose the next node', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [
          { fromNode: 'a', fromSide: 'right', id: 'ab', toNode: 'b', toSide: 'left' },
          { fromNode: 'a', fromSide: 'right', id: 'ac', toNode: 'c', toSide: 'left' },
        ],
        nodes: [createNode('a'), createNode('b', 0, 100), createNode('c', 100, 100)],
      }
      const { focused, presentation } = createPresentation(document)

      presentation.start('a')
      presentation.toggleRecording()
      vi.advanceTimersByTime(1000)

      expect(presentation.currentNodeId).toBe('a')
      expect(presentation.isPlaying).toBe(false)
      expect(focused).toEqual(['a'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps default autoplay behavior outside recording by selecting the first branch', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [
          { fromNode: 'a', fromSide: 'right', id: 'ab', toNode: 'b', toSide: 'left' },
          { fromNode: 'a', fromSide: 'right', id: 'ac', toNode: 'c', toSide: 'left' },
        ],
        nodes: [createNode('a'), createNode('b', 0, 100), createNode('c', 100, 100)],
      }
      const { presentation } = createPresentation(document)

      presentation.start('a')
      vi.advanceTimersByTime(1000)

      expect(presentation.currentNodeId).toBe('b')
      expect(presentation.isPlaying).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('replays the saved path from the beginning when starting presentation', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [],
        nodes: [createNode('a'), createNode('b'), createNode('c')],
        presentation: {
          recordedPath: ['a', 'b', 'c'],
        },
      }
      const { focused, presentation } = createPresentation(document)

      presentation.start('c')
      expect(presentation.currentNodeId).toBe('a')
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('b')
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('c')

      expect(focused).toEqual(['a', 'b', 'c'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears the saved path', async () => {
    const document: CanvasDocument = {
      edges: [],
      nodes: [createNode('a')],
      presentation: {
        recordedPath: ['a'],
      },
    }
    const { presentation, savedPaths } = createPresentation(document)

    expect(presentation.hasRecordedPath).toBe(true)
    presentation.clearRecordedPath()
    await nextTick()

    expect(savedPaths).toEqual([[]])
    expect(presentation.hasRecordedPath).toBe(false)
  })
})

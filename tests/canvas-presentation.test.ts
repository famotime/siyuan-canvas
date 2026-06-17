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

  it('plays the recorded path from the beginning when togglePlay is clicked after recording completes', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [],
        nodes: [createNode('a'), createNode('b'), createNode('c')],
      }
      const { presentation } = createPresentation(document)

      presentation.start('a')
      presentation.toggleRecording()
      presentation.goTo('b')
      presentation.goTo('c')
      presentation.toggleRecording() // 结束录制

      expect(presentation.isRecording).toBe(false)
      expect(presentation.hasRecordedPath).toBe(true)

      // 再次点击播放按钮 (togglePlay)
      presentation.togglePlay()

      // 应该切换为 recorded 模式，且当前节点应该重置为 'a' 重新播放
      expect(presentation.currentNodeId).toBe('a')

      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('b')
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('c')
    } finally {
      vi.useRealTimers()
    }
  })

  it('replays the recorded path from the beginning when togglePlay is clicked after the previous playback completes', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [],
        nodes: [createNode('a'), createNode('b')],
        presentation: {
          recordedPath: ['a', 'b'],
        },
      }
      const { presentation } = createPresentation(document)

      presentation.start('a')
      vi.advanceTimersByTime(2000) // 自动播放完成

      // 此时已经播完，isPlaying 自动变为 false
      expect(presentation.isPlaying).toBe(false)
      expect(presentation.currentNodeId).toBe('b')

      // 再次点击播放按钮
      presentation.togglePlay()

      // 应该重新从头播放 'a'
      expect(presentation.currentNodeId).toBe('a')
      expect(presentation.isPlaying).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('records and saves the path when autoplay is active during recording', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [
          { fromNode: 'a', fromSide: 'right', id: 'ab', toNode: 'b', toSide: 'left' },
          { fromNode: 'b', fromSide: 'right', id: 'bc', toNode: 'c', toSide: 'left' },
        ],
        nodes: [createNode('a'), createNode('b', 0, 100), createNode('c', 100, 100)],
      }
      const { presentation, savedPaths } = createPresentation(document)

      // 开始演示并开启录制
      presentation.start('a')
      presentation.toggleRecording()

      expect(presentation.isRecording).toBe(true)
      expect(presentation.isPlaying).toBe(true) // start() 会自动设 isPlaying 为 true

      // 自动播放跳到 'b'
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('b')

      // 自动播放跳到 'c'
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('c')

      // 结束录制
      presentation.toggleRecording()

      expect(presentation.isRecording).toBe(false)
      // 应该成功保存包含自动播放生成的节点的完整路径
      expect(savedPaths).toEqual([['a', 'b', 'c']])
    } finally {
      vi.useRealTimers()
    }
  })

  it('allows toggling play (pause/resume) during recording and records all visited nodes', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [
          { fromNode: 'a', fromSide: 'right', id: 'ab', toNode: 'b', toSide: 'left' },
          { fromNode: 'b', fromSide: 'right', id: 'bc', toNode: 'c', toSide: 'left' },
        ],
        nodes: [createNode('a'), createNode('b', 0, 100), createNode('c', 100, 100)],
      }
      const { presentation, savedPaths } = createPresentation(document)

      // 开始演示并开启录制
      presentation.start('a')
      presentation.toggleRecording()

      expect(presentation.isRecording).toBe(true)
      expect(presentation.isPlaying).toBe(true)

      // 1. 自动播放到 'b'
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('b')

      // 2. 点击播放按钮进行暂停
      presentation.togglePlay()
      expect(presentation.isPlaying).toBe(false)
      expect(presentation.isRecording).toBe(true) // 录制应该保持开启

      // 3. 等待一段时间，验证没有自动播放到 'c'
      vi.advanceTimersByTime(2000)
      expect(presentation.currentNodeId).toBe('b')

      // 4. 再次点击播放按钮恢复播放
      presentation.togglePlay()
      expect(presentation.isPlaying).toBe(true)

      // 5. 自动播放到 'c'
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('c')

      // 6. 结束录制
      presentation.toggleRecording()
      expect(presentation.isRecording).toBe(false)
      expect(savedPaths).toEqual([['a', 'b', 'c']])
    } finally {
      vi.useRealTimers()
    }
  })

  it('resets visitedNodes when recording starts to allow recording over previously visited nodes', () => {
    vi.useFakeTimers()
    try {
      const document: CanvasDocument = {
        edges: [
          { fromNode: 'a', fromSide: 'right', id: 'ab', toNode: 'b', toSide: 'left' },
          { fromNode: 'b', fromSide: 'right', id: 'ba', toNode: 'a', toSide: 'left' },
        ],
        nodes: [createNode('a'), createNode('b', 0, 100)],
      }
      const { presentation } = createPresentation(document)

      // 先未录制时从 a 走到 b
      presentation.start('a')
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('b')

      // 此时 'a' 在 visitedNodes 里。开启录制，应该重置 visitedNodes 并清空历史记录
      presentation.toggleRecording()
      presentation.isPlaying = false

      presentation.togglePlay() // 重新播放
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('a') // 应该成功回到 'a'
    } finally {
      vi.useRealTimers()
    }
  })

  it('advances to the first branch and resumes play when togglePlay is clicked at a branch node during recording', () => {
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
      presentation.toggleRecording()

      // 因为是分支节点，自动播放会在 a 处暂停，此时 isPlaying 应该为 false
      vi.advanceTimersByTime(1000)
      expect(presentation.currentNodeId).toBe('a')
      expect(presentation.isPlaying).toBe(false)

      // 在分支节点上，用户点击播放按钮 (togglePlay)
      presentation.togglePlay()

      // 应当直接重置并前进到第一个分支节点 'b'，且保持在播放中
      expect(presentation.currentNodeId).toBe('b')
      expect(presentation.isPlaying).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('continues recording from the end node of the saved path when starting recording with a saved path already present', () => {
    const document: CanvasDocument = {
      edges: [],
      nodes: [createNode('a'), createNode('b'), createNode('c'), createNode('d')],
      presentation: {
        recordedPath: ['a', 'b', 'c'],
      },
    }
    const { presentation, savedPaths } = createPresentation(document)

    expect(presentation.hasRecordedPath).toBe(true)

    // 在已有保存路径的情况下开启录制
    presentation.toggleRecording()

    expect(presentation.isRecording).toBe(true)
    expect(presentation.currentNodeId).toBe('c') // 应当跳转到已保存路径的最后一个节点 'c'
    expect(presentation.pathHistory).toEqual(['a', 'b']) // 游历历史应当初始化为除了最后一个节点的其余节点

    // 继续添加节点
    presentation.goTo('d')
    presentation.toggleRecording() // 结束录制

    // 保存的路径应该是延长的路径 ['a', 'b', 'c', 'd']
    expect(savedPaths).toEqual([['a', 'b', 'c', 'd']])
  })

  it('truncates the path and continues recording from the current step when stepping back to a node during playback and starting recording', () => {
    const document: CanvasDocument = {
      edges: [],
      nodes: [createNode('a'), createNode('b'), createNode('c'), createNode('d'), createNode('e')],
      presentation: {
        recordedPath: ['a', 'b', 'c', 'd'],
      },
    }
    const { presentation, savedPaths } = createPresentation(document)

    expect(presentation.hasRecordedPath).toBe(true)

    // 启动演示
    presentation.start('a')
    
    // 模拟播放走到 'd'
    presentation.next() // b
    presentation.next() // c
    presentation.next() // d
    expect(presentation.currentNodeId).toBe('d')

    // 退回两步到 'b'
    presentation.prev() // c
    presentation.prev() // b
    expect(presentation.currentNodeId).toBe('b')

    // 点击录制按钮开始录制
    presentation.toggleRecording()

    expect(presentation.isRecording).toBe(true)
    expect(presentation.currentNodeId).toBe('b')
    expect(presentation.pathHistory).toEqual(['a'])

    // 继续添加节点 'e'
    presentation.goTo('e')
    presentation.toggleRecording() // 结束录制

    // 最终保存的路径应该是截断后延长的路径 ['a', 'b', 'e']
    expect(savedPaths).toEqual([['a', 'b', 'e']])
  })
})



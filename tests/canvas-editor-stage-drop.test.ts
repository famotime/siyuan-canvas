/* @vitest-environment jsdom */

import {
  beforeEach,
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
import { createCanvasEditorStageDropActions } from '@/canvas/use-canvas-editor-stage-drop'

const apiMocks = vi.hoisted(() => ({
  putFile: vi.fn(async () => null),
  upload: vi.fn(async () => ({ succMap: {} })),
}))

vi.mock('@/api', () => apiMocks)

function createStageDropHarness(options?: { fileSource?: string, filePath?: string }) {
  const committed: ReturnType<typeof createEmptyCanvasDocument>[] = []
  const board = computed(() => ({
    height: 2400,
    left: 0,
    top: 0,
    width: 3200,
  }))
  const viewport = { scale: 1, x: 0, y: 0 }
  const selectNode = vi.fn()
  const refreshFileNodeMetadata = vi.fn(async () => {})
  const state = {
    document: createEmptyCanvasDocument(),
    filePath: options?.filePath ?? '/test.canvas',
  } as any

  const harness = createCanvasEditorStageDropActions({
    board,
    commitDocument: (doc: any) => committed.push(doc),
    fileSource: ref(options?.fileSource ?? 'workspace'),
    refreshFileNodeMetadata,
    selectNode,
    state,
    t: ((key: string) => key) as any,
    viewport,
  })

  return { committed, harness, refreshFileNodeMetadata, selectNode }
}

function createDropEvent(data: string, clientX = 100, clientY = 200): DragEvent {
  const stageEl = document.createElement('section')
  stageEl.getBoundingClientRect = vi.fn(() => ({
    bottom: 600,
    height: 600,
    left: 0,
    right: 800,
    top: 0,
    width: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }))

  const dt = {
    getData: (type: string) => type === 'application/siyuan-file' ? data : '',
    types: ['application/siyuan-file'],
  }

  return {
    clientX,
    clientY,
    currentTarget: stageEl,
    dataTransfer: dt,
    preventDefault: vi.fn(),
  } as unknown as DragEvent
}

function createFileDropEvent(files: File[], clientX = 100, clientY = 200): DragEvent {
  const stageEl = document.createElement('section')
  stageEl.getBoundingClientRect = vi.fn(() => ({
    bottom: 600,
    height: 600,
    left: 0,
    right: 800,
    top: 0,
    width: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }))

  const dt = {
    files,
    getData: () => '',
    types: ['Files'],
  }

  return {
    clientX,
    clientY,
    currentTarget: stageEl,
    dataTransfer: dt,
    preventDefault: vi.fn(),
  } as unknown as DragEvent
}

describe('canvas editor stage drop', () => {
  beforeEach(() => {
    apiMocks.putFile.mockClear()
    apiMocks.upload.mockClear()
  })

  it('accepts dragover with siyuan-file type', () => {
    const { harness } = createStageDropHarness()
    const event = {
      dataTransfer: { types: ['application/siyuan-file'], dropEffect: '' },
      preventDefault: vi.fn(),
    } as unknown as DragEvent

    harness.handleStageDragOver(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect((event.dataTransfer as any).dropEffect).toBe('copy')
  })

  it('ignores dragover without siyuan-file type', () => {
    const { harness } = createStageDropHarness()
    const event = {
      dataTransfer: { types: ['text/plain'], dropEffect: '' },
      preventDefault: vi.fn(),
    } as unknown as DragEvent

    harness.handleStageDragOver(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('creates file node from single dropped block ID', async () => {
    const { committed, harness, selectNode } = createStageDropHarness()
    const event = createDropEvent('20230613234017-zkw3pr0')

    await harness.handleStageDrop(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(committed).toHaveLength(1)
    const doc = committed[0]
    const node = doc.nodes.find((n: any) => n.type === 'file')!
    expect(node.file).toBe('20230613234017-zkw3pr0')
    expect(selectNode).toHaveBeenCalledWith(node.id)
  })

  it('creates multiple file nodes from comma-separated block IDs', async () => {
    const { committed, harness } = createStageDropHarness()
    const event = createDropEvent('20230613234017-zkw3pr0,20230614091200-abc1234')

    await harness.handleStageDrop(event)

    expect(committed).toHaveLength(2)
    const nodes = committed.flatMap((doc: any) => doc.nodes.filter((n: any) => n.type === 'file'))
    expect(nodes[0].file).toBe('20230613234017-zkw3pr0')
    expect(nodes[1].file).toBe('20230614091200-abc1234')
    expect(nodes[1].y).toBeGreaterThan(nodes[0].y)
  })

  it('ignores invalid block IDs in the payload', async () => {
    const { committed, harness } = createStageDropHarness()
    const event = createDropEvent('not-a-valid-id,also-bad')

    await harness.handleStageDrop(event)

    expect(committed).toHaveLength(0)
  })

  it('skips drop when canvas is not saved to workspace', async () => {
    const { committed, harness } = createStageDropHarness({ fileSource: 'unsaved' })
    const event = createDropEvent('20230613234017-zkw3pr0')

    await harness.handleStageDrop(event)

    expect(committed).toHaveLength(0)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('places node at drop coordinates', async () => {
    const { committed, harness } = createStageDropHarness()
    const event = createDropEvent('20230613234017-zkw3pr0', 400, 300)

    await harness.handleStageDrop(event)

    expect(committed).toHaveLength(1)
    const node = committed[0].nodes.find((n: any) => n.type === 'file')!
    expect(node.x).toBe(400)
    expect(node.y).toBe(300)
  })

  it('keeps dropped image block id as file source so metadata refresh can resolve it as an image', async () => {
    const { committed, harness, refreshFileNodeMetadata } = createStageDropHarness()
    const event = createDropEvent('20230613234017-zkw3pr0')

    await harness.handleStageDrop(event)

    expect(committed).toHaveLength(1)
    const node = committed[0].nodes.find((n: any) => n.type === 'file')!
    expect(node.file).toBe('20230613234017-zkw3pr0')
    expect(refreshFileNodeMetadata).toHaveBeenCalledTimes(1)
  })

  it('writes dropped image files beside the saved workspace canvas without using global asset upload or metadata refresh', async () => {
    const { committed, harness, refreshFileNodeMetadata, selectNode } = createStageDropHarness({
      filePath: '/data/storage/maps/roadmap.canvas',
    })
    const imageFile = new File(['png'], 'dropped.png', { type: 'image/png' })
    const event = createFileDropEvent([imageFile], 400, 300)

    await harness.handleStageDrop(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(apiMocks.upload).not.toHaveBeenCalled()
    expect(apiMocks.putFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/data\/storage\/maps\/roadmap\.assets\/\d+\.png$/),
      false,
      imageFile,
    )
    expect(refreshFileNodeMetadata).not.toHaveBeenCalled()
    expect(committed).toHaveLength(1)
    const node = committed[0].nodes.find((n: any) => n.type === 'file')!
    expect(node.file).toMatch(/^\/data\/storage\/maps\/roadmap\.assets\/\d+\.png$/)
    expect(node).toMatchObject({
      height: 240,
      type: 'file',
      width: 320,
      x: 400,
      y: 300,
    })
    expect(selectNode).toHaveBeenCalledWith(node.id)
  })
})

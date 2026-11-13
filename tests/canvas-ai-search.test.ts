import { describe, expect, it, vi } from 'vitest'
import { collectUpstreamContext, requestAiSearch } from '@/canvas/ai-search-helper'
import type { CanvasNode, CanvasEdge } from '@/canvas/types'

// Mock Siyuan kernel API requests since we run unit tests in a Node environment without kernel active
vi.mock('@/canvas/siyuan-kernel-file-node-lookups', () => ({
  findSiyuanAssetByPath: vi.fn(),
  findSiyuanBlockById: vi.fn(),
  findSiyuanDocumentByBlockId: vi.fn(),
  findSiyuanDocumentByPath: vi.fn(),
  findSiyuanImageAssetByBlockId: vi.fn(),
  getSiyuanBlockMarkdown: vi.fn(() => Promise.resolve('Mock Block Content')),
  getSiyuanHeadingBlockMarkdown: vi.fn(() => Promise.resolve('Mock Heading Content')),
  getSiyuanDocumentMarkdown: vi.fn(() => Promise.resolve('Mock Document Content')),
}))

describe('collectUpstreamContext BFS Trace', () => {
  const mockNodes: CanvasNode[] = [
    { id: 'nodeA', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'Node A Content' },
    { id: 'nodeB', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'Node B Content' },
    { id: 'nodeC', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'Node C Content' },
    { id: 'nodeD', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'Node D Content' },
    { id: 'nodeE', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'Node E Content' },
  ]

  it('collects target node and immediate parent', async () => {
    // A -> B
    const edges: CanvasEdge[] = [
      { id: 'edge1', fromNode: 'nodeA', fromSide: 'right', toNode: 'nodeB', toSide: 'left' }
    ]

    const result = await collectUpstreamContext('nodeB', mockNodes, edges, 3, 10)
    expect(result.targetNode).not.toBeNull()
    expect(result.targetNode?.id).toBe('nodeB')
    expect(result.collected.length).toBe(1)
    expect(result.collected[0].id).toBe('nodeA')
    expect(result.collected[0].depth).toBe(1)
  })

  it('respects trace maxDepth limit', async () => {
    // A -> B -> C -> D
    const edges: CanvasEdge[] = [
      { id: 'e1', fromNode: 'nodeA', fromSide: 'right', toNode: 'nodeB', toSide: 'left' },
      { id: 'e2', fromNode: 'nodeB', fromSide: 'right', toNode: 'nodeC', toSide: 'left' },
      { id: 'e3', fromNode: 'nodeC', fromSide: 'right', toNode: 'nodeD', toSide: 'left' },
    ]

    // maxDepth = 2: should only trace D's parents up to 2 hops (C and B, but not A)
    const result = await collectUpstreamContext('nodeD', mockNodes, edges, 2, 10)
    expect(result.collected.map(n => n.id)).toEqual(['nodeC', 'nodeB'])
    expect(result.collected.find(n => n.id === 'nodeA')).toBeUndefined()
  })

  it('respects trace maxCards limit', async () => {
    // A -> B, C -> B, D -> B
    const edges: CanvasEdge[] = [
      { id: 'e1', fromNode: 'nodeA', fromSide: 'right', toNode: 'nodeB', toSide: 'left' },
      { id: 'e2', fromNode: 'nodeC', fromSide: 'right', toNode: 'nodeB', toSide: 'left' },
      { id: 'e3', fromNode: 'nodeD', fromSide: 'right', toNode: 'nodeB', toSide: 'left' },
    ]

    // maxCards = 2: should only collect 2 parent cards
    const result = await collectUpstreamContext('nodeB', mockNodes, edges, 3, 2)
    expect(result.collected.length).toBe(2)
  })

  it('avoids infinite loop in circular relationships', async () => {
    // A -> B -> A (Circular)
    const edges: CanvasEdge[] = [
      { id: 'e1', fromNode: 'nodeA', fromSide: 'right', toNode: 'nodeB', toSide: 'left' },
      { id: 'e2', fromNode: 'nodeB', fromSide: 'right', toNode: 'nodeA', toSide: 'left' },
    ]

    const result = await collectUpstreamContext('nodeB', mockNodes, edges, 5, 10)
    // Should not hang and A should be collected exactly once
    expect(result.collected.length).toBe(1)
    expect(result.collected[0].id).toBe('nodeA')
  })
})

describe('requestAiSearch JSON parser tolerance', () => {
  it('correctly parses standard response', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            cards: [{ content: 'Hello World' }]
          })
        }
      }]
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    )

    const result = await requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'content', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 5, temperature: 0.7, maxTokens: 100 },
      richness: 'simple',
      cardCount: 1
    })

    expect(result.cards).toEqual([{ content: 'Hello World' }])
    fetchSpy.mockRestore()
  })

  it('correctly handles non-standard response with top-level content field', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            content: 'Pandas DataFrame typical scenarios...'
          })
        }
      }]
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    )

    const result = await requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'content', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 5, temperature: 0.7, maxTokens: 100 },
      richness: 'simple',
      cardCount: 1
    })

    expect(result.cards).toEqual([{ content: 'Pandas DataFrame typical scenarios...' }])
    fetchSpy.mockRestore()
  })

  it('correctly handles array response', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify([
            { content: 'Card A' },
            { content: 'Card B' }
          ])
        }
      }]
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    )

    const result = await requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'content', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 5, temperature: 0.7, maxTokens: 100 },
      richness: 'simple',
      cardCount: 2
    })

    expect(result.cards).toEqual([{ content: 'Card A' }, { content: 'Card B' }])
    fetchSpy.mockRestore()
  })

  it('correctly handles response where cards is a string', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            cards: 'Single string card content'
          })
        }
      }]
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    )

    const result = await requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'content', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 5, temperature: 0.7, maxTokens: 100 },
      richness: 'simple',
      cardCount: 1
    })

    expect(result.cards).toEqual([{ content: 'Single string card content' }])
    fetchSpy.mockRestore()
  })

  it('correctly rescues unterminated string (truncated JSON) from LLM', async () => {
    // 模拟一个大模型输出，并在中途被截断导致字符串未闭合的场景
    const mockContent = `{\n  "cards": [\n    { "content": "第一张卡片完成的内容" },\n    { "content": "第二张卡片未`
    
    const mockResponse = {
      choices: [{
        message: {
          content: mockContent
        }
      }]
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    )

    const result = await requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'content', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 5, temperature: 0.7, maxTokens: 100 },
      richness: 'simple',
      cardCount: 2
    })

    // 应该只抢救出已经闭合的第一张卡片
    expect(result.cards).toEqual([{ content: '第一张卡片完成的内容' }])
    fetchSpy.mockRestore()
  })

  it('correctly rescues duplicate top-level content keys in truncated format', async () => {
    // 模拟大模型输出大量重复 "content" 键，且末尾发生截断的场景
    const mockContent = `{
      "content": "Python基础模块内容一"
    ,
      "content": "Python标准库内容二"
    ,
      "content": "Python第三方库未`

    const mockResponse = {
      choices: [{
        message: {
          content: mockContent
        }
      }]
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    )

    const result = await requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'content', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 5, temperature: 0.7, maxTokens: 100 },
      richness: 'simple',
      cardCount: 3
    })

    // 应该把能够闭合的两个 content 内容成功抢救出来
    expect(result.cards).toEqual([
      { content: 'Python基础模块内容一' },
      { content: 'Python标准库内容二' }
    ])
    fetchSpy.mockRestore()
  })

  it('includes customPrompt in request payload when provided', async () => {
    let capturedBody: any = null
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            cards: [
              { content: '### 核心推演\n聚焦该主题的概要说明。' },
              { content: '### 潜在风险\n分析潜在实施风险。' }
            ]
          })
        }
      }]
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options: any) => {
      capturedBody = JSON.parse(options.body)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response)
    })

    const result = await requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'Vue3响应式原理', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 5, temperature: 0.7, maxTokens: 100 },
      cardCount: 2,
      customPrompt: '重点分析 Proxy 与 Reflect 细节',
    })

    expect(result.cards.length).toBe(2)
    expect(result.cards[0].content).toContain('### 核心推演')
    expect(capturedBody).not.toBeNull()
    const userPromptContent = capturedBody.messages.find((m: any) => m.role === 'user')?.content
    expect(userPromptContent).toContain('【用户指定的探索方向与具体要求】')
    expect(userPromptContent).toContain('重点分析 Proxy 与 Reflect 细节')
    expect(userPromptContent).toContain('以 "### 标题" 的三级标题作为第一行')
    expect(userPromptContent).toContain('少于 150 字的概要说明')

    fetchSpy.mockRestore()
  })

  it('forwards external AbortSignal so caller unmount/switch cancels in-flight fetch with AbortError', async () => {
    const abortController = new AbortController()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options: any) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted.')
          error.name = 'AbortError'
          reject(error)
        }, { once: true })
      })
    })

    const requestPromise = requestAiSearch({
      collected: [],
      relations: [],
      targetNode: { id: 't1', type: 'text', title: 'Target', content: 'Content', depth: 0 },
      apiConfig: { provider: 'test', baseUrl: 'http://test.ai', apiKey: 'key', model: 'gpt-4', requestTimeoutSeconds: 30, temperature: 0.7, maxTokens: 100 },
      cardCount: 1,
      signal: abortController.signal,
    })

    abortController.abort()
    await expect(requestPromise).rejects.toMatchObject({ name: 'AbortError' })
    fetchSpy.mockRestore()
  })
})



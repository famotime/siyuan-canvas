import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { ref } from "vue"
import { createQueryNodeRuntime } from "@/canvas/query-node-runtime"
import type { CanvasNode, CanvasQueryNode } from "@/canvas/types"

describe("createQueryNodeRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("fetches and renders SQL results for query nodes", async () => {
    const nodes = ref<CanvasNode[]>([
      {
        id: "query-1",
        type: "query",
        sql: "SELECT * FROM blocks LIMIT 10",
        refreshInterval: 0,
        maxResults: 5,
        x: 0,
        y: 0,
        width: 300,
        height: 400,
      } as CanvasQueryNode,
    ])

    const executeSql = vi.fn(async () => [
      { id: "b1", content: "Block 1", markdown: "**Block 1**" },
      { id: "b2", content: "Block 2", markdown: "*Block 2*" },
    ])

    const renderMarkdown = vi.fn((md: string) => `<span>${md}</span>`)
    const updateNodeField = vi.fn()
    const editingNodeId = ref("")

    const runtime = createQueryNodeRuntime({
      getNodes: () => nodes.value,
      updateNodeField,
      editingNodeId,
      renderMarkdown,
      executeSql,
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(executeSql).toHaveBeenCalledWith("SELECT * FROM blocks LIMIT 10")
    expect(runtime.queryResultsMap.value["query-1"]).toHaveLength(2)
    expect(runtime.queryResultsMap.value["query-1"][0].renderedHtml).toBe("<span>**Block 1**</span>")
    expect(runtime.queryErrorsMap.value["query-1"]).toBe("")

    runtime.cleanup()
  })

  it("handles SQL execution failure with descriptive error", async () => {
    const nodes = ref<CanvasNode[]>([
      {
        id: "query-err",
        type: "query",
        sql: "INVALID SQL SYNTAX",
        refreshInterval: 0,
        maxResults: 10,
        x: 0,
        y: 0,
        width: 300,
        height: 400,
      } as CanvasQueryNode,
    ])

    const executeSql = vi.fn(async () => {
      throw new Error("syntax error at or near INVALID")
    })

    const runtime = createQueryNodeRuntime({
      getNodes: () => nodes.value,
      updateNodeField: vi.fn(),
      editingNodeId: ref(""),
      renderMarkdown: (md) => md,
      executeSql,
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(runtime.queryErrorsMap.value["query-err"]).toContain("syntax error at or near INVALID")
    expect(runtime.queryResultsMap.value["query-err"]).toEqual([])
    expect(runtime.queryLoadingMap.value["query-err"]).toBe(false)

    runtime.cleanup()
  })

  it("slices SQL results to respect maxResults limit", async () => {
    const nodes = ref<CanvasNode[]>([
      {
        id: "query-limit",
        type: "query",
        sql: "SELECT * FROM blocks",
        refreshInterval: 0,
        maxResults: 2,
        x: 0,
        y: 0,
        width: 300,
        height: 400,
      } as CanvasQueryNode,
    ])

    const executeSql = vi.fn(async () => [
      { id: "b1", content: "Block 1" },
      { id: "b2", content: "Block 2" },
      { id: "b3", content: "Block 3" },
      { id: "b4", content: "Block 4" },
    ])

    const runtime = createQueryNodeRuntime({
      getNodes: () => nodes.value,
      updateNodeField: vi.fn(),
      editingNodeId: ref(""),
      renderMarkdown: (md) => md,
      executeSql,
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(runtime.queryResultsMap.value["query-limit"]).toHaveLength(2)

    runtime.cleanup()
  })

  it("manages timer lifecycle for periodic refreshing", async () => {
    const queryNode: CanvasQueryNode = {
      id: "query-timer",
      type: "query",
      sql: "SELECT count(*) FROM blocks",
      refreshInterval: 5,
      maxResults: 10,
      x: 0,
      y: 0,
      width: 300,
      height: 400,
    }
    const nodes = ref<CanvasNode[]>([queryNode])

    const executeSql = vi.fn(async () => [{ count: 42 }])
    const editingNodeId = ref("")

    const runtime = createQueryNodeRuntime({
      getNodes: () => nodes.value,
      updateNodeField: vi.fn(),
      editingNodeId,
      renderMarkdown: (md) => md,
      executeSql,
    })

    await Promise.resolve()
    expect(executeSql).toHaveBeenCalledTimes(1)

    // Advance 5 seconds -> triggers scheduled refresh
    await vi.advanceTimersByTimeAsync(5000)
    expect(executeSql).toHaveBeenCalledTimes(2)

    // While editing the node, timer does not fetch
    editingNodeId.value = "query-timer"
    await vi.advanceTimersByTimeAsync(5000)
    expect(executeSql).toHaveBeenCalledTimes(2)

    // Removing the node cleans up the timer and state
    editingNodeId.value = ""
    nodes.value = []
    await Promise.resolve()

    expect(runtime.queryTimersMap.has("query-timer")).toBe(false)
    expect(runtime.queryResultsMap.value["query-timer"]).toBeUndefined()

    runtime.cleanup()
  })

  it("manages query editing workflow and validates inputs", async () => {
    const queryNode: CanvasQueryNode = {
      id: "query-edit",
      type: "query",
      sql: "SELECT 1",
      refreshInterval: 10,
      maxResults: 20,
      x: 0,
      y: 0,
      width: 300,
      height: 400,
    }
    const nodes = ref<CanvasNode[]>([queryNode])
    const updateNodeField = vi.fn((id, field, value) => {
      (queryNode as any)[field] = value
    })
    const editingNodeId = ref("")
    const showMessage = vi.fn()

    const runtime = createQueryNodeRuntime({
      getNodes: () => nodes.value,
      updateNodeField,
      editingNodeId,
      renderMarkdown: (md) => md,
      executeSql: vi.fn(async () => []),
      showMessage,
    })

    // Start editing
    runtime.startQueryEditing(queryNode)
    expect(editingNodeId.value).toBe("query-edit")
    expect(runtime.editingQuerySql.value).toBe("SELECT 1")
    expect(runtime.editingQueryInterval.value).toBe(10)
    expect(runtime.editingQueryMaxResults.value).toBe(20)

    // Validate empty sql rejection
    runtime.editingQuerySql.value = "   "
    runtime.saveQueryEditing(queryNode)
    expect(showMessage).toHaveBeenCalledWith("sqlCannotBeEmpty", 3000, "error")

    // Save valid query
    runtime.editingQuerySql.value = "SELECT * FROM notes"
    runtime.editingQueryInterval.value = 15
    runtime.editingQueryMaxResults.value = 30
    runtime.saveQueryEditing(queryNode)

    expect(updateNodeField).toHaveBeenCalledWith("query-edit", "sql", "SELECT * FROM notes")
    expect(updateNodeField).toHaveBeenCalledWith("query-edit", "refreshInterval", 15)
    expect(updateNodeField).toHaveBeenCalledWith("query-edit", "maxResults", 30)
    expect(editingNodeId.value).toBe("")

    // Cancel editing
    runtime.startQueryEditing(queryNode)
    runtime.cancelQueryEditing()
    expect(editingNodeId.value).toBe("")
    expect(runtime.editingQuerySql.value).toBe("")

    runtime.cleanup()
  })

  it("sets dataTransfer payload on query result drag start", () => {
    const runtime = createQueryNodeRuntime({
      getNodes: () => [],
      updateNodeField: vi.fn(),
      editingNodeId: ref(""),
      renderMarkdown: (md) => md,
    })

    const setData = vi.fn()
    const mockDragEvent = {
      dataTransfer: {
        effectAllowed: "",
        setData,
      },
    } as unknown as DragEvent

    runtime.handleQueryResultDragStart(mockDragEvent, "block-123", "node-456")
    expect(mockDragEvent.dataTransfer?.effectAllowed).toBe("copy")
    expect(setData).toHaveBeenCalledWith("application/siyuan-file", "block-123")
    expect(setData).toHaveBeenCalledWith("application/siyuan-canvas-drag-source-node-id", "node-456")

    runtime.cleanup()
  })
})

import type { Ref } from "vue"
import {
  ref,
  watch,
} from "vue"
import type { CanvasNode, CanvasQueryNode } from "@/canvas/types"

export interface QueryNodeRuntimeOptions {
  getNodes: () => CanvasNode[]
  updateNodeField: (nodeId: string, field: string, value: unknown) => void
  editingNodeId: Ref<string>
  renderMarkdown: (markdown: string) => string
  processRenderedHtml?: (html: string) => string
  executeSql?: (sqlQuery: string) => Promise<unknown>
  showMessage?: (msg: string, timeout?: number, type?: string) => void
  t?: (key: string) => string
}

export interface CanvasQueryResultItem {
  [key: string]: unknown
  content?: string
  markdown?: string
  renderedHtml?: string
}

export function createQueryNodeRuntime(options: QueryNodeRuntimeOptions) {
  const {
    getNodes,
    updateNodeField,
    editingNodeId,
    renderMarkdown,
    processRenderedHtml,
    executeSql,
    showMessage,
    t = (key: string) => key,
  } = options

  const queryResultsMap = ref<Record<string, CanvasQueryResultItem[]>>({})
  const queryErrorsMap = ref<Record<string, string>>({})
  const queryLoadingMap = ref<Record<string, boolean>>({})
  const queryTimersMap = new Map<string, { timer: ReturnType<typeof setInterval> | null, interval: number }>()

  const editingQuerySql = ref("")
  const editingQueryInterval = ref(0)
  const editingQueryMaxResults = ref(50)

  async function fetchQueryResult(node: CanvasQueryNode): Promise<void> {
    if (!node.id || !node.sql) return
    queryLoadingMap.value[node.id] = true
    queryErrorsMap.value[node.id] = ""
    try {
      if (!executeSql) {
        throw new Error("SQL executor is not configured")
      }
      const rawResults = await executeSql(node.sql)
      if (!Array.isArray(rawResults)) {
        throw new Error("SQL returned invalid results (expected array)")
      }
      const limit = node.maxResults || 50
      const sliced = rawResults.slice(0, limit)

      const processed: CanvasQueryResultItem[] = sliced.map((block: Record<string, unknown>) => {
        const markdown = String(block.markdown || block.content || "")
        let html = renderMarkdown(markdown)
        if (processRenderedHtml) {
          html = processRenderedHtml(html)
        }
        return {
          ...block,
          renderedHtml: html,
        }
      })
      queryResultsMap.value[node.id] = processed
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      queryErrorsMap.value[node.id] = errorMsg
      queryResultsMap.value[node.id] = []
    } finally {
      queryLoadingMap.value[node.id] = false
    }
  }

  function startQueryEditing(node: CanvasQueryNode): void {
    editingNodeId.value = node.id
    editingQuerySql.value = node.sql || ""
    editingQueryInterval.value = node.refreshInterval || 0
    editingQueryMaxResults.value = node.maxResults || 50
  }

  function cancelQueryEditing(): void {
    editingNodeId.value = ""
    editingQuerySql.value = ""
  }

  function saveQueryEditing(node: CanvasQueryNode): void {
    if (!editingQuerySql.value.trim()) {
      showMessage?.(t("sqlCannotBeEmpty"), 3000, "error")
      return
    }

    updateNodeField(node.id, "sql", editingQuerySql.value.trim())
    updateNodeField(node.id, "refreshInterval", Math.max(0, editingQueryInterval.value || 0))
    updateNodeField(node.id, "maxResults", Math.max(1, editingQueryMaxResults.value || 50))

    editingNodeId.value = ""

    const updatedNode = getNodes().find(n => n.id === node.id) as CanvasQueryNode | undefined
    if (updatedNode) {
      void fetchQueryResult(updatedNode)
    }
  }

  function handleQueryResultDragStart(event: DragEvent, blockId: string, sourceNodeId: string): void {
    if (!event.dataTransfer) return
    event.dataTransfer.effectAllowed = "copy"
    event.dataTransfer.setData("application/siyuan-file", blockId)
    event.dataTransfer.setData("application/siyuan-canvas-drag-source-node-id", sourceNodeId)
  }

  const stopNodesWatcher = watch(
    () => getNodes()
      .filter(node => node.type === "query")
      .map(node => `${node.id}:${(node as CanvasQueryNode).sql || ""}:${(node as CanvasQueryNode).refreshInterval || 0}:${(node as CanvasQueryNode).maxResults || 50}`)
      .join(";"),
    () => {
      const allNodes = getNodes()
      if (!allNodes) return
      const queryNodes = allNodes.filter(node => node.type === "query") as CanvasQueryNode[]

      const currentTimerIds = Array.from(queryTimersMap.keys())
      for (const timerId of currentTimerIds) {
        if (!queryNodes.some(n => n.id === timerId)) {
          const info = queryTimersMap.get(timerId)
          if (info?.timer) clearInterval(info.timer)
          queryTimersMap.delete(timerId)
          delete queryResultsMap.value[timerId]
          delete queryErrorsMap.value[timerId]
          delete queryLoadingMap.value[timerId]
        }
      }

      for (const node of queryNodes) {
        if (queryResultsMap.value[node.id] === undefined && !queryLoadingMap.value[node.id]) {
          void fetchQueryResult(node)
        }

        const timerInfo = queryTimersMap.get(node.id)
        const timerInterval = timerInfo ? timerInfo.interval : -1
        const currentInterval = node.refreshInterval !== undefined ? node.refreshInterval : 0

        if (currentInterval !== timerInterval) {
          if (timerInfo?.timer) {
            clearInterval(timerInfo.timer)
            queryTimersMap.delete(node.id)
          }
          if (currentInterval > 0) {
            const timer = setInterval(() => {
              const exists = getNodes().some(n => n.id === node.id)
              if (exists) {
                if (editingNodeId.value !== node.id) {
                  void fetchQueryResult(node)
                }
              } else {
                clearInterval(timer)
                queryTimersMap.delete(node.id)
              }
            }, currentInterval * 1000)
            queryTimersMap.set(node.id, { timer, interval: currentInterval })
          } else {
            queryTimersMap.set(node.id, { timer: null, interval: 0 })
          }
        }
      }
    },
    { immediate: true },
  )

  const stopEditingWatcher = watch(editingNodeId, (newId) => {
    if (newId) {
      const node = getNodes().find(n => n.id === newId)
      if (node && node.type === "query") {
        const queryNode = node as CanvasQueryNode
        editingQuerySql.value = queryNode.sql || ""
        editingQueryInterval.value = queryNode.refreshInterval || 0
        editingQueryMaxResults.value = queryNode.maxResults || 50
      }
    }
  })

  function cleanup(): void {
    stopNodesWatcher()
    stopEditingWatcher()
    for (const info of queryTimersMap.values()) {
      if (info.timer) clearInterval(info.timer)
    }
    queryTimersMap.clear()
  }

  return {
    queryResultsMap,
    queryErrorsMap,
    queryLoadingMap,
    queryTimersMap,
    editingQuerySql,
    editingQueryInterval,
    editingQueryMaxResults,
    fetchQueryResult,
    startQueryEditing,
    cancelQueryEditing,
    saveQueryEditing,
    handleQueryResultDragStart,
    cleanup,
  }
}

export type QueryNodeRuntime = ReturnType<typeof createQueryNodeRuntime>

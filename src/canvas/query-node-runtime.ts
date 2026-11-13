import type { Ref } from "vue"
import {
  ref,
  watch,
} from "vue"
import type { CanvasNode, CanvasQueryNode } from "@/canvas/types"

export interface QueryNodeRuntimeOptions {
  getNodes: () => CanvasNode[]
  updateNodeField: (nodeId: string, field: string, value: unknown) => void
  updateNodeFields?: (nodeId: string, fields: Record<string, unknown>) => void
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
    updateNodeFields,
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
  const requestSeqMap = new Map<string, number>()
  let disposed = false

  const editingQuerySql = ref("")
  const editingQueryInterval = ref(0)
  const editingQueryMaxResults = ref(50)

  function isActiveQueryNode(nodeId: string): boolean {
    return getNodes().some(candidate => candidate.id === nodeId && candidate.type === "query")
  }

  async function fetchQueryResult(node: CanvasQueryNode): Promise<void> {
    if (disposed || !node.id || !node.sql) return
    const requestSeq = (requestSeqMap.get(node.id) ?? 0) + 1
    requestSeqMap.set(node.id, requestSeq)
    const isStale = () => disposed || requestSeqMap.get(node.id) !== requestSeq || !isActiveQueryNode(node.id)

    queryLoadingMap.value[node.id] = true
    queryErrorsMap.value[node.id] = ""
    try {
      if (!executeSql) {
        throw new Error("SQL executor is not configured")
      }
      const rawResults = await executeSql(node.sql)
      if (isStale()) return
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
      if (isStale()) return
      queryResultsMap.value[node.id] = processed
    } catch (err: unknown) {
      if (isStale()) return
      const errorMsg = err instanceof Error ? err.message : String(err)
      queryErrorsMap.value[node.id] = errorMsg
      queryResultsMap.value[node.id] = []
    } finally {
      if (!disposed && requestSeqMap.get(node.id) === requestSeq && isActiveQueryNode(node.id)) {
        queryLoadingMap.value[node.id] = false
      }
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

    const nextSql = editingQuerySql.value.trim()
    const nextRefreshInterval = Math.max(0, editingQueryInterval.value || 0)
    const nextMaxResults = Math.max(1, editingQueryMaxResults.value || 50)

    if (updateNodeFields) {
      updateNodeFields(node.id, {
        maxResults: nextMaxResults,
        refreshInterval: nextRefreshInterval,
        sql: nextSql,
      })
    } else {
      updateNodeField(node.id, "sql", nextSql)
      updateNodeField(node.id, "refreshInterval", nextRefreshInterval)
      updateNodeField(node.id, "maxResults", nextMaxResults)
    }

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
          requestSeqMap.delete(timerId)
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
            const nodeId = node.id
            const timer = setInterval(() => {
              const latestNode = getNodes().find(n => n.id === nodeId && n.type === "query") as CanvasQueryNode | undefined
              if (latestNode) {
                if (editingNodeId.value !== nodeId) {
                  void fetchQueryResult(latestNode)
                }
              } else {
                clearInterval(timer)
                queryTimersMap.delete(nodeId)
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
    disposed = true
    stopNodesWatcher()
    stopEditingWatcher()
    for (const info of queryTimersMap.values()) {
      if (info.timer) clearInterval(info.timer)
    }
    queryTimersMap.clear()
    requestSeqMap.clear()
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

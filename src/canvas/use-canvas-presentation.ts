import { computed, reactive, ref, watch } from "vue"
import type { CanvasDocument, CanvasEdge, CanvasNode } from "@/canvas/types"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"
import { findCanvasNodesInGroup } from "@/canvas/document-group"


export interface CanvasPresentationOptions {
  getDocument: () => CanvasDocument
  getSettings: () => CanvasPluginSettings
  clearSelection: () => void
  selectNode: (nodeId: string) => void
  focusNode: (nodeId: string) => void
  saveRecordedPath?: (path: string[]) => void
}

// 解析目标节点。如果是 group 节点，则自动寻找该 group 内最靠左侧的非 group 节点。如果是空组，返回 null。
function resolveTargetNodeId(document: CanvasDocument, targetId: string): string | null {
  const node = document.nodes.find(n => n.id === targetId)
  if (node && node.type === "group") {
    const childIds = findCanvasNodesInGroup(document, targetId)
    const childNodes = document.nodes.filter(n => childIds.includes(n.id) && n.type !== "group")
    if (childNodes.length > 0) {
      childNodes.sort((a, b) => a.x - b.x)
      return childNodes[0].id
    }
    return null
  }
  return targetId
}

function getSavedRecordedPath(document: CanvasDocument): string[] {
  const presentation = document.presentation as { recordedPath?: unknown } | undefined
  return Array.isArray(presentation?.recordedPath)
    ? presentation.recordedPath.filter((id): id is string => typeof id === "string")
    : []
}

export function useCanvasPresentation(options: CanvasPresentationOptions) {
  const { getDocument, getSettings, clearSelection, selectNode, focusNode, saveRecordedPath } = options

  const isActive = ref(false)
  const isPlaying = ref(false)
  const isRecording = ref(false)
  const currentNodeId = ref<string | null>(null)
  const pathHistory = ref<string[]>([])
  const visitedNodes = ref<Set<string>>(new Set())
  const recordedDraftPath = ref<string[]>([])
  const playbackMode = ref<CanvasPresentationPlaybackMode>("graph")
  const recordedPlaybackPath = ref<string[]>([])
  const recordedPlaybackIndex = ref(0)
  let autoplayTimer: number | null = null

  const validSavedRecordedPath = computed(() => {
    const nodeIds = new Set(getDocument().nodes.map(node => node.id))
    return getSavedRecordedPath(getDocument()).filter(id => nodeIds.has(id))
  })

  const hasRecordedPath = computed(() => validSavedRecordedPath.value.length > 0)

  const availableNextNodes = computed(() => {
    if (!currentNodeId.value) return []
    const edges = getDocument().edges
    const outEdges = edges.map(e => {
      const hasEndArrow = e.endArrow !== false
      const hasStartArrow = e.startArrow === true
      const isUndirected = !hasEndArrow && !hasStartArrow

      const canGoToToNode = hasEndArrow || isUndirected
      const canGoToFromNode = hasStartArrow || isUndirected

      if (e.fromNode === currentNodeId.value && canGoToToNode) {
        return { edge: e, targetNodeId: e.toNode }
      }
      if (e.toNode === currentNodeId.value && canGoToFromNode) {
        return { edge: e, targetNodeId: e.fromNode }
      }
      return null
    }).filter(item => item !== null) as Array<{ edge: CanvasEdge, targetNodeId: string }>

    // Sort edges by some stable metric, e.g., target node spatial Y, then X
    const targetNodes = outEdges.map(item => {
      const node = getDocument().nodes.find(n => n.id === item.targetNodeId)
      return { edge: item.edge, node }
    }).filter(item => item.node !== undefined)

    targetNodes.sort((a, b) => {
      if (!a.node || !b.node) return 0
      if (Math.abs(a.node.y - b.node.y) > 10) {
        return a.node.y - b.node.y
      }
      return a.node.x - b.node.x
    })

    // 解析 group 节点为最左侧非 group 节点，过滤 null 并剔除已访问的节点以防止死循环
    const resolvedTargetIds = targetNodes
      .map(item => resolveTargetNodeId(getDocument(), item.node!.id))
      .filter((id): id is string => id !== null && !visitedNodes.value.has(id))

    return Array.from(new Set(resolvedTargetIds))
  })

  const clearTimer = () => {
    if (autoplayTimer !== null) {
      clearTimeout(autoplayTimer)
      autoplayTimer = null
    }
  }

  const appendRecordedNode = (nodeId: string) => {
    if (!isRecording.value) return
    if (recordedDraftPath.value[recordedDraftPath.value.length - 1] === nodeId) return
    recordedDraftPath.value = [...recordedDraftPath.value, nodeId]
  }

  const moveToNode = (nodeId: string, options: { record?: boolean } = {}) => {
    const resolvedId = resolveTargetNodeId(getDocument(), nodeId)
    if (!resolvedId) return
    nodeId = resolvedId

    if (currentNodeId.value) {
      pathHistory.value.push(currentNodeId.value)
    }
    currentNodeId.value = nodeId
    visitedNodes.value.add(nodeId)
    if (options.record !== false) {
      appendRecordedNode(nodeId)
    }
    clearSelection()
    selectNode(nodeId)
    focusNode(nodeId)
  }

  const scheduleNext = () => {
    clearTimer()
    if (!isPlaying.value || !isActive.value) return

    const interval = getSettings().presentationAutoPlayInterval * 1000
    autoplayTimer = window.setTimeout(() => {
      if (!isPlaying.value || !isActive.value) return

      if (playbackMode.value === "recorded") {
        let nextIndex = recordedPlaybackIndex.value + 1
        let resolvedId: string | null = null
        while (nextIndex < recordedPlaybackPath.value.length) {
          resolvedId = resolveTargetNodeId(getDocument(), recordedPlaybackPath.value[nextIndex])
          if (resolvedId) {
            break
          }
          nextIndex++
        }

        if (nextIndex >= recordedPlaybackPath.value.length || !resolvedId) {
          isPlaying.value = false
          return
        }

        recordedPlaybackIndex.value = nextIndex
        moveToNode(resolvedId, { record: false })
        scheduleNext()
        return
      }

      const nextNodes = availableNextNodes.value
      if (nextNodes.length === 0) {
        // Stop playing if nowhere to go
        isPlaying.value = false
        return
      }

      if (isRecording.value && nextNodes.length > 1) {
        // Recording should pause at branches so user can choose the route.
        isPlaying.value = false
        return
      }

      // Normal autoplay keeps existing behavior: pick the first available branch.
      moveToNode(nextNodes[0])
      scheduleNext()
    }, interval)
  }

  const goToNode = (nodeId: string) => {
    playbackMode.value = "graph"
    moveToNode(nodeId)
    scheduleNext()
  }

  const startGraphPlayback = (nodeId: string) => {
    playbackMode.value = "graph"
    recordedPlaybackPath.value = []
    recordedPlaybackIndex.value = 0
    isActive.value = true
    isPlaying.value = true
    pathHistory.value = []

    const resolvedId = resolveTargetNodeId(getDocument(), nodeId)
    if (!resolvedId) {
      isPlaying.value = false
      isActive.value = false
      return
    }

    visitedNodes.value = new Set([resolvedId])
    currentNodeId.value = resolvedId
    clearSelection()
    selectNode(resolvedId)
    focusNode(resolvedId)
    scheduleNext()
  }

  const startRecordedPlayback = (path: string[]) => {
    let startNodeId = path[0]
    let resolvedId: string | null = null
    let startIndex = 0
    for (let i = 0; i < path.length; i++) {
      resolvedId = resolveTargetNodeId(getDocument(), path[i])
      if (resolvedId) {
        startIndex = i
        break
      }
    }

    if (!resolvedId) {
      isPlaying.value = false
      isActive.value = false
      return
    }

    playbackMode.value = "recorded"
    recordedPlaybackPath.value = [...path]
    recordedPlaybackIndex.value = startIndex
    isActive.value = true
    isPlaying.value = true
    pathHistory.value = []
    visitedNodes.value = new Set([resolvedId])
    currentNodeId.value = resolvedId
    clearSelection()
    selectNode(resolvedId)
    focusNode(resolvedId)
    scheduleNext()
  }

  const start = (nodeId: string) => {
    const path = validSavedRecordedPath.value
    if (!isRecording.value && path.length > 0) {
      startRecordedPlayback(path)
      return
    }

    startGraphPlayback(nodeId)
  }

  const stop = () => {
    isActive.value = false
    isPlaying.value = false
    isRecording.value = false
    playbackMode.value = "graph"
    currentNodeId.value = null
    pathHistory.value = []
    recordedDraftPath.value = []
    recordedPlaybackPath.value = []
    recordedPlaybackIndex.value = 0
    visitedNodes.value.clear()
    clearTimer()
  }

  const next = () => {
    if (playbackMode.value === "recorded") {
      let nextIndex = recordedPlaybackIndex.value + 1
      let resolvedId: string | null = null
      while (nextIndex < recordedPlaybackPath.value.length) {
        resolvedId = resolveTargetNodeId(getDocument(), recordedPlaybackPath.value[nextIndex])
        if (resolvedId) {
          break
        }
        nextIndex++
      }

      if (nextIndex < recordedPlaybackPath.value.length && resolvedId) {
        recordedPlaybackIndex.value = nextIndex
        moveToNode(resolvedId, { record: false })
      } else {
        isPlaying.value = false
        clearTimer()
      }
      return
    }

    if (availableNextNodes.value.length === 1) {
      goToNode(availableNextNodes.value[0])
    } else if (availableNextNodes.value.length > 1) {
      // Manual branch selection is required
      isPlaying.value = false
      clearTimer()
    } else {
      // End of presentation
      isPlaying.value = false
      clearTimer()
    }
  }

  const prev = () => {
    if (playbackMode.value === "recorded" && recordedPlaybackIndex.value > 0) {
      let prevIndex = recordedPlaybackIndex.value - 1
      let resolvedId: string | null = null
      while (prevIndex >= 0) {
        resolvedId = resolveTargetNodeId(getDocument(), recordedPlaybackPath.value[prevIndex])
        if (resolvedId) {
          break
        }
        prevIndex--
      }

      if (prevIndex >= 0 && resolvedId) {
        recordedPlaybackIndex.value = prevIndex
        if (currentNodeId.value) {
          visitedNodes.value.delete(currentNodeId.value)
        }
        currentNodeId.value = resolvedId
        pathHistory.value = recordedPlaybackPath.value.slice(0, prevIndex)
        clearSelection()
        selectNode(resolvedId)
        focusNode(resolvedId)
      }
      isPlaying.value = false
      clearTimer()
      return
    }

    if (pathHistory.value.length > 0) {
      const prevNodeId = pathHistory.value.pop()!
      // Remove current from visited
      if (currentNodeId.value) {
        visitedNodes.value.delete(currentNodeId.value)
      }
      currentNodeId.value = prevNodeId
      clearSelection()
      selectNode(prevNodeId)
      focusNode(prevNodeId)

      // Stop autoplay when going back, let user resume manually
      isPlaying.value = false
      clearTimer()
    }
  }

  const togglePlay = () => {
    isPlaying.value = !isPlaying.value
    if (isPlaying.value) {
      if (isRecording.value && availableNextNodes.value.length > 1) {
        moveToNode(availableNextNodes.value[0])
        scheduleNext()
        return
      }

      if (playbackMode.value === "graph" && !isRecording.value && validSavedRecordedPath.value.length > 0) {
        startRecordedPlayback(validSavedRecordedPath.value)
        return
      }

      if (playbackMode.value === "recorded") {
        if (recordedPlaybackIndex.value >= recordedPlaybackPath.value.length - 1) {
          startRecordedPlayback(recordedPlaybackPath.value)
        } else {
          scheduleNext()
        }
        return
      }

      // If we resumed play and have branches, we need to pick one or we schedule next
      if (availableNextNodes.value.length === 0) {
        isPlaying.value = false // Can't play
      } else {
        scheduleNext()
      }
    } else {
      clearTimer()
    }
  }

  const startRecording = () => {
    isRecording.value = true
    playbackMode.value = "graph"
    recordedPlaybackPath.value = []
    recordedPlaybackIndex.value = 0

    const savedPath = validSavedRecordedPath.value
    if (savedPath.length > 0) {
      if (currentNodeId.value) {
        const currentPath = [...pathHistory.value, currentNodeId.value]
        recordedDraftPath.value = [...currentPath]
        visitedNodes.value = new Set(currentPath)
        pathHistory.value = currentPath.slice(0, currentPath.length - 1)
      } else {
        recordedDraftPath.value = [...savedPath]
        const lastNodeId = savedPath[savedPath.length - 1]
        const resolvedId = resolveTargetNodeId(getDocument(), lastNodeId) || lastNodeId
        currentNodeId.value = resolvedId
        visitedNodes.value = new Set([...savedPath.slice(0, savedPath.length - 1), resolvedId])
        pathHistory.value = savedPath.slice(0, savedPath.length - 1)
        clearSelection()
        selectNode(resolvedId)
        focusNode(resolvedId)
      }
    } else {
      recordedDraftPath.value = currentNodeId.value ? [currentNodeId.value] : []
      visitedNodes.value = new Set(currentNodeId.value ? [currentNodeId.value] : [])
      pathHistory.value = []
    }
  }

  const finishRecording = () => {
    isRecording.value = false
    isPlaying.value = false
    clearTimer()
    saveRecordedPath?.(recordedDraftPath.value)
  }

  const toggleRecording = () => {
    if (isRecording.value) {
      finishRecording()
    } else {
      startRecording()
    }
  }

  const clearRecordedPath = () => {
    saveRecordedPath?.([])
    recordedDraftPath.value = []
  }

  const selectBranch = (nodeId: string) => {
    if (!availableNextNodes.value.includes(nodeId)) return
    goToNode(nodeId)
    // Resume play if it was playing, else keep manual
    if (isPlaying.value) {
      scheduleNext()
    }
  }

  watch(isActive, (active) => {
    if (!active) {
      clearTimer()
    }
  })

  return reactive({
    isActive,
    isPlaying,
    isRecording,
    currentNodeId,
    pathHistory,
    availableNextNodes,
    recordedDraftPath,
    hasRecordedPath,
    start,
    stop,
    next,
    prev,
    goTo: (nodeId: string) => {
      clearTimer()
      playbackMode.value = "graph"

      const resolvedId = resolveTargetNodeId(getDocument(), nodeId)
      if (!resolvedId) return
      nodeId = resolvedId

      const historyIndex = pathHistory.value.indexOf(nodeId)
      if (historyIndex !== -1) {
        pathHistory.value = pathHistory.value.slice(0, historyIndex)
        visitedNodes.value = new Set([...pathHistory.value, nodeId])
      } else if (currentNodeId.value) {
        pathHistory.value.push(currentNodeId.value)
        visitedNodes.value.add(nodeId)
      } else {
        visitedNodes.value.add(nodeId)
      }

      currentNodeId.value = nodeId
      appendRecordedNode(nodeId)
      clearSelection()
      selectNode(nodeId)
      focusNode(nodeId)

      if (isPlaying.value) {
        scheduleNext()
      }
    },
    togglePlay,
    toggleRecording,
    clearRecordedPath,
    selectBranch,
  })
}

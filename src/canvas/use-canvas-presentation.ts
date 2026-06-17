import { computed, reactive, ref, watch } from "vue"
import type { CanvasDocument, CanvasEdge } from "@/canvas/types"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"

export interface CanvasPresentationOptions {
  getDocument: () => CanvasDocument
  getSettings: () => CanvasPluginSettings
  clearSelection: () => void
  selectNode: (nodeId: string) => void
  focusNode: (nodeId: string) => void
  saveRecordedPath?: (path: string[]) => void
}

type CanvasPresentationPlaybackMode = "graph" | "recorded"

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

    // Filter out already visited nodes to prevent loops
    return targetNodes
      .map(item => item.node!.id)
      .filter(id => !visitedNodes.value.has(id))
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
        const nextIndex = recordedPlaybackIndex.value + 1
        if (nextIndex >= recordedPlaybackPath.value.length) {
          isPlaying.value = false
          return
        }

        recordedPlaybackIndex.value = nextIndex
        moveToNode(recordedPlaybackPath.value[nextIndex], { record: false })
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
    visitedNodes.value = new Set([nodeId])
    currentNodeId.value = nodeId
    clearSelection()
    selectNode(nodeId)
    focusNode(nodeId)
    scheduleNext()
  }

  const startRecordedPlayback = (path: string[]) => {
    const startNodeId = path[0]
    playbackMode.value = "recorded"
    recordedPlaybackPath.value = [...path]
    recordedPlaybackIndex.value = 0
    isActive.value = true
    isPlaying.value = true
    pathHistory.value = []
    visitedNodes.value = new Set([startNodeId])
    currentNodeId.value = startNodeId
    clearSelection()
    selectNode(startNodeId)
    focusNode(startNodeId)
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
      const nextIndex = recordedPlaybackIndex.value + 1
      if (nextIndex < recordedPlaybackPath.value.length) {
        recordedPlaybackIndex.value = nextIndex
        moveToNode(recordedPlaybackPath.value[nextIndex], { record: false })
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
      recordedPlaybackIndex.value -= 1
      const prevNodeId = recordedPlaybackPath.value[recordedPlaybackIndex.value]
      if (currentNodeId.value) {
        visitedNodes.value.delete(currentNodeId.value)
      }
      currentNodeId.value = prevNodeId
      pathHistory.value = recordedPlaybackPath.value.slice(0, recordedPlaybackIndex.value)
      clearSelection()
      selectNode(prevNodeId)
      focusNode(prevNodeId)
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
      if (playbackMode.value === "recorded") {
        if (recordedPlaybackIndex.value >= recordedPlaybackPath.value.length - 1) {
          isPlaying.value = false
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
    recordedDraftPath.value = currentNodeId.value ? [currentNodeId.value] : []
  }

  const finishRecording = () => {
    isRecording.value = false
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

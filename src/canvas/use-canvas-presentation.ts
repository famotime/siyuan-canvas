import { computed, reactive, ref, watch } from "vue"
import type { Ref } from "vue"
import type { CanvasDocumentState } from "@/canvas/document"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"


export interface CanvasPresentationOptions {
  getDocument: () => CanvasDocumentState
  getSettings: () => CanvasPluginSettings
  clearSelection: () => void
  selectNode: (nodeId: string) => void
  focusNode: (nodeId: string) => void
}

export function useCanvasPresentation(options: CanvasPresentationOptions) {
  const { getDocument, getSettings, clearSelection, selectNode, focusNode } = options

  const isActive = ref(false)
  const isPlaying = ref(false)
  const currentNodeId = ref<string | null>(null)
  const pathHistory = ref<string[]>([])
  const visitedNodes = ref<Set<string>>(new Set())
  let autoplayTimer: number | null = null

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

  const scheduleNext = () => {
    clearTimer()
    if (!isPlaying.value || !isActive.value) return

    const interval = getSettings().presentationAutoPlayInterval * 1000
    autoplayTimer = window.setTimeout(() => {
      if (!isPlaying.value || !isActive.value) return
      
      const nextNodes = availableNextNodes.value
      if (nextNodes.length === 0) {
        // Stop playing if nowhere to go
        isPlaying.value = false
        return
      }
      
      // Auto-play picks the first available branch
      goToNode(nextNodes[0])
    }, interval)
  }

  const goToNode = (nodeId: string) => {
    if (currentNodeId.value) {
      pathHistory.value.push(currentNodeId.value)
    }
    currentNodeId.value = nodeId
    visitedNodes.value.add(nodeId)
    clearSelection()
    selectNode(nodeId)
    focusNode(nodeId)
    scheduleNext()
  }

  const start = (nodeId: string) => {
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

  const stop = () => {
    isActive.value = false
    isPlaying.value = false
    currentNodeId.value = null
    pathHistory.value = []
    visitedNodes.value.clear()
    clearTimer()
  }

  const next = () => {
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
    currentNodeId,
    pathHistory,
    availableNextNodes,
    start,
    stop,
    next,
    prev,
    goTo: (nodeId: string) => {
      clearTimer()
      
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
      clearSelection()
      selectNode(nodeId)
      focusNode(nodeId)
      
      if (isPlaying.value) {
        scheduleNext()
      }
    },
    togglePlay,
    selectBranch
  })
}

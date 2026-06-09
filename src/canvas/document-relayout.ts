import type {
  CanvasDocument,
  CanvasEdge,
  CanvasGeometryPatch,
  CanvasGroupNode,
  CanvasNode,
} from "@/canvas/types"

import { findCanvasNodesInGroup } from "@/canvas/document-group"
import { doNodesOverlap } from "@/canvas/node-overlap"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayoutOptions {
  /** 起始节点 ID */
  selectedNodeId: string
  /** 主方向：horizontal（从左到右）或 vertical（从上到下） */
  primaryDirection?: "horizontal" | "vertical"
  /** 层间间距（默认 80） */
  layerGap?: number
  /** 同层节点间距（默认 32） */
  nodeGap?: number
  /** 外框 padding（默认 24） */
  groupPadding?: number
  /** 最大重叠修正迭代次数（默认 50） */
  maxOverlapFixAttempts?: number
}

export interface RelayoutResult {
  /** 更新后的文档 */
  document: CanvasDocument
  /** 是否成功（false = 没有找到连接节点） */
  success: boolean
  /** 消息（如"无连接节点"） */
  message?: string
}

interface Subgraph {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 从 selectedNodeId 出发，沿连线关系找到所有可达节点，
 * 重新布局使节点间距均匀、不重叠。
 * 仅调整位置，不修改连线关系和节点内容。
 */
export function relayoutConnectedNodes(
  document: CanvasDocument,
  options: RelayoutOptions,
): RelayoutResult {
  const {
    selectedNodeId,
    layerGap = 80,
    nodeGap = 32,
    groupPadding = 24,
    maxOverlapFixAttempts = 50,
  } = options

  // 如果选中节点在某个 group 内，用该 group 作为子图入口
  const entryNodeId = findParentGroup(document, selectedNodeId) ?? selectedNodeId

  // 1. 提取连通子图（group 内节点折叠为 group 超级节点）
  const subgraph = extractConnectedSubgraph(document, entryNodeId)
  if (subgraph.nodes.length <= 1) {
    return { document, success: false, message: "无连接节点" }
  }

  // 2. 推断主方向
  const direction = options.primaryDirection ?? inferDirection(entryNodeId, subgraph.edges)

  // 3. 分层
  const layers = assignLayers(subgraph, entryNodeId)

  // 4. 层内排序（减少交叉）
  const orderedLayers = reduceCrossings(layers, subgraph.edges)

  // 5. 计算坐标
  const positions = computePositions(orderedLayers, direction, layerGap, nodeGap)

  // 6. 应用位置到文档（group 内节点随 group 整体移动）
  let updatedDoc = applyPositions(document, positions, groupPadding)

  // 7. 重叠修正（将整个子图作为整体平移，避免与其他连通分量重叠）
  updatedDoc = resolveOverlaps(updatedDoc, subgraph.nodes, direction, maxOverlapFixAttempts)

  return { document: updatedDoc, success: true }
}

// ─── Connected Subgraph Extraction ────────────────────────────────────────────

/**
 * 如果 nodeId 在某个 group 内，返回该 group 的 ID。
 */
function findParentGroup(document: CanvasDocument, nodeId: string): string | undefined {
  const groups = document.nodes.filter(
    (n): n is CanvasGroupNode => n.type === "group",
  )
  for (const group of groups) {
    const children = findCanvasNodesInGroup(document, group.id)
    if (children.includes(nodeId)) {
      return group.id
    }
  }
  return undefined
}

/**
 * 提取连通子图。Group 内的节点折叠为 group 超级节点：
 * - group 的 children 不单独出现在子图中
 * - 指向 group 内任意节点的边重定向到 group
 * - group 以其包围盒（含 padding）作为节点尺寸参与布局
 */
function extractConnectedSubgraph(document: CanvasDocument, selectedNodeId: string): Subgraph {
  const nodeMap = new Map(document.nodes.map(n => [n.id, n]))

  // 建立 group children 映射：childId → groupId
  const childToGroup = new Map<string, string>()
  const groupNodes = document.nodes.filter(
    (n): n is CanvasGroupNode => n.type === "group",
  )
  for (const group of groupNodes) {
    const children = findCanvasNodesInGroup(document, group.id)
    for (const childId of children) {
      childToGroup.set(childId, group.id)
    }
  }

  // 将 nodeId 映射到其 group（如果有）
  function resolveEndpoint(nodeId: string): string {
    return childToGroup.get(nodeId) ?? nodeId
  }

  // 建立邻接表（group 内节点的边重定向到 group）
  const adjacency = new Map<string, string[]>()
  for (const edge of document.edges) {
    const from = resolveEndpoint(edge.fromNode)
    const to = resolveEndpoint(edge.toNode)
    if (from === to) continue // group 内部边，忽略
    if (!adjacency.has(from)) adjacency.set(from, [])
    if (!adjacency.has(to)) adjacency.set(to, [])
    adjacency.get(from)!.push(to)
    adjacency.get(to)!.push(from)
  }

  // BFS
  const visited = new Set<string>()
  const queue = [selectedNodeId]
  visited.add(selectedNodeId)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  // 构建节点列表
  const groupPadding = 24
  const nodes: CanvasNode[] = []

  for (const id of visited) {
    const node = nodeMap.get(id)
    if (!node) continue

    if (node.type === "group") {
      // 用 group 的 children 包围盒 + padding 作为超级节点尺寸
      const children = findCanvasNodesInGroup(document, id)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const childId of children) {
        const child = nodeMap.get(childId)
        if (!child) continue
        minX = Math.min(minX, child.x)
        minY = Math.min(minY, child.y)
        maxX = Math.max(maxX, child.x + child.width)
        maxY = Math.max(maxY, child.y + child.height)
      }

      if (minX !== Infinity) {
        nodes.push({
          ...node,
          x: minX - groupPadding,
          y: minY - groupPadding,
          width: (maxX - minX) + groupPadding * 2,
          height: (maxY - minY) + groupPadding * 2,
        })
      }
      else {
        nodes.push(node)
      }
    }
    else {
      nodes.push(node)
    }
  }

  // 构建边列表（重定向到 group）
  const nodeIds = new Set(visited)
  const seenEdges = new Set<string>()
  const edges: CanvasEdge[] = []

  for (const edge of document.edges) {
    const from = resolveEndpoint(edge.fromNode)
    const to = resolveEndpoint(edge.toNode)
    if (from === to) continue
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue
    const key = `${from}->${to}`
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    edges.push({ ...edge, fromNode: from, toNode: to })
  }

  return { nodes, edges }
}

function buildAdjacencyList(edges: CanvasEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adj.has(edge.fromNode)) adj.set(edge.fromNode, [])
    if (!adj.has(edge.toNode)) adj.set(edge.toNode, [])
    adj.get(edge.fromNode)!.push(edge.toNode)
    adj.get(edge.toNode)!.push(edge.fromNode)
  }
  return adj
}

// ─── Direction Inference ──────────────────────────────────────────────────────

function inferDirection(
  selectedNodeId: string,
  edges: CanvasEdge[],
): "horizontal" | "vertical" {
  // Count outgoing edge directions from the selected node
  let horizontal = 0
  let vertical = 0

  for (const edge of edges) {
    if (edge.fromNode === selectedNodeId) {
      if (edge.fromSide === "right" || edge.fromSide === "left") {
        horizontal++
      }
      else {
        vertical++
      }
    }
    if (edge.toNode === selectedNodeId) {
      if (edge.toSide === "right" || edge.toSide === "left") {
        horizontal++
      }
      else {
        vertical++
      }
    }
  }

  if (horizontal > vertical) return "horizontal"
  if (vertical > horizontal) return "vertical"
  return "horizontal" // default
}

// ─── Layer Assignment (BFS-based) ────────────────────────────────────────────

function assignLayers(subgraph: Subgraph, selectedNodeId: string): CanvasNode[][] {
  // Build directed adjacency: fromNode → toNode
  const directedAdj = new Map<string, string[]>()
  for (const edge of subgraph.edges) {
    if (!directedAdj.has(edge.fromNode)) directedAdj.set(edge.fromNode, [])
    directedAdj.get(edge.fromNode)!.push(edge.toNode)
  }

  // BFS layer assignment
  const layerOf = new Map<string, number>()
  layerOf.set(selectedNodeId, 0)

  const queue: string[] = [selectedNodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLayer = layerOf.get(current)!
    const neighbors = directedAdj.get(current) ?? []

    for (const neighbor of neighbors) {
      if (!layerOf.has(neighbor)) {
        layerOf.set(neighbor, currentLayer + 1)
        queue.push(neighbor)
      }
    }
  }

  // Any nodes not reached by directed BFS get assigned layer 0
  // (they might only have reverse edges from the selected node)
  for (const node of subgraph.nodes) {
    if (!layerOf.has(node.id)) {
      layerOf.set(node.id, 0)
    }
  }

  // Group nodes into layers
  const maxLayer = Math.max(...layerOf.values())
  const layers: CanvasNode[][] = Array.from({ length: maxLayer + 1 }, () => [])

  for (const node of subgraph.nodes) {
    const layer = layerOf.get(node.id)!
    layers[layer].push(node)
  }

  return layers
}

// ─── Crossing Reduction (Barycenter Method) ───────────────────────────────────

function reduceCrossings(layers: CanvasNode[][], edges: CanvasEdge[]): CanvasNode[][] {
  if (layers.length <= 1) {
    return layers
  }

  // Build edge lookup: fromNode → [toNode, ...]
  const forwardEdges = new Map<string, string[]>()
  const backwardEdges = new Map<string, string[]>()
  for (const edge of edges) {
    if (!forwardEdges.has(edge.fromNode)) forwardEdges.set(edge.fromNode, [])
    forwardEdges.get(edge.fromNode)!.push(edge.toNode)
    if (!backwardEdges.has(edge.toNode)) backwardEdges.set(edge.toNode, [])
    backwardEdges.get(edge.toNode)!.push(edge.fromNode)
  }

  // Make a mutable copy
  const result = layers.map(layer => [...layer])

  // Forward sweep: fix layer i, reorder layer i+1
  for (let i = 0; i < result.length - 1; i++) {
    const fixedLayer = result[i]
    const movableLayer = result[i + 1]

    const fixedOrder = new Map(fixedLayer.map((n, idx) => [n.id, idx]))
    const barycenters = new Map<string, number>()

    for (const node of movableLayer) {
      const parents = backwardEdges.get(node.id) ?? []
      const positions = parents
        .map(pId => fixedOrder.get(pId))
        .filter((p): p is number => p !== undefined)

      if (positions.length > 0) {
        barycenters.set(node.id, positions.reduce((a, b) => a + b, 0) / positions.length)
      }
      else {
        // No parents in fixed layer — keep original position
        barycenters.set(node.id, movableLayer.indexOf(node))
      }
    }

    result[i + 1] = [...movableLayer].sort(
      (a, b) => (barycenters.get(a.id) ?? 0) - (barycenters.get(b.id) ?? 0),
    )
  }

  // Backward sweep: fix layer i, reorder layer i-1
  for (let i = result.length - 1; i > 0; i--) {
    const fixedLayer = result[i]
    const movableLayer = result[i - 1]

    const fixedOrder = new Map(fixedLayer.map((n, idx) => [n.id, idx]))
    const barycenters = new Map<string, number>()

    for (const node of movableLayer) {
      const children = forwardEdges.get(node.id) ?? []
      const positions = children
        .map(cId => fixedOrder.get(cId))
        .filter((p): p is number => p !== undefined)

      if (positions.length > 0) {
        barycenters.set(node.id, positions.reduce((a, b) => a + b, 0) / positions.length)
      }
      else {
        barycenters.set(node.id, movableLayer.indexOf(node))
      }
    }

    result[i - 1] = [...movableLayer].sort(
      (a, b) => (barycenters.get(a.id) ?? 0) - (barycenters.get(b.id) ?? 0),
    )
  }

  return result
}

// ─── Position Computation ─────────────────────────────────────────────────────

function computePositions(
  layers: CanvasNode[][],
  direction: "horizontal" | "vertical",
  layerGap: number,
  nodeGap: number,
): Map<string, { x: number, y: number }> {
  const positions = new Map<string, { x: number, y: number }>()

  if (direction === "horizontal") {
    // Layers stacked left-to-right, nodes within each layer stacked top-to-bottom
    let currentX = 0

    for (const layer of layers) {
      // Calculate total height of this layer
      const totalHeight = layer.reduce((sum, n) => sum + n.height, 0)
        + nodeGap * (layer.length - 1)

      // Center the layer vertically around y=0
      let currentY = -totalHeight / 2
      let maxLayerWidth = 0

      for (const node of layer) {
        positions.set(node.id, { x: currentX, y: currentY })
        currentY += node.height + nodeGap
        maxLayerWidth = Math.max(maxLayerWidth, node.width)
      }

      currentX += maxLayerWidth + layerGap
    }
  }
  else {
    // Layers stacked top-to-bottom, nodes within each layer stacked left-to-right
    let currentY = 0

    for (const layer of layers) {
      // Calculate total width of this layer
      const totalWidth = layer.reduce((sum, n) => sum + n.width, 0)
        + nodeGap * (layer.length - 1)

      // Center the layer horizontally around x=0
      let currentX = -totalWidth / 2
      let maxLayerHeight = 0

      for (const node of layer) {
        positions.set(node.id, { x: currentX, y: currentY })
        currentX += node.width + nodeGap
        maxLayerHeight = Math.max(maxLayerHeight, node.height)
      }

      currentY += maxLayerHeight + layerGap
    }
  }

  return positions
}

// ─── Apply Positions ──────────────────────────────────────────────────────────

/**
 * 应用新位置到文档。对于 group 节点，同时移动其所有内部节点，
 * 保持相对位置不变。
 */
function applyPositions(
  document: CanvasDocument,
  positions: Map<string, { x: number, y: number }>,
  groupPadding: number,
): CanvasDocument {
  if (positions.size === 0) {
    return document
  }

  // 建立 group children 映射
  const groupChildrenMap = new Map<string, string[]>()
  for (const node of document.nodes) {
    if (node.type === "group") {
      groupChildrenMap.set(node.id, findCanvasNodesInGroup(document, node.id))
    }
  }

  // 收集属于某个 group 的子节点 ID（这些节点随 group 移动，不单独处理）
  const groupedChildIds = new Set<string>()
  for (const childIds of groupChildrenMap.values()) {
    for (const id of childIds) {
      groupedChildIds.add(id)
    }
  }

  // 记录每个 group 的位移量
  const groupDeltas = new Map<string, { dx: number, dy: number }>()
  for (const node of document.nodes) {
    if (node.type === "group") {
      const pos = positions.get(node.id)
      if (pos) {
        groupDeltas.set(node.id, { dx: pos.x - node.x, dy: pos.y - node.y })
      }
    }
  }

  return {
    ...document,
    nodes: document.nodes.map((node) => {
      // group 子节点：随 group 整体移动
      const parentId = [...groupChildrenMap.entries()]
        .find(([, children]) => children.includes(node.id))?.[0]
      if (parentId && parentId !== node.id) {
        const delta = groupDeltas.get(parentId)
        if (delta) {
          return { ...node, x: node.x + delta.dx, y: node.y + delta.dy }
        }
        return node
      }

      // 普通节点或 group 节点本身
      const pos = positions.get(node.id)
      if (!pos) return node
      return { ...node, x: pos.x, y: pos.y }
    }),
  }
}

// ─── Overlap Resolution ───────────────────────────────────────────────────────

interface BBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 将整个子图作为一个整体平移，避免与其他连通子图重叠。
 * 策略：找到所有其他连通分量的包围盒作为障碍物，整体平移当前子图直到无重叠。
 */
function resolveOverlaps(
  document: CanvasDocument,
  subgraphNodes: CanvasNode[],
  direction: "horizontal" | "vertical",
  maxAttempts: number,
): CanvasDocument {
  const subgraphIds = new Set(subgraphNodes.map(n => n.id))
  const obstaclePadding = 20

  // 找到所有其他连通分量，计算其包围盒作为障碍物
  const obstacleBBoxes = findObstacleBBoxes(document, subgraphIds, obstaclePadding)

  if (obstacleBBoxes.length === 0) {
    return document
  }

  // 计算当前子图的包围盒
  const movableNodes = document.nodes.filter(n => subgraphIds.has(n.id))
  const subgraphBBox = computeBBox(movableNodes)
  if (!subgraphBBox) return document

  // 整体平移直到不与任何障碍物重叠
  let offsetX = 0
  let offsetY = 0
  const stepX = direction === "horizontal" ? 40 : 0
  const stepY = direction === "vertical" ? 40 : 0
  // 垂直于主方向的微调步进
  const altStepX = direction === "vertical" ? 40 : 0
  const altStepY = direction === "horizontal" ? 40 : 0
  let altSign = 1
  let altCount = 0
  const altThreshold = 3 // 每 altThreshold 次主方向步进后切换一次垂直方向

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shiftedBBox: BBox = {
      x: subgraphBBox.x + offsetX,
      y: subgraphBBox.y + offsetY,
      width: subgraphBBox.width,
      height: subgraphBBox.height,
    }

    const hasOverlap = obstacleBBoxes.some(obstacle => bboxOverlap(shiftedBBox, obstacle))
    if (!hasOverlap) break

    // 主方向步进
    offsetX += stepX
    offsetY += stepY

    // 每隔几次，也尝试垂直于主方向的偏移（之字形搜索）
    altCount++
    if (altCount >= altThreshold) {
      altCount = 0
      offsetX += altStepX * altSign
      offsetY += altStepY * altSign
      altSign = -altSign // 交替正负
    }
  }

  if (offsetX === 0 && offsetY === 0) {
    return document
  }

  // 收集 group 内部节点 ID（随 group 一起移动）
  const groupInternalIds = new Set<string>()
  for (const node of document.nodes) {
    if (node.type === "group" && subgraphIds.has(node.id)) {
      for (const childId of findCanvasNodesInGroup(document, node.id)) {
        groupInternalIds.add(childId)
      }
    }
  }

  return {
    ...document,
    nodes: document.nodes.map((node) => {
      if (!subgraphIds.has(node.id) && !groupInternalIds.has(node.id)) return node
      return { ...node, x: node.x + offsetX, y: node.y + offsetY }
    }),
  }
}

/**
 * 找到文档中所有不属于当前子图的连通分量和孤立节点，
 * 返回它们的包围盒列表（作为障碍物）。
 */
function findObstacleBBoxes(
  document: CanvasDocument,
  currentSubgraphIds: Set<string>,
  padding: number,
): BBox[] {
  const adjacency = buildAdjacencyList(document.edges)
  const allNodeIds = new Set(document.nodes.map(n => n.id))
  const visited = new Set<string>()
  const bboxes: BBox[] = []

  // BFS 找所有连通分量
  for (const nodeId of allNodeIds) {
    if (visited.has(nodeId) || currentSubgraphIds.has(nodeId)) continue

    // BFS 遍历该连通分量
    const component: string[] = []
    const queue = [nodeId]
    visited.add(nodeId)

    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor) && !currentSubgraphIds.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    // 计算该分量的包围盒（排除 group 节点）
    const componentNodes = document.nodes.filter(
      n => component.includes(n.id) && n.type !== "group",
    )
    if (componentNodes.length === 0) continue

    const bbox = computeBBox(componentNodes)
    if (bbox) {
      bboxes.push({
        x: bbox.x - padding,
        y: bbox.y - padding,
        width: bbox.width + padding * 2,
        height: bbox.height + padding * 2,
      })
    }
  }

  return bboxes
}

function computeBBox(nodes: CanvasNode[]): BBox | null {
  if (nodes.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function bboxOverlap(a: BBox, b: BBox): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
}

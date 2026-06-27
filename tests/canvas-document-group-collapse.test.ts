import { describe, expect, it } from "vitest"
import {
  collapseCanvasGroup,
  expandCanvasGroup,
  createEmptyCanvasDocument,
} from "@/canvas/document"
import type { CanvasDocument, CanvasGroupNode } from "@/canvas/types"

describe("canvas group collapse operations", () => {
  it("collapses and expands empty group successfully", () => {
    let doc: CanvasDocument = createEmptyCanvasDocument()
    const group: CanvasGroupNode = {
      id: "group-1",
      type: "group",
      label: "My Group",
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    }
    doc.nodes.push(group)

    // 折叠
    doc = collapseCanvasGroup(doc, "group-1", 46)
    const collapsedGroup = doc.nodes.find((n) => n.id === "group-1") as CanvasGroupNode
    expect(collapsedGroup).toBeDefined()
    expect(collapsedGroup.collapsed).toBe(true)
    expect(collapsedGroup.originalWidth).toBe(400)
    expect(collapsedGroup.originalHeight).toBe(300)
    expect(collapsedGroup.height).toBe(46)
    expect(collapsedGroup.collapsedNodes).toEqual([])
    expect(collapsedGroup.collapsedEdges).toEqual([])

    // 展开
    doc = expandCanvasGroup(doc, "group-1")
    const expandedGroup = doc.nodes.find((n) => n.id === "group-1") as CanvasGroupNode
    expect(expandedGroup).toBeDefined()
    expect(expandedGroup.collapsed).toBeUndefined()
    expect(expandedGroup.originalWidth).toBeUndefined()
    expect(expandedGroup.originalHeight).toBeUndefined()
    expect(expandedGroup.width).toBe(400)
    expect(expandedGroup.height).toBe(300)
  })

  it("handles child nodes and internal/external edges during collapse and expand", () => {
    let doc: CanvasDocument = createEmptyCanvasDocument()

    // 1. 放入群组及子节点
    // 子节点 node-a, node-b 处于 group-1 的几何边界内 [100, 100, 400, 300] 即 x 范围 [100, 500], y 范围 [100, 400]
    const group: CanvasGroupNode = {
      id: "group-1",
      type: "group",
      label: "My Group",
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    }
    const nodeA = {
      id: "node-a",
      type: "text" as const,
      text: "A",
      x: 150,
      y: 150,
      width: 100,
      height: 50,
    }
    const nodeB = {
      id: "node-b",
      type: "text" as const,
      text: "B",
      x: 250,
      y: 250,
      width: 100,
      height: 50,
    }
    // 外部节点，在群组外部
    const nodeOut = {
      id: "node-out",
      type: "text" as const,
      text: "Outside",
      x: 600,
      y: 150,
      width: 100,
      height: 50,
    }

    doc.nodes.push(group, nodeA, nodeB, nodeOut)

    // 2. 放入连线
    // 内部连线
    const edgeInternal = {
      id: "edge-internal",
      fromNode: "node-a",
      fromSide: "bottom" as const,
      toNode: "node-b",
      toSide: "top" as const,
    }
    // 外部连线
    const edgeExternal = {
      id: "edge-external",
      fromNode: "node-a",
      fromSide: "right" as const,
      toNode: "node-out",
      toSide: "left" as const,
    }

    doc.edges.push(edgeInternal, edgeExternal)

    // 3. 执行折叠
    doc = collapseCanvasGroup(doc, "group-1", 46)

    // 验证子节点已被隐藏（移出 nodes）
    expect(doc.nodes.map((n) => n.id)).toEqual(["group-1", "node-out"])

    const collapsedGroup = doc.nodes.find((n) => n.id === "group-1") as CanvasGroupNode
    expect(collapsedGroup.collapsedNodes?.map((n) => n.id)).toContain("node-a")
    expect(collapsedGroup.collapsedNodes?.map((n) => n.id)).toContain("node-b")

    // 验证内部连线已被隐藏（移出 edges，并暂存）
    expect(doc.edges.map((e) => e.id)).toEqual(["edge-external"])
    expect(collapsedGroup.collapsedEdges?.map((e) => e.id)).toContain("edge-internal")

    // 验证外部连接边被改写（重定向到 group-1 节点本身）
    const outerEdge = doc.edges.find((e) => e.id === "edge-external")
    expect(outerEdge).toBeDefined()
    expect(outerEdge?.fromNode).toBe("group-1")
    expect(outerEdge?.collapsedOriginalFromNode).toBe("node-a")

    // 4. 执行展开
    doc = expandCanvasGroup(doc, "group-1")

    // 验证子节点和外部节点已重置到 nodes
    expect(doc.nodes.map((n) => n.id)).toContain("node-a")
    expect(doc.nodes.map((n) => n.id)).toContain("node-b")
    expect(doc.nodes.map((n) => n.id)).toContain("node-out")
    expect(doc.nodes.map((n) => n.id)).toContain("group-1")

    // 验证连线已全部恢复
    expect(doc.edges.map((e) => e.id)).toContain("edge-internal")
    expect(doc.edges.map((e) => e.id)).toContain("edge-external")

    const restoredOuterEdge = doc.edges.find((e) => e.id === "edge-external")
    expect(restoredOuterEdge?.fromNode).toBe("node-a")
    expect(restoredOuterEdge?.collapsedOriginalFromNode).toBeUndefined()
  })
})

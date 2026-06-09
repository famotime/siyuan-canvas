import { describe, expect, it } from 'vitest'
import { relayoutConnectedNodes } from '@/canvas/document-relayout'
import type { CanvasDocument, CanvasEdge, CanvasGroupNode, CanvasTextNode } from '@/canvas/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeText(id: string, x: number, y: number, w = 320, h = 180): CanvasTextNode {
  return { id, type: "text", text: id, x, y, width: w, height: h }
}

function makeEdge(id: string, from: string, fromSide: CanvasEdge["fromSide"], to: string, toSide: CanvasEdge["toSide"]): CanvasEdge {
  return { id, fromNode: from, fromSide, toNode: to, toSide, endArrow: true }
}

function makeGroup(id: string, x: number, y: number, w: number, h: number): CanvasGroupNode {
  return { id, type: "group", x, y, width: w, height: h, label: "G" }
}

function findNode(doc: CanvasDocument, id: string) {
  return doc.nodes.find(n => n.id === id)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("relayoutConnectedNodes", () => {
  it("returns failure for a single isolated node", () => {
    const doc: CanvasDocument = {
      nodes: [makeText("a", 0, 0)],
      edges: [],
    }
    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(false)
    expect(result.document).toBe(doc)
  })

  it("returns failure for a node with no edges in a multi-node doc", () => {
    const doc: CanvasDocument = {
      nodes: [makeText("a", 0, 0), makeText("b", 500, 500)],
      edges: [],
    }
    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(false)
  })

  it("layouts a linear chain A→B→C horizontally", () => {
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 10, 10),
        makeText("c", 20, 20),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "b", "right", "c", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, {
      selectedNodeId: "a",
      primaryDirection: "horizontal",
      layerGap: 80,
      nodeGap: 32,
    })

    expect(result.success).toBe(true)

    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!
    const c = findNode(result.document, "c")!

    // A is in layer 0, B in layer 1, C in layer 2
    // Horizontal layout: x increases per layer
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)

    // Layer gap between layers
    expect(b.x - (a.x + a.width)).toBe(80)
    expect(c.x - (b.x + b.width)).toBe(80)
  })

  it("layouts a linear chain A→B→C vertically", () => {
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 10, 10),
        makeText("c", 20, 20),
      ],
      edges: [
        makeEdge("e1", "a", "bottom", "b", "top"),
        makeEdge("e2", "b", "bottom", "c", "top"),
      ],
    }

    const result = relayoutConnectedNodes(doc, {
      selectedNodeId: "a",
      primaryDirection: "vertical",
      layerGap: 80,
      nodeGap: 32,
    })

    expect(result.success).toBe(true)

    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!
    const c = findNode(result.document, "c")!

    expect(b.y).toBeGreaterThan(a.y)
    expect(c.y).toBeGreaterThan(b.y)
    expect(b.y - (a.y + a.height)).toBe(80)
  })

  it("layouts a tree structure with branching", () => {
    // A → B, A → C, B → D
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 0, 0),
        makeText("c", 0, 0),
        makeText("d", 0, 0),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "a", "right", "c", "left"),
        makeEdge("e3", "b", "right", "d", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, {
      selectedNodeId: "a",
      primaryDirection: "horizontal",
      layerGap: 80,
      nodeGap: 32,
    })

    expect(result.success).toBe(true)

    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!
    const c = findNode(result.document, "c")!
    const d = findNode(result.document, "d")!

    // Layer 0: A
    // Layer 1: B, C (both directly from A)
    // Layer 2: D (from B)
    expect(a.x).toBeLessThan(b.x)
    expect(a.x).toBeLessThan(c.x)
    expect(b.x).toBeLessThan(d.x)
    // B and C are in the same layer — same x
    expect(b.x).toBe(c.x)
  })

  it("handles a graph with a cycle (A→B→C→A)", () => {
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 100, 0),
        makeText("c", 200, 0),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "b", "right", "c", "left"),
        makeEdge("e3", "c", "right", "a", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    // Should not infinite loop — all 3 nodes are laid out
    const positions = result.document.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }))
    expect(positions.length).toBe(3)
  })

  it("handles bidirectional edges (A↔B)", () => {
    const doc: CanvasDocument = {
      nodes: [makeText("a", 0, 0), makeText("b", 500, 500)],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "b", "left", "a", "right"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!

    // A and B should be in adjacent layers
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(0)
  })

  it("does not move nodes outside the connected subgraph", () => {
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 10, 10),
        makeText("isolated", 9999, 9999),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    const isolated = findNode(result.document, "isolated")!
    expect(isolated.x).toBe(9999)
    expect(isolated.y).toBe(9999)
  })

  it("preserves node content and dimensions", () => {
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0, 400, 200),
        makeText("b", 10, 10, 250, 150),
      ],
      edges: [makeEdge("e1", "a", "right", "b", "left")],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })

    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!

    expect(a.width).toBe(400)
    expect(a.height).toBe(200)
    expect(b.width).toBe(250)
    expect(b.height).toBe(150)
    expect(a.text).toBe("a")
    expect(b.text).toBe("b")
  })

  it("preserves edges unchanged", () => {
    const doc: CanvasDocument = {
      nodes: [makeText("a", 0, 0), makeText("b", 10, 10)],
      edges: [makeEdge("e1", "a", "right", "b", "left")],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })

    expect(result.document.edges).toEqual(doc.edges)
  })

  it("adjusts group to contain its initial child nodes after layout", () => {
    const group = makeGroup("g1", -10, -10, 360, 420)
    const doc: CanvasDocument = {
      nodes: [
        group,
        makeText("a", 0, 0),     // inside group
        makeText("b", 10, 200),   // inside group
        makeText("c", 500, 0),    // outside group, connected
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "b", "right", "c", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    // After layout, A and B moved. Group should expand to still contain both.
    const g = findNode(result.document, "g1")! as CanvasGroupNode
    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!

    // Group should fully contain both A and B after relayout
    expect(g.x).toBeLessThanOrEqual(a.x)
    expect(g.y).toBeLessThanOrEqual(a.y)
    expect(g.x + g.width).toBeGreaterThanOrEqual(a.x + a.width)
    expect(g.y + g.height).toBeGreaterThanOrEqual(a.y + a.height)
    expect(g.x).toBeLessThanOrEqual(b.x)
    expect(g.y).toBeLessThanOrEqual(b.y)
    expect(g.x + g.width).toBeGreaterThanOrEqual(b.x + b.width)
    expect(g.y + g.height).toBeGreaterThanOrEqual(b.y + b.height)
  })

  it("respects custom gap parameters", () => {
    const doc: CanvasDocument = {
      nodes: [makeText("a", 0, 0), makeText("b", 10, 10)],
      edges: [makeEdge("e1", "a", "right", "b", "left")],
    }

    const result = relayoutConnectedNodes(doc, {
      selectedNodeId: "a",
      layerGap: 200,
      nodeGap: 100,
    })

    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!

    expect(b.x - (a.x + a.width)).toBe(200)
  })

  it("starts from a node in the middle of a chain", () => {
    // A → B → C, select B
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 400, 0),
        makeText("c", 800, 0),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "b", "right", "c", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "b" })
    expect(result.success).toBe(true)

    // All 3 nodes should be in the result
    const ids = result.document.nodes.map(n => n.id)
    expect(ids).toContain("a")
    expect(ids).toContain("b")
    expect(ids).toContain("c")
  })

  it("does not overlap with another disconnected connected subgraph", () => {
    // Subgraph 1: A → B (will be relayouted)
    // Subgraph 2: X → Y (placed nearby, should be avoided)
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 10, 10),
        // Place X→Y close to origin so the relayouted A→B would overlap without avoidance
        makeText("x", 200, -50),
        makeText("y", 520, -50),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "x", "right", "y", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, {
      selectedNodeId: "a",
      primaryDirection: "horizontal",
      layerGap: 80,
      nodeGap: 32,
    })

    expect(result.success).toBe(true)

    const a = findNode(result.document, "a")!
    const b = findNode(result.document, "b")!
    const x = findNode(result.document, "x")!
    const y = findNode(result.document, "y")!

    // X, Y should not have moved
    expect(x.x).toBe(200)
    expect(y.x).toBe(520)

    // A-B bounding box should not overlap with X-Y bounding box
    const abMinX = Math.min(a.x, b.x)
    const abMaxX = Math.max(a.x + a.width, b.x + b.width)
    const abMinY = Math.min(a.y, b.y)
    const abMaxY = Math.max(a.y + a.height, b.y + b.height)

    const xyMinX = Math.min(x.x, y.x)
    const xyMaxX = Math.max(x.x + x.width, y.x + y.width)
    const xyMinY = Math.min(x.y, y.y)
    const xyMaxY = Math.max(x.y + x.height, y.y + y.height)

    const overlaps = abMinX < xyMaxX && abMaxX > xyMinX && abMinY < xyMaxY && abMaxY > xyMinY
    expect(overlaps).toBe(false)
  })

  it("handles two disconnected groups by only relayouting the selected one", () => {
    // Group 1: A → B
    // Group 2: X → Y (isolated)
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0),
        makeText("b", 400, 0),
        makeText("x", 2000, 2000),
        makeText("y", 2400, 2000),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "x", "right", "y", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    // X and Y should not have moved
    const x = findNode(result.document, "x")!
    const y = findNode(result.document, "y")!
    expect(x.x).toBe(2000)
    expect(x.y).toBe(2000)
    expect(y.x).toBe(2400)
    expect(y.y).toBe(2000)
  })

  it("handles nodes of different sizes", () => {
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 0, 0, 200, 100),
        makeText("b", 0, 0, 500, 300),
        makeText("c", 0, 0, 150, 80),
      ],
      edges: [
        makeEdge("e1", "a", "right", "b", "left"),
        makeEdge("e2", "b", "right", "c", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    // No nodes should overlap
    const nodes = result.document.nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const overlaps
          = a.x < b.x + b.width
            && a.x + a.width > b.x
            && a.y < b.y + b.height
            && a.y + a.height > b.y
        expect(overlaps).toBe(false)
      }
    }
  })

  it("preserves document extra fields (unknown JSON Canvas properties)", () => {
    const doc: CanvasDocument = {
      nodes: [makeText("a", 0, 0), makeText("b", 10, 10)],
      edges: [makeEdge("e1", "a", "right", "b", "left")],
      customField: "preserved",
    } as CanvasDocument & { customField: string }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect((result.document as any).customField).toBe("preserved")
  })

  it("preserves node extra fields", () => {
    const doc: CanvasDocument = {
      nodes: [
        { ...makeText("a", 0, 0), customProp: "hello" } as any,
        makeText("b", 10, 10),
      ],
      edges: [makeEdge("e1", "a", "right", "b", "left")],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    const a = findNode(result.document, "a")! as any
    expect(a.customProp).toBe("hello")
  })
})

describe("relayoutConnectedNodes — group constraints", () => {
  it("treats group as a super node and moves it with internal nodes", () => {
    // A is outside group G, A → C (inside G)
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 1000, 0),
        makeGroup("g", -10, -10, 660, 400),
        makeText("c", 0, 0),     // inside group
        makeText("d", 200, 150),  // inside group
      ],
      edges: [
        makeEdge("e1", "a", "right", "c", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    const g = findNode(result.document, "g")!
    const c = findNode(result.document, "c")!
    const d = findNode(result.document, "d")!

    // C and D should still be inside group boundaries
    expect(c.x).toBeGreaterThanOrEqual(g.x)
    expect(c.y).toBeGreaterThanOrEqual(g.y)
    expect(c.x + c.width).toBeLessThanOrEqual(g.x + g.width)
    expect(c.y + c.height).toBeLessThanOrEqual(g.y + g.height)

    expect(d.x).toBeGreaterThanOrEqual(g.x)
    expect(d.y).toBeGreaterThanOrEqual(g.y)
    expect(d.x + d.width).toBeLessThanOrEqual(g.x + g.width)
    expect(d.y + d.height).toBeLessThanOrEqual(g.y + g.height)
  })

  it("preserves relative positions of group internal nodes", () => {
    // A is outside group G, A → C (inside G)
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 1000, 0),
        makeGroup("g", -10, -10, 660, 400),
        makeText("c", 0, 0),
        makeText("d", 200, 150),
      ],
      edges: [
        makeEdge("e1", "a", "right", "c", "left"),
      ],
    }

    // Record original relative positions
    const origRelX = 200 - 0 // d.x - c.x
    const origRelY = 150 - 0 // d.y - c.y

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })

    const c = findNode(result.document, "c")!
    const d = findNode(result.document, "d")!

    // Relative positions should be preserved exactly
    expect(d.x - c.x).toBe(origRelX)
    expect(d.y - c.y).toBe(origRelY)
  })

  it("group bounding box does not overlap with other connected subgraphs", () => {
    // Subgraph 1: A → group G (containing C, D), A outside G
    // Subgraph 2: X → Y (placed nearby)
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 1500, 0),
        makeGroup("g", 200, -50, 660, 400),
        makeText("c", 200, -50),
        makeText("d", 500, 150),
        makeText("x", 900, 0),
        makeText("y", 1220, 0),
      ],
      edges: [
        makeEdge("e1", "a", "right", "c", "left"),
        makeEdge("e2", "x", "right", "y", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "a" })
    expect(result.success).toBe(true)

    // Get the group's actual bounding box (from its children)
    const g = findNode(result.document, "g")!
    const x = findNode(result.document, "x")!
    const y = findNode(result.document, "y")!

    // X, Y should not have moved
    expect(x.x).toBe(900)
    expect(y.x).toBe(1220)

    // Group bounding box should not overlap with X-Y bounding box
    const gRight = g.x + g.width
    const xyLeft = Math.min(x.x, y.x)
    const gBottom = g.y + g.height
    const xyTop = Math.min(x.y, y.y)
    const xyBottom = Math.max(x.y + x.height, y.y + y.height)

    // No horizontal overlap OR no vertical overlap
    const noOverlap = gRight <= xyLeft || g.x >= xyLeft + 320
      || gBottom <= xyTop || g.y >= xyBottom
    expect(noOverlap).toBe(true)
  })

  it("handles selected node inside a group", () => {
    // A → group G (containing C, D), user selects C
    const doc: CanvasDocument = {
      nodes: [
        makeText("a", 1500, 0),
        makeGroup("g", -10, -10, 660, 400),
        makeText("c", 0, 0),
        makeText("d", 200, 150),
      ],
      edges: [
        makeEdge("e1", "a", "right", "c", "left"),
      ],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "c" })
    expect(result.success).toBe(true)

    const c = findNode(result.document, "c")!
    const d = findNode(result.document, "d")!
    const g = findNode(result.document, "g")!

    // C and D should still be inside group boundaries
    expect(c.x).toBeGreaterThanOrEqual(g.x)
    expect(c.y).toBeGreaterThanOrEqual(g.y)
    expect(c.x + c.width).toBeLessThanOrEqual(g.x + g.width)
    expect(c.y + c.height).toBeLessThanOrEqual(g.y + g.height)

    expect(d.x).toBeGreaterThanOrEqual(g.x)
    expect(d.y).toBeGreaterThanOrEqual(g.y)
    expect(d.x + d.width).toBeLessThanOrEqual(g.x + g.width)
    expect(d.y + d.height).toBeLessThanOrEqual(g.y + g.height)
  })

  it("handles group with no external edges (isolated group)", () => {
    // Group G with C, D inside but no external edges
    const doc: CanvasDocument = {
      nodes: [
        makeGroup("g", -10, -10, 660, 400),
        makeText("c", 0, 0),
        makeText("d", 340, 200),
      ],
      edges: [],
    }

    const result = relayoutConnectedNodes(doc, { selectedNodeId: "c" })
    // Should fail — no connected nodes outside the group
    expect(result.success).toBe(false)
  })
})

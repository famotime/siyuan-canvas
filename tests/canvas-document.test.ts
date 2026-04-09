import {
  describe,
  expect,
  it,
} from "vitest"

import {
  applyCanvasNodeLayout,
  createCanvasGroupForNodes,
  createEmptyCanvasDocument,
  findCanvasNodesInGroup,
  getCanvasSelectionBounds,
  removeCanvasNode,
  removeCanvasNodes,
  setCanvasNodeGeometry,
  setCanvasNodesColor,
  translateCanvasNodes,
  upsertCanvasEdge,
  upsertCanvasNode,
} from "@/canvas/document"

describe("canvas document operations", () => {
  it("removing a node also removes related edges", () => {
    const withNodes = upsertCanvasNode(
      upsertCanvasNode(createEmptyCanvasDocument(), {
        id: "n1",
        type: "text",
        text: "one",
        x: 0,
        y: 0,
        width: 320,
        height: 180,
      }),
      {
        id: "n2",
        type: "text",
        text: "two",
        x: 500,
        y: 100,
        width: 320,
        height: 180,
      },
    )

    const withEdge = upsertCanvasEdge(withNodes, {
      id: "e1",
      fromNode: "n1",
      fromSide: "right",
      toNode: "n2",
      toSide: "left",
      label: "flow",
    })

    const next = removeCanvasNode(withEdge, "n1")

    expect(next.nodes.map((node) => node.id)).toEqual(["n2"])
    expect(next.edges).toEqual([])
  })

  it("updating geometry only touches the targeted node", () => {
    const document = upsertCanvasNode(createEmptyCanvasDocument(), {
      id: "n1",
      type: "group",
      label: "scope",
      color: "2",
      x: 10,
      y: 20,
      width: 400,
      height: 300,
    })

    const next = setCanvasNodeGeometry(document, "n1", {
      x: 50,
      y: 70,
      width: 640,
      height: 480,
    })

    expect(next.nodes[0]).toMatchObject({
      id: "n1",
      x: 50,
      y: 70,
      width: 640,
      height: 480,
      label: "scope",
      color: "2",
    })
  })

  it("removing multiple nodes removes their related edges", () => {
    const document = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "one",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
        {
          id: "n2",
          type: "text",
          text: "two",
          x: 400,
          y: 0,
          width: 320,
          height: 180,
        },
        {
          id: "n3",
          type: "text",
          text: "three",
          x: 800,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [
        {
          id: "e1",
          fromNode: "n1",
          fromSide: "right",
          toNode: "n2",
          toSide: "left",
        },
        {
          id: "e2",
          fromNode: "n2",
          fromSide: "right",
          toNode: "n3",
          toSide: "left",
        },
      ],
    }

    const next = removeCanvasNodes(document, ["n1", "n2"])

    expect(next.nodes.map((node) => node.id)).toEqual(["n3"])
    expect(next.edges).toEqual([])
  })

  it("translates a group of selected nodes together", () => {
    const document = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "one",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
        {
          id: "n2",
          type: "text",
          text: "two",
          x: 400,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [],
    }

    const next = translateCanvasNodes(document, ["n1", "n2"], 30, -15)

    expect(next.nodes).toMatchObject([
      {
        id: "n1",
        x: 30,
        y: -15,
      },
      {
        id: "n2",
        x: 430,
        y: -15,
      },
    ])
  })

  it("computes combined bounds for selected nodes", () => {
    const document = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "one",
          x: 10,
          y: 20,
          width: 100,
          height: 50,
        },
        {
          id: "n2",
          type: "text",
          text: "two",
          x: 50,
          y: 90,
          width: 180,
          height: 120,
        },
      ],
      edges: [],
    }

    const bounds = getCanvasSelectionBounds(document, ["n1", "n2"])

    expect(bounds).toEqual({
      x: 10,
      y: 20,
      width: 220,
      height: 190,
    })
  })

  it("applies one color to selected nodes only", () => {
    const document = {
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "one",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
          color: "1",
        },
        {
          id: "n2",
          type: "text",
          text: "two",
          x: 0,
          y: 200,
          width: 320,
          height: 180,
          color: "2",
        },
      ],
      edges: [],
    }

    const next = setCanvasNodesColor(document, ["n1"], "5")

    expect(next.nodes).toMatchObject([
      {
        id: "n1",
        color: "5",
      },
      {
        id: "n2",
        color: "2",
      },
    ])
  })

  it("creates a group node around selected nodes with padding", () => {
    const document = {
      nodes: [
        {
          id: "c1",
          type: "text",
          text: "child",
          x: 100,
          y: 200,
          width: 80,
          height: 40,
        },
        {
          id: "c2",
          type: "text",
          text: "child",
          x: 220,
          y: 260,
          width: 50,
          height: 50,
        },
      ],
      edges: [],
    }

    const { document: grouped, groupId } = createCanvasGroupForNodes(document, ["c1", "c2"])

    const group = grouped.nodes.find((node) => node.id === groupId)

    expect(group).toMatchObject({
      label: "Group",
      x: 76,
      y: 176,
      width: 218,
      height: 158,
    })
  })

  it("finds nodes fully enclosed by a group", () => {
    const document = {
      nodes: [
        {
          id: "g1",
          type: "group",
          label: "scope",
          x: 0,
          y: 0,
          width: 300,
          height: 200,
        },
        {
          id: "inside",
          type: "text",
          text: "inside",
          x: 10,
          y: 10,
          width: 50,
          height: 50,
        },
        {
          id: "border",
          type: "text",
          text: "border",
          x: 250,
          y: 150,
          width: 50,
          height: 50,
        },
        {
          id: "partial",
          type: "text",
          text: "partial",
          x: 280,
          y: 10,
          width: 30,
          height: 30,
        },
      ],
      edges: [],
    }

    const enclosedIds = findCanvasNodesInGroup(document, "g1")

    expect(enclosedIds).toEqual(["inside", "border"])
  })
})

describe("canvas node layout actions", () => {
  const mapNodesById = <T extends { id: string }>(nodes: T[]) =>
    nodes.reduce<Record<string, T>>((accumulator, node) => {
      accumulator[node.id] = node
      return accumulator
    }, {})

  it("returns the original document when selection is empty", () => {
    const document = {
      nodes: [
        { id: "n1", type: "text", text: "one", x: 10, y: 20, width: 100, height: 40 },
      ],
      edges: [],
    }

    const next = applyCanvasNodeLayout(document, [], "left-align")

    expect(next).toBe(document)
  })

  it("aligns selected nodes to left, right, top, and bottom edges only", () => {
    const document = {
      nodes: [
        { id: "a", type: "text", text: "A", x: 40, y: 60, width: 100, height: 80 },
        { id: "b", type: "text", text: "B", x: 220, y: 120, width: 80, height: 40 },
        { id: "c", type: "text", text: "C", x: 500, y: 500, width: 40, height: 40 },
      ],
      edges: [{ id: "e1", fromNode: "a", fromSide: "right", toNode: "c", toSide: "left" }],
    }

    const left = applyCanvasNodeLayout(document, ["a", "b"], "left-align")
    const leftById = mapNodesById(left.nodes)
    expect(leftById.a).toMatchObject({ x: 40 })
    expect(leftById.b).toMatchObject({ x: 40 })
    expect(leftById.c).toMatchObject({ x: 500, y: 500, width: 40, height: 40 })
    expect(left.edges).toEqual(document.edges)

    const right = applyCanvasNodeLayout(document, ["a", "b"], "right-align")
    const rightById = mapNodesById(right.nodes)
    expect(rightById.a).toMatchObject({ x: 200 })
    expect(rightById.b).toMatchObject({ x: 220 })

    const top = applyCanvasNodeLayout(document, ["a", "b"], "top-align")
    const topById = mapNodesById(top.nodes)
    expect(topById.a).toMatchObject({ y: 60 })
    expect(topById.b).toMatchObject({ y: 60 })

    const bottom = applyCanvasNodeLayout(document, ["a", "b"], "bottom-align")
    const bottomById = mapNodesById(bottom.nodes)
    expect(bottomById.a).toMatchObject({ y: 80 })
    expect(bottomById.b).toMatchObject({ y: 120 })
  })

  it("aligns selected node centers to horizontal and vertical center lines", () => {
    const document = {
      nodes: [
        { id: "a", type: "text", text: "A", x: 40, y: 60, width: 100, height: 80 },
        { id: "b", type: "text", text: "B", x: 220, y: 120, width: 80, height: 40 },
      ],
      edges: [],
    }

    const centeredHorizontally = applyCanvasNodeLayout(document, ["a", "b"], "center-horizontal")
    const horizontalById = mapNodesById(centeredHorizontally.nodes)
    expect(horizontalById.a).toMatchObject({ x: 120 })
    expect(horizontalById.b).toMatchObject({ x: 130 })

    const centeredVertically = applyCanvasNodeLayout(document, ["a", "b"], "center-vertical")
    const verticalById = mapNodesById(centeredVertically.nodes)
    expect(verticalById.a).toMatchObject({ y: 70 })
    expect(verticalById.b).toMatchObject({ y: 90 })
  })

  it("distributes nodes horizontally by center points while keeping first and last anchors", () => {
    const document = {
      nodes: [
        { id: "n1", type: "text", text: "one", x: 0, y: 0, width: 60, height: 40 },
        { id: "n2", type: "text", text: "two", x: 120, y: 40, width: 100, height: 40 },
        { id: "n3", type: "text", text: "three", x: 280, y: 80, width: 40, height: 40 },
        { id: "n4", type: "text", text: "four", x: 500, y: 120, width: 120, height: 40 },
      ],
      edges: [],
    }

    const distributed = applyCanvasNodeLayout(document, ["n1", "n2", "n3", "n4"], "distribute-horizontal")
    const distributedById = mapNodesById(distributed.nodes)
    expect(distributedById.n1).toMatchObject({ x: 0 })
    expect(distributedById.n2.x).toBeCloseTo(156.6666666667)
    expect(distributedById.n3.x).toBeCloseTo(363.3333333333)
    expect(distributedById.n4).toMatchObject({ x: 500 })
  })

  it("distributes nodes vertically by center points while keeping first and last anchors", () => {
    const document = {
      nodes: [
        { id: "n1", type: "text", text: "one", x: 0, y: 0, width: 60, height: 40 },
        { id: "n2", type: "text", text: "two", x: 40, y: 80, width: 60, height: 60 },
        { id: "n3", type: "text", text: "three", x: 80, y: 120, width: 60, height: 20 },
        { id: "n4", type: "text", text: "four", x: 120, y: 300, width: 60, height: 40 },
      ],
      edges: [],
    }

    const distributed = applyCanvasNodeLayout(document, ["n1", "n2", "n3", "n4"], "distribute-vertical")
    const distributedById = mapNodesById(distributed.nodes)
    expect(distributedById.n1).toMatchObject({ y: 0 })
    expect(distributedById.n2).toMatchObject({ y: 90 })
    expect(distributedById.n3).toMatchObject({ y: 210 })
    expect(distributedById.n4).toMatchObject({ y: 300 })
  })

  it("arranges selected nodes as a row with 32px gaps in left-to-right then top-to-bottom order", () => {
    const document = {
      nodes: [
        { id: "a", type: "text", text: "A", x: 200, y: 200, width: 80, height: 40 },
        { id: "b", type: "text", text: "B", x: 20, y: 150, width: 60, height: 50 },
        { id: "c", type: "text", text: "C", x: 20, y: 20, width: 100, height: 30 },
        { id: "d", type: "text", text: "D", x: 120, y: 80, width: 70, height: 60 },
        { id: "u", type: "text", text: "U", x: 600, y: 600, width: 40, height: 40 },
      ],
      edges: [],
    }

    const arranged = applyCanvasNodeLayout(document, ["a", "b", "c", "d"], "arrange-row")
    const arrangedById = mapNodesById(arranged.nodes)
    expect(arrangedById.c).toMatchObject({ x: 20, y: 20 })
    expect(arrangedById.b).toMatchObject({ x: 152, y: 20 })
    expect(arrangedById.d).toMatchObject({ x: 244, y: 20 })
    expect(arrangedById.a).toMatchObject({ x: 346, y: 20 })
    expect(arrangedById.u).toMatchObject({ x: 600, y: 600 })
  })

  it("arranges selected nodes as a column with 24px gaps in top-to-bottom then left-to-right order", () => {
    const document = {
      nodes: [
        { id: "a", type: "text", text: "A", x: 200, y: 200, width: 80, height: 40 },
        { id: "b", type: "text", text: "B", x: 20, y: 80, width: 60, height: 50 },
        { id: "c", type: "text", text: "C", x: 120, y: 80, width: 100, height: 30 },
        { id: "d", type: "text", text: "D", x: 50, y: 20, width: 70, height: 60 },
      ],
      edges: [],
    }

    const arranged = applyCanvasNodeLayout(document, ["a", "b", "c", "d"], "arrange-column")
    const arrangedById = mapNodesById(arranged.nodes)
    expect(arrangedById.d).toMatchObject({ x: 20, y: 20 })
    expect(arrangedById.b).toMatchObject({ x: 20, y: 104 })
    expect(arrangedById.c).toMatchObject({ x: 20, y: 178 })
    expect(arrangedById.a).toMatchObject({ x: 20, y: 232 })
  })

  it("arranges selected nodes in a grid using a column count derived from selection aspect ratio", () => {
    const document = {
      nodes: [
        { id: "n1", type: "text", text: "one", x: 10, y: 10, width: 50, height: 30 },
        { id: "n2", type: "text", text: "two", x: 90, y: 80, width: 70, height: 40 },
        { id: "n3", type: "text", text: "three", x: 40, y: 180, width: 60, height: 50 },
        { id: "n4", type: "text", text: "four", x: 120, y: 260, width: 80, height: 30 },
        { id: "n5", type: "text", text: "five", x: 30, y: 340, width: 55, height: 45 },
        { id: "n6", type: "text", text: "six", x: 100, y: 420, width: 65, height: 35 },
      ],
      edges: [],
    }

    const arranged = applyCanvasNodeLayout(document, ["n1", "n2", "n3", "n4", "n5", "n6"], "arrange-grid")
    const arrangedById = mapNodesById(arranged.nodes)
    expect(arrangedById.n1).toMatchObject({ x: 10, y: 10 })
    expect(arrangedById.n2).toMatchObject({ x: 94, y: 10 })
    expect(arrangedById.n3).toMatchObject({ x: 10, y: 74 })
    expect(arrangedById.n4).toMatchObject({ x: 94, y: 74 })
    expect(arrangedById.n5).toMatchObject({ x: 10, y: 148 })
    expect(arrangedById.n6).toMatchObject({ x: 94, y: 148 })
  })

  it("stretches selected nodes horizontally to selection bounds", () => {
    const document = {
      nodes: [
        { id: "a", type: "text", text: "A", x: 20, y: 0, width: 100, height: 80 },
        { id: "b", type: "text", text: "B", x: 180, y: 60, width: 50, height: 40 },
        { id: "c", type: "text", text: "C", x: 500, y: 20, width: 40, height: 40 },
      ],
      edges: [{ id: "e1", fromNode: "a", fromSide: "right", toNode: "b", toSide: "left" }],
    }

    const stretched = applyCanvasNodeLayout(document, ["a", "b"], "stretch-horizontal")
    const stretchedById = mapNodesById(stretched.nodes)
    expect(stretchedById.a).toMatchObject({ x: 20, width: 210 })
    expect(stretchedById.b).toMatchObject({ x: 20, width: 210 })
    expect(stretchedById.c).toMatchObject({ x: 500, width: 40 })
    expect(stretched.edges).toEqual(document.edges)
  })

  it("stretches selected nodes vertically to selection bounds", () => {
    const document = {
      nodes: [
        { id: "a", type: "text", text: "A", x: 20, y: 40, width: 100, height: 80 },
        { id: "b", type: "text", text: "B", x: 180, y: 150, width: 50, height: 40 },
      ],
      edges: [],
    }

    const stretched = applyCanvasNodeLayout(document, ["a", "b"], "stretch-vertical")
    const stretchedById = mapNodesById(stretched.nodes)
    expect(stretchedById.a).toMatchObject({ y: 40, height: 150 })
    expect(stretchedById.b).toMatchObject({ y: 40, height: 150 })
  })
})

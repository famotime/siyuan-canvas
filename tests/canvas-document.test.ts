import {
  describe,
  expect,
  it,
} from "vitest"

import {
  applyColorToSelectedNodes,
  computeSelectionBounds,
  createGroupNodeAroundSelection,
  findNodesFullyEnclosedByGroup,
  createEmptyCanvasDocument,
  removeCanvasNode,
  removeCanvasNodes,
  setCanvasNodeGeometry,
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

    const bounds = computeSelectionBounds(document, ["n1", "n2"])

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

    const next = applyColorToSelectedNodes(document, ["n1"], "5")

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

    const next = createGroupNodeAroundSelection(document, ["c1", "c2"])

    const group = next.nodes.find((node) => node.type === "group")

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

    const enclosed = findNodesFullyEnclosedByGroup(document, "g1")

    expect(enclosed.map((node) => node.id)).toEqual(["inside", "border"])
  })
})

import {
  describe,
  expect,
  it,
} from "vitest"

import {
  createEmptyCanvasDocument,
  removeCanvasNode,
  setCanvasNodeGeometry,
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
})

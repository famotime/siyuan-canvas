import {
  describe,
  expect,
  it,
} from "vitest"

import {
  findNearestCanvasAnchor,
  getCanvasNodeAnchor,
  resizeCanvasNodeFromCorner,
  resizeCanvasNodeFromSide,
} from "@/canvas/node-interaction"

describe("canvas node interaction helpers", () => {
  it("computes edge anchors from the midpoint of each side", () => {
    const node = {
      id: "n1",
      type: "text" as const,
      text: "one",
      x: 100,
      y: 200,
      width: 320,
      height: 180,
    }

    expect(getCanvasNodeAnchor(node, "top")).toEqual({ x: 260, y: 200 })
    expect(getCanvasNodeAnchor(node, "right")).toEqual({ x: 420, y: 290 })
    expect(getCanvasNodeAnchor(node, "bottom")).toEqual({ x: 260, y: 380 })
    expect(getCanvasNodeAnchor(node, "left")).toEqual({ x: 100, y: 290 })
  })

  it("resizes a node from any edge while preserving the opposite edge", () => {
    const node = {
      id: "n1",
      type: "text" as const,
      text: "one",
      x: 100,
      y: 200,
      width: 320,
      height: 180,
    }

    expect(resizeCanvasNodeFromSide(node, "left", 40, 0)).toMatchObject({
      x: 140,
      y: 200,
      width: 280,
      height: 180,
    })
    expect(resizeCanvasNodeFromSide(node, "right", 40, 0)).toMatchObject({
      x: 100,
      y: 200,
      width: 360,
      height: 180,
    })
    expect(resizeCanvasNodeFromSide(node, "top", 0, 30)).toMatchObject({
      x: 100,
      y: 230,
      width: 320,
      height: 150,
    })
    expect(resizeCanvasNodeFromSide(node, "bottom", 0, 30)).toMatchObject({
      x: 100,
      y: 200,
      width: 320,
      height: 210,
    })
  })

  it("resizes a node from the bottom-right corner by changing width and height together", () => {
    const node = {
      id: "n1",
      type: "text" as const,
      text: "one",
      x: 100,
      y: 200,
      width: 320,
      height: 180,
    }

    expect(resizeCanvasNodeFromCorner(node, 40, 30)).toMatchObject({
      x: 100,
      y: 200,
      width: 360,
      height: 210,
    })
  })

  it("snaps a dragged connection to the nearest eligible side midpoint", () => {
    const nodes = [
      {
        id: "source",
        type: "text" as const,
        text: "source",
        x: 100,
        y: 100,
        width: 180,
        height: 100,
      },
      {
        id: "target",
        type: "text" as const,
        text: "target",
        x: 420,
        y: 120,
        width: 180,
        height: 100,
      },
    ]

    expect(findNearestCanvasAnchor(nodes, { x: 428, y: 170 }, {
      excludeNodeId: "source",
      maxDistance: 24,
    })).toMatchObject({
      nodeId: "target",
      side: "left",
      x: 420,
      y: 170,
    })

    expect(findNearestCanvasAnchor(nodes, { x: 360, y: 170 }, {
      excludeNodeId: "source",
      maxDistance: 24,
    })).toBeNull()
  })
})

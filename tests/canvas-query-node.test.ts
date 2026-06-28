import {
  describe,
  expect,
  it,
} from "vitest"

import { createCanvasNode } from "@/canvas/document"
import type { CanvasQueryNode } from "@/canvas/types"

describe("canvas query node operations", () => {
  it("initializes a query node with default properties", () => {
    const node = createCanvasNode("query") as CanvasQueryNode

    expect(node.type).toBe("query")
    expect(node.sql).toContain("SELECT * FROM blocks")
    expect(node.refreshInterval).toBe(0)
    expect(node.maxResults).toBe(50)
    expect(node.width).toBe(360)
    expect(node.height).toBe(480)
  })
})

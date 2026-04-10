import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  describe,
  expect,
  it,
} from "vitest"

import {
  parseCanvasDocument,
  stringifyCanvasDocument,
  validateCanvasDocument,
} from "@/canvas/format"

describe("canvas format", () => {
  it("parses the sample Obsidian canvas document", () => {
    const raw = readFileSync(
      resolve(process.cwd(), "sample_canvas", "学习观 1-6.canvas"),
      "utf8",
    )

    const result = parseCanvasDocument(raw)

    expect(result.errors).toEqual([])
    expect(result.document).not.toBeNull()
    expect(result.document?.nodes).toHaveLength(11)
    expect(result.document?.edges).toHaveLength(7)
    expect(new Set(result.document?.nodes.map((node) => node.type))).toEqual(
      new Set(["group", "file", "text", "link"]),
    )
  })

  it("preserves unknown fields through parse and stringify", () => {
    const raw = JSON.stringify({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "hello",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
          customFlag: true,
        },
      ],
      edges: [
        {
          id: "e1",
          fromNode: "n1",
          fromSide: "right",
          toNode: "n1",
          toSide: "left",
          customLabelColor: "amber",
        },
      ],
      customMeta: {
        source: "test",
      },
    })

    const parsed = parseCanvasDocument(raw)
    const serialized = stringifyCanvasDocument(parsed.document!)
    const roundtrip = JSON.parse(serialized)

    expect(roundtrip.customMeta).toEqual({ source: "test" })
    expect(roundtrip.nodes[0].customFlag).toBe(true)
    expect(roundtrip.edges[0].customLabelColor).toBe("amber")
  })

  it("reports edge references to missing nodes", () => {
    const result = validateCanvasDocument({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "hello",
          x: 0,
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
          toNode: "missing",
          toSide: "left",
        },
      ],
    })

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.code).toBe("edge.missing-node")
  })

  it("falls back to inferred edge sides when imported edges omit them", () => {
    const raw = JSON.stringify({
      nodes: [
        {
          id: "left",
          type: "text",
          text: "left",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
        {
          id: "right",
          type: "text",
          text: "right",
          x: 600,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [
        {
          id: "e1",
          fromNode: "left",
          toNode: "right",
        },
      ],
    })

    const result = parseCanvasDocument(raw)

    expect(result.errors).toEqual([])
    expect(result.document?.edges).toEqual([
      {
        id: "e1",
        fromNode: "left",
        fromSide: "right",
        toNode: "right",
        toSide: "left",
      },
    ])
    expect(result.warnings).toMatchObject([
      {
        code: "edge.side.defaulted",
        level: "warning",
      },
    ])
  })
})

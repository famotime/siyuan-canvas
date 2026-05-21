import { describe, expect, it } from "vitest"

import {
  collectCanvasSearchTargets,
  createCanvasSearchRevision,
  getCanvasSearchRegistry,
  markCanvasSearchTextRanges,
  renderCanvasSearchMarkedText,
  replaceCanvasTextTargetRanges,
  registerCanvasSearchHost,
} from "@/canvas/search-bridge"

describe("canvas search bridge", () => {
  it("collects text nodes as replaceable and file nodes as view-only note targets", () => {
    const targets = collectCanvasSearchTargets({
      document: {
        nodes: [
          { id: "t1", type: "text", text: "Alpha note", x: 0, y: 0, width: 320, height: 180 },
          { id: "f1", type: "file", file: "20260101010101-abcdefg", x: 0, y: 240, width: 320, height: 180 },
          { id: "g1", type: "group", label: "Group Alpha", x: 0, y: 480, width: 640, height: 360 },
        ],
        edges: [
          { id: "e1", fromNode: "t1", fromSide: "right", toNode: "f1", toSide: "left", label: "Edge Alpha" },
        ],
      },
      fileNodeTextById: new Map([["f1", "Document Alpha\n/data/doc.sy"]]),
    })

    expect(targets.map(target => ({
      field: target.field,
      nodeId: target.nodeId,
      replaceable: target.replaceable,
      text: target.text,
      type: target.type,
    }))).toEqual([
      { field: "text", nodeId: "t1", replaceable: true, text: "Alpha note", type: "node" },
      { field: "note", nodeId: "f1", replaceable: false, text: "Document Alpha\n/data/doc.sy", type: "node" },
      { field: "label", nodeId: "g1", replaceable: false, text: "Group Alpha", type: "node" },
      { field: "label", nodeId: "e1", replaceable: false, text: "Edge Alpha", type: "edge" },
    ])
  })

  it("replaces text node ranges in reverse order and leaves other targets untouched", () => {
    const result = replaceCanvasTextTargetRanges({
      document: {
        nodes: [
          { id: "t1", type: "text", text: "Alpha Alpha", x: 0, y: 0, width: 320, height: 180 },
          { id: "f1", type: "file", file: "Alpha", x: 0, y: 240, width: 320, height: 180 },
        ],
        edges: [],
      },
      ranges: [
        { start: 0, end: 5, text: "Beta" },
        { start: 6, end: 11, text: "Gamma" },
      ],
      targetId: "node:t1:text",
    })

    expect(result.appliedCount).toBe(2)
    expect(result.document.nodes[0]).toMatchObject({ text: "Beta Gamma" })
    expect(result.document.nodes[1]).toMatchObject({ file: "Alpha" })
  })

  it("registers hosts globally and creates stable snapshot revisions", () => {
    const host = {
      version: 1 as const,
      getContext: () => ({
        filePath: "/data/canvas/a.canvas",
        id: "canvas:/data/canvas/a.canvas",
        readonly: false,
        title: "a.canvas",
      }),
      getSnapshot: async () => ({ revision: "r1", targets: [] }),
      replaceTextRanges: async () => ({ appliedCount: 0, revision: "r1" }),
      reveal: async () => false,
      root: {} as HTMLElement,
      subscribe: () => () => undefined,
      syncDecorations: () => undefined,
    }

    const unregister = registerCanvasSearchHost(host)
    expect(getCanvasSearchRegistry().has(host)).toBe(true)
    unregister()
    expect(getCanvasSearchRegistry().has(host)).toBe(false)

    expect(createCanvasSearchRevision("/data/canvas/a.canvas", 3, "raw")).toBe("canvas:/data/canvas/a.canvas:3:3")
  })

  it("renders safe mark elements for search ranges in plain text", () => {
    expect(renderCanvasSearchMarkedText("A <Alpha> Alpha", [
      { current: false, start: 3, end: 8, targetId: "node:t1:text" },
      { current: true, start: 10, end: 15, targetId: "node:t1:text" },
    ])).toBe(
      'A &lt;<mark class="canvas-search-mark">Alpha</mark>&gt; <mark class="canvas-search-mark canvas-search-mark--current">Alpha</mark>',
    )
  })

  it("marks multiple text-node search ranges in source order for markdown rendering", () => {
    expect(markCanvasSearchTextRanges("Alpha Beta Alpha", [
      { current: true, start: 11, end: 16, targetId: "node:t1:text" },
      { current: false, start: 0, end: 5, targetId: "node:t1:text" },
    ])).toBe(
      '<mark class="canvas-search-mark">Alpha</mark> Beta <mark class="canvas-search-mark canvas-search-mark--current">Alpha</mark>',
    )
  })
})

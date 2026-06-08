import { describe, expect, it } from "vitest"
import { generateCanvasEmbedSvg, generateCanvasEmbedDataUrl } from "@/canvas/canvas-embed-preview"
import type { CanvasDocument } from "@/canvas/types"

function makeDoc(overrides?: Partial<CanvasDocument>): CanvasDocument {
  return {
    nodes: [],
    edges: [],
    ...overrides,
  }
}

describe("generateCanvasEmbedSvg", () => {
  it("returns empty string for empty document", () => {
    expect(generateCanvasEmbedSvg(makeDoc())).toBe("")
  })

  it("generates SVG with node rects", () => {
    const doc = makeDoc({
      nodes: [
        { id: "n1", type: "text", x: 0, y: 0, width: 200, height: 100, text: "hello" },
      ],
    })
    const svg = generateCanvasEmbedSvg(doc)
    expect(svg).toContain("<svg")
    expect(svg).toContain("</svg>")
    expect(svg).toContain("<rect")
    expect(svg).toContain("xmlns=")
  })

  it("renders edges between nodes", () => {
    const doc = makeDoc({
      nodes: [
        { id: "n1", type: "text", x: 0, y: 0, width: 100, height: 100, text: "a" },
        { id: "n2", type: "text", x: 300, y: 0, width: 100, height: 100, text: "b" },
      ],
      edges: [
        { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left" },
      ],
    })
    const svg = generateCanvasEmbedSvg(doc)
    expect(svg).toContain("<line")
  })

  it("handles group nodes with transparent fill", () => {
    const doc = makeDoc({
      nodes: [
        { id: "g1", type: "group", x: 0, y: 0, width: 400, height: 300, label: "G" },
        { id: "n1", type: "text", x: 50, y: 50, width: 100, height: 60, text: "t" },
      ],
    })
    const svg = generateCanvasEmbedSvg(doc)
    expect(svg).toContain("fill=\"transparent\"")
  })

  it("renders multiple node types", () => {
    const doc = makeDoc({
      nodes: [
        { id: "t1", type: "text", x: 0, y: 0, width: 100, height: 80, text: "t" },
        { id: "f1", type: "file", x: 200, y: 0, width: 100, height: 80, file: "doc" },
        { id: "l1", type: "link", x: 0, y: 200, width: 100, height: 80, url: "https://example.com" },
      ],
    })
    const svg = generateCanvasEmbedSvg(doc)
    const rectCount = (svg.match(/<rect/g) || []).length
    expect(rectCount).toBe(4) // 3 nodes + 1 background
  })

  it("skips edges referencing missing nodes", () => {
    const doc = makeDoc({
      nodes: [
        { id: "n1", type: "text", x: 0, y: 0, width: 100, height: 100, text: "a" },
      ],
      edges: [
        { id: "e1", fromNode: "n1", fromSide: "right", toNode: "missing", toSide: "left" },
      ],
    })
    const svg = generateCanvasEmbedSvg(doc)
    expect(svg).not.toContain("<line")
  })
})

describe("generateCanvasEmbedDataUrl", () => {
  it("returns empty string for empty document", () => {
    expect(generateCanvasEmbedDataUrl(makeDoc())).toBe("")
  })

  it("returns a valid data URL", () => {
    const doc = makeDoc({
      nodes: [
        { id: "n1", type: "text", x: 0, y: 0, width: 200, height: 100, text: "hello" },
      ],
    })
    const url = generateCanvasEmbedDataUrl(doc)
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/)
  })
})

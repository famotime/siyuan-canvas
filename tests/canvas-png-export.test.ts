/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
} from "vitest"

import {
  createCanvasPngExportFilename,
  resolveCanvasPngExportBackground,
  resolveCanvasPngExportBounds,
  shouldIncludeCanvasPngExportNode,
} from "@/canvas/png-export"

const nodes = [
  {
    height: 80,
    id: "left",
    text: "left",
    type: "text" as const,
    width: 120,
    x: -100,
    y: 40,
  },
  {
    height: 160,
    id: "right",
    text: "right",
    type: "text" as const,
    width: 200,
    x: 260,
    y: 220,
  },
]

describe("canvas png export", () => {
  it("resolves full canvas bounds from node content with padding", () => {
    expect(resolveCanvasPngExportBounds({
      nodes,
      padding: 32,
      range: "full",
      stageSize: { height: 600, width: 800 },
      viewport: { scale: 1, x: 0, y: 0 },
    })).toEqual({
      height: 404,
      width: 624,
      x: -132,
      y: 8,
    })
  })

  it("resolves current viewport bounds in canvas coordinates", () => {
    expect(resolveCanvasPngExportBounds({
      nodes,
      padding: 32,
      range: "viewport",
      stageSize: { height: 300, width: 500 },
      viewport: { scale: 2, x: 40, y: -20 },
    })).toEqual({
      height: 150,
      width: 250,
      x: -20,
      y: 10,
    })
  })

  it("falls back to a one-pixel full export when the canvas has no nodes", () => {
    expect(resolveCanvasPngExportBounds({
      nodes: [],
      padding: 32,
      range: "full",
      stageSize: { height: 300, width: 500 },
      viewport: { scale: 1, x: 0, y: 0 },
    })).toEqual({
      height: 1,
      width: 1,
      x: 0,
      y: 0,
    })
  })

  it("resolves white transparent and custom backgrounds", () => {
    expect(resolveCanvasPngExportBackground({ color: "#123456", mode: "white" })).toBe("#ffffff")
    expect(resolveCanvasPngExportBackground({ color: "#123456", mode: "transparent" })).toBeUndefined()
    expect(resolveCanvasPngExportBackground({ color: "#123456", mode: "custom" })).toBe("#123456")
    expect(resolveCanvasPngExportBackground({ color: "invalid", mode: "custom" })).toBe("#ffffff")
  })

  it("creates a png filename from the current canvas name", () => {
    expect(createCanvasPngExportFilename("Project.canvas")).toBe("Project.png")
    expect(createCanvasPngExportFilename("")).toBe("canvas-export.png")
  })

  it("excludes interactive-only layers from png export", () => {
    const root = document.createElement("div")
    const ignored = document.createElement("svg")
    const ignoredChild = document.createElement("path")
    const included = document.createElement("article")
    ignored.setAttribute("data-canvas-png-export-ignore", "true")
    ignored.append(ignoredChild)
    root.append(ignored, included)

    expect(shouldIncludeCanvasPngExportNode(root)).toBe(true)
    expect(shouldIncludeCanvasPngExportNode(included)).toBe(true)
    expect(shouldIncludeCanvasPngExportNode(ignored)).toBe(false)
    expect(shouldIncludeCanvasPngExportNode(ignoredChild)).toBe(false)
  })

  it("excludes iframes from png export to avoid cross-origin clone failures", () => {
    const iframe = document.createElement("iframe")
    iframe.src = "https://example.com"

    expect(shouldIncludeCanvasPngExportNode(iframe)).toBe(false)
  })
})

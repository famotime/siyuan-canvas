import {
  describe,
  expect,
  it,
} from "vitest"

import {
  getColorThemeById,
  buildColorStyles,
} from "@/canvas/canvas-color-themes"
import {
  CLEAR_SELECTION_COLOR,
  getCanvasNodeContentStyle,
  getCanvasNodeStyle,
  getNodeSelectionColorValue,
  getSelectionColorStyle,
} from "@/components/canvas/canvas-workspace-display"

describe("canvas workspace display helpers", () => {
  it("returns the clear swatch style and falls back for unknown colors", () => {
    expect(getSelectionColorStyle("")).toEqual({
      backgroundColor: "#9ca3af",
      borderColor: "#94a3b8",
    })

    expect(getSelectionColorStyle("missing")).toEqual({
      backgroundColor: "#64748b",
      borderColor: "#64748b",
    })
  })

  it("merges shared node positioning with color-specific card chrome", () => {
    expect(getCanvasNodeStyle(
      {
        color: "2",
        height: 180,
        id: "n1",
        text: "text",
        type: "text",
        width: 320,
        x: 0,
        y: 0,
      },
      {
        height: "180px",
        left: "0px",
        top: "0px",
        width: "320px",
      },
    )).toEqual({
      backgroundColor: "rgba(249, 115, 22, 0.18)",
      borderColor: "#f97316",
      height: "180px",
      left: "0px",
      top: "0px",
      width: "320px",
      zIndex: "3",
    })
  })

  it("keeps groups below regular nodes so inner nodes stay clickable", () => {
    expect(getCanvasNodeStyle(
      {
        height: 240,
        id: "group-0",
        label: "Group",
        type: "group",
        width: 480,
        x: 0,
        y: 0,
      },
      {
        height: "240px",
        left: "0px",
        top: "0px",
        width: "480px",
      },
    )).toEqual({
      height: "240px",
      left: "0px",
      top: "0px",
      width: "480px",
      zIndex: "1",
    })

    expect(getCanvasNodeStyle(
      {
        height: 240,
        id: "group-1",
        label: "Group",
        type: "group",
        width: 480,
        x: 0,
        y: 0,
      },
      {
        height: "240px",
        left: "0px",
        top: "0px",
        width: "480px",
      },
      { selected: true },
    )).toEqual({
      height: "240px",
      left: "0px",
      top: "0px",
      width: "480px",
      zIndex: "2",
    })

    expect(getCanvasNodeStyle(
      {
        height: 180,
        id: "n0",
        text: "text",
        type: "text",
        width: 320,
        x: 0,
        y: 0,
      },
      {
        height: "180px",
        left: "40px",
        top: "20px",
        width: "320px",
      },
    )).toEqual({
      height: "180px",
      left: "40px",
      top: "20px",
      width: "320px",
      zIndex: "3",
    })

    expect(getCanvasNodeStyle(
      {
        height: 180,
        id: "n1",
        text: "text",
        type: "text",
        width: 320,
        x: 0,
        y: 0,
      },
      {
        height: "180px",
        left: "40px",
        top: "20px",
        width: "320px",
      },
      { selected: true },
    )).toEqual({
      height: "180px",
      left: "40px",
      top: "20px",
      width: "320px",
      zIndex: "4",
    })
  })

  it("exposes group label colors and normalizes empty selection colors", () => {
    expect(getCanvasNodeContentStyle(
      {
        color: "1",
        height: 240,
        id: "group-1",
        label: "Group",
        type: "group",
        width: 480,
        x: 0,
        y: 0,
      },
    )).toEqual({
      backgroundColor: "#ef4444",
      color: "#ffffff",
    })

    expect(getCanvasNodeContentStyle(
      {
        color: "3",
        height: 240,
        id: "group-2",
        label: "Group",
        type: "group",
        width: 480,
        x: 0,
        y: 0,
      },
    )).toEqual({
      backgroundColor: "#f4b400",
      color: "#111827",
    })

    expect(getNodeSelectionColorValue(
      {
        height: 180,
        id: "n1",
        text: "text",
        type: "text",
        width: 320,
        x: 0,
        y: 0,
      },
    )).toBe(CLEAR_SELECTION_COLOR)
  })
})

describe("theme-aware color styles", () => {
  it("getSelectionColorStyle uses default theme colors", () => {
    const style = getSelectionColorStyle("1")
    // getSelectionColorStyle returns swatch (hex) for backgroundColor
    expect(style.backgroundColor).toBe("#ef4444")
    expect(style.borderColor).toBe("#ef4444")
  })

  it("getCanvasNodeStyle uses provided colorStyles", () => {
    const earthTheme = getColorThemeById("earth")
    const earthStyles = buildColorStyles(earthTheme)
    const result = getCanvasNodeStyle(
      { color: "1", height: 100, id: "n1", text: "x", type: "text", width: 200, x: 0, y: 0 },
      { height: "100px", left: "0px", top: "0px", width: "200px" },
      {},
      earthStyles,
    )
    // earth slot 1 = #c77a3a
    expect(result.backgroundColor).toBe("rgba(199, 122, 58, 0.18)")
    expect(result.borderColor).toBe("#c77a3a")
  })

  it("getCanvasNodeContentStyle uses provided colorStyles", () => {
    const neonTheme = getColorThemeById("neon")
    const neonStyles = buildColorStyles(neonTheme)
    const result = getCanvasNodeContentStyle(
      { color: "1", height: 200, id: "g1", label: "G", type: "group", width: 400, x: 0, y: 0 },
      neonStyles,
    )
    // neon slot 1 = #00f0ff
    expect(result?.backgroundColor).toBe("#00f0ff")
  })

  it("getCanvasNodeStyle falls back to default styles when no colorStyles provided", () => {
    const result = getCanvasNodeStyle(
      { color: "2", height: 100, id: "n1", text: "x", type: "text", width: 200, x: 0, y: 0 },
      { height: "100px", left: "0px", top: "0px", width: "200px" },
    )
    expect(result.backgroundColor).toBe("rgba(249, 115, 22, 0.18)")
    expect(result.borderColor).toBe("#f97316")
  })
})

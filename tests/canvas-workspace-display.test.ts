import {
  describe,
  expect,
  it,
} from "vitest"

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

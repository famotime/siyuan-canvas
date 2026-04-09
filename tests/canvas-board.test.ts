import {
  describe,
  expect,
  it,
} from "vitest"

import { createCanvasBoardMetrics } from "@/canvas/board"

describe("canvas board metrics", () => {
  it("expands the board to contain imported canvases that exceed the default height", () => {
    const metrics = createCanvasBoardMetrics([
      {
        id: "n1",
        type: "text",
        text: "top",
        x: -520,
        y: -843,
        width: 250,
        height: 361,
      },
      {
        id: "n2",
        type: "text",
        text: "bottom",
        x: -244,
        y: 2644,
        width: 276,
        height: 347,
      },
    ])

    expect(metrics.top).toBe(-2100)
    expect(metrics.height).toBeGreaterThan(5091)
    expect(metrics.width).toBe(5600)
  })
})

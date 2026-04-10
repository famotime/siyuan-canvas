import {
  describe,
  expect,
  it,
} from "vitest"

import {
  MIN_VIEWPORT_SCALE,
  clampViewportScale,
  scaleViewportAtPoint,
} from "@/canvas/viewport"

describe("canvas viewport helpers", () => {
  it("keeps the cursor focus anchored while zooming", () => {
    const nextViewport = scaleViewportAtPoint(
      { scale: 1, x: 10, y: 20 },
      { x: 110, y: 120 },
      2,
    )

    const worldXBefore = (110 - 10) / 1
    const worldYBefore = (120 - 20) / 1
    const worldXAfter = (110 - nextViewport.x) / nextViewport.scale
    const worldYAfter = (120 - nextViewport.y) / nextViewport.scale

    expect(worldXAfter).toBe(worldXBefore)
    expect(worldYAfter).toBe(worldYBefore)
  })

  it("allows zooming out below thirty percent while still enforcing a floor", () => {
    expect(MIN_VIEWPORT_SCALE).toBe(0.1)
    expect(clampViewportScale(0.18)).toBe(0.18)
    expect(clampViewportScale(0.04)).toBe(0.1)
  })
})

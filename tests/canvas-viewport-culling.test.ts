import { describe, expect, it } from "vitest"
import {
  computeViewportVisibleBounds,
  isNodeInViewportBounds,
} from "@/canvas/viewport-culling"

describe("Canvas Viewport Culling & Intersection Detection", () => {
  const board = {
    height: 4000,
    left: -2000,
    top: -2000,
    width: 4000,
  }

  it("computes visible bounds correctly with default buffer", () => {
    // 视口无偏移、scale = 1，容器 1000x800，buffer = 200
    const bounds = computeViewportVisibleBounds(
      { scale: 1, x: 0, y: 0 },
      board,
      { clientWidth: 1000, clientHeight: 800 },
      200,
    )

    // left = 0 / 1 + (-2000) - 200 = -2200
    // top = 0 / 1 + (-2000) - 200 = -2200
    // right = 1000 / 1 + (-2000) + 200 = -800
    // bottom = 800 / 1 + (-2000) + 200 = -1000
    expect(bounds.left).toBe(-2200)
    expect(bounds.top).toBe(-2200)
    expect(bounds.right).toBe(-800)
    expect(bounds.bottom).toBe(-1000)
  })

  it("detects nodes intersecting or inside the viewport bounds", () => {
    const bounds = {
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
    }

    // 1. 完全在内部
    expect(isNodeInViewportBounds({ x: 200, y: 200, width: 200, height: 100 }, bounds)).toBe(true)

    // 2. 左边界相交
    expect(isNodeInViewportBounds({ x: -100, y: 200, width: 200, height: 100 }, bounds)).toBe(true)

    // 3. 右边界相交
    expect(isNodeInViewportBounds({ x: 900, y: 200, width: 200, height: 100 }, bounds)).toBe(true)

    // 4. 上边界相交
    expect(isNodeInViewportBounds({ x: 200, y: -50, width: 200, height: 100 }, bounds)).toBe(true)

    // 5. 下边界相交
    expect(isNodeInViewportBounds({ x: 200, y: 750, width: 200, height: 100 }, bounds)).toBe(true)
  })

  it("culls nodes located entirely outside the viewport bounds", () => {
    const bounds = {
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
    }

    // 偏左完全在边界外
    expect(isNodeInViewportBounds({ x: -400, y: 200, width: 200, height: 100 }, bounds)).toBe(false)

    // 偏右完全在边界外
    expect(isNodeInViewportBounds({ x: 1200, y: 200, width: 200, height: 100 }, bounds)).toBe(false)

    // 偏上完全在边界外
    expect(isNodeInViewportBounds({ x: 200, y: -300, width: 200, height: 100 }, bounds)).toBe(false)

    // 偏下完全在边界外
    expect(isNodeInViewportBounds({ x: 200, y: 1000, width: 200, height: 100 }, bounds)).toBe(false)
  })

  it("handles viewport zoom scaling correctly", () => {
    // 缩小到 0.5x（缩小视角看到更广阔的世界坐标范围）
    const boundsZoomOut = computeViewportVisibleBounds(
      { scale: 0.5, x: 0, y: 0 },
      board,
      { clientWidth: 1000, clientHeight: 800 },
      0,
    )

    // 宽度 1000 在 0.5x 下对应世界宽度 2000
    expect(boundsZoomOut.right - boundsZoomOut.left).toBe(2000)
    expect(boundsZoomOut.bottom - boundsZoomOut.top).toBe(1600)
  })
})

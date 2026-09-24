import { describe, expect, it } from "vitest"
import {
  createCanvasWheelSourceClassifier,
  MOUSE_WHEEL_MIN_DELTA_PX,
  normalizeCanvasWheelDelta,
  WHEEL_GESTURE_IDLE_MS,
  WHEEL_LINE_HEIGHT_PX,
} from "@/canvas/wheel-gesture"

function wheel(deltaY: number, deltaX = 0, deltaMode = 0) {
  return {
    deltaMode,
    deltaX,
    deltaY,
  }
}

describe("normalizeCanvasWheelDelta", () => {
  it("keeps pixel-mode deltas unchanged", () => {
    expect(normalizeCanvasWheelDelta(wheel(100, -20))).toEqual({ x: -20, y: 100 })
  })

  it("converts line-mode deltas to pixels and preserves the sign", () => {
    // Firefox 鼠标滚轮上报 ±3 行，折算后为 ±48 像素
    expect(normalizeCanvasWheelDelta(wheel(-3, 0, 1))).toEqual({ x: 0, y: -3 * WHEEL_LINE_HEIGHT_PX })
  })

  it("honours a custom line height", () => {
    expect(normalizeCanvasWheelDelta(wheel(3, 0, 1), { lineHeightPx: 40 })).toEqual({ x: 0, y: 120 })
  })

  it("converts page-mode deltas with the supplied page size", () => {
    expect(normalizeCanvasWheelDelta(wheel(1, 0, 2), { pageSizePx: 800 })).toEqual({ x: 0, y: 800 })
  })

  it("falls back to unscaled deltas when the page size is unknown", () => {
    expect(normalizeCanvasWheelDelta(wheel(1, 0, 2))).toEqual({ x: 0, y: 1 })
  })

  it("falls back to unscaled deltas for unknown delta modes", () => {
    expect(normalizeCanvasWheelDelta(wheel(7, 0, 99))).toEqual({ x: 0, y: 7 })
  })
})

describe("createCanvasWheelSourceClassifier", () => {
  function createHarness() {
    let clock = 0
    const classifier = createCanvasWheelSourceClassifier({ now: () => clock })
    return {
      classifier,
      advance(ms: number) {
        clock += ms
      },
    }
  }

  it("treats a mouse wheel notch as mouse input", () => {
    const { classifier } = createHarness()
    expect(classifier.classify(wheel(100))).toBe("mouse")
  })

  it("treats a line-mode wheel as mouse input", () => {
    const { classifier } = createHarness()
    // 行模式只有鼠标滚轮会产生，即使增量很小也按鼠标处理
    expect(classifier.classify(wheel(3, 0, 1))).toBe("mouse")
  })

  it("treats a small vertical delta as trackpad input", () => {
    const { classifier } = createHarness()
    expect(classifier.classify(wheel(12))).toBe("trackpad")
  })

  it("treats a horizontal delta as trackpad input", () => {
    const { classifier } = createHarness()
    // 鼠标滚轮没有横向分量，带 deltaX 的一律按触控板处理
    expect(classifier.classify(wheel(3, 40))).toBe("trackpad")
  })

  it("treats a delta just below the mouse threshold as trackpad input", () => {
    const { classifier } = createHarness()
    expect(classifier.classify(wheel(MOUSE_WHEEL_MIN_DELTA_PX - 1))).toBe("trackpad")
  })

  it("keeps panning when a fast flick emits a mouse-sized delta mid-gesture", () => {
    const { classifier, advance } = createHarness()
    expect(classifier.classify(wheel(8))).toBe("trackpad")

    // 手势锁存后，中途加速产生的 100 像素增量不应改判为鼠标滚轮而触发缩放
    advance(16)
    expect(classifier.classify(wheel(120))).toBe("trackpad")
  })

  it("classifies a flick that starts from rest as mouse input", () => {
    const { classifier } = createHarness()
    // 已知局限：从静止猛划时首个事件就可能是满刻度增量，会被误判为鼠标滚轮
    expect(classifier.classify(wheel(118))).toBe("mouse")
  })

  it("re-classifies after the gesture goes idle", () => {
    const { classifier, advance } = createHarness()
    expect(classifier.classify(wheel(8))).toBe("trackpad")

    advance(WHEEL_GESTURE_IDLE_MS + 1)
    expect(classifier.classify(wheel(120))).toBe("mouse")
  })

  it("keeps the latch while the momentum tail keeps firing", () => {
    const { classifier, advance } = createHarness()
    expect(classifier.classify(wheel(8))).toBe("trackpad")

    // 手指抬起后的惯性尾巴约每 16ms 一次，期间即使出现大增量也保持触控板判定
    for (let index = 0; index < 60; index += 1) {
      advance(16)
      expect(classifier.classify(wheel(index % 2 === 0 ? 120 : 4))).toBe("trackpad")
    }
  })

  it("refreshes the idle window on pinch events without flipping the latch", () => {
    const { classifier, advance } = createHarness()
    expect(classifier.classify(wheel(8))).toBe("trackpad")

    // 捏合同样是 wheel 事件（带 ctrlKey），它刷新时效但不改变已锁存的来源
    advance(200)
    expect(classifier.classify(wheel(3))).toBe("trackpad")

    // 若捏合事件未刷新时效，此处距首个事件已 250ms，会被当成新手势改判为鼠标
    advance(50)
    expect(classifier.classify(wheel(120))).toBe("trackpad")
  })

  it("falls back to trackpad input for a zero delta", () => {
    const { classifier } = createHarness()
    // 零位移事件在 handleStageWheel 中已被提前丢弃，这里只固化分类器的兜底取值
    expect(classifier.classify(wheel(0))).toBe("trackpad")
  })

  it("keeps state per instance so editors do not share a latch", () => {
    const first = createCanvasWheelSourceClassifier()
    const second = createCanvasWheelSourceClassifier()

    expect(first.classify(wheel(8))).toBe("trackpad")
    expect(second.classify(wheel(120))).toBe("mouse")
  })

  it("clears the latch on reset", () => {
    const { classifier } = createHarness()
    expect(classifier.classify(wheel(8))).toBe("trackpad")

    classifier.reset()
    expect(classifier.classify(wheel(120))).toBe("mouse")
  })
})

export type CanvasWheelSource = "mouse" | "trackpad"

/**
 * wheel 事件中与设备判定相关的字段子集，抽出来便于纯函数测试
 */
export interface CanvasWheelDeltaLike {
  deltaMode: number
  deltaX: number
  deltaY: number
}

/** 手势空闲阈值：距上次事件超过该时长即视为新手势，重新判定输入设备 */
export const WHEEL_GESTURE_IDLE_MS = 250

/** 鼠标滚轮单格位移的像素下限；触控板双指滑动的单次增量通常远小于此值 */
export const MOUSE_WHEEL_MIN_DELTA_PX = 100

/** deltaMode 为「行」时的像素换算基准（Firefox 的鼠标滚轮上报 ±3 行） */
export const WHEEL_LINE_HEIGHT_PX = 16

/** 滚轮缩放的灵敏度系数，沿用既有手感 */
export const WHEEL_ZOOM_SENSITIVITY = 0.0015

const DELTA_MODE_LINE = 1
const DELTA_MODE_PAGE = 2

/**
 * 把 wheel 事件的原始增量统一折算为像素。
 * 浏览器对鼠标滚轮可能上报「行」或「页」（Firefox 默认 ±3 行），不折算会让滚动与缩放几乎不动
 */
export function normalizeCanvasWheelDelta(
  delta: CanvasWheelDeltaLike,
  options: { lineHeightPx?: number, pageSizePx?: number } = {},
): { x: number, y: number } {
  const {
    lineHeightPx = WHEEL_LINE_HEIGHT_PX,
    pageSizePx = 0,
  } = options

  // deltaMode: 0 = 像素，1 = 行，2 = 页；无法识别的取值按像素处理，避免把增量放大失真
  let multiplier = 1
  if (delta.deltaMode === DELTA_MODE_LINE) {
    multiplier = lineHeightPx
  } else if (delta.deltaMode === DELTA_MODE_PAGE) {
    multiplier = pageSizePx > 0 ? pageSizePx : 1
  }

  return {
    x: delta.deltaX * multiplier,
    y: delta.deltaY * multiplier,
  }
}

export interface CanvasWheelSourceClassifier {
  classify: (delta: CanvasWheelDeltaLike) => CanvasWheelSource
  reset: () => void
}

/**
 * 判定一次 wheel 事件的来源设备。浏览器在 wheel 事件中不暴露设备类型，只能按增量特征推断，
 * 因此判定结果会按「手势」锁存：一旦确定就保持到手势结束，避免快速滑动中途穿插的
 * 大增量事件被单独判成鼠标滚轮，导致平移中突然缩放
 */
export function createCanvasWheelSourceClassifier(
  options: { now?: () => number } = {},
): CanvasWheelSourceClassifier {
  const now = options.now ?? (() => Date.now())
  let latched: CanvasWheelSource | null = null
  let lastEventAt = Number.NEGATIVE_INFINITY

  function reset() {
    latched = null
    lastEventAt = Number.NEGATIVE_INFINITY
  }

  function classify(delta: CanvasWheelDeltaLike): CanvasWheelSource {
    const timestamp = now()
    // 捏合与惯性尾巴都会持续推送事件，刷新时效可避免同一手势中途被当成新手势重新判定
    const isNewGesture = timestamp - lastEventAt > WHEEL_GESTURE_IDLE_MS
    lastEventAt = timestamp

    if (isNewGesture || latched === null) {
      latched = detectCanvasWheelSource(delta)
    }

    return latched
  }

  return {
    classify,
    reset,
  }
}

function detectCanvasWheelSource(delta: CanvasWheelDeltaLike): CanvasWheelSource {
  // 行/页模式只有鼠标滚轮会产生，触控板双指滑动恒为像素模式
  if (delta.deltaMode !== 0) {
    return "mouse"
  }

  // 鼠标滚轮按固定刻度步进（Chrome 约 100 像素一格）且没有横向分量；
  // 触控板则是连续小量，且常带横向抖动
  if (delta.deltaX === 0 && Math.abs(delta.deltaY) >= MOUSE_WHEEL_MIN_DELTA_PX) {
    return "mouse"
  }

  return "trackpad"
}

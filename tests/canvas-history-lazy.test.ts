import { describe, expect, it, vi } from "vitest"
import { CanvasHistoryStack } from "@/canvas/canvas-history"
import type { CanvasHistorySnapshot } from "@/canvas/canvas-history"

describe("CanvasHistoryStack Lazy Snapshot Recording", () => {
  function createSnapshot(text = "sample"): CanvasHistorySnapshot {
    return {
      document: {
        nodes: [{ id: "n1", type: "text", text, x: 0, y: 0, width: 100, height: 100 }],
        edges: [],
      },
      selectedEdgeId: "",
      selectedNodeId: "n1",
      selectedNodeIds: ["n1"],
    }
  }

  it("avoids calling createSnapshot during intermediate coalesced operations", () => {
    const stack = new CanvasHistoryStack({ defaultCoalesceMs: 300 })
    const snapshotFactory = vi.fn(() => createSnapshot("drag-1"))

    // 第 1 次调用：应该生成快照并入栈
    const recorded1 = stack.recordLazy(snapshotFactory, {
      coalesceKey: "drag-n1",
      now: 1000,
    })
    expect(recorded1).toBe(true)
    expect(snapshotFactory).toHaveBeenCalledTimes(1)
    expect(stack.canUndo).toBe(true)

    // 第 2 次与第 3 次调用（模拟 pointermove 高频帧）：在合并窗口内，应直接跳过快照生成
    const recorded2 = stack.recordLazy(snapshotFactory, {
      coalesceKey: "drag-n1",
      now: 1050,
    })
    const recorded3 = stack.recordLazy(snapshotFactory, {
      coalesceKey: "drag-n1",
      now: 1100,
    })

    expect(recorded2).toBe(false)
    expect(recorded3).toBe(false)
    // 依然只调用了 1 次工厂函数，消除了中间帧的多余深拷贝！
    expect(snapshotFactory).toHaveBeenCalledTimes(1)
  })

  it("creates a new snapshot when coalesceKey differs or window expires", () => {
    const stack = new CanvasHistoryStack({ defaultCoalesceMs: 200 })
    const snapshotFactory = vi.fn(() => createSnapshot())

    stack.recordLazy(snapshotFactory, { coalesceKey: "op-1", now: 1000 })
    expect(snapshotFactory).toHaveBeenCalledTimes(1)

    // 换了不同的 key
    stack.recordLazy(snapshotFactory, { coalesceKey: "op-2", now: 1050 })
    expect(snapshotFactory).toHaveBeenCalledTimes(2)

    // 超过窗口时间
    stack.recordLazy(snapshotFactory, { coalesceKey: "op-2", now: 1300 })
    expect(snapshotFactory).toHaveBeenCalledTimes(3)
  })

  it("supports undo and redo seamlessly with lazy snapshots", () => {
    const stack = new CanvasHistoryStack()
    const snap1 = createSnapshot("step-1")
    const snap2 = createSnapshot("step-2")

    stack.recordLazy(() => snap1)

    const undone = stack.undo(snap2)
    expect(undone).toEqual(snap1)
    expect(stack.canRedo).toBe(true)

    const redone = stack.redo(snap1)
    expect(redone).toEqual(snap2)
  })
})

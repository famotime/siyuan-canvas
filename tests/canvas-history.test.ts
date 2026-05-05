import type { CanvasDocument } from "@/canvas/types"
import { describe, expect, it } from "vitest"
import {
  CanvasHistoryStack,
  cloneCanvasDocument,
} from "@/canvas/canvas-history"

function makeDoc(label: string): CanvasDocument {
  return {
    edges: [],
    nodes: [
      {
        color: "1",
        height: 100,
        id: `node-${label}`,
        text: label,
        type: "text",
        width: 200,
        x: 0,
        y: 0,
      },
    ],
  }
}

function makeSnapshot(label: string) {
  return {
    document: makeDoc(label),
    selectedEdgeId: "",
    selectedNodeId: `node-${label}`,
    selectedNodeIds: [`node-${label}`],
  }
}

describe("CanvasHistoryStack", () => {
  it("starts empty without canUndo/canRedo", () => {
    const history = new CanvasHistoryStack()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it("records snapshots and exposes canUndo", () => {
    const history = new CanvasHistoryStack()
    history.record(makeSnapshot("a"))
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it("undoes back to the previous snapshot and pushes current onto redo", () => {
    const history = new CanvasHistoryStack()
    history.record(makeSnapshot("a"))
    const previous = history.undo(makeSnapshot("b"))
    expect(previous?.document.nodes[0].text).toBe("a")
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(true)
  })

  it("redoes forward to the next snapshot", () => {
    const history = new CanvasHistoryStack()
    history.record(makeSnapshot("a"))
    history.undo(makeSnapshot("b"))
    const next = history.redo(makeSnapshot("a"))
    expect(next?.document.nodes[0].text).toBe("b")
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)
  })

  it("clears redo stack on new record (linear history)", () => {
    const history = new CanvasHistoryStack()
    history.record(makeSnapshot("a"))
    history.undo(makeSnapshot("b"))
    expect(history.canRedo).toBe(true)

    history.record(makeSnapshot("c"))
    expect(history.canRedo).toBe(false)
  })

  it("returns null when nothing to undo or redo", () => {
    const history = new CanvasHistoryStack()
    expect(history.undo(makeSnapshot("a"))).toBeNull()
    expect(history.redo(makeSnapshot("a"))).toBeNull()
  })

  it("respects capacity by dropping the oldest record", () => {
    const history = new CanvasHistoryStack({ capacity: 2 })
    history.record(makeSnapshot("a"))
    history.record(makeSnapshot("b"))
    history.record(makeSnapshot("c"))

    // 容量 2，最早的 a 已被丢弃；栈剩下 [b, c]。
    // undo 弹出栈顶 c，再 undo 弹出 b，之后栈空
    const first = history.undo(makeSnapshot("d"))
    expect(first?.document.nodes[0].text).toBe("c")

    const second = history.undo(makeSnapshot("d"))
    expect(second?.document.nodes[0].text).toBe("b")

    expect(history.canUndo).toBe(false)
  })

  it("clears all stacks on clear()", () => {
    const history = new CanvasHistoryStack()
    history.record(makeSnapshot("a"))
    history.undo(makeSnapshot("b"))
    history.clear()
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })
})

describe("cloneCanvasDocument", () => {
  it("returns a deep copy independent from the original", () => {
    const original = makeDoc("a")
    const clone = cloneCanvasDocument(original)
    clone.nodes[0].text = "mutated"
    expect(original.nodes[0].text).toBe("a")
  })
})

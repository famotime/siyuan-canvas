/* @vitest-environment jsdom */

import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"

import { createCanvasBlockJumpHighlighter } from "@/canvas/block-jump-highlight"

function createPluginBridgeMock() {
  const handlers = new Map<string, Array<(event: any) => void>>()
  return {
    plugin: {
      eventBus: {
        off(name: string, fn: (event: any) => void) {
          const list = handlers.get(name) ?? []
          handlers.set(name, list.filter(item => item !== fn))
        },
        on(name: string, fn: (event: any) => void) {
          const list = handlers.get(name) ?? []
          list.push(fn)
          handlers.set(name, list)
        },
      },
    } as any,
    emit(name: string, detail: any) {
      for (const fn of handlers.get(name) ?? []) {
        fn({ detail })
      }
    },
  }
}

describe("createCanvasBlockJumpHighlighter", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  it("ref-counts the shared highlight stylesheet across multiple highlighter instances", () => {
    const busA = createPluginBridgeMock()
    const busB = createPluginBridgeMock()

    const highlighterA = createCanvasBlockJumpHighlighter(busA.plugin)
    const highlighterB = createCanvasBlockJumpHighlighter(busB.plugin)

    const protyleA = document.createElement("div")
    protyleA.innerHTML = `<div data-node-id="b-1" data-type="NodeParagraph">A</div>`
    const protyleB = document.createElement("div")
    protyleB.innerHTML = `<div data-node-id="b-2" data-type="NodeParagraph">B</div>`

    highlighterA.requestBlockHighlight("b-1")
    busA.emit("loaded-protyle-static", { protyle: { element: protyleA } })
    highlighterB.requestBlockHighlight("b-2")
    busB.emit("loaded-protyle-static", { protyle: { element: protyleB } })

    expect(document.getElementById("siyuan-canvas-block-jump-highlight-style")).not.toBeNull()

    // Disposing A must keep the style sheet alive for B
    highlighterA.dispose()
    expect(document.getElementById("siyuan-canvas-block-jump-highlight-style")).not.toBeNull()

    // Disposing B removes the style sheet once ref-count drops to 0
    highlighterB.dispose()
    expect(document.getElementById("siyuan-canvas-block-jump-highlight-style")).toBeNull()
  })
})

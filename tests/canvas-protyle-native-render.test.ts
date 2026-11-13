/* @vitest-environment jsdom */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { renderMermaidBlocksDirectly } from "@/canvas/protyle-native-render"

describe("protyle-native-render script loader", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    delete (window as any).mermaid
    delete (window as any).Protyle
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shares a single pending script load and removes failed script tags so retries succeed", async () => {
    const container = document.createElement("div")
    container.innerHTML = `<div data-subtype="mermaid">graph TD; A-->B;</div>`

    // Trigger two concurrent renders before mermaid loads
    const firstRender = renderMermaidBlocksDirectly(container)
    const secondRender = renderMermaidBlocksDirectly(container)

    const scriptsAfterFirst = document.head.querySelectorAll("#siyuan-canvas-mermaid-js")
    expect(scriptsAfterFirst).toHaveLength(1)

    // Simulate script failure -> broken <script> element must be removed cleanly
    const failedScript = scriptsAfterFirst[0] as HTMLScriptElement
    failedScript.onerror?.(new Event("error"))
    await Promise.all([firstRender, secondRender])

    expect(document.head.querySelector("#siyuan-canvas-mermaid-js")).toBeNull()

    // Retry should create a new <script> and succeed cleanly
    const retryRender = renderMermaidBlocksDirectly(container)
    const retryScript = document.head.querySelector("#siyuan-canvas-mermaid-js") as HTMLScriptElement | null
    expect(retryScript).not.toBeNull()

    ;(window as any).mermaid = {
      initialize: vi.fn(),
      render: vi.fn(async () => ({ svg: "<svg>ok</svg>" })),
    }
    retryScript?.onload?.(new Event("load"))
    await retryRender

    expect((window as any).mermaid.initialize).toHaveBeenCalledTimes(1)
    expect((window as any).mermaid.render).toHaveBeenCalledTimes(1)
    expect(container.querySelector("svg")?.textContent).toBe("ok")
  })
})

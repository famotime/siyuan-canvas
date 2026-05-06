/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
} from "vitest"
import { mount } from "@vue/test-utils"
import { reactive, ref } from "vue"

import CanvasMinimap from "@/components/canvas/CanvasMinimap.vue"

interface MinimapEditor {
  board: { width: number, height: number, left: number, top: number }
  state: { document: { nodes: any[] }, selectedNodeIds: string[] }
  viewport: { scale: number, x: number, y: number }
  stageRef: { value?: HTMLElement }
}

function makeStage(width = 1200, height = 800): { value: HTMLElement } {
  const div = document.createElement("div")
  Object.defineProperty(div, "getBoundingClientRect", {
    value: () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON: () => "" }),
    configurable: true,
  })
  return { value: div }
}

function makeEditor(overrides: Partial<MinimapEditor> = {}): MinimapEditor {
  return reactive({
    board: { width: 4000, height: 3000, left: -2000, top: -1500 },
    state: {
      document: {
        nodes: [
          { id: "n1", type: "text", text: "hi", x: 0, y: 0, width: 200, height: 100 },
          { id: "n2", type: "text", text: "hi", x: 400, y: 200, width: 200, height: 100 },
        ],
      },
      selectedNodeIds: [],
    },
    viewport: { scale: 1, x: 0, y: 0 },
    stageRef: makeStage(),
    ...overrides,
  }) as MinimapEditor
}

describe("CanvasMinimap", () => {
  it("does not render when document has no nodes", () => {
    const editor = makeEditor({
      state: { document: { nodes: [] }, selectedNodeIds: [] },
    })

    const wrapper = mount(CanvasMinimap, { props: { editor } })

    expect(wrapper.find("[data-testid='canvas-minimap']").exists()).toBe(false)
  })

  it("renders one rect per node", () => {
    const editor = makeEditor()
    const wrapper = mount(CanvasMinimap, { props: { editor } })

    expect(wrapper.find("[data-testid='canvas-minimap']").exists()).toBe(true)
    const nodeRects = wrapper.findAll(".canvas-minimap__node")
    expect(nodeRects.length).toBe(2)
  })

  it("highlights selected nodes with the accent color class", () => {
    const editor = makeEditor()
    editor.state.selectedNodeIds = ["n1"]
    const wrapper = mount(CanvasMinimap, { props: { editor } })

    const selected = wrapper.findAll(".canvas-minimap__node--selected")
    expect(selected.length).toBe(1)
  })

  it("renders a viewport rect when viewport.scale > 0", () => {
    const editor = makeEditor()
    const wrapper = mount(CanvasMinimap, { props: { editor } })

    expect(wrapper.find(".canvas-minimap__viewport").exists()).toBe(true)
  })

  it("clicking the minimap recenters the viewport", async () => {
    const editor = makeEditor()
    const wrapper = mount(CanvasMinimap, { props: { editor } })

    const minimap = wrapper.find("[data-testid='canvas-minimap']")
    const minimapEl = minimap.element as HTMLElement
    Object.defineProperty(minimapEl, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 180, height: 120, right: 180, bottom: 120, x: 0, y: 0, toJSON: () => "" }),
      configurable: true,
    })

    // 直接派发原生 PointerEvent；@vue/test-utils 的 trigger 不允许覆盖 clientX 等 readonly 属性
    const event = new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 90,
      clientY: 60,
      button: 0,
      pointerId: 1,
    })
    minimapEl.dispatchEvent(event)
    await wrapper.vm.$nextTick()

    // 视口被居中到点击点；具体值取决于 board / scale，但应该不为 0,0
    expect(editor.viewport.x).not.toBe(0)
    expect(editor.viewport.y).not.toBe(0)
  })
})

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

  it("uses node bounding box for bounds instead of fixed board", () => {
    // 两个紧凑节点 (0,0)→(600,300)，缩略图应紧密贴合，不使用固定的大坐标空间
    const editor = makeEditor()
    const wrapper = mount(CanvasMinimap, { props: { editor } })

    // 每个节点的 rect 应该在 SVG 内可见
    const nodeRects = wrapper.findAll(".canvas-minimap__node")
    expect(nodeRects.length).toBe(2)

    // 节点尺寸应大于最小值 2px（因为缩略图范围紧凑，比例尺更大）
    const w1 = Number(nodeRects[0].attributes("width"))
    expect(w1).toBeGreaterThan(2)
  })

  it("adapts range when nodes are spread further apart", async () => {
    const editor = makeEditor()
    const wrapper = mount(CanvasMinimap, { props: { editor } })

    // 记录初始第一个节点的宽度（宽度受缩放比例影响）
    const getFirstNodeWidth = () => {
      const rect = wrapper.findAll(".canvas-minimap__node")[0]
      return Number(rect.attributes("width"))
    }
    const initialWidth = getFirstNodeWidth()

    // 将第二个节点移动到更远的位置，扩大节点边界
    editor.state.document.nodes = [
      { id: "n1", type: "text", text: "hi", x: 0, y: 0, width: 200, height: 100 },
      { id: "n2", type: "text", text: "hi", x: 4000, y: 3000, width: 200, height: 100 },
    ]
    await wrapper.vm.$nextTick()

    // 边界变大后缩放比例变小，节点 rect 宽度应变小
    const newWidth = getFirstNodeWidth()
    expect(newWidth).toBeLessThan(initialWidth)
  })
})

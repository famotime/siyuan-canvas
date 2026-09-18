/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"
import { ref } from "vue"
import zhCN from "@/i18n/zh_CN.json"
import CanvasDock from "@/components/canvas/CanvasDock.vue"

function createPluginMock(overrides: Record<string, unknown> = {}) {
  const activeEditor = ref<any>(null)
  return {
    activeEditor,
    getCanvasSettings: vi.fn(() => ({
      defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas",
      colorTheme: "classic",
    })),
    getRecentCanvasFiles: vi.fn(() => [
      { path: "/data/storage/petal/siyuan-canvas/recent.canvas", title: "recent.canvas" },
    ]),
    removeRecentCanvasFile: vi.fn(),
    openCanvasTab: vi.fn(),
    i18n: zhCN,
    ...overrides,
  }
}

describe("CanvasDock", () => {
  it("renders documents tab with toolbar and workspace tree", async () => {
    const plugin = createPluginMock()
    const wrapper = mount(CanvasDock, {
      props: {
        plugin: plugin as any,
      },
    })

    // 默认在 documents tab
    expect(wrapper.find("[data-testid='inspector-tabs']").exists()).toBe(true)
    const tabs = wrapper.findAll(".inspector__tab")
    expect(tabs.length).toBe(2)
    expect(tabs[0].classes()).toContain("inspector__tab--active")

    // 无 activeEditor 时 selection tab 处于 disabled 状态
    expect(tabs[1].classes()).toContain("inspector__tab--disabled")

    // 工具栏按钮存在
    const buttons = wrapper.findAll(".inspector__toolbar-button")
    expect(buttons.length).toBe(4) // new-canvas, new-folder, sort, expand-all
  })

  it("switches to selection tab when editor is active and back when closed", async () => {
    const plugin = createPluginMock()
    const wrapper = mount(CanvasDock, {
      props: {
        plugin: plugin as any,
      },
    })

    const tabs = wrapper.findAll(".inspector__tab")
    expect(tabs[1].classes()).toContain("inspector__tab--disabled")

    // 激活一个 editor
    plugin.activeEditor.value = {
      state: {
        filePath: "/data/storage/petal/siyuan-canvas/active.canvas",
        selectedNodeIds: ["node-1"],
        selectedEdgeId: "",
        document: { nodes: [], edges: new Map() },
      },
      selectedNodeCount: 1,
      selectedEdge: null,
      inspectorSectionState: { node: true, edge: true },
    }

    await wrapper.vm.$nextTick()
    expect(tabs[1].classes()).not.toContain("inspector__tab--disabled")

    // 点击切换到 selection tab
    await tabs[1].trigger("click")
    await wrapper.vm.$nextTick()
    expect(tabs[1].classes()).toContain("inspector__tab--active")

    // 关闭 editor 时应自动切回 documents tab
    plugin.activeEditor.value = null
    await wrapper.vm.$nextTick()
    expect(tabs[0].classes()).toContain("inspector__tab--active")
  })

  it("toggles sections and sorts independently without activeEditor", async () => {
    const plugin = createPluginMock()
    const wrapper = mount(CanvasDock, {
      props: {
        plugin: plugin as any,
      },
    })

    // 点击折叠 document section
    const toggles = wrapper.findAll(".inspector__section-toggle")
    expect(toggles.length).toBe(2)
    await toggles[0].trigger("click")
    await wrapper.vm.$nextTick()

    // 排序菜单交互
    const sortBtn = wrapper.find(".inspector__toolbar-button[aria-label='排序']")
    expect(sortBtn.exists()).toBe(true)
    await sortBtn.trigger("click")
    await wrapper.vm.$nextTick()

    const sortDropdown = wrapper.find(".inspector__sort-dropdown")
    expect(sortDropdown.exists()).toBe(true)
  })

  it("closes context menu on Escape key", async () => {
    const plugin = createPluginMock()
    const wrapper = mount(CanvasDock, {
      props: {
        plugin: plugin as any,
      },
    })

    // 模拟按下 Escape 键
    const event = new KeyboardEvent("keydown", { key: "Escape" })
    document.dispatchEvent(event)
    await wrapper.vm.$nextTick()

    expect(wrapper.find(".workspace-context-menu").exists()).toBe(false)
  })
})

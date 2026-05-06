/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"

import CanvasCommandPalette from "@/components/canvas/CanvasCommandPalette.vue"

function makeEditor(overrides: Record<string, any> = {}) {
  return {
    state: { document: { nodes: [] }, filePath: "" },
    recentFiles: [],
    newCanvas: vi.fn(),
    triggerImport: vi.fn(),
    save: vi.fn(),
    exportCanvas: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomToActualSize: vi.fn(),
    zoomToFit: vi.fn(),
    resetViewport: vi.fn(),
    openRecentFile: vi.fn(),
    selectNode: vi.fn(),
    centerSelectionInViewport: vi.fn(),
    ...overrides,
  }
}

const t = (key: string) => key

describe("CanvasCommandPalette", () => {
  it("does not render when open is false", () => {
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: false, editor: makeEditor(), t },
    })

    expect(wrapper.find("[data-testid='command-palette']").exists()).toBe(false)
  })

  it("lists built-in commands when open with empty query", () => {
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor: makeEditor(), t },
    })

    const items = wrapper.findAll(".command-palette__item")
    expect(items.length).toBeGreaterThan(0)

    const text = wrapper.find("[data-testid='command-palette']").text()
    expect(text).toContain("toolbarSave")
    expect(text).toContain("toolbarUndo")
    expect(text).toContain("toolbarZoomIn")
  })

  it("filters items by query against title and keywords", async () => {
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor: makeEditor(), t },
    })

    await wrapper.find(".command-palette__input").setValue("toolbarSave")
    const titles = wrapper.findAll(".command-palette__item-title").map((node) => node.text())
    expect(titles).toContain("toolbarSave")
    expect(titles).not.toContain("toolbarZoomIn")
  })

  it("shows recent files as palette entries", () => {
    const editor = makeEditor({
      recentFiles: [
        { path: "/foo/bar.canvas", title: "Bar", sourceType: "workspace" },
      ],
    })
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor, t },
    })

    expect(wrapper.find("[data-testid='command-palette']").text()).toContain("Bar")
    expect(wrapper.find("[data-testid='command-palette']").text()).toContain("/foo/bar.canvas")
  })

  it("shows nodes as palette entries with node titles", () => {
    const editor = makeEditor({
      state: {
        filePath: "",
        document: {
          nodes: [
            { id: "n1", type: "text", text: "Hello world\nsecond", x: 0, y: 0, width: 100, height: 100 },
            { id: "n2", type: "link", url: "https://example.com", x: 0, y: 0, width: 100, height: 100 },
          ],
        },
      },
    })
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor, t },
    })

    const text = wrapper.find("[data-testid='command-palette']").text()
    expect(text).toContain("Hello world")
    expect(text).toContain("https://example.com")
  })

  it("executes a command on click and emits close", async () => {
    const editor = makeEditor()
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor, t },
    })

    await wrapper.find("[data-testid='command-palette-item-0']").trigger("click")
    // 第 0 个项是 cmd:new → newCanvas
    expect(editor.newCanvas).toHaveBeenCalledOnce()
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("navigates with arrow keys and runs the selected entry on enter", async () => {
    const editor = makeEditor()
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor, t },
    })

    const input = wrapper.find(".command-palette__input")
    await input.trigger("keydown", { key: "ArrowDown" })
    await input.trigger("keydown", { key: "Enter" })
    // 第二个命令是 cmd:open → triggerImport
    expect(editor.triggerImport).toHaveBeenCalledOnce()
  })

  it("emits close on escape", async () => {
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor: makeEditor(), t },
    })

    await wrapper.find(".command-palette__input").trigger("keydown", { key: "Escape" })
    expect(wrapper.emitted("close")).toBeTruthy()
  })

  it("renders no-results message when filter matches nothing", async () => {
    const wrapper = mount(CanvasCommandPalette, {
      props: { open: true, editor: makeEditor(), t },
    })

    await wrapper.find(".command-palette__input").setValue("xyzzy_nothing_matches")
    expect(wrapper.find(".command-palette__empty").exists()).toBe(true)
  })
})

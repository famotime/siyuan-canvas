/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"
import {
  defineComponent,
  h,
  nextTick,
} from "vue"
import { useCanvasEditor } from "@/canvas/use-canvas-editor"
import {
  centerViewportOnBounds,
  resolveDragNodeIds,
  resolveSelectionToolbarPosition,
} from "@/canvas/selection-toolbar"

vi.mock("@/api", () => ({
  findSiyuanAssetByPath: vi.fn(async () => null),
  findSiyuanDocumentByPath: vi.fn(async () => null),
}))

describe("selection toolbar helpers", () => {
  it("preserves viewport scale while centering bounds in the stage", () => {
    const next = centerViewportOnBounds(
      { scale: 1.5, x: 40, y: 60 },
      { width: 900, height: 600 },
      { x: 200, y: 100, width: 300, height: 200 },
      { left: 50, top: 20 },
    )

    expect(next).toEqual({
      scale: 1.5,
      x: 0,
      y: 30,
    })
  })

  it("places the toolbar above the selection and flips below near the top edge", () => {
    expect(resolveSelectionToolbarPosition(
      { x: 100, y: 120, width: 280, height: 160 },
      { width: 900, height: 700 },
      { width: 220, height: 48 },
    )).toEqual({
      placement: "top",
      x: 130,
      y: 64,
    })

    expect(resolveSelectionToolbarPosition(
      { x: 100, y: 8, width: 280, height: 160 },
      { width: 900, height: 700 },
      { width: 220, height: 48 },
    )).toEqual({
      placement: "bottom",
      x: 130,
      y: 176,
    })
  })

  it("includes enclosed nodes when dragging a group node", () => {
    const document = {
      nodes: [
        { id: "group-1", type: "group", label: "Group", x: 0, y: 0, width: 300, height: 220 },
        { id: "n1", type: "text", text: "one", x: 20, y: 20, width: 120, height: 80 },
        { id: "n2", type: "text", text: "two", x: 260, y: 170, width: 80, height: 80 },
      ],
      edges: [],
    }

    expect(resolveDragNodeIds(document, "group-1", ["group-1"])).toEqual(["group-1", "n1"])
  })
})

describe("useCanvasEditor selection toolbar integration", () => {
  it("closes the open selection popover on Escape", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = {
      app: {},
    }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          {
            id: "n1",
            type: "text",
            text: "one",
            x: 100,
            y: 120,
            width: 180,
            height: 90,
          },
        ],
        edges: [],
      }),
    }

    const Harness = defineComponent({
      setup() {
        editor = useCanvasEditor(plugin as any, bootstrap, vi.fn())
        return () => h("div")
      },
    })

    const wrapper = mount(Harness)
    await nextTick()

    editor.selectNode("n1")
    editor.toggleSelectionPopover("color")
    expect(editor.selectionToolbarPopover).toBe("color")

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await nextTick()

    expect(editor.selectionToolbarPopover).toBe("closed")

    wrapper.unmount()
  })
})

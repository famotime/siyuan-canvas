/* @vitest-environment jsdom */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

vi.mock("siyuan", () => ({
  confirm: vi.fn(),
  showMessage: vi.fn(),
}))

import { createDefaultCanvasPluginSettings } from "@/canvas/plugin-data"
import { openCanvasPluginSettingsPanel } from "@/canvas/plugin-settings-panel"

class MockSetting {
  public root = document.createElement("div")
  public open = vi.fn()

  constructor() {
    document.body.appendChild(this.root)
  }

  addItem(item: {
    actionElement?: HTMLElement
    createActionElement?: () => HTMLElement
    description?: string
    title?: string
  }) {
    const wrapper = document.createElement("div")
    wrapper.className = "b3-label"
    const el = item.createActionElement ? item.createActionElement() : item.actionElement
    if (el) {
      wrapper.appendChild(el)
    }
    this.root.appendChild(wrapper)
  }
}

describe("openCanvasPluginSettingsPanel", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  it("deduplicates window ai-config-changed listeners across openings and auto-cleans on DOM removal", async () => {
    const addSpy = vi.spyOn(window, "addEventListener")
    const removeSpy = vi.spyOn(window, "removeEventListener")

    const createSetting = () => new MockSetting() as any

    const first = openCanvasPluginSettingsPanel({
      createSetting,
      getSettings: () => createDefaultCanvasPluginSettings(),
      pluginName: "siyuan-canvas",
      saveSettings: vi.fn(async () => {}),
      t: (key: string) => key,
    }) as unknown as MockSetting

    const second = openCanvasPluginSettingsPanel({
      createSetting,
      getSettings: () => createDefaultCanvasPluginSettings(),
      pluginName: "siyuan-canvas",
      saveSettings: vi.fn(async () => {}),
      t: (key: string) => key,
    }) as unknown as MockSetting

    expect(addSpy.mock.calls.filter(c => c[0] === "siyuan-canvas:ai-config-changed")).toHaveLength(2)
    expect(removeSpy.mock.calls.filter(c => c[0] === "siyuan-canvas:ai-config-changed")).toHaveLength(1)

    // Remove DOM containers without firing custom events -> MutationObserver cleans up listener automatically
    first.root.remove()
    second.root.remove()
    await vi.waitFor(() => {
      expect(removeSpy.mock.calls.filter(c => c[0] === "siyuan-canvas:ai-config-changed").length).toBeGreaterThanOrEqual(2)
    })
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

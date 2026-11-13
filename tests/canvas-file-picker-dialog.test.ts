/* @vitest-environment jsdom */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const fetchSyncPost = vi.fn()

vi.mock("siyuan", () => {
  class Dialog {
    public element: HTMLElement
    private readonly destroyCallback?: () => void

    constructor(options: { content: string, destroyCallback?: () => void }) {
      this.destroyCallback = options.destroyCallback
      this.element = document.createElement("div")
      this.element.innerHTML = options.content
      document.body.appendChild(this.element)
    }

    destroy() {
      this.element.remove()
      this.destroyCallback?.()
    }
  }

  return { Dialog }
})

vi.mock("@/api", () => ({
  readDir: vi.fn(async (path: string) => {
    return fetchSyncPost("/api/file/readDir", { path })
  }),
}))

import { openCanvasFilePickerDialog } from "@/canvas/canvas-file-picker-dialog"

const defaultOptions = {
  cancelLabel: "取消",
  confirmLabel: "确认",
  noResultsLabel: "未找到匹配的 Canvas 文件",
  searchPlaceholder: "搜索 Canvas 文件名…",
  title: "选择 Canvas 文件",
  defaultDirectory: "/data/storage/siyuan-canvas",
  insertLinkSwitchLabel: "插入链接",
}

function getInput(): HTMLInputElement {
  return document.querySelector("[data-canvas-file-picker-input]") as HTMLInputElement
}

function getListItems(): HTMLElement[] {
  return [...document.querySelectorAll("[data-canvas-file-picker-index]")] as HTMLElement[]
}

function getEmptyMessage(): string | null {
  return document.querySelector(".canvas-file-picker__empty")?.textContent ?? null
}

function getConfirmButton(): HTMLButtonElement {
  return document.querySelector("[data-canvas-file-picker-confirm]") as HTMLButtonElement
}

function getCancelButton(): HTMLButtonElement {
  return document.querySelector("[data-canvas-file-picker-cancel]") as HTMLButtonElement
}

function getModeSwitch(): HTMLInputElement {
  return document.querySelector("[data-canvas-file-picker-mode-switch]") as HTMLInputElement
}

describe("openCanvasFilePickerDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.clearAllMocks()
  })

  it("loads canvas files from the default directory and displays them", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "roadmap.canvas", updated: 1000 },
      { isDir: false, name: "notes.canvas", updated: 2000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(2)
    })

    const items = getListItems()
    expect(items[0].querySelector(".canvas-file-picker__item-name")?.textContent).toBe("roadmap.canvas")
    expect(items[0].querySelector(".canvas-file-picker__item-path")?.textContent).toBe("/data/storage/siyuan-canvas/roadmap.canvas")
    expect(items[1].querySelector(".canvas-file-picker__item-name")?.textContent).toBe("notes.canvas")

    // Cancel to close the dialog
    getCancelButton().click()
    expect(await promise).toBeNull()
  })

  it("recursively collects canvas files from subdirectories", async () => {
    fetchSyncPost.mockImplementation(async (url: string, data: { path?: string }) => {
      if (url === "/api/file/readDir") {
        if (data.path === "/data/storage/siyuan-canvas") {
          return [
            { isDir: true, name: "subfolder", updated: 0 },
            { isDir: false, name: "root.canvas", updated: 1000 },
          ]
        }
        if (data.path === "/data/storage/siyuan-canvas/subfolder") {
          return [
            { isDir: false, name: "nested.canvas", updated: 2000 },
          ]
        }
      }
      return []
    })

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(2)
    })

    const items = getListItems()
    expect(items[0].querySelector(".canvas-file-picker__item-name")?.textContent).toBe("nested.canvas")
    expect(items[0].querySelector(".canvas-file-picker__item-path")?.textContent).toBe("/data/storage/siyuan-canvas/subfolder/nested.canvas")
    expect(items[1].querySelector(".canvas-file-picker__item-name")?.textContent).toBe("root.canvas")

    getCancelButton().click()
    await promise
  })

  it("filters files by name as user types", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "roadmap.canvas", updated: 1000 },
      { isDir: false, name: "notes.canvas", updated: 2000 },
      { isDir: false, name: "project-plan.canvas", updated: 3000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(3)
    })

    const input = getInput()
    input.value = "road"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    const items = getListItems()
    expect(items).toHaveLength(1)
    expect(items[0].querySelector(".canvas-file-picker__item-name")?.textContent).toBe("roadmap.canvas")

    getCancelButton().click()
    await promise
  })

  it("shows empty message when no files match", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "roadmap.canvas", updated: 1000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(1)
    })

    const input = getInput()
    input.value = "nonexistent"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(getListItems()).toHaveLength(0)
    expect(getEmptyMessage()).toBe("未找到匹配的 Canvas 文件")

    getCancelButton().click()
    await promise
  })

  it("confirms with selected file path on confirm button click", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "roadmap.canvas", updated: 1000 },
      { isDir: false, name: "notes.canvas", updated: 2000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(2)
    })

    getConfirmButton().click()
    expect(await promise).toEqual({
      path: "/data/storage/siyuan-canvas/roadmap.canvas",
      mode: "preview",
    })
  })

  it("confirms with selected file path on item click", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "roadmap.canvas", updated: 1000 },
      { isDir: false, name: "notes.canvas", updated: 2000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(2)
    })

    getListItems()[1].click()
    expect(await promise).toEqual({
      path: "/data/storage/siyuan-canvas/notes.canvas",
      mode: "preview",
    })
  })

  it("uses typed text as path when no files match and confirm is clicked", async () => {
    fetchSyncPost.mockResolvedValueOnce([])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getEmptyMessage()).toBeTruthy()
    })

    const input = getInput()
    input.value = "/custom/path/manual.canvas"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    getConfirmButton().click()
    expect(await promise).toEqual({
      path: "/custom/path/manual.canvas",
      mode: "preview",
    })
  })

  it("navigates with ArrowDown and ArrowUp keys", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "a.canvas", updated: 1000 },
      { isDir: false, name: "b.canvas", updated: 2000 },
      { isDir: false, name: "c.canvas", updated: 3000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(3)
    })

    const input = getInput()

    // First item is active by default
    expect(document.querySelector(".canvas-file-picker__item--active")?.textContent).toContain("a.canvas")

    // ArrowDown
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    expect(document.querySelector(".canvas-file-picker__item--active")?.textContent).toContain("b.canvas")

    // ArrowDown again
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    expect(document.querySelector(".canvas-file-picker__item--active")?.textContent).toContain("c.canvas")

    // ArrowDown at end stays on last
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    expect(document.querySelector(".canvas-file-picker__item--active")?.textContent).toContain("c.canvas")

    // ArrowUp
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }))
    expect(document.querySelector(".canvas-file-picker__item--active")?.textContent).toContain("b.canvas")

    getCancelButton().click()
    await promise
  })

  it("confirms with Enter key on active item", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "a.canvas", updated: 1000 },
      { isDir: false, name: "b.canvas", updated: 2000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(2)
    })

    const input = getInput()
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))

    expect(await promise).toEqual({
      path: "/data/storage/siyuan-canvas/b.canvas",
      mode: "preview",
    })
  })

  it("returns mode 'link' when the mode switch is checked", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "demo.canvas", updated: 1000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(1)
    })

    const modeSwitch = getModeSwitch()
    expect(modeSwitch).toBeTruthy()
    expect(modeSwitch.checked).toBe(false)

    modeSwitch.checked = true
    modeSwitch.dispatchEvent(new Event("change", { bubbles: true }))

    getConfirmButton().click()
    expect(await promise).toEqual({
      path: "/data/storage/siyuan-canvas/demo.canvas",
      mode: "link",
    })
  })

  it("returns mode 'link' on item click when mode switch is checked", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "item1.canvas", updated: 1000 },
      { isDir: false, name: "item2.canvas", updated: 2000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(2)
    })

    const modeSwitch = getModeSwitch()
    modeSwitch.checked = true

    getListItems()[1].click()
    expect(await promise).toEqual({
      path: "/data/storage/siyuan-canvas/item2.canvas",
      mode: "link",
    })
  })

  it("cancels with Escape key", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "a.canvas", updated: 1000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(1)
    })

    const input = getInput()
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

    expect(await promise).toBeNull()
  })

  it("returns null when cancel button is clicked without selection", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "a.canvas", updated: 1000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(1)
    })

    getCancelButton().click()
    expect(await promise).toBeNull()
  })

  it("handles readDir failure gracefully", async () => {
    fetchSyncPost.mockRejectedValueOnce(new Error("network error"))

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getEmptyMessage()).toBeTruthy()
    })

    const input = getInput()
    input.value = "/fallback/path.canvas"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    getConfirmButton().click()
    expect(await promise).toEqual({
      path: "/fallback/path.canvas",
      mode: "preview",
    })
  })

  it("highlights item on mousemove", async () => {
    fetchSyncPost.mockResolvedValueOnce([
      { isDir: false, name: "a.canvas", updated: 1000 },
      { isDir: false, name: "b.canvas", updated: 2000 },
    ])

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      expect(getListItems()).toHaveLength(2)
    })

    // Simulate mousemove on the second item
    const secondItem = getListItems()[1]
    secondItem.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))

    // The second item should now be active
    expect(document.querySelector(".canvas-file-picker__item--active")?.textContent).toContain("b.canvas")

    getCancelButton().click()
    await promise
  })

  it("tracks error loadState cleanly and keeps valid index when ArrowDown is pressed on empty results", async () => {
    fetchSyncPost.mockRejectedValueOnce(new Error("boom"))

    const promise = openCanvasFilePickerDialog(defaultOptions)
    await vi.waitFor(() => {
      const list = document.querySelector("[data-canvas-file-picker-list]") as HTMLElement | null
      expect(list?.dataset.loadState).toBe("error")
    })

    const input = getInput()
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }))

    // Confirming while list is empty with whitespace input should not confirm undefined index or crash
    input.value = "   "
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))

    getCancelButton().click()
    expect(await promise).toBeNull()
  })
})

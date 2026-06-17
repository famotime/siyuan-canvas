/* @vitest-environment jsdom */

import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { useCanvasWorkspaceContextMenu } from "@/components/canvas/use-canvas-workspace-context-menu"

function mouseEvent(x: number, y: number): MouseEvent {
  return new MouseEvent("contextmenu", {
    clientX: x,
    clientY: y,
  })
}

describe("canvas workspace context menu", () => {
  it("opens and closes with path, type, and pointer coordinates", () => {
    const menu = useCanvasWorkspaceContextMenu({
      copyPath: vi.fn(),
      editor: {} as any,
      showCopyPathSuccess: vi.fn(),
    })

    menu.onContextMenu(mouseEvent(12, 34), "/a.canvas", "file")
    expect(menu.contextMenuVisible.value).toBe(true)
    expect(menu.contextMenuX.value).toBe(12)
    expect(menu.contextMenuY.value).toBe(34)
    expect(menu.contextMenuPath.value).toBe("/a.canvas")
    expect(menu.contextMenuType.value).toBe("file")

    menu.closeContextMenu()
    expect(menu.contextMenuVisible.value).toBe(false)
  })

  it("dispatches rename and delete based on the selected item type", () => {
    const editor = {
      deleteWorkspaceDocument: vi.fn(),
      deleteWorkspaceFolder: vi.fn(),
      renameWorkspaceDocument: vi.fn(),
      renameWorkspaceFolder: vi.fn(),
    }
    const menu = useCanvasWorkspaceContextMenu({
      copyPath: vi.fn(),
      editor: editor as any,
      showCopyPathSuccess: vi.fn(),
    })

    menu.onContextMenu(mouseEvent(0, 0), "/file.canvas", "file")
    menu.contextMenuRename()
    expect(editor.renameWorkspaceDocument).toHaveBeenCalledWith("/file.canvas")

    menu.onContextMenu(mouseEvent(0, 0), "/folder", "folder")
    menu.contextMenuRename()
    expect(editor.renameWorkspaceFolder).toHaveBeenCalledWith("/folder")
    menu.contextMenuDelete()
    expect(editor.deleteWorkspaceFolder).toHaveBeenCalledWith("/folder")
  })

  it("copies normalized file paths and reports success", async () => {
    const copyPath = vi.fn(async () => {})
    const showCopyPathSuccess = vi.fn()
    const menu = useCanvasWorkspaceContextMenu({
      copyPath,
      editor: {} as any,
      showCopyPathSuccess,
    })

    menu.onContextMenu(mouseEvent(0, 0), "data/canvas/a.canvas", "file")
    await menu.contextMenuCopyPath()

    expect(copyPath).toHaveBeenCalledWith("/data/canvas/a.canvas")
    expect(showCopyPathSuccess).toHaveBeenCalledOnce()
    expect(menu.contextMenuVisible.value).toBe(false)
  })
})

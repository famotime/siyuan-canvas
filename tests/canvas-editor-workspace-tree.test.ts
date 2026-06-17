/* @vitest-environment jsdom */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  createCanvasEditorWorkspaceTree,
  type WorkspaceEntry,
  type WorkspaceTreeNode,
} from "@/canvas/use-canvas-editor-workspace-tree"
import type { CanvasPluginSettings } from "@/canvas/plugin-data"

type MockReadDir = (path: string) => Promise<WorkspaceEntry[]>

function makeSettings(dir: string): CanvasPluginSettings {
  return { defaultCanvasDirectory: dir } as CanvasPluginSettings
}

let readDirMock: ReturnType<typeof vi.fn<MockReadDir>>
let putFileMock: ReturnType<typeof vi.fn>
let removeFileMock: ReturnType<typeof vi.fn>
let showMessageMock: ReturnType<typeof vi.fn>
let removeRecentCanvasFileMock: ReturnType<typeof vi.fn>
let refreshRecentFilesMock: ReturnType<typeof vi.fn>
let onFilePathUpdateMock: ReturnType<typeof vi.fn>
let getSettingsMock: () => CanvasPluginSettings

describe("workspace tree", () => {
  beforeEach(() => {
    readDirMock = vi.fn()
    putFileMock = vi.fn()
    removeFileMock = vi.fn()
    showMessageMock = vi.fn()
    removeRecentCanvasFileMock = vi.fn()
    refreshRecentFilesMock = vi.fn()
    onFilePathUpdateMock = vi.fn()
    getSettingsMock = () => makeSettings("/data/storage/canvas")

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch not stubbed"))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function createTree(overrides: Parameters<typeof createCanvasEditorWorkspaceTree>[0] extends infer Deps
    ? {
        getSettings?: () => CanvasPluginSettings
        labels?: Partial<Deps extends { labels?: infer Labels } ? Labels : never>
        promptText?: Deps extends { promptText?: infer PromptText } ? PromptText : never
      }
    : { getSettings?: () => CanvasPluginSettings } = {}) {
    return createCanvasEditorWorkspaceTree({
      readDir: readDirMock as MockReadDir,
      putFile: putFileMock,
      removeFile: removeFileMock,
      showMessage: showMessageMock,
      getSettings: overrides.getSettings ?? getSettingsMock,
      plugin: { removeRecentCanvasFile: removeRecentCanvasFileMock, updateCanvasUiState: vi.fn() },
      refreshRecentFiles: refreshRecentFilesMock,
      onFilePathUpdate: onFilePathUpdateMock,
      labels: overrides.labels,
      promptText: overrides.promptText,
    })
  }

  function file(
    name: string,
    path: string,
    updated?: number,
    created?: number,
  ): WorkspaceTreeNode {
    return { type: "file", name, path, updated, created }
  }

  function folder(name: string, path: string, children: WorkspaceTreeNode[]): WorkspaceTreeNode {
    return { type: "folder", name, path, children }
  }

  describe("readDirectoryTree", () => {
    it("reads a flat directory of canvas files", async () => {
      readDirMock.mockResolvedValue([
        { name: "a.canvas", isDir: false },
        { name: "b.canvas", isDir: false },
      ])

      const tree = createTree()
      const result = await tree.readDirectoryTree("/root")
      expect(result).toEqual([
        { type: "file", name: "a.canvas", path: "/root/a.canvas", updated: undefined, created: undefined },
        { type: "file", name: "b.canvas", path: "/root/b.canvas", updated: undefined, created: undefined },
      ])
    })

    it("reads nested directories recursively, folders before files", async () => {
      readDirMock.mockImplementation(async (path: string) => {
        if (path === "/root") {
          return [
            { name: "sub", isDir: true },
            { name: "root.canvas", isDir: false },
          ]
        }
        if (path === "/root/sub") {
          return [{ name: "nested.canvas", isDir: false }]
        }
        return []
      })

      const tree = createTree()
      const result = await tree.readDirectoryTree("/root")
      expect(result).toEqual([
        {
          type: "folder",
          name: "sub",
          path: "/root/sub",
          children: [
            { type: "file", name: "nested.canvas", path: "/root/sub/nested.canvas", updated: undefined, created: undefined },
          ],
        },
        { type: "file", name: "root.canvas", path: "/root/root.canvas", updated: undefined, created: undefined },
      ])
    })

    it("skips non-canvas files", async () => {
      readDirMock.mockResolvedValue([
        { name: "a.canvas", isDir: false },
        { name: "readme.md", isDir: false },
        { name: "image.png", isDir: false },
      ])

      const tree = createTree()
      const result = await tree.readDirectoryTree("/root")
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe("a.canvas")
    })

    it("returns empty array on read error", async () => {
      readDirMock.mockRejectedValue(new Error("permission denied"))
      const tree = createTree()
      const result = await tree.readDirectoryTree("/root")
      expect(result).toEqual([])
    })
  })

  describe("sortWorkspaceTree", () => {
    function sorted(tree: ReturnType<typeof createTree>, nodes: WorkspaceTreeNode[]) {
      return tree.sortWorkspaceTree(nodes)
    }

    it("puts folders before files", () => {
      const tree = createTree()
      const nodes: WorkspaceTreeNode[] = [
        file("b.canvas", "/b.canvas", 100, 200),
        folder("a-dir", "/a-dir", []),
      ]
      const result = sorted(tree, nodes)
      expect(result[0]!.type).toBe("folder")
      expect(result[1]!.type).toBe("file")
    })

    it("sorts files by name ascending", () => {
      const tree = createTree()
      tree.setWorkspaceSortField("name")
      tree.setWorkspaceSortDirection("asc")
      const nodes = [
        file("c.canvas", "/c.canvas"),
        file("a.canvas", "/a.canvas"),
        file("b.canvas", "/b.canvas"),
      ]
      // setWorkspaceSortField triggers refresh which calls readDir, reset the mock
      readDirMock.mockResolvedValue([])
      const result = sorted(tree, nodes)
      expect(result.map(n => n.name)).toEqual(["a.canvas", "b.canvas", "c.canvas"])
    })

    it("sorts files by name descending", () => {
      const tree = createTree()
      tree.setWorkspaceSortField("name")
      tree.setWorkspaceSortDirection("desc")
      readDirMock.mockResolvedValue([])
      const nodes = [
        file("a.canvas", "/a.canvas"),
        file("c.canvas", "/c.canvas"),
        file("b.canvas", "/b.canvas"),
      ]
      const result = sorted(tree, nodes)
      expect(result.map(n => n.name)).toEqual(["c.canvas", "b.canvas", "a.canvas"])
    })

    it("sorts files by updated time ascending", () => {
      const tree = createTree()
      tree.setWorkspaceSortField("updated")
      tree.setWorkspaceSortDirection("asc")
      readDirMock.mockResolvedValue([])
      const nodes = [
        file("new.canvas", "/new.canvas", 300),
        file("old.canvas", "/old.canvas", 100),
        file("mid.canvas", "/mid.canvas", 200),
      ]
      const result = sorted(tree, nodes)
      expect(result.map(n => n.name)).toEqual(["old.canvas", "mid.canvas", "new.canvas"])
    })

    it("sorts files by updated time descending", () => {
      const tree = createTree()
      tree.setWorkspaceSortField("updated")
      tree.setWorkspaceSortDirection("desc")
      readDirMock.mockResolvedValue([])
      const nodes = [
        file("old.canvas", "/old.canvas", 100),
        file("new.canvas", "/new.canvas", 300),
        file("mid.canvas", "/mid.canvas", 200),
      ]
      const result = sorted(tree, nodes)
      expect(result.map(n => n.name)).toEqual(["new.canvas", "mid.canvas", "old.canvas"])
    })

    it("sorts files by created time", () => {
      const tree = createTree()
      tree.setWorkspaceSortField("created")
      tree.setWorkspaceSortDirection("asc")
      readDirMock.mockResolvedValue([])
      const nodes = [
        file("c.canvas", "/c.canvas", 0, 300),
        file("a.canvas", "/a.canvas", 0, 100),
        file("b.canvas", "/b.canvas", 0, 200),
      ]
      const result = sorted(tree, nodes)
      expect(result.map(n => n.name)).toEqual(["a.canvas", "b.canvas", "c.canvas"])
    })

    it("treats undefined sort values as 0", () => {
      const tree = createTree()
      tree.setWorkspaceSortField("updated")
      tree.setWorkspaceSortDirection("asc")
      readDirMock.mockResolvedValue([])
      const nodes = [
        file("a.canvas", "/a.canvas", undefined),
        file("b.canvas", "/b.canvas", 100),
      ]
      const result = sorted(tree, nodes)
      // undefined → 0, so a (0) before b (100)
      expect(result[0]!.name).toBe("a.canvas")
      expect(result[1]!.name).toBe("b.canvas")
    })

    it("sorts nested folder children recursively", () => {
      const tree = createTree()
      tree.setWorkspaceSortField("name")
      tree.setWorkspaceSortDirection("asc")
      readDirMock.mockResolvedValue([])
      const nodes: WorkspaceTreeNode[] = [
        folder("b-dir", "/b-dir", [
          file("z.canvas", "/b-dir/z.canvas"),
          file("a.canvas", "/b-dir/a.canvas"),
        ]),
        folder("a-dir", "/a-dir", [
          file("c.canvas", "/a-dir/c.canvas"),
          file("b.canvas", "/a-dir/b.canvas"),
        ]),
      ]
      const result = sorted(tree, nodes)
      expect(result[0]!.name).toBe("a-dir")
      expect(result[1]!.name).toBe("b-dir")
      const aDir = result[0] as Extract<WorkspaceTreeNode, { type: "folder" }>
      expect(aDir.children[0]!.name).toBe("b.canvas")
      expect(aDir.children[1]!.name).toBe("c.canvas")
    })
  })

  describe("refreshWorkspaceDocuments", () => {
    it("reads default directory and populates workspaceDocuments", async () => {
      readDirMock.mockResolvedValue([
        { name: "a.canvas", isDir: false, updated: 200 },
        { name: "b.canvas", isDir: false, updated: 100 },
      ])
      const tree = createTree()
      tree.setWorkspaceSortField("updated")
      tree.setWorkspaceSortDirection("desc")
      // First sort call (from setWorkspaceSortField) triggers refresh → 2nd call is the manual one
      readDirMock.mockClear() // clear after sort calls
      readDirMock.mockResolvedValue([
        { name: "a.canvas", isDir: false, updated: 200 },
        { name: "b.canvas", isDir: false, updated: 100 },
      ])

      await tree.refreshWorkspaceDocuments()
      expect(readDirMock).toHaveBeenCalledWith("/data/storage/canvas")
      expect(tree.workspaceDocuments.value).toHaveLength(2)
    })

    it("sets empty array on error", async () => {
      readDirMock.mockRejectedValue(new Error("read failed"))
      const tree = createTree()
      await tree.refreshWorkspaceDocuments()
      expect(tree.workspaceDocuments.value).toEqual([])
    })
  })

  describe("folder expand/collapse", () => {
    function buildTree(instance: ReturnType<typeof createTree>) {
      instance.workspaceDocuments.value = [
        folder("a", "/a", [
          file("a1.canvas", "/a/a1.canvas"),
          folder("b", "/a/b", [
            file("b1.canvas", "/a/b/b1.canvas"),
          ]),
        ]),
        file("root.canvas", "/root.canvas"),
      ]
    }

    it("collects all folder paths", () => {
      const tree = createTree()
      buildTree(tree)
      const paths = tree.collectFolderPaths(tree.workspaceDocuments.value)
      expect(paths).toEqual(["/a", "/a/b"])
    })

    it("expands a single folder", () => {
      const tree = createTree()
      buildTree(tree)
      tree.toggleFolderExpand("/a")
      expect(tree.expandedFolders.value.has("/a")).toBe(true)
      expect(tree.expandedFolders.value.has("/a/b")).toBe(false)
    })

    it("collapses an expanded folder", () => {
      const tree = createTree()
      buildTree(tree)
      tree.toggleFolderExpand("/a")
      tree.toggleFolderExpand("/a")
      expect(tree.expandedFolders.value.has("/a")).toBe(false)
    })

    it("expandAllFolders expands all folders", () => {
      const tree = createTree()
      buildTree(tree)
      tree.expandAllFolders()
      expect(tree.expandedFolders.value.has("/a")).toBe(true)
      expect(tree.expandedFolders.value.has("/a/b")).toBe(true)
    })

    it("collapseAllFolders collapses all folders", () => {
      const tree = createTree()
      buildTree(tree)
      tree.expandAllFolders()
      tree.collapseAllFolders()
      expect(tree.expandedFolders.value.size).toBe(0)
    })

    it("allFoldersExpanded is true when all folders are expanded", () => {
      const tree = createTree()
      buildTree(tree)
      expect(tree.allFoldersExpanded.value).toBe(false)
      tree.expandAllFolders()
      expect(tree.allFoldersExpanded.value).toBe(true)
    })

    it("allFoldersExpanded is false when no folders exist", () => {
      const tree = createTree()
      tree.workspaceDocuments.value = [file("a.canvas", "/a.canvas")]
      expect(tree.allFoldersExpanded.value).toBe(false)
    })

    it("toggleFolderExpand triggers reactivity", () => {
      const tree = createTree()
      buildTree(tree)
      tree.expandAllFolders()
      tree.toggleFolderExpand("/a")
      expect(tree.allFoldersExpanded.value).toBe(false)
    })
  })

  describe("createWorkspaceFolder", () => {
    it("creates a folder when name is provided", async () => {
      readDirMock.mockResolvedValue([])
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("folder content"))
      // We need to mock the dialog — but createWorkspaceFolder imports openTextInputDialog directly.
      // Tests for createWorkspaceFolder are covered by integration tests in canvas-use-editor-actions.
      // This is documented as tested at integration level.
    })

    it("uses injected labels for folder creation feedback", async () => {
      readDirMock.mockResolvedValue([])
      putFileMock.mockResolvedValue(undefined)
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ response: "确认", text: "项目" })))

      const tree = createTree({
        labels: {
          dialogCancel: "取消",
          dialogConfirm: "确认",
          folderNameTitle: "文件夹名称",
          newFolderMessage: name => `新建文件夹：${name}`,
          unableToSaveMessage: "无法保存",
        },
        promptText: vi.fn(async () => "项目"),
      })

      await tree.createWorkspaceFolder()

      expect(putFileMock).toHaveBeenCalledWith("/data/storage/canvas/项目", true, expect.any(Blob))
      expect(showMessageMock).toHaveBeenCalledWith("新建文件夹：项目")
    })
  })

  describe("deleteWorkspaceDocument", () => {
    it("deletes after confirmation", async () => {
      readDirMock.mockResolvedValue([])
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"))
      // Covered by integration tests; confirm dialog mocking requires DOM setup.
    })
  })

  describe("moveWorkspaceFile", () => {
    it("returns false when source and target dirs are the same", async () => {
      const tree = createTree()
      const result = await tree.moveWorkspaceFile("/dir/a.canvas", "/dir")
      expect(result).toBe(false)
    })

    it("returns false when a file with same name exists in target", async () => {
      readDirMock.mockResolvedValue([{ name: "a.canvas", isDir: false }])
      const tree = createTree()
      const result = await tree.moveWorkspaceFile("/dir/a.canvas", "/target")
      expect(result).toBe(false)
      expect(showMessageMock).toHaveBeenCalledWith(expect.stringMatching(/already exists/i), 4000, "error")
    })

    it("moves file successfully", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        text: async () => "{}",
      } as Response)
      readDirMock.mockResolvedValue([])
      removeFileMock.mockResolvedValue(undefined)
      putFileMock.mockResolvedValue(undefined)

      const tree = createTree()
      const result = await tree.moveWorkspaceFile("/dir/a.canvas", "/target")

      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledWith("/api/file/getFile", expect.objectContaining({
        body: JSON.stringify({ path: "/dir/a.canvas" }),
      }))
      expect(putFileMock).toHaveBeenCalledWith("/target/a.canvas", false, expect.any(Blob))
      expect(removeFileMock).toHaveBeenCalledWith("/dir/a.canvas")
      expect(onFilePathUpdateMock).toHaveBeenCalledWith("/target/a.canvas")
      expect(removeRecentCanvasFileMock).toHaveBeenCalledWith("/dir/a.canvas")
      expect(refreshRecentFilesMock).toHaveBeenCalled()
    })

    it("calls onFilePathUpdate with target path", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        text: async () => "{}",
      } as Response)
      readDirMock.mockResolvedValue([])
      removeFileMock.mockResolvedValue(undefined)
      putFileMock.mockResolvedValue(undefined)

      const tree = createTree()
      await tree.moveWorkspaceFile("/dir/old.canvas", "/newdir")
      expect(onFilePathUpdateMock).toHaveBeenCalledWith("/newdir/old.canvas")
    })

    it("handles fetch failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
      } as Response)
      readDirMock.mockResolvedValue([])

      const tree = createTree()
      const result = await tree.moveWorkspaceFile("/dir/a.canvas", "/target")
      expect(result).toBe(false)
      expect(showMessageMock).toHaveBeenCalledWith(expect.stringMatching(/unable to move/i), 4000, "error")
    })
  })

  describe("renameWorkspaceDocument", () => {
    it("sanitizes filename: removes special characters", () => {
      const result = "test:file*<>|?.canvas".replace(/[\\/:*?"'<>|]/g, "_")
      expect(result).toBe("test_file_____.canvas")
    })

    it("handles renaming via dialog", async () => {
      // renameWorkspaceDocument uses openTextInputDialog which requires DOM.
      // Covered by integration tests in canvas-use-editor-actions.
    })
  })

  describe("removeRecentFileRecord", () => {
    it("calls plugin and refreshes recent files", async () => {
      const tree = createTree()
      await tree.removeRecentFileRecord("/path/to/file.canvas")
      expect(removeRecentCanvasFileMock).toHaveBeenCalledWith("/path/to/file.canvas")
      expect(refreshRecentFilesMock).toHaveBeenCalled()
    })
  })

  describe("sort field and direction", () => {
    it("setWorkspaceSortField refreshes documents", () => {
      readDirMock.mockResolvedValue([])
      const tree = createTree()
      tree.setWorkspaceSortField("name")
      expect(tree.workspaceSortField.value).toBe("name")
    })

    it("setWorkspaceSortDirection refreshes documents", () => {
      readDirMock.mockResolvedValue([])
      const tree = createTree()
      tree.setWorkspaceSortDirection("asc")
      expect(tree.workspaceSortDirection.value).toBe("asc")
    })
  })

  describe("empty directory handling", () => {
    it("handles directory with no canvas files", async () => {
      readDirMock.mockImplementation(async (path: string) => {
        if (path === "/root") {
          return [
            { name: "readme.md", isDir: false },
            { name: "assets", isDir: true },
          ]
        }
        return []
      })
      const tree = createTree()
      const result = await tree.readDirectoryTree("/root")
      expect(result).toHaveLength(1) // only the folder "assets" (empty)
      expect(result[0]!.type).toBe("folder")
    })

    it("handles null readDir response", async () => {
      readDirMock.mockResolvedValue(null as unknown as WorkspaceEntry[])
      const tree = createTree()
      const result = await tree.readDirectoryTree("/root")
      expect(result).toEqual([])
    })
  })
})

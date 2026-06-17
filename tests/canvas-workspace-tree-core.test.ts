import {
  describe,
  expect,
  it,
} from "vitest"

import {
  buildWorkspaceFilePath,
  collectWorkspaceCanvasFiles,
  collectWorkspaceFolderPaths,
  readWorkspaceDirectoryTree,
  sanitizeCanvasFileBaseName,
  sortWorkspaceTreeNodes,
} from "@/canvas/workspace-tree-core"
import type {
  WorkspaceEntry,
  WorkspaceSortDirection,
  WorkspaceSortField,
  WorkspaceTreeNode,
} from "@/canvas/use-canvas-editor-workspace-tree"

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

describe("workspace tree core", () => {
  it("reads nested workspace directories and keeps only canvas files", async () => {
    const readDir = async (path: string): Promise<WorkspaceEntry[]> => {
      if (path === "/workspace/canvas") {
        return [
          { name: "z.canvas", isDir: false, updated: 30 },
          { name: "notes.md", isDir: false },
          { name: "projects", isDir: true },
        ]
      }

      if (path === "/workspace/canvas/projects") {
        return [
          { name: "a.canvas", isDir: false, updated: 10, created: 1 },
          { name: "image.png", isDir: false },
        ]
      }

      return []
    }

    await expect(readWorkspaceDirectoryTree("/workspace/canvas", readDir)).resolves.toEqual([
      file("z.canvas", "/workspace/canvas/z.canvas", 30),
      folder("projects", "/workspace/canvas/projects", [
        file("a.canvas", "/workspace/canvas/projects/a.canvas", 10, 1),
      ]),
    ])
  })

  it("returns an empty tree when reading a directory fails", async () => {
    await expect(readWorkspaceDirectoryTree("/workspace/canvas", async () => {
      throw new Error("read failed")
    })).resolves.toEqual([])
  })

  it("sorts folders before files and sorts nested children by selected field", () => {
    const nodes = [
      file("b.canvas", "/b.canvas", 20, 2),
      folder("z-folder", "/z-folder", [
        file("new.canvas", "/z-folder/new.canvas", 30, 3),
        file("old.canvas", "/z-folder/old.canvas", 10, 1),
      ]),
      folder("a-folder", "/a-folder", []),
      file("a.canvas", "/a.canvas", 10, 1),
    ]

    expect(sortWorkspaceTreeNodes(nodes, "name", "asc").map(node => node.name)).toEqual([
      "a-folder",
      "z-folder",
      "a.canvas",
      "b.canvas",
    ])

    const zFolder = sortWorkspaceTreeNodes(nodes, "updated", "desc")[0] as Extract<WorkspaceTreeNode, { type: "folder" }>
    expect(zFolder.children.map(node => node.name)).toEqual(["new.canvas", "old.canvas"])
  })

  it("collects folder paths and canvas file paths recursively", () => {
    const nodes = [
      folder("a", "/a", [
        file("a.canvas", "/a/a.canvas"),
        folder("b", "/a/b", [
          file("b.canvas", "/a/b/b.canvas"),
        ]),
      ]),
      file("root.canvas", "/root.canvas"),
    ]

    expect(collectWorkspaceFolderPaths(nodes)).toEqual(["/a", "/a/b"])
    expect(collectWorkspaceCanvasFiles(nodes)).toEqual([
      "/a/a.canvas",
      "/a/b/b.canvas",
      "/root.canvas",
    ])
  })

  it("sanitizes canvas filenames and appends the canvas extension", () => {
    expect(sanitizeCanvasFileBaseName("test:file*<>|?")).toBe("test_file_____")
    expect(buildWorkspaceFilePath("/canvas", "test:file*<>|?")).toBe("/canvas/test_file_____.canvas")
    expect(buildWorkspaceFilePath("/canvas", "already.canvas")).toBe("/canvas/already.canvas")
  })

  it("treats supported sort fields and directions as explicit inputs", () => {
    const field: WorkspaceSortField = "created"
    const direction: WorkspaceSortDirection = "desc"
    const result = sortWorkspaceTreeNodes([
      file("old.canvas", "/old.canvas", 0, 1),
      file("new.canvas", "/new.canvas", 0, 2),
    ], field, direction)

    expect(result.map(node => node.name)).toEqual(["new.canvas", "old.canvas"])
  })
})

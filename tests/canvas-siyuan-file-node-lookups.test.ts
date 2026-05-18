import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  createAssetPathCandidates,
  createDocumentPathCandidates,
  resolveImageAssetByBlockId,
  resolveSiyuanBlockById,
  resolveSiyuanAssetByPath,
  resolveSiyuanDocumentByPath,
  searchSiyuanBlocks,
} from "@/canvas/siyuan-file-node-lookups"
import { searchCanvasFilePickerTargets } from "@/canvas/file-picker-dialog"

describe("siyuan file node lookups", () => {
  it("creates normalized document path candidates for hpath and storage lookups", () => {
    expect(createDocumentPathCandidates("Projects/Spec.md")).toEqual({
      hpaths: ["/Projects/Spec.md", "/Projects/Spec"],
      storagePaths: [],
    })

    expect(createDocumentPathCandidates("/20260408/root/20260409-note.sy")).toEqual({
      hpaths: ["/20260408/root/20260409-note.sy"],
      storagePaths: ["/20260408/root/20260409-note.sy"],
    })
  })

  it("creates asset path candidates across workspace-relative variants", () => {
    expect(createAssetPathCandidates("/data/assets/diagram.png")).toEqual([
      "/data/assets/diagram.png",
      "assets/diagram.png",
      "data/assets/diagram.png",
    ])
  })

  it("resolves documents by storage path first and then falls back to hpath", async () => {
    const queryRows = vi.fn(async (statement: string) => {
      if (statement.includes("path = '/20260408/root/20260409-note.sy'")) {
        return []
      }

      if (statement.includes("hpath = '/Projects/Spec'")) {
        return [{
          content: "Spec",
          hpath: "/Projects/Spec",
          id: "20260408235000-demo",
          path: "/20260408/root/20260409-note.sy",
        }]
      }

      return []
    })

    const result = await resolveSiyuanDocumentByPath("/Projects/Spec.md", queryRows)

    expect(queryRows).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      hpath: "/Projects/Spec",
      id: "20260408235000-demo",
      path: "/20260408/root/20260409-note.sy",
      title: "Spec",
    })
  })

  it("resolves assets across candidate variants until one matches", async () => {
    const queryRows = vi.fn(async (statement: string) => {
      if (statement.includes("path = 'assets/diagram.png'")) {
        return [{
          name: "diagram.png",
          path: "assets/diagram.png",
          title: "Architecture Diagram",
        }]
      }

      return []
    })

    const result = await resolveSiyuanAssetByPath("/data/assets/diagram.png", queryRows)

    expect(queryRows).toHaveBeenNthCalledWith(1, expect.stringContaining("path = '/data/assets/diagram.png'"))
    expect(queryRows).toHaveBeenNthCalledWith(2, expect.stringContaining("path = 'assets/diagram.png'"))
    expect(result).toEqual({
      name: "diagram.png",
      openPath: "/data/assets/diagram.png",
      path: "assets/diagram.png",
      title: "Architecture Diagram",
    })
  })

  it("resolves image assets by the copied block id", async () => {
    const queryRows = vi.fn(async () => [{
      block_id: "20260412094047-ihhbskn",
      name: "diagram.png",
      path: "assets/diagram.png",
      title: "Architecture Diagram",
    }])

    const result = await resolveImageAssetByBlockId("20260412094047-ihhbskn", queryRows)

    expect(result).toEqual({
      blockId: "20260412094047-ihhbskn",
      name: "diagram.png",
      openPath: "/data/assets/diagram.png",
      path: "assets/diagram.png",
      title: "Architecture Diagram",
    })
  })

  it("falls back to block markdown when assets.block_id does not match the copied image block id", async () => {
    const queryRows = vi.fn(async (statement: string) => {
      if (statement.includes("FROM assets") && statement.includes("block_id = '20260412094047-ihhbskn'")) {
        return []
      }

      if (statement.includes("SELECT markdown, content") && statement.includes("FROM blocks")) {
        return [{
          content: "Diagram",
          markdown: "![Diagram](assets/diagram.png)\n{: id=\"20260412094047-ihhbskn\"}",
        }]
      }

      if (statement.includes("path = 'assets/diagram.png'")) {
        return [{
          name: "diagram.png",
          path: "assets/diagram.png",
          title: "",
        }]
      }

      return []
    })

    const result = await resolveImageAssetByBlockId("20260412094047-ihhbskn", queryRows)

    expect(result).toEqual({
      blockId: "20260412094047-ihhbskn",
      name: "diagram.png",
      openPath: "/data/assets/diagram.png",
      path: "assets/diagram.png",
      title: "Diagram",
    })
  })

  it("resolves a non-document block id into block metadata", async () => {
    const queryRows = vi.fn(async (statement: string) => {
      if (statement.includes("WHERE id = '20260412094047-ihhbskn'")) {
        return [{
          content: "第一项",
          hpath: "",
          id: "20260412094047-ihhbskn",
          path: "/20260408/root/20260409-note.sy",
          root_id: "20260408235000-root",
          subtype: "u",
          type: "l",
        }]
      }

      if (statement.includes("WHERE id = '20260408235000-root'")) {
        return [{
          content: "Roadmap",
          hpath: "/Projects/Roadmap",
          id: "20260408235000-root",
          path: "/20260408/root/20260409-note.sy",
        }]
      }

      return []
    })

    const result = await resolveSiyuanBlockById("20260412094047-ihhbskn", queryRows)

    expect(result).toEqual({
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/20260408/root/20260409-note.sy",
      rootId: "20260408235000-root",
      title: "第一项",
      type: "l",
    })
  })

  it("searches content blocks by exact block id", async () => {
    const queryRows = vi.fn(async (statement: string) => {
      if (statement.includes("WHERE id = '20260412094047-ihhbskn'")) {
        return [{
          content: "图片说明",
          hpath: "",
          id: "20260412094047-ihhbskn",
          path: "/20260408/root/20260409-note.sy",
          root_id: "20260408235000-root",
          subtype: "",
          type: "p",
        }]
      }

      if (statement.includes("WHERE id = '20260408235000-root'")) {
        return [{
          content: "Roadmap",
          hpath: "/Projects/Roadmap",
          id: "20260408235000-root",
          path: "/20260408/root/20260409-note.sy",
        }]
      }

      return []
    })

    const result = await searchSiyuanBlocks("20260412094047-ihhbskn", queryRows)

    expect(result).toEqual([{
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/20260408/root/20260409-note.sy",
      rootId: "20260408235000-root",
      title: "图片说明",
      type: "p",
    }])
  })

  it("searches documents, blocks, images, and workspace canvases into grouped picker results", async () => {
    const result = await searchCanvasFilePickerTargets("road", {
      searchBlocks: vi.fn(async () => [{
        kind: "block",
        path: "20260412094047-ihhbskn",
        subtitle: "/Projects/Roadmap",
        title: "Road block",
      }]),
      searchDocuments: vi.fn(async () => [{
        kind: "document",
        path: "/data/roadmap.sy",
        subtitle: "/Projects/Roadmap",
        title: "Roadmap",
      }]),
      searchImages: vi.fn(async () => [{
        kind: "image",
        path: "assets/road.png",
        subtitle: "assets/road.png",
        title: "road.png",
      }]),
      searchWorkspaceCanvasFiles: vi.fn(async () => [{
        kind: "canvas",
        path: "/data/storage/maps/road.canvas",
        subtitle: "/data/storage/maps/road.canvas",
        title: "road.canvas",
      }]),
    })

    expect(result.documents).toHaveLength(1)
    expect(result.blocks).toHaveLength(1)
    expect(result.images).toHaveLength(1)
    expect(result.canvases).toHaveLength(1)
  })
})

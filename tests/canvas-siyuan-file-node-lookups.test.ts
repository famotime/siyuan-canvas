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
  resolveSiyuanAssetByPath,
  resolveSiyuanDocumentByPath,
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

  it("searches documents, images, and workspace canvases into grouped picker results", async () => {
    const result = await searchCanvasFilePickerTargets("road", {
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
    expect(result.images).toHaveLength(1)
    expect(result.canvases).toHaveLength(1)
  })
})

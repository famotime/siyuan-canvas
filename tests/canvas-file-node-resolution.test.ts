import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { resolveCanvasFileNode } from "@/canvas/file-node-resolution"

describe("canvas file node resolution", () => {
  it("classifies nested canvas files without external lookup", async () => {
    const result = await resolveCanvasFileNode("maps/ideas.canvas", {
      resolveAssetByPath: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("canvas")
    expect(result.title).toBe("ideas.canvas")
  })

  it("resolves Siyuan assets through the asset lookup", async () => {
    const resolveAssetByPath = vi.fn(async () => ({
      name: "diagram.png",
      path: "assets/diagram.png",
      title: "Architecture Diagram",
    }))

    const result = await resolveCanvasFileNode("/data/assets/diagram.png", {
      resolveAssetByPath,
      resolveDocumentByPath: vi.fn(async () => null),
    })

    expect(resolveAssetByPath).toHaveBeenCalled()
    expect(result.kind).toBe("asset")
    expect(result.title).toBe("Architecture Diagram")
    expect(result.asset?.path).toBe("assets/diagram.png")
  })

  it("resolves Siyuan documents through the document lookup", async () => {
    const result = await resolveCanvasFileNode("/Projects/Canvas/Spec", {
      resolveAssetByPath: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => ({
        hpath: "/Projects/Canvas/Spec",
        id: "20260408235000-demo",
        path: "/20260408234000-root/20260408235000-demo.sy",
        title: "Spec",
      })),
    })

    expect(result.kind).toBe("document")
    expect(result.title).toBe("Spec")
    expect(result.description).toBe("/Projects/Canvas/Spec")
    expect(result.document?.id).toBe("20260408235000-demo")
  })

  it("falls back to a generic file node when no Siyuan target is found", async () => {
    const result = await resolveCanvasFileNode("notes/legacy.md", {
      resolveAssetByPath: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("file")
    expect(result.title).toBe("legacy.md")
    expect(result.description).toBe("notes/legacy.md")
  })

  it("keeps direct image paths previewable through the legacy file-node resolver", async () => {
    const result = await resolveCanvasFileNode("/data/storage/maps/roadmap.assets/pasted.png", {
      resolveAssetByPath: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("asset")
    expect(result.asset?.openPath).toBe("/data/storage/maps/roadmap.assets/pasted.png")
    expect(result.title).toBe("pasted.png")
  })
})

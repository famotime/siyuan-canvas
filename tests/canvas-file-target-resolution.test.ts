import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { resolveCanvasFileTarget } from "@/canvas/file-target-resolution"

describe("resolveCanvasFileTarget", () => {
  it("resolves a block id to an image target before falling back to document lookup", async () => {
    const result = await resolveCanvasFileTarget("20260412094047-ihhbskn", {
      resolveCanvasByPath: vi.fn(async () => null),
      resolveDocumentByBlockId: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
      resolveImageByBlockId: vi.fn(async () => ({
        blockId: "20260412094047-ihhbskn",
        kind: "image",
        openPath: "/data/assets/example.png",
        path: "assets/example.png",
        title: "example.png",
      })),
      resolveImageByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("image")
    expect(result.path).toBe("assets/example.png")
  })

  it("resolves a .canvas path before document lookup", async () => {
    const result = await resolveCanvasFileTarget("/data/storage/maps/roadmap.canvas", {
      resolveCanvasByPath: vi.fn(async (path) => ({
        kind: "canvas",
        path,
        title: "roadmap.canvas",
      })),
      resolveDocumentByBlockId: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
      resolveImageByBlockId: vi.fn(async () => null),
      resolveImageByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("canvas")
    expect(result.title).toBe("roadmap.canvas")
  })

  it("resolves raw image markdown by the embedded block id before falling back to path parsing", async () => {
    const result = await resolveCanvasFileTarget(`![Diagram](assets/diagram.png)
{: id="20260412094047-ihhbskn"}`, {
      resolveCanvasByPath: vi.fn(async () => null),
      resolveDocumentByBlockId: vi.fn(async () => null),
      resolveDocumentByPath: vi.fn(async () => null),
      resolveImageByBlockId: vi.fn(async () => ({
        blockId: "20260412094047-ihhbskn",
        kind: "image",
        openPath: "/data/assets/diagram.png",
        path: "assets/diagram.png",
        title: "Diagram",
      })),
      resolveImageByPath: vi.fn(async () => null),
    })

    expect(result.kind).toBe("image")
    expect(result.path).toBe("assets/diagram.png")
  })
})

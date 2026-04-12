import {
  describe,
  expect,
  it,
} from "vitest"

import { createCanvasFileTargetPreview } from "@/canvas/file-target-preview"

describe("createCanvasFileTargetPreview", () => {
  it("creates a document preview with rendered html and clipping metadata", () => {
    const preview = createCanvasFileTargetPreview({
      excerptHtml: "<h1>Heading</h1><p>Body</p>",
      hpath: "/Projects/Canvas",
      id: "20260412094047-ihhbskn",
      kind: "document",
      path: "/data/20260412094047-ihhbskn.sy",
      title: "Canvas Spec",
    })

    expect(preview.kind).toBe("document")
    expect(preview.headline).toBe("Canvas Spec")
    expect(preview.previewHtml).toContain("<h1>Heading</h1>")
    expect(preview.clampMode).toBe("viewport")
  })

  it("creates a canvas preview with miniature graph data", () => {
    const preview = createCanvasFileTargetPreview({
      kind: "canvas",
      path: "/data/storage/maps/roadmap.canvas",
      thumbnail: {
        edges: [{ fromX: 10, fromY: 20, toX: 70, toY: 80 }],
        nodes: [{ height: 40, width: 80, x: 20, y: 30 }],
      },
      title: "roadmap.canvas",
    })

    expect(preview.kind).toBe("canvas")
    expect(preview.thumbnail?.nodes).toHaveLength(1)
  })

  it("creates an image card preview", () => {
    const preview = createCanvasFileTargetPreview({
      kind: "image",
      openPath: "/data/assets/photo.png",
      path: "assets/photo.png",
      title: "photo.png",
    })

    expect(preview.kind).toBe("image")
    expect(preview.imageSrc).toBe("/data/assets/photo.png")
  })
})

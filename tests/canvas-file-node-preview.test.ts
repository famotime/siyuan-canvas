import {
  describe,
  expect,
  it,
} from "vitest"

import { createCanvasFileNodePreview } from "@/canvas/file-node-preview"

describe("canvas file node preview", () => {
  it("creates a document preview card", () => {
    const preview = createCanvasFileNodePreview({
      description: "/Projects/Canvas/Spec",
      document: {
        hpath: "/Projects/Canvas/Spec",
        id: "202604090001-spec",
        path: "/20260408234000-root/202604090001-spec.sy",
        title: "Spec",
      },
      kind: "document",
      path: "/Projects/Canvas/Spec",
      title: "Spec",
    })

    expect(preview.badge).toBe("Document")
    expect(preview.headline).toBe("Spec")
    expect(preview.detail).toBe("/Projects/Canvas/Spec")
    expect(preview.helper).toBe("Opens in SiYuan")
  })

  it("creates an image asset preview card", () => {
    const preview = createCanvasFileNodePreview({
      asset: {
        name: "diagram.png",
        openPath: "/data/assets/diagram.png",
        path: "assets/diagram.png",
        title: "Architecture Diagram",
      },
      description: "assets/diagram.png",
      kind: "asset",
      path: "/data/assets/diagram.png",
      title: "Architecture Diagram",
    })

    expect(preview.badge).toBe("Image Asset")
    expect(preview.imageSrc).toBe("/data/assets/diagram.png")
    expect(preview.helper).toBe("Opens in asset viewer")
  })

  it("creates a generic fallback preview card", () => {
    const preview = createCanvasFileNodePreview({
      description: "notes/legacy.md",
      kind: "file",
      path: "notes/legacy.md",
      title: "legacy.md",
    })

    expect(preview.badge).toBe("File")
    expect(preview.headline).toBe("legacy.md")
    expect(preview.detail).toBe("notes/legacy.md")
  })
})

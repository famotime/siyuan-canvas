import {
  describe,
  expect,
  it,
} from "vitest"

import {
  createDefaultCanvasPluginData,
  rememberRecentCanvasFile,
} from "@/canvas/plugin-data"

describe("canvas plugin data", () => {
  it("provides default settings for canvas persistence", () => {
    const data = createDefaultCanvasPluginData()

    expect(data.settings.defaultCanvasDirectory).toBe("/data/storage/siyuan-canvas")
    expect(data.settings.detectExternalChanges).toBe(true)
    expect(data.settings.recentFilesLimit).toBe(8)
    expect(data.recentFiles).toEqual([])
  })

  it("deduplicates and caps recent canvas files", () => {
    let data = createDefaultCanvasPluginData()

    data = rememberRecentCanvasFile(data, {
      openedAt: "2026-04-08T10:00:00.000Z",
      path: "/data/storage/siyuan-canvas/alpha.canvas",
      title: "alpha.canvas",
    })
    data = rememberRecentCanvasFile(data, {
      openedAt: "2026-04-08T10:01:00.000Z",
      path: "/data/storage/siyuan-canvas/beta.canvas",
      title: "beta.canvas",
    })
    data = rememberRecentCanvasFile({
      ...data,
      settings: {
        ...data.settings,
        recentFilesLimit: 2,
      },
    }, {
      openedAt: "2026-04-08T10:02:00.000Z",
      path: "/data/storage/siyuan-canvas/alpha.canvas",
      title: "alpha.canvas",
    })

    expect(data.recentFiles).toEqual([
      {
        openedAt: "2026-04-08T10:02:00.000Z",
        path: "/data/storage/siyuan-canvas/alpha.canvas",
        title: "alpha.canvas",
      },
      {
        openedAt: "2026-04-08T10:01:00.000Z",
        path: "/data/storage/siyuan-canvas/beta.canvas",
        title: "beta.canvas",
      },
    ])
  })
})

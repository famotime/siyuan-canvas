import {
  describe,
  expect,
  it,
} from "vitest"

import {
  createDefaultCanvasPluginData,
  normalizeCanvasPluginData,
  rememberRecentCanvasFile,
} from "@/canvas/plugin-data"

describe("canvas plugin data", () => {
  it("provides default settings for canvas persistence", () => {
    const data = createDefaultCanvasPluginData()

    expect(data.settings.detectExternalChanges).toBe(true)
    expect(data.settings.recentFilesLimit).toBe(8)
    expect(data.recentFiles).toEqual([])
    expect(data.ui.inspectorSections).toEqual({
      createEdge: true,
      document: true,
      edge: true,
      node: true,
      recent: true,
      selection: true,
    })
  })

  it("deduplicates and caps recent canvas files", () => {
    let data = createDefaultCanvasPluginData()

    data = rememberRecentCanvasFile(data, {
      openedAt: "2026-04-08T10:00:00.000Z",
      path: "/data/storage/siyuan-canvas/alpha.canvas",
      sourceType: "workspace",
      title: "alpha.canvas",
    })
    data = rememberRecentCanvasFile(data, {
      openedAt: "2026-04-08T10:01:00.000Z",
      path: "C:\\canvas\\beta.canvas",
      sourceType: "local",
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
      sourceType: "workspace",
      title: "alpha.canvas",
    })

    expect(data.recentFiles).toEqual([
      {
        openedAt: "2026-04-08T10:02:00.000Z",
        path: "/data/storage/siyuan-canvas/alpha.canvas",
        sourceType: "workspace",
        title: "alpha.canvas",
      },
      {
        openedAt: "2026-04-08T10:01:00.000Z",
        path: "C:\\canvas\\beta.canvas",
        sourceType: "local",
        title: "beta.canvas",
      },
    ])
  })

  it("normalizes missing or invalid persisted inspector UI state", () => {
    const data = normalizeCanvasPluginData({
      recentFiles: [],
      settings: {},
      ui: {
        inspectorSections: {
          createEdge: false,
          document: "bad",
        },
      },
      version: 1,
    })

    expect(data.ui.inspectorSections).toEqual({
      createEdge: false,
      document: true,
      edge: true,
      node: true,
      recent: true,
      selection: true,
    })
  })
})

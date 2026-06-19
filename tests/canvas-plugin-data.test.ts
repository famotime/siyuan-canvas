import {
  describe,
  expect,
  it,
} from "vitest"

import {
  createDefaultCanvasPluginData,
  createDefaultCanvasPluginSettings,
  normalizeCanvasPluginData,
  rememberRecentCanvasFile,
} from "@/canvas/plugin-data"

describe("canvas plugin data", () => {
  it("provides default settings for canvas persistence", () => {
    const data = createDefaultCanvasPluginData()

    expect(data.settings.detectExternalChanges).toBe(true)
    expect(data.settings.recentFilesLimit).toBe(8)
    expect(data.settings.showCanvasThumbnails).toBe(false)
    expect(data.settings.showNodeHeader).toBe(true)
    expect(data.settings.presentationAutoRatio).toBe(true)
    expect(data.settings.presentationMaskOpacity).toBe(60)
    expect(data.recentFiles).toEqual([])
    expect(data.ui.inspectorSections).toEqual({
      createEdge: true,
      document: true,
      edge: true,
      node: true,
      nodeEdges: true,
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
      nodeEdges: true,
      recent: true,
      selection: true,
    })
    expect(data.settings.showCanvasThumbnails).toBe(false)
    expect(data.settings.showNodeHeader).toBe(true)
  })
})

describe("colorTheme in plugin settings", () => {
  it("default settings include colorTheme as classic", () => {
    const settings = createDefaultCanvasPluginSettings()
    expect(settings.colorTheme).toBe("classic")
  })

  it("normalizes valid colorTheme", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: { colorTheme: "earth" },
    })
    expect(data.settings.colorTheme).toBe("earth")
  })

  it("falls back to classic for invalid colorTheme", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: { colorTheme: "invalid" },
    })
    expect(data.settings.colorTheme).toBe("classic")
  })

  it("falls back to classic when colorTheme is missing", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: {},
    })
    expect(data.settings.colorTheme).toBe("classic")
  })
})

describe("presentation settings normalization", () => {
  it("normalizes valid presentation settings", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: {
        presentationAutoRatio: false,
        presentationMaskOpacity: 45,
      },
    })
    expect(data.settings.presentationAutoRatio).toBe(false)
    expect(data.settings.presentationMaskOpacity).toBe(45)
  })

  it("falls back to default for invalid presentation settings", () => {
    const data = normalizeCanvasPluginData({
      version: 1,
      settings: {
        presentationAutoRatio: "not-a-boolean",
        presentationMaskOpacity: 150, // out of range 0-100
      },
    })
    expect(data.settings.presentationAutoRatio).toBe(true) // default
    expect(data.settings.presentationMaskOpacity).toBe(60) // default
  })
})

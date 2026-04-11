/* @vitest-environment jsdom */

import {
  readFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import {
  dirname,
  extname,
  resolve,
} from "node:path"

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  transpileModule,
  ModuleKind,
  ScriptTarget,
} from "typescript"
import type { ModuleExports } from "vitest"

const openTab = vi.fn()
const showMessage = vi.fn()
const getFrontend = vi.fn(() => "desktop")

class PluginMock {
  public app = {}
  public commands: any[] = []
  public i18n?: Record<string, string>
  public name = "siyuan-canvas"
  public setting: unknown
  public tabs: any[] = []
  public topBars: any[] = []
  private storedData: unknown = null

  addCommand = vi.fn((config: any) => {
    this.commands.push(config)
  })

  addTab = vi.fn((config: any) => {
    this.tabs.push(config)
  })

  addTopBar = vi.fn((config: any) => {
    this.topBars.push(config)
  })

  async loadData(_key: string): Promise<unknown> {
    return this.storedData
  }

  async saveData(_key: string, value: unknown): Promise<void> {
    this.storedData = value
  }

  setStoredData(value: unknown): void {
    this.storedData = value
  }
}

class SettingMock {
  public items: any[] = []
  public open = vi.fn()

  constructor(public readonly options: { width: string }) {}

  addItem(config: any) {
    this.items.push(config)
    return this
  }
}

const siyuanMock = {
  Plugin: PluginMock,
  Setting: SettingMock,
  getFrontend,
  openTab,
  showMessage,
}

let SiyuanCanvasPlugin: typeof import("@/index").default
const nodeRequire = createRequire(import.meta.url)
const moduleCache = new Map<string, ModuleExports>()

function resolveLocalModulePathSync(specifier: string, importer?: string): string {
  const basePath = specifier.startsWith("@/")
    ? resolve(process.cwd(), "src", specifier.slice(2))
    : resolve(importer ? dirname(importer) : process.cwd(), specifier)

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    `${basePath}.json`,
    `${basePath}.vue`,
    `${basePath}.scss`,
    resolve(basePath, "index.ts"),
    resolve(basePath, "index.js"),
  ]

  for (const candidate of candidates) {
    try {
      readFileSync(candidate)
      return candidate
    } catch {
      continue
    }
  }

  throw new Error(`Unable to resolve local module: ${specifier}`)
}

function loadModuleExports(path: string): ModuleExports {
  const normalizedPath = resolve(path)
  const cached = moduleCache.get(normalizedPath)
  if (cached) {
    return cached
  }

  const extension = extname(normalizedPath)
  if (extension === ".json") {
    const jsonText = readFileSync(normalizedPath, "utf8")
    const parsed = JSON.parse(jsonText) as ModuleExports
    moduleCache.set(normalizedPath, parsed)
    return parsed
  }

  if (extension === ".scss" || extension === ".vue") {
    const stubbed = extension === ".vue" ? { default: {} } : {}
    moduleCache.set(normalizedPath, stubbed)
    return stubbed
  }

  const source = readFileSync(normalizedPath, "utf8")
  const transpiled = transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2020,
    },
    fileName: normalizedPath,
  })
  const module = { exports: {} as ModuleExports }
  moduleCache.set(normalizedPath, module.exports)

  const localRequire = (specifier: string) => {
    if (specifier === "siyuan") {
      return siyuanMock
    }

    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const resolvedPath = resolveLocalModulePathSync(specifier, normalizedPath)
      return loadModuleExports(resolvedPath)
    }

    return nodeRequire(specifier)
  }

  const wrapped = new Function(
    "require",
    "module",
    "exports",
    "__dirname",
    "__filename",
    `${transpiled.outputText}
return module.exports;`,
  ) as (
    require: (specifier: string) => ModuleExports,
    module: { exports: ModuleExports },
    exports: ModuleExports,
    __dirname: string,
    __filename: string,
  ) => ModuleExports

  const exports = wrapped(
    localRequire,
    module,
    module.exports,
    dirname(normalizedPath),
    normalizedPath,
  )

  moduleCache.set(normalizedPath, exports)
  return exports
}

beforeAll(() => {
  const loaded = loadModuleExports(resolve(process.cwd(), "src", "index.ts"))
  SiyuanCanvasPlugin = loaded.default as typeof SiyuanCanvasPlugin
})

beforeEach(() => {
  openTab.mockReset()
  showMessage.mockReset()
  getFrontend.mockReset()
  getFrontend.mockReturnValue("desktop")
})

describe("canvas plugin lifecycle", () => {
  it("opens canvas tabs with path-derived and explicit titles", async () => {
    const plugin = new SiyuanCanvasPlugin()

    await plugin.openCanvasTab({ path: "/data/storage/siyuan-canvas/example.canvas" })
    await plugin.openCanvasTab({
      path: "/data/storage/siyuan-canvas/example.canvas",
      title: "Custom title",
    })

    expect(openTab).toHaveBeenNthCalledWith(1, expect.objectContaining({
      app: plugin.app,
      custom: expect.objectContaining({
        data: { path: "/data/storage/siyuan-canvas/example.canvas" },
        icon: "iconGraph",
        title: "example.canvas",
      }),
      keepCursor: true,
      openNewTab: true,
    }))
    expect(openTab).toHaveBeenNthCalledWith(2, expect.objectContaining({
      custom: expect.objectContaining({
        title: "Custom title",
      }),
    }))
  })

  it("deduplicates recent files and respects the configured limit", async () => {
    const plugin = new SiyuanCanvasPlugin()

    await plugin.updateCanvasSettings({ recentFilesLimit: 2 })
    await plugin.rememberRecentCanvas("/data/storage/siyuan-canvas/one.canvas")
    await plugin.rememberRecentCanvas("/data/storage/siyuan-canvas/two.canvas")
    await plugin.rememberRecentCanvas("/data/storage/siyuan-canvas/three.canvas")
    await plugin.rememberRecentCanvas("/data/storage/siyuan-canvas/two.canvas")

    expect(plugin.getRecentCanvasFiles().map(item => item.path)).toEqual([
      "/data/storage/siyuan-canvas/two.canvas",
      "/data/storage/siyuan-canvas/three.canvas",
    ])
  })

  it("builds a settings panel from current defaults and persists edits", async () => {
    const plugin = new SiyuanCanvasPlugin()

    plugin.openCanvasSettings()

    const setting = plugin.setting as SettingMock
    expect(setting.options).toEqual({ width: "560px" })
    expect(setting.open).toHaveBeenCalledWith("siyuan-canvas")

    const defaultDirectoryInput = setting.items[0].createActionElement() as HTMLInputElement
    const recentFilesLimitInput = setting.items[1].createActionElement() as HTMLInputElement
    const detectExternalChangesInput = setting.items[2].createActionElement() as HTMLInputElement

    expect(defaultDirectoryInput.value).toBe("/data/storage/siyuan-canvas")
    expect(recentFilesLimitInput.value).toBe("8")
    expect(detectExternalChangesInput.checked).toBe(true)

    defaultDirectoryInput.value = "/custom/canvas"
    defaultDirectoryInput.dispatchEvent(new Event("change"))
    await Promise.resolve()

    recentFilesLimitInput.value = "1"
    recentFilesLimitInput.dispatchEvent(new Event("change"))
    await Promise.resolve()

    detectExternalChangesInput.checked = false
    detectExternalChangesInput.dispatchEvent(new Event("change"))
    await Promise.resolve()

    expect(plugin.getCanvasSettings()).toEqual({
      defaultCanvasDirectory: "/custom/canvas",
      detectExternalChanges: false,
      recentFilesLimit: 1,
    })
  })

  it("loads plugin data and registers tab, commands, and top bar on onload", async () => {
    const plugin = new SiyuanCanvasPlugin()
    plugin.setStoredData({
      recentFiles: [
        {
          openedAt: "2026-04-11T00:00:00.000Z",
          path: "/data/storage/siyuan-canvas/recent.canvas",
          title: "recent.canvas",
        },
      ],
      settings: {
        defaultCanvasDirectory: "/persisted/canvas",
        detectExternalChanges: false,
        recentFilesLimit: 3,
      },
      version: 1,
    })

    await plugin.onload()

    expect(plugin.getCanvasSettings()).toEqual({
      defaultCanvasDirectory: "/persisted/canvas",
      detectExternalChanges: false,
      recentFilesLimit: 3,
    })
    expect(plugin.getRecentCanvasFiles()).toEqual([
      expect.objectContaining({
        path: "/data/storage/siyuan-canvas/recent.canvas",
        title: "recent.canvas",
      }),
    ])
    expect(plugin.addTab).toHaveBeenCalledTimes(1)
    expect(plugin.addTopBar).toHaveBeenCalledTimes(1)
    expect(plugin.addCommand).toHaveBeenCalledTimes(3)
    expect(showMessage).toHaveBeenCalledWith(expect.any(String), 2500, "info")
  })
})

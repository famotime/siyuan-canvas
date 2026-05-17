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
type DialogAction = "cancel" | "confirm"

interface DialogResponse {
  action: DialogAction
  value: string
}

const dialogResponses: DialogResponse[] = []

class DialogMock {
  public element: HTMLElement
  public editors = {}
  public data: unknown
  private readonly destroyCallback?: (options?: Record<string, unknown>) => void
  private enterEvent?: () => void

  constructor(options: {
    content: string
    destroyCallback?: (options?: Record<string, unknown>) => void
  }) {
    this.destroyCallback = options.destroyCallback
    this.element = document.createElement("div")
    this.element.innerHTML = options.content
    document.body.appendChild(this.element)

    const response = dialogResponses.shift()
    queueMicrotask(() => {
      const input = this.element.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null
      if (input && response) {
        input.value = response.value
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }

      if (!response || response.action === "cancel") {
        this.destroy()
        return
      }

      const confirmButton = this.element.querySelector("[data-canvas-dialog-confirm]") as HTMLButtonElement | null
      if (confirmButton) {
        confirmButton.click()
        return
      }

      this.enterEvent?.()
    })
  }

  bindInput(_inputElement: HTMLInputElement | HTMLTextAreaElement, enterEvent?: () => void): void {
    this.enterEvent = enterEvent
  }

  destroy(options?: Record<string, unknown>): void {
    this.element.remove()
    this.destroyCallback?.(options)
  }
}

class PluginMock {
  public app = {}
  public commands: any[] = []
  public i18n?: Record<string, string>
  public icons: string[] = []
  public name = "siyuan-canvas"
  public setting: unknown
  public tabs: any[] = []
  public topBars: any[] = []
  private storedData: unknown = null

  addCommand = vi.fn((config: any) => {
    this.commands.push(config)
  })

  addIcons = vi.fn((svg: string) => {
    this.icons.push(svg)
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
  Dialog: DialogMock,
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
  dialogResponses.length = 0
  openTab.mockReset()
  showMessage.mockReset()
  getFrontend.mockReset()
  getFrontend.mockReturnValue("desktop")
  vi.spyOn(window, "prompt").mockImplementation(() => {
    throw new Error("prompt() is not supported.")
  })
})

describe("canvas plugin lifecycle", () => {
  it("opens a canvas tab from the command palette through a dialog when prompt is unavailable", async () => {
    dialogResponses.push({ action: "confirm", value: "/data/storage/siyuan-canvas/from-command.canvas" })

    const plugin = new SiyuanCanvasPlugin()
    await plugin.onload()

    const openByPathCommand = plugin.commands.find(command => command.langKey === "openCanvasPath")
    expect(openByPathCommand).toBeTruthy()

    await openByPathCommand.callback()
    await Promise.resolve()

    expect(window.prompt).not.toHaveBeenCalled()
    expect(openTab).toHaveBeenCalledWith(expect.objectContaining({
      app: plugin.app,
      custom: expect.objectContaining({
        data: { path: "/data/storage/siyuan-canvas/from-command.canvas" },
        title: "from-command.canvas",
      }),
    }))
  })

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
        icon: "iconCanvasTab",
        title: "example.canvas",
      }),
      keepCursor: false,
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
    const showCanvasThumbnailsInput = setting.items[3].createActionElement() as HTMLInputElement

    expect(defaultDirectoryInput.value).toBe("/data/storage/petal/siyuan-canvas")
    expect(recentFilesLimitInput.value).toBe("8")
    expect(detectExternalChangesInput.checked).toBe(true)
    expect(showCanvasThumbnailsInput.checked).toBe(false)

    recentFilesLimitInput.value = "1"
    recentFilesLimitInput.dispatchEvent(new Event("change"))
    await Promise.resolve()

    detectExternalChangesInput.checked = false
    detectExternalChangesInput.dispatchEvent(new Event("change"))
    await Promise.resolve()

    showCanvasThumbnailsInput.checked = true
    showCanvasThumbnailsInput.dispatchEvent(new Event("change"))
    await Promise.resolve()

    expect(plugin.getCanvasSettings()).toEqual({
      defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas",
      detectExternalChanges: false,
      enableDebugLog: false,
      recentFilesLimit: 1,
      showCanvasThumbnails: true,
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
        detectExternalChanges: false,
        recentFilesLimit: 3,
      },
      ui: {
        inspectorSections: {
          createEdge: false,
          document: false,
          edge: true,
          node: true,
          recent: true,
          selection: true,
        },
      },
      version: 1,
    })

    await plugin.onload()

    expect(plugin.getCanvasSettings()).toEqual({
      defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas",
      detectExternalChanges: false,
      enableDebugLog: false,
      recentFilesLimit: 3,
      showCanvasThumbnails: false,
    })
    expect(plugin.getRecentCanvasFiles()).toEqual([
      expect.objectContaining({
        path: "/data/storage/siyuan-canvas/recent.canvas",
        title: "recent.canvas",
      }),
    ])
    expect(plugin.getCanvasUiState()).toEqual({
      inspectorSections: {
        createEdge: false,
        document: false,
        edge: true,
        node: true,
        recent: true,
        selection: true,
      },
    })
    expect(plugin.addTab).toHaveBeenCalledTimes(1)
    expect(plugin.addTopBar).toHaveBeenCalledTimes(1)
    expect(plugin.addCommand).toHaveBeenCalledTimes(3)
    expect(plugin.addIcons).toHaveBeenCalledTimes(1)
  })

  it("updates persisted inspector section UI state", async () => {
    const plugin = new SiyuanCanvasPlugin()

    await plugin.updateCanvasUiState({
      inspectorSections: {
        document: false,
        recent: false,
      },
    })

    expect(plugin.getCanvasUiState()).toEqual({
      inspectorSections: {
        createEdge: true,
        document: false,
        edge: true,
        node: true,
        recent: false,
        selection: true,
      },
    })
  })
})

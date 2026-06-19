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
const fetchSyncPost = vi.fn()
const fetchMock = vi.fn()
const getAllEditor = vi.fn(() => [])
const getFrontend = vi.fn(() => "desktop")
type DialogAction = "cancel" | "confirm"

const eventBusHandlers = new Map<string, Array<(event: CustomEvent<any>) => void>>()

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

      const confirmButton = this.element.querySelector("[data-canvas-dialog-confirm], [data-canvas-file-picker-confirm]") as HTMLButtonElement | null
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
  public eventBus = {
    emit(type: string, detail?: unknown) {
      for (const handler of eventBusHandlers.get(type) || []) {
        handler(new CustomEvent(type, { detail }))
      }
    },
    off: vi.fn((type: string, handler: (event: CustomEvent<any>) => void) => {
      const handlers = eventBusHandlers.get(type)
      if (!handlers) {
        return
      }
      eventBusHandlers.set(type, handlers.filter(item => item !== handler))
    }),
    on: vi.fn((type: string, handler: (event: CustomEvent<any>) => void) => {
      const handlers = eventBusHandlers.get(type) || []
      handlers.push(handler)
      eventBusHandlers.set(type, handlers)
    }),
  }
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
  fetchSyncPost,
  getAllEditor,
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
  document.body.innerHTML = ""
  eventBusHandlers.clear()
  fetchMock.mockReset()
  fetchSyncPost.mockReset()
  getAllEditor.mockReset()
  getAllEditor.mockReturnValue([])
  vi.stubGlobal("fetch", fetchMock)
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

  it("inserts a canvas preview from a workspace path entered in the command dialog", async () => {
    const canvasRaw = JSON.stringify({
      edges: [],
      nodes: [
        {
          height: 120,
          id: "node-1",
          text: "大三元",
          type: "text",
          width: 180,
          x: 0,
          y: 0,
        },
      ],
    })
    const protyle = document.createElement("div")
    protyle.className = "protyle-wysiwyg"
    protyle.setAttribute("data-node-id", "20260608194800-docid")
    document.body.appendChild(protyle)
    dialogResponses.push({ action: "confirm", value: "/data/storage/petal/siyuan-canvas/大三元1.canvas " })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url || String(input)
      if (url.includes("/api/asset/upload")) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "大三元1.svg": "assets/大三元1-preview.svg",
            },
          },
        }), { status: 200 })
      }
      return new Response(canvasRaw, { status: 200 })
    })
    fetchSyncPost.mockImplementation(async (url: string, data: { path?: string }) => {
      if (url === "/api/file/readDir") {
        return []
      }
      if (url === "/api/system/getConf") {
        return {
          code: 0,
          data: {
            conf: {
              system: {
                workspaceDir: "/data",
              },
            },
          },
        }
      }
      if (url === "/api/asset/upload") {
        return {
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "大三元1.svg": "assets/大三元1-preview.svg",
            },
          },
        }
      }
      if (url === "/api/block/appendBlock") {
        return {
          code: 0,
          data: [
            {
              doOperations: [
                { id: "20260608194900-preview" },
              ],
            },
          ],
        }
      }
      if (url === "/api/attr/setBlockAttrs") {
        return { code: 0, data: null }
      }
      throw new Error(`Unexpected request ${url} ${JSON.stringify(data)}`)
    })

    const plugin = new SiyuanCanvasPlugin()
    await plugin.onload()

    const insertCommand = plugin.commands.find(command => command.langKey === "insertCanvasEmbed")
    expect(insertCommand).toBeTruthy()

    await insertCommand.callback()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledWith("/api/file/getFile", expect.objectContaining({
      body: JSON.stringify({ path: "/data/storage/petal/siyuan-canvas/大三元1.canvas" }),
      method: "POST",
    }))
    expect(fetchMock).toHaveBeenCalledWith("/api/asset/upload", expect.objectContaining({
      method: "POST",
      body: expect.any(FormData),
    }))
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/block/appendBlock", expect.objectContaining({
      data: '![大三元1](assets/大三元1-preview.svg "大三元1")',
      dataType: "markdown",
      parentID: "20260608194800-docid",
    }))
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/attr/setBlockAttrs", {
      attrs: { "custom-canvas-path": "/data/storage/petal/siyuan-canvas/大三元1.canvas" },
      id: "20260608194900-preview",
    })
    expect(showMessage).toHaveBeenCalledWith("已插入 Canvas 预览", 3000)
  })

  it("inserts a canvas preview into the last active protyle document when the command dialog steals focus", async () => {
    const canvasRaw = JSON.stringify({
      edges: [],
      nodes: [
        {
          height: 120,
          id: "node-1",
          text: "active doc",
          type: "text",
          width: 180,
          x: 0,
          y: 0,
        },
      ],
    })
    dialogResponses.push({ action: "confirm", value: "/data/storage/petal/siyuan-canvas/active.canvas" })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url || String(input)
      if (url.includes("/api/asset/upload")) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "active.svg": "assets/active-preview.svg",
            },
          },
        }), { status: 200 })
      }
      return new Response(canvasRaw, { status: 200 })
    })
    fetchSyncPost.mockImplementation(async (url: string) => {
      if (url === "/api/file/readDir") {
        return []
      }
      if (url === "/api/system/getConf") {
        return {
          code: 0,
          data: {
            conf: {
              system: {
                workspaceDir: "/data",
              },
            },
          },
        }
      }
      if (url === "/api/asset/upload") {
        return {
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "active.svg": "assets/active-preview.svg",
            },
          },
        }
      }
      if (url === "/api/block/appendBlock") {
        return {
          code: 0,
          data: [
            {
              doOperations: [
                { id: "20260608200100-preview" },
              ],
            },
          ],
        }
      }
      if (url === "/api/attr/setBlockAttrs") {
        return { code: 0, data: null }
      }
      throw new Error(`Unexpected request ${url}`)
    })

    const plugin = new SiyuanCanvasPlugin()
    await plugin.onload()
    plugin.eventBus.emit("switch-protyle", {
      protyle: {
        block: { rootID: "20260608200000-rootdoc" },
        element: document.createElement("div"),
      },
    })

    const insertCommand = plugin.commands.find(command => command.langKey === "insertCanvasEmbed")
    expect(insertCommand).toBeTruthy()

    await insertCommand.callback()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchSyncPost).toHaveBeenCalledWith("/api/block/appendBlock", expect.objectContaining({
      parentID: "20260608200000-rootdoc",
    }))
    expect(showMessage).toHaveBeenCalledWith("已插入 Canvas 预览", 3000)
  })

  it("falls back to the editor list when no protyle switch event has fired yet", async () => {
    const canvasRaw = JSON.stringify({
      edges: [],
      nodes: [
        {
          height: 120,
          id: "node-1",
          text: "editor list doc",
          type: "text",
          width: 180,
          x: 0,
          y: 0,
        },
      ],
    })
    dialogResponses.push({ action: "confirm", value: "/data/storage/petal/siyuan-canvas/editor-list.canvas" })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : (input as Request).url || String(input)
      if (url.includes("/api/asset/upload")) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "editor-list.svg": "assets/editor-list-preview.svg",
            },
          },
        }), { status: 200 })
      }
      return new Response(canvasRaw, { status: 200 })
    })
    fetchSyncPost.mockImplementation(async (url: string) => {
      if (url === "/api/file/readDir") {
        return []
      }
      if (url === "/api/system/getConf") {
        return {
          code: 0,
          data: {
            conf: {
              system: {
                workspaceDir: "/data",
              },
            },
          },
        }
      }
      if (url === "/api/asset/upload") {
        return {
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "editor-list.svg": "assets/editor-list-preview.svg",
            },
          },
        }
      }
      if (url === "/api/block/appendBlock") {
        return {
          code: 0,
          data: [
            {
              doOperations: [
                { id: "20260608200500-preview" },
              ],
            },
          ],
        }
      }
      if (url === "/api/attr/setBlockAttrs") {
        return { code: 0, data: null }
      }
      throw new Error(`Unexpected request ${url}`)
    })
    getAllEditor.mockReturnValue([
      {
        protyle: {
          block: { rootID: "20260608200400-rootdoc" },
          element: document.createElement("div"),
        },
      },
    ])

    const plugin = new SiyuanCanvasPlugin()
    await plugin.onload()

    const insertCommand = plugin.commands.find(command => command.langKey === "insertCanvasEmbed")
    expect(insertCommand).toBeTruthy()

    await insertCommand.callback()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchSyncPost).toHaveBeenCalledWith("/api/block/appendBlock", expect.objectContaining({
      parentID: "20260608200400-rootdoc",
    }))
    expect(showMessage).toHaveBeenCalledWith("已插入 Canvas 预览", 3000)
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

    const colorThemeSelect = setting.items[0].createActionElement() as HTMLSelectElement
    const defaultDirectoryInput = setting.items[1].createActionElement() as HTMLInputElement
    const recentFilesLimitInput = setting.items[2].createActionElement() as HTMLInputElement
    const detectExternalChangesInput = setting.items[3].createActionElement() as HTMLInputElement
    const showCanvasThumbnailsInput = setting.items[4].createActionElement() as HTMLInputElement
    const showNodeHeaderInput = setting.items[5].createActionElement() as HTMLInputElement

    expect(colorThemeSelect.value).toBe("classic")
    expect(defaultDirectoryInput.value).toBe("/data/storage/petal/siyuan-canvas")
    expect(recentFilesLimitInput.value).toBe("8")
    expect(detectExternalChangesInput.checked).toBe(true)
    expect(showCanvasThumbnailsInput.checked).toBe(false)
    expect(showNodeHeaderInput.checked).toBe(true)

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
      colorTheme: "classic",
      defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas",
      detectExternalChanges: false,
      enableDebugLog: false,
      noteCreationDirectory: "",
      presentationAutoPlayInterval: 3,
      presentationAutoRatio: true,
      presentationMaskOpacity: 60,
      presentationStyle: "zoom",
      recentFilesLimit: 1,
      showCanvasThumbnails: true,
      showNodeHeader: true,
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
      colorTheme: "classic",
      defaultCanvasDirectory: "/data/storage/petal/siyuan-canvas",
      detectExternalChanges: false,
      enableDebugLog: false,
      noteCreationDirectory: "",
      presentationAutoPlayInterval: 3,
      presentationAutoRatio: true,
      presentationMaskOpacity: 60,
      presentationStyle: "zoom",
      recentFilesLimit: 3,
      showCanvasThumbnails: false,
      showNodeHeader: true,
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
        nodeEdges: true,
        recent: true,
        selection: true,
      },
    })
    expect(plugin.addTab).toHaveBeenCalledTimes(1)
    expect(plugin.addTopBar).toHaveBeenCalledTimes(1)
    expect(plugin.addCommand).toHaveBeenCalledTimes(4)
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
        nodeEdges: true,
        recent: false,
        selection: true,
      },
    })
  })
})

/* @vitest-environment jsdom */

import type { ModuleExports } from "vitest"
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
  ModuleKind,
  ScriptTarget,
  transpileModule,
} from "typescript"

const getFrontend = vi.fn(() => "desktop")
const openTab = vi.fn()
const mountedApps: Array<{ bootstrap: unknown, element: HTMLElement }> = []
const unmountedApps: HTMLElement[] = []
const createdDialogs: DialogMock[] = []

class DialogMock {
  public element: HTMLElement

  constructor(public readonly options: {
    content: string
    destroyCallback?: () => void
    height?: string
    title?: string
    width?: string
  }) {
    this.element = document.createElement("div")
    this.element.innerHTML = options.content
    document.body.appendChild(this.element)
    createdDialogs.push(this)
  }

  destroy(): void {
    this.options.destroyCallback?.()
    this.element.remove()
  }
}

const siyuanMock = {
  Dialog: DialogMock,
  getFrontend,
  openTab,
}

const mainMock = {
  mountCanvasApp: vi.fn((element: HTMLElement, bootstrap: unknown) => {
    mountedApps.push({ bootstrap, element })
  }),
  unmountCanvasApp: vi.fn((element: HTMLElement) => {
    unmountedApps.push(element)
  }),
}

let pluginTabs: typeof import("@/canvas/plugin-tabs")
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
    moduleCache.set(normalizedPath, {})
    return {}
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

    if (specifier === "@/main") {
      return mainMock
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
  pluginTabs = loadModuleExports(resolve(process.cwd(), "src", "canvas", "plugin-tabs.ts")) as typeof pluginTabs
})

beforeEach(() => {
  document.body.innerHTML = ""
  createdDialogs.length = 0
  mountedApps.length = 0
  unmountedApps.length = 0
  getFrontend.mockReset()
  getFrontend.mockReturnValue("desktop")
  openTab.mockReset()
  mainMock.mountCanvasApp.mockClear()
  mainMock.unmountCanvasApp.mockClear()
})

describe("canvas plugin tabs", () => {
  it("opens a desktop custom tab outside mobile frontends", async () => {
    const plugin = { app: { name: "app" } }

    await pluginTabs.openCanvasEditorTab(
      plugin as any,
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )

    expect(openTab).toHaveBeenCalledWith(expect.objectContaining({
      app: plugin.app,
      custom: expect.objectContaining({
        data: { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
        title: "a.canvas",
      }),
      openNewTab: true,
    }))
    expect(createdDialogs).toHaveLength(0)
  })

  it("opens and unmounts a full screen dialog on mobile frontends", async () => {
    getFrontend.mockReturnValue("mobile")

    await pluginTabs.openCanvasEditorTab(
      { app: {} } as any,
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/mobile.canvas" },
      "Untitled.canvas",
    )

    expect(openTab).not.toHaveBeenCalled()
    expect(createdDialogs).toHaveLength(1)
    expect(createdDialogs[0].options).toEqual(expect.objectContaining({
      height: "100vh",
      title: "mobile.canvas",
      width: "100vw",
    }))
    expect(mountedApps).toEqual([
      expect.objectContaining({
        bootstrap: { path: "/data/storage/petal/siyuan-canvas/mobile.canvas" },
      }),
    ])

    const host = mountedApps[0].element
    createdDialogs[0].destroy()

    expect(unmountedApps).toEqual([host])
  })
})

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
  ModuleKind,
  ScriptTarget,
  transpileModule,
} from "typescript"
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const openTab = vi.fn()
const fetchSyncPost = vi.fn()
const fetchMock = vi.fn()
const getAllEditor = vi.fn(() => [])

const siyuanMock = {
  fetchSyncPost,
  getAllEditor,
}

let embedObserver: typeof import("@/canvas/canvas-embed-observer")
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

  if (extension === ".scss") {
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

    if (specifier === "@/canvas/plugin-tabs") {
      return { openCanvasEditorTab: openTab }
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

function createCanvasRaw(text: string): string {
  return JSON.stringify({
    edges: [],
    nodes: [
      {
        height: 120,
        id: "node-1",
        text,
        type: "text",
        width: 180,
        x: 0,
        y: 0,
      },
    ],
  })
}

beforeAll(() => {
  embedObserver = loadModuleExports(resolve(process.cwd(), "src", "canvas", "canvas-embed-observer.ts")) as typeof embedObserver
})

beforeEach(() => {
  document.body.innerHTML = ""
  fetchMock.mockReset()
  fetchSyncPost.mockReset()
  getAllEditor.mockReset()
  getAllEditor.mockReturnValue([])
  openTab.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  embedObserver.stopCanvasEmbedObserver()
})

describe("canvas embed observer", () => {
  it("refreshes visible embed blocks for a saved canvas path", async () => {
    document.body.innerHTML = `
      <div data-node-id="embed-1">
        <div class="canvas-embed-preview" data-canvas-path="/data/storage/petal/siyuan-canvas/a.canvas">
          <img src="old-preview" alt="a" />
        </div>
      </div>
      <div data-node-id="embed-2">
        <div class="canvas-embed-preview" data-canvas-path="/data/storage/petal/siyuan-canvas/b.canvas">
          <img src="old-other-preview" alt="b" />
        </div>
      </div>
    `
    fetchMock.mockResolvedValue(new Response(createCanvasRaw("updated preview"), { status: 200 }))
    fetchSyncPost.mockImplementation(async (url: string) => {
      if (url === "/api/asset/upload") {
        return {
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "a.svg": "assets/a-preview.svg",
            },
          },
        }
      }
      if (url === "/api/query/sql") {
        return {
          code: 0,
          data: [],
        }
      }
      if (url === "/api/block/updateBlock") {
        return {
          code: 0,
          data: null,
        }
      }
      if (url === "/api/attr/setBlockAttrs") {
        return {
          code: 0,
          data: null,
        }
      }
      throw new Error(`Unexpected request ${url}`)
    })

    embedObserver.startCanvasEmbedObserver({} as any, "siyuan-canvas")

    window.dispatchEvent(new CustomEvent("siyuan-canvas-embed-refresh", {
      detail: { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledWith("/api/file/getFile", expect.objectContaining({
      body: JSON.stringify({ path: "/data/storage/petal/siyuan-canvas/a.canvas" }),
      method: "POST",
    }))
    const image = document.querySelector<HTMLElement>('[data-node-id="embed-1"] .canvas-embed-preview img')
    expect(image?.getAttribute("src")).toContain("data:image/svg+xml;base64,")
    const otherImage = document.querySelector<HTMLElement>('[data-node-id="embed-2"] .canvas-embed-preview img')
    expect(otherImage?.getAttribute("src")).toBe("old-other-preview")
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/asset/upload", expect.any(FormData))
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/block/updateBlock", expect.objectContaining({
      data: "![a](assets/a-preview.svg)",
      dataType: "markdown",
      id: "embed-1",
    }))
    expect(fetchSyncPost).not.toHaveBeenCalledWith("/api/lute/spinBlockDOM", expect.anything())
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/attr/setBlockAttrs", {
      attrs: { "custom-canvas-path": "/data/storage/petal/siyuan-canvas/a.canvas" },
      id: "embed-1",
    })
    expect(fetchSyncPost).not.toHaveBeenCalledWith("/api/block/updateBlock", expect.objectContaining({
      id: "embed-2",
    }))
  })

  it("refreshes embed blocks found by custom canvas path attributes when no preview DOM is visible", async () => {
    const reload = vi.fn()
    fetchMock.mockResolvedValue(new Response(createCanvasRaw("updated from attr"), { status: 200 }))
    fetchSyncPost.mockImplementation(async (url: string, data: { stmt?: string }) => {
      if (url === "/api/asset/upload") {
        return {
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "a.svg": "assets/a-preview.svg",
            },
          },
        }
      }
      if (url === "/api/query/sql") {
        return {
          code: 0,
          data: [
            {
              block_id: "embed-from-attr",
              root_id: "20260608204514-rootdoc",
            },
          ],
        }
      }
      if (url === "/api/block/updateBlock") {
        return {
          code: 0,
          data: null,
        }
      }
      if (url === "/api/attr/setBlockAttrs") {
        return {
          code: 0,
          data: null,
        }
      }
      throw new Error(`Unexpected request ${url} ${JSON.stringify(data)}`)
    })
    getAllEditor.mockReturnValue([
      {
        protyle: {
          block: { rootID: "20260608204514-rootdoc" },
        },
        reload,
      },
    ])

    embedObserver.startCanvasEmbedObserver({} as any, "siyuan-canvas")

    window.dispatchEvent(new CustomEvent("siyuan-canvas-embed-refresh", {
      detail: { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSyncPost).toHaveBeenCalledWith("/api/query/sql", expect.objectContaining({
      stmt: expect.stringContaining("custom-canvas-path"),
    }))
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/query/sql", expect.objectContaining({
      stmt: expect.stringContaining("/data/storage/petal/siyuan-canvas/a.canvas"),
    }))
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/block/updateBlock", expect.objectContaining({
      data: "![a](assets/a-preview.svg)",
      dataType: "markdown",
      id: "embed-from-attr",
    }))
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/attr/setBlockAttrs", {
      attrs: { "custom-canvas-path": "/data/storage/petal/siyuan-canvas/a.canvas" },
      id: "embed-from-attr",
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it("refreshes visible embed images rendered inside HTML block iframes", async () => {
    document.body.innerHTML = `
      <div data-node-id="embed-html">
        <iframe></iframe>
      </div>
    `
    const iframe = document.querySelector("iframe") as HTMLIFrameElement
    iframe.contentDocument?.body.insertAdjacentHTML("beforeend", `
      <div class="canvas-embed-preview" data-canvas-path="//data/storage/petal/siyuan-canvas/a.canvas">
        <img src="old-iframe-preview" alt="Canvas" />
      </div>
    `)
    fetchMock.mockResolvedValue(new Response(createCanvasRaw("updated iframe preview"), { status: 200 }))
    fetchSyncPost.mockImplementation(async (url: string) => {
      if (url === "/api/asset/upload") {
        return {
          code: 0,
          data: {
            errFiles: [],
            succMap: {
              "a.svg": "assets/a-preview.svg",
            },
          },
        }
      }
      if (url === "/api/query/sql") {
        return {
          code: 0,
          data: [],
        }
      }
      if (url === "/api/block/updateBlock") {
        return {
          code: 0,
          data: null,
        }
      }
      if (url === "/api/attr/setBlockAttrs") {
        return {
          code: 0,
          data: null,
        }
      }
      throw new Error(`Unexpected request ${url}`)
    })

    embedObserver.startCanvasEmbedObserver({} as any, "siyuan-canvas")

    window.dispatchEvent(new CustomEvent("siyuan-canvas-embed-refresh", {
      detail: { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const image = iframe.contentDocument?.querySelector<HTMLImageElement>(".canvas-embed-preview img")
    expect(image?.getAttribute("src")).toContain("data:image/svg+xml;base64,")
    expect(fetchSyncPost).toHaveBeenCalledWith("/api/block/updateBlock", expect.objectContaining({
      data: "![a](assets/a-preview.svg)",
      dataType: "markdown",
      id: "embed-html",
    }))
  })

  it("opens a canvas from a reloaded image block by reading the custom canvas path attribute", async () => {
    document.body.innerHTML = `
      <div data-node-id="embed-reloaded">
        <span>canvas-embed</span>
        <img src="preview" alt="Canvas" />
      </div>
    `
    fetchSyncPost.mockImplementation(async (url: string, data: { id?: string }) => {
      if (url === "/api/attr/getBlockAttrs") {
        return {
          code: 0,
          data: {
            "custom-canvas-path": "/data/storage/petal/siyuan-canvas/a.canvas",
          },
        }
      }
      throw new Error(`Unexpected request ${url} ${JSON.stringify(data)}`)
    })

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")

    document.querySelector<HTMLImageElement>('[data-node-id="embed-reloaded"] img')?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSyncPost).toHaveBeenCalledWith("/api/attr/getBlockAttrs", {
      id: "embed-reloaded",
    })
    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })

  it("falls back to the preview data path when a clicked block has no custom canvas path attribute", async () => {
    document.body.innerHTML = `
      <div data-node-id="embed-without-attr">
        <div class="canvas-embed-preview" data-canvas-path="//data/storage/petal/siyuan-canvas/a.canvas">
          <img src="preview" alt="Canvas" />
        </div>
      </div>
    `
    fetchSyncPost.mockImplementation(async (url: string, data: { id?: string }) => {
      if (url === "/api/attr/getBlockAttrs") {
        return {
          code: 0,
          data: {},
        }
      }
      throw new Error(`Unexpected request ${url} ${JSON.stringify(data)}`)
    })

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")

    document.querySelector<HTMLImageElement>('[data-node-id="embed-without-attr"] img')?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSyncPost).toHaveBeenCalledWith("/api/attr/getBlockAttrs", {
      id: "embed-without-attr",
    })
    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })

  it("opens a canvas from an HTML block iframe by reading the outer block custom canvas path attribute", async () => {
    document.body.innerHTML = `
      <div data-node-id="embed-html">
        <iframe></iframe>
      </div>
    `
    const iframe = document.querySelector("iframe") as HTMLIFrameElement
    iframe.contentDocument?.body.insertAdjacentHTML("beforeend", `
      <div class="canvas-embed-preview" data-canvas-path="//data/storage/petal/siyuan-canvas/a.canvas">
        <img src="preview" alt="Canvas" />
      </div>
    `)
    fetchSyncPost.mockImplementation(async (url: string, data: { id?: string }) => {
      if (url === "/api/attr/getBlockAttrs") {
        return {
          code: 0,
          data: {
            "custom-canvas-path": "/data/storage/petal/siyuan-canvas/a.canvas",
          },
        }
      }
      throw new Error(`Unexpected request ${url} ${JSON.stringify(data)}`)
    })

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")

    iframe.contentDocument?.querySelector("img")?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSyncPost).toHaveBeenCalledWith("/api/attr/getBlockAttrs", {
      id: "embed-html",
    })
    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })

  it("opens a canvas from a reloaded HTML iframe preview path when no outer block id is available", async () => {
    document.body.innerHTML = `
      <iframe></iframe>
    `
    const iframe = document.querySelector("iframe") as HTMLIFrameElement
    iframe.contentDocument?.body.insertAdjacentHTML("beforeend", `
      <html><head></head><body>
        <div class="canvas-embed-preview" data-canvas-path="//data/storage/petal/siyuan-canvas/a.canvas">
          <img src="preview" alt="Canvas" />
        </div>
      </body></html>
    `)

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")

    iframe.contentDocument?.querySelector("img")?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSyncPost).not.toHaveBeenCalledWith("/api/attr/getBlockAttrs", expect.anything())
    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })

  it("opens a canvas from a reloaded HTML iframe document path when clicking a non-image preview element", async () => {
    document.body.innerHTML = `
      <iframe></iframe>
    `
    const iframe = document.querySelector("iframe") as HTMLIFrameElement
    iframe.contentDocument?.body.insertAdjacentHTML("beforeend", `
      <div class="canvas-embed-preview" data-canvas-path="//data/storage/petal/siyuan-canvas/a.canvas">
        <span class="canvas-embed-title">Canvas</span>
      </div>
    `)

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")

    iframe.contentDocument?.querySelector(".canvas-embed-title")?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })

  it("creates an iframe overlay from the iframe document preview path without an outer block id", async () => {
    document.body.innerHTML = `
      <div>
        <iframe></iframe>
      </div>
    `
    const iframe = document.querySelector("iframe") as HTMLIFrameElement
    iframe.contentDocument?.body.insertAdjacentHTML("beforeend", `
      <div class="canvas-embed-preview" data-canvas-path="//data/storage/petal/siyuan-canvas/a.canvas">
        <img src="preview" alt="Canvas" />
      </div>
    `)

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")
    await new Promise((resolve) => setTimeout(resolve, 0))

    document.querySelector<HTMLElement>('[data-canvas-embed-iframe-overlay="true"]')?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })

  it("opens a canvas from a reloaded preview path when no block id is available", async () => {
    document.body.innerHTML = `
      <div class="canvas-embed-preview" data-canvas-path="//data/storage/petal/siyuan-canvas/a.canvas">
        <img src="preview" alt="Canvas" />
      </div>
    `

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")

    document.querySelector<HTMLImageElement>("img")?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSyncPost).not.toHaveBeenCalledWith("/api/attr/getBlockAttrs", expect.anything())
    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })

  it("opens a canvas from a reloaded HTML iframe overlay when iframe content events are unavailable", async () => {
    document.body.innerHTML = `
      <div data-node-id="embed-html-overlay">
        <iframe></iframe>
      </div>
    `
    fetchSyncPost.mockImplementation(async (url: string, data: { id?: string }) => {
      if (url === "/api/attr/getBlockAttrs") {
        return {
          code: 0,
          data: {
            "custom-canvas-path": "/data/storage/petal/siyuan-canvas/a.canvas",
          },
        }
      }
      throw new Error(`Unexpected request ${url} ${JSON.stringify(data)}`)
    })

    embedObserver.startCanvasEmbedObserver({ app: "app" } as any, "siyuan-canvas")
    await new Promise((resolve) => setTimeout(resolve, 0))

    document.querySelector<HTMLElement>('[data-canvas-embed-iframe-overlay="true"]')?.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchSyncPost).toHaveBeenCalledWith("/api/attr/getBlockAttrs", {
      id: "embed-html-overlay",
    })
    expect(openTab).toHaveBeenCalledWith(
      { app: "app" },
      "siyuan-canvas",
      { path: "/data/storage/petal/siyuan-canvas/a.canvas" },
      "Untitled.canvas",
    )
  })
})

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
  afterEach,
  beforeEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { mount } from "@vue/test-utils"
import {
  defineComponent,
  h,
  nextTick,
} from "vue"
import {
  transpileModule,
  ModuleKind,
  ScriptTarget,
} from "typescript"

import type { CanvasTabBootstrap } from "@/main"
import {
  createDefaultCanvasPluginData,
  type CanvasPluginData,
  rememberRecentCanvasFile,
} from "@/canvas/plugin-data"
import type { ModuleExports } from "vitest"

const openTab = vi.fn()
const showMessage = vi.fn()
const fileNodeLookupMock = {
  findSiyuanAssetByPath: vi.fn(async () => null),
  findSiyuanDocumentByPath: vi.fn(async () => null),
}
const siyuanMock = {
  openTab,
  showMessage,
}

let useCanvasEditor: typeof import("@/canvas/use-canvas-editor").useCanvasEditor
const nodeRequire = createRequire(import.meta.url)
const moduleCache = new Map<string, ModuleExports>()

interface EditorHarnessResult {
  editor: ReturnType<typeof useCanvasEditor>
  plugin: ReturnType<typeof createPluginMock>
  wrapper: ReturnType<typeof mount>
}

const workspaceFiles = new Map<string, string>()
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString()

  if (url === "/api/file/getFile") {
    const body = JSON.parse(String(init?.body || "{}")) as { path?: string }
    const raw = body.path ? workspaceFiles.get(body.path) : undefined
    if (raw === undefined) {
      return new Response(JSON.stringify({ msg: `Missing file: ${body.path || ""}` }), {
        status: 404,
      })
    }

    return new Response(raw, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  if (url === "/api/file/putFile") {
    const formData = init?.body as FormData
    const path = String(formData.get("path") || "")
    const file = formData.get("file")
    if (!(file instanceof Blob)) {
      return new Response(JSON.stringify({ code: -1, msg: "Missing file payload" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    workspaceFiles.set(path, await file.text())
    return new Response(JSON.stringify({ code: 0 }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  return new Response(JSON.stringify({ msg: `Unhandled request: ${url}` }), {
    status: 500,
    headers: {
      "Content-Type": "application/json",
    },
  })
})

function resolveLocalModulePathSync(specifier: string, importer?: string): string {
  const basePath = specifier.startsWith("@/")
    ? resolve(process.cwd(), "src", specifier.slice(2))
    : resolve(importer ? dirname(importer) : process.cwd(), specifier)

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    `${basePath}.json`,
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

  if (extname(normalizedPath) === ".json") {
    const jsonText = readFileSync(normalizedPath, "utf8")
    const parsed = JSON.parse(jsonText) as ModuleExports
    moduleCache.set(normalizedPath, parsed)
    return parsed
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

    if (
      specifier === "@/api"
      || specifier === "@/canvas/siyuan-file-node-lookups"
      || specifier === "@/canvas/siyuan-kernel-file-node-lookups"
    ) {
      return fileNodeLookupMock
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
  return `${JSON.stringify({
    nodes: [
      {
        id: "n1",
        type: "text",
        text,
        x: 80,
        y: 80,
        width: 320,
        height: 180,
      },
    ],
    edges: [],
  }, null, "\t")}\n`
}

function createPluginMock() {
  let pluginData: CanvasPluginData = createDefaultCanvasPluginData()

  return {
    app: {},
    getCanvasSettings: vi.fn(() => ({
      ...pluginData.settings,
    })),
    getRecentCanvasFiles: vi.fn(() => pluginData.recentFiles.map((item) => ({ ...item }))),
    openCanvasSettings: vi.fn(),
    openCanvasTab: vi.fn(),
    rememberRecentCanvas: vi.fn(async (path: string, title?: string) => {
      pluginData = rememberRecentCanvasFile(pluginData, {
        openedAt: new Date("2026-04-11T09:00:00.000Z").toISOString(),
        path,
        title: title || path.split("/").pop() || path,
      })
    }),
  }
}

async function flushEditor(): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

async function mountEditor(bootstrap: CanvasTabBootstrap = {}): Promise<EditorHarnessResult> {
  const plugin = createPluginMock()
  let editor!: ReturnType<typeof useCanvasEditor>

  const Harness = defineComponent({
    setup() {
      editor = useCanvasEditor(plugin as any, bootstrap, vi.fn())
      return () => h("div")
    },
  })

  const wrapper = mount(Harness)
  await flushEditor()

  return {
    editor,
    plugin,
    wrapper,
  }
}

beforeAll(() => {
  const loaded = loadModuleExports(resolve(process.cwd(), "src", "canvas", "use-canvas-editor.ts"))
  useCanvasEditor = loaded.useCanvasEditor as typeof useCanvasEditor
})

beforeEach(() => {
  workspaceFiles.clear()
  showMessage.mockReset()
  openTab.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(window, "prompt").mockReturnValue(null)

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:canvas-export"),
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useCanvasEditor file lifecycle flows", () => {
  it("opens a workspace canvas path, normalizes the extension, and refreshes recent files", async () => {
    workspaceFiles.set("/data/storage/siyuan-canvas/opened.canvas", createCanvasRaw("opened from workspace"))
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("opened")

    const { editor, plugin, wrapper } = await mountEditor()

    await editor.openPath()
    await flushEditor()

    expect(promptSpy).toHaveBeenCalledOnce()
    expect(editor.state.filePath).toBe("/data/storage/siyuan-canvas/opened.canvas")
    expect(editor.state.document.nodes[0]).toMatchObject({
      id: "n1",
      text: "opened from workspace",
      type: "text",
    })
    expect(plugin.rememberRecentCanvas).toHaveBeenCalledWith(
      "/data/storage/siyuan-canvas/opened.canvas",
      "opened.canvas",
    )
    expect(editor.recentFiles).toEqual([
      expect.objectContaining({
        path: "/data/storage/siyuan-canvas/opened.canvas",
        title: "opened.canvas",
      }),
    ])

    wrapper.unmount()
  })

  it("imports a local canvas file and exports the current document through a download link", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null)
    const clickSpy = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    const createdAnchors: HTMLAnchorElement[] = []

    vi.spyOn(document, "createElement").mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options)
      if (tagName === "a") {
        const anchor = element as HTMLAnchorElement
        anchor.click = clickSpy
        createdAnchors.push(anchor)
      }

      return element
    }) as typeof document.createElement)

    const { editor, wrapper } = await mountEditor()

    await editor.importCanvas(new File([createCanvasRaw("imported locally")], "imported.canvas", {
      type: "application/json",
    }))
    await flushEditor()

    expect(promptSpy).not.toHaveBeenCalled()
    expect(editor.suggestedFilename).toBe("imported.canvas")
    expect(editor.state.filePath).toBe("")
    expect(editor.state.document.nodes[0]).toMatchObject({
      id: "n1",
      text: "imported locally",
      type: "text",
    })

    editor.exportCanvas()

    expect(clickSpy).toHaveBeenCalledOnce()
    expect(createdAnchors[0]?.download).toBe("imported.canvas")
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:canvas-export")

    const exportBlob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob
    expect(await exportBlob.text()).toContain("\"text\": \"imported locally\"")

    wrapper.unmount()
  })

  it("saves the current document to the workspace and records the saved path in recent files", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("saved-workspace")
    const { editor, plugin, wrapper } = await mountEditor()

    editor.addNode("text")
    await flushEditor()

    const createdNodeId = editor.state.selectedNodeId
    editor.updateTextNodeContent(createdNodeId, "saved to workspace")
    await flushEditor()

    await editor.save()
    await flushEditor()

    const savedPath = "/data/storage/siyuan-canvas/saved-workspace.canvas"
    const savedRaw = workspaceFiles.get(savedPath)

    expect(promptSpy).toHaveBeenCalledOnce()
    expect(savedRaw).toBeTruthy()
    expect(savedRaw).toContain("\"text\": \"saved to workspace\"")
    expect(editor.state.filePath).toBe(savedPath)
    expect(editor.suggestedFilename).toBe("saved-workspace.canvas")
    expect(plugin.rememberRecentCanvas).toHaveBeenCalledWith(savedPath, "saved-workspace.canvas")
    expect(editor.recentFiles[0]).toEqual(expect.objectContaining({
      path: savedPath,
      title: "saved-workspace.canvas",
    }))

    wrapper.unmount()
  })

  it("captures external save conflicts and can overwrite the disk version afterwards", async () => {
    const path = "/data/storage/siyuan-canvas/conflict.canvas"
    workspaceFiles.set(path, createCanvasRaw("original on disk"))

    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(path)
    const { editor, wrapper } = await mountEditor({ path })

    editor.updateTextNodeContent("n1", "edited in memory")
    await flushEditor()

    workspaceFiles.set(path, createCanvasRaw("changed on disk"))

    await editor.save()
    await flushEditor()

    expect(promptSpy).toHaveBeenCalledOnce()
    expect(editor.state.conflict?.path).toBe(path)
    expect(editor.state.conflict?.document?.nodes[0]).toMatchObject({
      id: "n1",
      text: "changed on disk",
      type: "text",
    })
    expect(editor.state.isDirty).toBe(true)
    expect(workspaceFiles.get(path)).toContain("\"text\": \"changed on disk\"")

    await editor.overwriteConflictVersion()
    await flushEditor()

    expect(editor.state.conflict).toBeNull()
    expect(editor.state.isDirty).toBe(false)
    expect(workspaceFiles.get(path)).toContain("\"text\": \"edited in memory\"")

    wrapper.unmount()
  })

  it("loads the newer disk version into the editor after a conflict is detected", async () => {
    const path = "/data/storage/siyuan-canvas/load-conflict.canvas"
    workspaceFiles.set(path, createCanvasRaw("before conflict"))

    vi.spyOn(window, "prompt").mockReturnValue(path)
    const { editor, wrapper } = await mountEditor({ path })

    editor.updateTextNodeContent("n1", "local edit")
    await flushEditor()

    workspaceFiles.set(path, createCanvasRaw("newer disk version"))

    await editor.save()
    await flushEditor()

    expect(editor.state.conflict?.document?.nodes[0]).toMatchObject({
      id: "n1",
      text: "newer disk version",
      type: "text",
    })

    editor.loadConflictVersion()
    await flushEditor()

    expect(editor.state.conflict).toBeNull()
    expect(editor.state.isDirty).toBe(false)
    expect(editor.state.document.nodes[0]).toMatchObject({
      id: "n1",
      text: "newer disk version",
      type: "text",
    })
    expect(editor.suggestedFilename).toBe("load-conflict.canvas")

    wrapper.unmount()
  })
})

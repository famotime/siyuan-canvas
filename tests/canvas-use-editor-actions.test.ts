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
  updateCanvasPluginUiState,
} from "@/canvas/plugin-data"
import type { ModuleExports } from "vitest"

const openTab = vi.fn()
const showMessage = vi.fn()
const confirm = vi.fn()
const fileNodeLookupMock = {
  findSiyuanAssetByPath: vi.fn(async () => null),
  findSiyuanBlockById: vi.fn(async () => null),
  findSiyuanBlocksByQuery: vi.fn(async () => []),
  findSiyuanDocumentByBlockId: vi.fn(async () => null),
  findSiyuanDocumentByPath: vi.fn(async () => null),
  findSiyuanDocumentsByQuery: vi.fn(async () => []),
  findSiyuanImageAssetByBlockId: vi.fn(async () => null),
  findSiyuanImageAssetsByQuery: vi.fn(async () => []),
  getSiyuanBlockMarkdown: vi.fn(async () => ""),
  getSiyuanDocumentMarkdown: vi.fn(async () => ""),
}
type DialogAction = "cancel" | "confirm"

interface DialogResponse {
  action: DialogAction
  value: string
}

const dialogResponses: DialogResponse[] = []
const confirmResponses: boolean[] = []
const workspaceDirectoryEntries: Array<{ isDir: boolean, isSymlink: boolean, name: string, updated?: number }> = []
const localFiles = new Map<string, string>()

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

function confirmMock(
  title: string,
  text: string,
  confirmCallback?: (dialog: { destroy: () => void }) => void,
  cancelCallback?: (dialog: { destroy: () => void }) => void,
): void {
  confirm(title, text)
  const accepted = confirmResponses.shift() ?? false
  const dialog = {
    destroy: vi.fn(),
  }

  queueMicrotask(() => {
    if (accepted) {
      confirmCallback?.(dialog)
      return
    }

    cancelCallback?.(dialog)
  })
}

const apiMock = {
  putFile: vi.fn(async (path: string, _isDir: boolean, file: Blob) => {
    workspaceFiles.set(path, await file.text())
    return { code: 0 }
  }),
  readDir: vi.fn(async () => [...workspaceDirectoryEntries]),
}

const localFsMock = {
  access: vi.fn(async (path: string) => {
    if (!localFiles.has(path)) {
      throw new Error(`ENOENT: ${path}`)
    }
  }),
  readFile: vi.fn(async (path: string, encoding?: string) => {
    if (encoding !== "utf8") {
      throw new Error(`Unexpected encoding: ${String(encoding)}`)
    }

    const value = localFiles.get(path)
    if (value === undefined) {
      throw new Error(`ENOENT: ${path}`)
    }

    return value
  }),
  writeFile: vi.fn(async (path: string, value: string) => {
    localFiles.set(path, value)
  }),
}

const siyuanMock = {
  confirm: confirmMock,
  Dialog: DialogMock,
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

    if (specifier === "@/api") {
      return apiMock
    }

    if (
      specifier === "@/canvas/siyuan-file-node-lookups"
      || specifier === "@/canvas/siyuan-kernel-file-node-lookups"
    ) {
      return fileNodeLookupMock
    }

    if (specifier === "node:fs/promises") {
      return localFsMock
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

function queueDialogResponse(value: string, action: DialogAction = "confirm"): void {
  dialogResponses.push({ action, value })
}

function queueConfirmResponse(accepted: boolean): void {
  confirmResponses.push(accepted)
}

function createPluginMock() {
  let pluginData: CanvasPluginData = createDefaultCanvasPluginData()

  return {
    app: {},
    getCanvasSettings: vi.fn(() => ({
      ...pluginData.settings,
    })),
    getCanvasUiState: vi.fn(() => ({
      inspectorSections: {
        ...pluginData.ui.inspectorSections,
      },
    })),
    getRecentCanvasFiles: vi.fn(() => pluginData.recentFiles.map((item) => ({ ...item }))),
    openCanvasSettings: vi.fn(),
    openCanvasTab: vi.fn(),
    rememberRecentCanvas: vi.fn(async (path: string, title?: string, sourceType?: "local" | "workspace") => {
      pluginData = rememberRecentCanvasFile(pluginData, {
        openedAt: new Date("2026-04-11T09:00:00.000Z").toISOString(),
        path,
        sourceType,
        title: title || path.split("/").pop() || path,
      })
    }),
    updateCanvasUiState: vi.fn(async (ui: Parameters<typeof updateCanvasPluginUiState>[1]) => {
      pluginData = updateCanvasPluginUiState(pluginData, ui)
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
  dialogResponses.length = 0
  confirmResponses.length = 0
  workspaceDirectoryEntries.length = 0
  localFiles.clear()
  workspaceFiles.clear()
  apiMock.readDir.mockClear()
  apiMock.putFile.mockClear()
  localFsMock.access.mockClear()
  localFsMock.readFile.mockClear()
  localFsMock.writeFile.mockClear()
  confirm.mockReset()
  showMessage.mockReset()
  openTab.mockReset()
  fetchMock.mockClear()
  fileNodeLookupMock.findSiyuanAssetByPath.mockReset()
  fileNodeLookupMock.findSiyuanAssetByPath.mockResolvedValue(null)
  fileNodeLookupMock.findSiyuanBlockById.mockReset()
  fileNodeLookupMock.findSiyuanBlockById.mockResolvedValue(null)
  fileNodeLookupMock.findSiyuanBlocksByQuery.mockReset()
  fileNodeLookupMock.findSiyuanBlocksByQuery.mockResolvedValue([])
  fileNodeLookupMock.findSiyuanDocumentByBlockId.mockReset()
  fileNodeLookupMock.findSiyuanDocumentByBlockId.mockResolvedValue(null)
  fileNodeLookupMock.findSiyuanDocumentByPath.mockReset()
  fileNodeLookupMock.findSiyuanDocumentByPath.mockResolvedValue(null)
  fileNodeLookupMock.findSiyuanDocumentsByQuery.mockReset()
  fileNodeLookupMock.findSiyuanDocumentsByQuery.mockResolvedValue([])
  fileNodeLookupMock.findSiyuanImageAssetByBlockId.mockReset()
  fileNodeLookupMock.findSiyuanImageAssetByBlockId.mockResolvedValue(null)
  fileNodeLookupMock.findSiyuanImageAssetsByQuery.mockReset()
  fileNodeLookupMock.findSiyuanImageAssetsByQuery.mockResolvedValue([])
  fileNodeLookupMock.getSiyuanBlockMarkdown.mockReset()
  fileNodeLookupMock.getSiyuanBlockMarkdown.mockResolvedValue("")
  fileNodeLookupMock.getSiyuanDocumentMarkdown.mockReset()
  fileNodeLookupMock.getSiyuanDocumentMarkdown.mockResolvedValue("")
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(window, "prompt").mockImplementation(() => {
    throw new Error("prompt() is not supported.")
  })

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
  it("shows the bottom toolbar after the stage is activated", async () => {
    const { editor, wrapper } = await mountEditor()

    expect(editor.bottomToolbarVisible).toBe(false)

    editor.activateCanvasSurface()
    await flushEditor()

    expect(editor.bottomToolbarVisible).toBe(true)

    editor.deactivateCanvasSurface()
    await flushEditor()

    expect(editor.bottomToolbarVisible).toBe(false)

    wrapper.unmount()
  })

  it("opens the file picker from the bottom toolbar instead of inserting a placeholder node", async () => {
    const { editor, wrapper } = await mountEditor()

    editor.openFilePickerDialog()
    await flushEditor()

    expect(editor.filePickerDialog.visible).toBe(true)
    expect(editor.state.document.nodes).toHaveLength(0)

    wrapper.unmount()
  })

  it("updates file picker result groups from the query", async () => {
    fileNodeLookupMock.findSiyuanBlocksByQuery.mockResolvedValueOnce([{
      hpath: "/Projects/Roadmap",
      id: "20260412094047-block01",
      path: "/data/roadmap.sy",
      rootId: "20260412094047-root001",
      title: "Road block",
    }])
    fileNodeLookupMock.findSiyuanDocumentsByQuery.mockResolvedValueOnce([{
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/data/roadmap.sy",
      title: "Roadmap",
    }])
    fileNodeLookupMock.findSiyuanImageAssetsByQuery.mockResolvedValueOnce([{
      blockId: "20260412094047-imgroad",
      name: "road.png",
      openPath: "/data/assets/road.png",
      path: "assets/road.png",
      title: "road.png",
    }])
    workspaceDirectoryEntries.push({ isDir: false, isSymlink: false, name: "road.canvas" })

    const { editor, wrapper } = await mountEditor()

    await editor.updateFilePickerQuery("road")
    await flushEditor()

    expect(editor.filePickerDialog.groups.documents).toEqual([{
      kind: "document",
      path: "/data/roadmap.sy",
      subtitle: "/Projects/Roadmap",
      title: "Roadmap",
    }])
    expect(editor.filePickerDialog.groups.blocks).toEqual([{
      blockId: "20260412094047-block01",
      kind: "block",
      path: "20260412094047-block01",
      subtitle: "/Projects/Roadmap",
      title: "Road block",
    }])
    expect(editor.filePickerDialog.groups.images).toEqual([{
      blockId: "20260412094047-imgroad",
      kind: "image",
      path: "assets/road.png",
      subtitle: "assets/road.png",
      title: "road.png",
    }])
    expect(editor.filePickerDialog.groups.canvases).toEqual([{
      kind: "canvas",
      path: "/data/storage/siyuan-canvas/road.canvas",
      subtitle: "/data/storage/siyuan-canvas/road.canvas",
      title: "road.canvas",
    }])

    wrapper.unmount()
  })

  it("finds a content block picker result by a copied block id", async () => {
    fileNodeLookupMock.findSiyuanBlockById.mockResolvedValueOnce({
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/data/roadmap.sy",
      rootId: "20260412094047-root001",
      title: "图片说明",
    })

    const { editor, wrapper } = await mountEditor()

    await editor.updateFilePickerQuery("20260412094047-ihhbskn")
    await flushEditor()

    expect(editor.filePickerDialog.groups.blocks).toEqual([{
      blockId: "20260412094047-ihhbskn",
      kind: "block",
      path: "20260412094047-ihhbskn",
      subtitle: "/Projects/Roadmap",
      title: "图片说明",
    }])

    wrapper.unmount()
  })

  it("finds a document picker result by an exact document id", async () => {
    fileNodeLookupMock.findSiyuanDocumentByBlockId.mockResolvedValueOnce({
      hpath: "/Projects/Roadmap",
      id: "20260412094047-doc0001",
      path: "/data/roadmap.sy",
      title: "Roadmap",
    })

    const { editor, wrapper } = await mountEditor()

    await editor.updateFilePickerQuery("20260412094047-doc0001")
    await flushEditor()

    expect(editor.filePickerDialog.groups.documents).toEqual([{
      kind: "document",
      path: "/data/roadmap.sy",
      subtitle: "/Projects/Roadmap",
      title: "Roadmap",
    }])
    expect(editor.filePickerDialog.groups.blocks).toEqual([])

    wrapper.unmount()
  })

  it("finds an image picker result by a copied image block id", async () => {
    fileNodeLookupMock.findSiyuanImageAssetByBlockId.mockResolvedValueOnce({
      blockId: "20260412094047-ihhbskn",
      name: "diagram.png",
      openPath: "/data/assets/diagram.png",
      path: "assets/diagram.png",
      title: "Diagram",
    })

    const { editor, wrapper } = await mountEditor()

    await editor.updateFilePickerQuery("20260412094047-ihhbskn")
    await flushEditor()

    expect(editor.filePickerDialog.groups.images).toEqual([{
      blockId: "20260412094047-ihhbskn",
      kind: "image",
      path: "assets/diagram.png",
      subtitle: "assets/diagram.png",
      title: "Diagram",
    }])

    wrapper.unmount()
  })

  it("creates a document file node from picker selection and selects it", async () => {
    const { editor, wrapper } = await mountEditor()

    editor.openFilePickerDialog()
    await flushEditor()

    await editor.selectFilePickerResult({
      kind: "document",
      path: "/data/roadmap.sy",
      subtitle: "/Projects/Roadmap",
      title: "Roadmap",
    })
    await flushEditor()

    expect(editor.state.document.nodes).toHaveLength(1)
    expect(editor.state.document.nodes[0]).toMatchObject({
      file: "/data/roadmap.sy",
      type: "file",
    })
    expect(editor.selectedNode?.id).toBe(editor.state.document.nodes[0]?.id)
    expect(editor.filePickerDialog.visible).toBe(false)

    wrapper.unmount()
  })

  it("creates an image file node from picker selection as an image preview", async () => {
    fileNodeLookupMock.findSiyuanAssetByPath.mockResolvedValue({
      name: "diagram.png",
      openPath: "/data/assets/diagram.png",
      path: "assets/diagram.png",
      title: "Diagram",
    })

    const { editor, wrapper } = await mountEditor()

    await editor.selectFilePickerResult({
      blockId: "20260412094047-ihhbskn",
      kind: "image",
      path: "assets/diagram.png",
      subtitle: "assets/diagram.png",
      title: "Diagram",
    } as any)
    await flushEditor()

    expect(editor.state.document.nodes).toHaveLength(1)
    expect(editor.state.document.nodes[0]).toMatchObject({
      file: "assets/diagram.png",
      type: "file",
    })

    const preview = editor.getFileNodePreview(editor.selectedNode)
    expect(preview.kind).toBe("image")
    expect(preview.imageSrc).toBe("/data/assets/diagram.png")
    expect(preview.previewHtml).toBeUndefined()

    wrapper.unmount()
  })

  it("renders a block preview for a non-document block id and strips internal attrs", async () => {
    fileNodeLookupMock.findSiyuanBlockById.mockResolvedValue({
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/data/roadmap.sy",
      rootId: "20260412094047-root001",
      title: "第一项",
    })
    fileNodeLookupMock.getSiyuanBlockMarkdown.mockResolvedValue(`* {: id="20260412094047-ihhbskn"}第一项
  {: id="20260412094047-child001"}`)

    const { editor, wrapper } = await mountEditor()

    await editor.selectFilePickerResult({
      blockId: "20260412094047-ihhbskn",
      kind: "block",
      path: "20260412094047-ihhbskn",
      subtitle: "/Projects/Roadmap",
      title: "第一项",
    } as any)
    await flushEditor()

    const preview = editor.getFileNodePreview(editor.selectedNode)
    expect(preview.kind).toBe("block")
    expect(preview.previewHtml).toContain("<ul><li>第一项</li></ul>")
    expect(preview.previewHtml).not.toContain("{:")
    expect(preview.previewHtml).not.toContain("20260412094047-child001")

    wrapper.unmount()
  })

  it("renders a real markdown preview for a resolved document file node", async () => {
    fileNodeLookupMock.findSiyuanDocumentByPath.mockResolvedValue({
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/data/roadmap.sy",
      title: "Roadmap",
    })
    fileNodeLookupMock.getSiyuanDocumentMarkdown.mockResolvedValue(`# Roadmap
{: id="20260412094047-ihhbskn" updated="20260412100000"}

Preview body
{: id="20260412094047-abcdefg"}`)

    const { editor, wrapper } = await mountEditor()

    await editor.selectFilePickerResult({
      kind: "document",
      path: "/data/roadmap.sy",
      subtitle: "/Projects/Roadmap",
      title: "Roadmap",
    })
    await flushEditor()

    const preview = editor.getFileNodePreview(editor.selectedNode)
    expect(preview.kind).toBe("document")
    expect(preview.previewHtml).toContain("<h1>Roadmap</h1>")
    expect(preview.previewHtml).toContain("<p>Preview body</p>")
    expect(preview.previewHtml).not.toContain("{:")
    expect(preview.previewHtml).not.toContain("updated=")
    expect(preview.previewHtml).not.toContain("20260412094047-ihhbskn")

    wrapper.unmount()
  })

  it("resolves a copied image block id into an image preview", async () => {
    fileNodeLookupMock.findSiyuanBlockById.mockResolvedValue({
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/data/roadmap.sy",
      rootId: "20260412094047-root001",
      title: "Diagram",
    })
    fileNodeLookupMock.getSiyuanBlockMarkdown.mockResolvedValue(`![Diagram](assets/diagram.png)
{: id="20260412094047-ihhbskn"}`)

    const { editor, wrapper } = await mountEditor()

    editor.addNode("file")
    await flushEditor()
    editor.updateNodeField("file", "20260412094047-ihhbskn")
    await flushEditor()

    const preview = editor.getFileNodePreview(editor.selectedNode)
    expect(preview.kind).toBe("block")
    expect(preview.imageSrc).toBe("/data/assets/diagram.png")

    wrapper.unmount()
  })

  it("resolves raw image markdown in the file field into an image preview", async () => {
    fileNodeLookupMock.findSiyuanBlockById.mockResolvedValue({
      hpath: "/Projects/Roadmap",
      id: "20260412094047-ihhbskn",
      path: "/data/roadmap.sy",
      rootId: "20260412094047-root001",
      title: "Diagram",
    })
    fileNodeLookupMock.getSiyuanBlockMarkdown.mockResolvedValue(`![Diagram](assets/diagram.png)
{: id="20260412094047-ihhbskn"}`)

    const { editor, wrapper } = await mountEditor()

    editor.addNode("file")
    await flushEditor()
    editor.updateNodeField("file", `![Diagram](assets/diagram.png)
{: id="20260412094047-ihhbskn"}`)
    await flushEditor()

    const preview = editor.getFileNodePreview(editor.selectedNode)
    expect(preview.kind).toBe("block")
    expect(preview.imageSrc).toBe("/data/assets/diagram.png")
    expect(preview.headline).toBe("Diagram")

    wrapper.unmount()
  })

  it("opens the create-edge dialog only when exactly one node is selected", async () => {
    const { editor, wrapper } = await mountEditor()

    editor.openCreateEdgeDialog()
    await flushEditor()

    expect(showMessage).toHaveBeenCalled()
    expect(editor.createEdgeDialog.visible).toBe(false)

    editor.addNode("text")
    await flushEditor()

    editor.openCreateEdgeDialog()
    await flushEditor()

    expect(editor.createEdgeDialog.visible).toBe(true)
    expect(editor.newEdgeSourceId).toBe(editor.state.selectedNodeId)

    wrapper.unmount()
  })

  it("filters create-edge source and target node options by keyword and excludes self-connections", async () => {
    const { editor, wrapper } = await mountEditor()

    editor.addNode("text")
    await flushEditor()
    const firstNodeId = editor.state.selectedNodeId
    editor.updateTextNodeContent(firstNodeId, "Alpha source")
    await flushEditor()

    editor.addNode("text")
    await flushEditor()
    const secondNodeId = editor.state.selectedNodeId
    editor.updateTextNodeContent(secondNodeId, "Beta target")
    await flushEditor()

    editor.selectNode(firstNodeId)
    await flushEditor()
    editor.openCreateEdgeDialog()
    await flushEditor()

    expect(editor.newEdgeSourceId).toBe(firstNodeId)
    expect(editor.edgeTargets.map((node: any) => node.id)).toEqual([secondNodeId])

    editor.newEdgeSourceQuery = "beta"
    await flushEditor()

    expect(editor.edgeSources.map((node: any) => node.id)).toEqual([secondNodeId])

    editor.newEdgeTargetQuery = "beta"
    await flushEditor()

    expect(editor.edgeTargets.map((node: any) => node.id)).toEqual([secondNodeId])

    editor.newEdgeTargetQuery = "alpha"
    await flushEditor()

    expect(editor.edgeTargets).toEqual([])

    wrapper.unmount()
  })

  it("blocks create-edge submission when source and target point to the same node", async () => {
    const { editor, wrapper } = await mountEditor()

    editor.addNode("text")
    await flushEditor()

    const nodeId = editor.state.selectedNodeId
    editor.openCreateEdgeDialog()
    await flushEditor()

    editor.newEdgeSourceId = nodeId
    editor.newEdgeTargetId = nodeId
    editor.submitCreateEdgeDialog()
    await flushEditor()

    expect(editor.state.document.edges).toEqual([])
    expect(showMessage).toHaveBeenCalled()
    expect(editor.createEdgeDialog.visible).toBe(true)

    wrapper.unmount()
  })

  it("persists inspector section toggles through the plugin bridge", async () => {
    const { editor, plugin, wrapper } = await mountEditor()

    await editor.toggleInspectorSection("document")
    await flushEditor()

    expect(plugin.updateCanvasUiState).toHaveBeenCalledWith({
      inspectorSections: {
        document: false,
      },
    })
    expect(editor.inspectorSectionState.document).toBe(false)

    wrapper.unmount()
  })

  it("opens a local canvas file through the file picker and records it in recent files", async () => {
    const localPath = "C:\\canvas\\opened-local.canvas"
    localFiles.set(localPath, createCanvasRaw("opened from local disk"))

    const { editor, wrapper } = await mountEditor()
    const localFile = new File([createCanvasRaw("opened from local disk")], "opened-local.canvas", {
      type: "application/json",
    })
    Object.defineProperty(localFile, "path", {
      configurable: true,
      value: localPath,
    })

    await editor.importCanvas(localFile)
    await flushEditor()

    expect(editor.state.filePath).toBe(localPath)
    expect(editor.suggestedFilename).toBe("opened-local.canvas")
    expect(editor.state.document.nodes[0]).toMatchObject({
      id: "n1",
      text: "opened from local disk",
      type: "text",
    })
    expect(editor.recentFiles).toEqual([
      expect.objectContaining({
        path: localPath,
        sourceType: "local",
        title: "opened-local.canvas",
      }),
    ])

    wrapper.unmount()
  })

  it("opens a workspace canvas path through a dialog when prompt is unavailable", async () => {
    workspaceFiles.set("/data/storage/siyuan-canvas/opened.canvas", createCanvasRaw("opened from workspace"))
    queueDialogResponse("opened")

    const { editor, plugin, wrapper } = await mountEditor()

    await editor.openPath()
    await flushEditor()

    expect(window.prompt).not.toHaveBeenCalled()
    expect(editor.state.filePath).toBe("/data/storage/siyuan-canvas/opened.canvas")
    expect(editor.state.document.nodes[0]).toMatchObject({
      id: "n1",
      text: "opened from workspace",
      type: "text",
    })
    expect(plugin.rememberRecentCanvas).toHaveBeenCalledWith(
      "/data/storage/siyuan-canvas/opened.canvas",
      "opened.canvas",
      "workspace",
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

    expect(window.prompt).not.toHaveBeenCalled()
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

  it("saves the current document through a dialog when prompt is unavailable", async () => {
    queueDialogResponse("saved-workspace")
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

    expect(window.prompt).not.toHaveBeenCalled()
    expect(savedRaw).toBeTruthy()
    expect(savedRaw).toContain("\"text\": \"saved to workspace\"")
    expect(editor.state.filePath).toBe(savedPath)
    expect(editor.suggestedFilename).toBe("saved-workspace.canvas")
    expect(plugin.rememberRecentCanvas).toHaveBeenCalledWith(savedPath, "saved-workspace.canvas", "workspace")
    expect(editor.recentFiles[0]).toEqual(expect.objectContaining({
      path: savedPath,
      title: "saved-workspace.canvas",
    }))

    wrapper.unmount()
  })

  it("saves a local canvas back to its original file path by default", async () => {
    const localPath = "C:\\canvas\\save-local.canvas"
    localFiles.set(localPath, createCanvasRaw("before edit"))
    queueDialogResponse(localPath)

    const { editor, plugin, wrapper } = await mountEditor()
    const localFile = new File([createCanvasRaw("before edit")], "save-local.canvas", {
      type: "application/json",
    })
    Object.defineProperty(localFile, "path", {
      configurable: true,
      value: localPath,
    })

    await editor.importCanvas(localFile)
    await flushEditor()

    editor.updateTextNodeContent("n1", "saved back to local disk")
    await flushEditor()

    await editor.save()
    await flushEditor()

    expect(localFsMock.writeFile).toHaveBeenCalledWith(
      localPath,
      expect.stringContaining("\"text\": \"saved back to local disk\""),
    )
    expect(localFiles.get(localPath)).toContain("\"text\": \"saved back to local disk\"")
    expect(plugin.rememberRecentCanvas).toHaveBeenCalledWith(localPath, "save-local.canvas", "local")

    wrapper.unmount()
  })

  it("re-prompts for a new workspace filename after overwrite is declined", async () => {
    workspaceFiles.set("/data/storage/siyuan-canvas/existing.canvas", createCanvasRaw("already there"))
    queueDialogResponse("/data/storage/siyuan-canvas/existing.canvas")
    queueConfirmResponse(false)
    queueDialogResponse("/data/storage/siyuan-canvas/renamed.canvas")

    const { editor, wrapper } = await mountEditor()

    editor.addNode("text")
    await flushEditor()

    editor.updateTextNodeContent(editor.state.selectedNodeId, "saved after rename")
    await flushEditor()

    await editor.save()
    await flushEditor()

    expect(confirm).toHaveBeenCalledOnce()
    expect(workspaceFiles.get("/data/storage/siyuan-canvas/existing.canvas")).toContain("\"text\": \"already there\"")
    expect(workspaceFiles.get("/data/storage/siyuan-canvas/renamed.canvas")).toContain("\"text\": \"saved after rename\"")

    wrapper.unmount()
  })

  it("captures external save conflicts and can overwrite the disk version afterwards", async () => {
    const path = "/data/storage/siyuan-canvas/conflict.canvas"
    workspaceFiles.set(path, createCanvasRaw("original on disk"))

    queueDialogResponse(path)
    const { editor, wrapper } = await mountEditor({ path })

    editor.updateTextNodeContent("n1", "edited in memory")
    await flushEditor()

    workspaceFiles.set(path, createCanvasRaw("changed on disk"))

    await editor.save()
    await flushEditor()

    expect(window.prompt).not.toHaveBeenCalled()
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

    queueDialogResponse(path)
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

  it("lists workspace canvas documents from the configured workspace directory", async () => {
    workspaceDirectoryEntries.push(
      { isDir: false, isSymlink: false, name: "alpha.canvas" },
      { isDir: false, isSymlink: false, name: "notes.md" },
      { isDir: false, isSymlink: false, name: "beta.canvas" },
      { isDir: true, isSymlink: false, name: "nested" },
    )

    const { editor, wrapper } = await mountEditor()

    expect(apiMock.readDir).toHaveBeenCalledWith("/data/storage/siyuan-canvas")
    expect(editor.workspaceDocuments).toEqual([
      {
        path: "/data/storage/siyuan-canvas/alpha.canvas",
        title: "alpha.canvas",
      },
      {
        path: "/data/storage/siyuan-canvas/beta.canvas",
        title: "beta.canvas",
      },
    ])

    wrapper.unmount()
  })

  it("keeps recent files from both workspace and local opens", async () => {
    workspaceFiles.set("/data/storage/siyuan-canvas/workspace.canvas", createCanvasRaw("workspace version"))

    queueDialogResponse("workspace")
    const { editor, wrapper } = await mountEditor()

    await editor.openPath()
    await flushEditor()

    const localPath = "C:\\canvas\\recent-local.canvas"
    localFiles.set(localPath, createCanvasRaw("local version"))
    const localFile = new File([createCanvasRaw("local version")], "recent-local.canvas", {
      type: "application/json",
    })
    Object.defineProperty(localFile, "path", {
      configurable: true,
      value: localPath,
    })

    await editor.importCanvas(localFile)
    await flushEditor()

    expect(editor.recentFiles.map((item: any) => item.path)).toEqual([
      localPath,
      "/data/storage/siyuan-canvas/workspace.canvas",
    ])
    expect(editor.recentFiles.map((item: any) => item.sourceType)).toEqual([
      "local",
      "workspace",
    ])

    wrapper.unmount()
  })

  it("writes a pasted image beside the saved workspace canvas and creates a file node", async () => {
    const path = "/data/storage/maps/roadmap.canvas"
    workspaceFiles.set(path, createCanvasRaw("workspace canvas"))

    const { editor, wrapper } = await mountEditor({ path })

    await editor.handleClipboardImagePaste(new File(["png"], "pasted.png", { type: "image/png" }))
    await flushEditor()

    const pastedNode = editor.state.document.nodes.at(-1)
    expect(pastedNode).toMatchObject({
      file: expect.stringContaining("/data/storage/maps/roadmap.assets/"),
      type: "file",
    })
    expect(apiMock.putFile).toHaveBeenCalledWith(
      expect.stringContaining("/data/storage/maps/roadmap.assets/"),
      false,
      expect.any(File),
    )
    expect(workspaceFiles.get(pastedNode.file)).toBe("png")

    const preview = editor.getFileNodePreview(pastedNode)
    expect(preview.kind).toBe("image")
    expect(preview.imageSrc).toContain("/data/storage/maps/roadmap.assets/")

    wrapper.unmount()
  })
})

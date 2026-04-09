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
import type { ModuleExports } from "vitest"
import {
  centerViewportOnBounds,
  resolveDragNodeIds,
  resolveSelectionToolbarPosition,
} from "@/canvas/selection-toolbar"

const apiMock = {
  findSiyuanAssetByPath: vi.fn(async () => null),
  findSiyuanDocumentByPath: vi.fn(async () => null),
}
const siyuanMock = {
  openTab: vi.fn(),
  showMessage: vi.fn(),
}

let useCanvasEditor: typeof import("@/canvas/use-canvas-editor").useCanvasEditor
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
  const loaded = loadModuleExports(resolve(process.cwd(), "src", "canvas", "use-canvas-editor.ts"))
  useCanvasEditor = loaded.useCanvasEditor as typeof useCanvasEditor
})

describe("selection toolbar helpers", () => {
  it("preserves viewport scale while centering bounds in the stage", () => {
    const next = centerViewportOnBounds(
      { scale: 1.5, x: 40, y: 60 },
      { width: 900, height: 600 },
      { x: 200, y: 100, width: 300, height: 200 },
      { left: 50, top: 20 },
    )

    expect(next).toEqual({
      scale: 1.5,
      x: 0,
      y: 30,
    })
  })

  it("places the toolbar above the selection and flips below near the top edge", () => {
    expect(resolveSelectionToolbarPosition(
      { x: 100, y: 120, width: 280, height: 160 },
      { width: 900, height: 700 },
      { width: 220, height: 48 },
    )).toEqual({
      placement: "top",
      x: 130,
      y: 64,
    })

    expect(resolveSelectionToolbarPosition(
      { x: 100, y: 8, width: 280, height: 160 },
      { width: 900, height: 700 },
      { width: 220, height: 48 },
    )).toEqual({
      placement: "bottom",
      x: 130,
      y: 176,
    })
  })

  it("includes enclosed nodes when dragging a group node", () => {
    const document = {
      nodes: [
        { id: "group-1", type: "group", label: "Group", x: 0, y: 0, width: 300, height: 220 },
        { id: "n1", type: "text", text: "one", x: 20, y: 20, width: 120, height: 80 },
        { id: "n2", type: "text", text: "two", x: 260, y: 170, width: 80, height: 80 },
      ],
      edges: [],
    }

    expect(resolveDragNodeIds(document, "group-1", ["group-1"])).toEqual(["group-1", "n1"])
  })

  it("preserves the rest of a mixed selection when dragging a selected group", () => {
    const document = {
      nodes: [
        { id: "group-1", type: "group", label: "Group", x: 0, y: 0, width: 300, height: 220 },
        { id: "inside", type: "text", text: "inside", x: 20, y: 20, width: 120, height: 80 },
        { id: "outside", type: "text", text: "outside", x: 420, y: 20, width: 120, height: 80 },
      ],
      edges: [],
    }

    expect(resolveDragNodeIds(document, "group-1", ["group-1", "outside"])).toEqual([
      "group-1",
      "outside",
      "inside",
    ])
  })
})

describe("useCanvasEditor selection toolbar integration", () => {
  it("closes the open selection popover on Escape", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = {
      app: {},
    }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          {
            id: "n1",
            type: "text",
            text: "one",
            x: 100,
            y: 120,
            width: 180,
            height: 90,
          },
        ],
        edges: [],
      }),
    }

    const Harness = defineComponent({
      setup() {
        editor = useCanvasEditor(plugin as any, bootstrap, vi.fn())
        return () => h("div")
      },
    })

    const wrapper = mount(Harness)
    await nextTick()

    editor.selectNode("n1")
    editor.toggleSelectionPopover("color")
    expect(editor.selectionToolbarPopover).toBe("color")

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    await nextTick()

    expect(editor.selectionToolbarPopover).toBe("closed")

    wrapper.unmount()
  })

  it("closes the open selection popover when the selection changes", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = {
      app: {},
    }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          {
            id: "n1",
            type: "text",
            text: "one",
            x: 100,
            y: 120,
            width: 180,
            height: 90,
          },
          {
            id: "n2",
            type: "text",
            text: "two",
            x: 400,
            y: 120,
            width: 180,
            height: 90,
          },
        ],
        edges: [],
      }),
    }

    const Harness = defineComponent({
      setup() {
        editor = useCanvasEditor(plugin as any, bootstrap, vi.fn())
        return () => h("div")
      },
    })

    const wrapper = mount(Harness)
    await nextTick()

    editor.selectNode("n1")
    editor.toggleSelectionPopover("layout")
    expect(editor.selectionToolbarPopover).toBe("layout")

    editor.selectNode("n2")
    await nextTick()

    expect(editor.selectionToolbarPopover).toBe("closed")

    wrapper.unmount()
  })
})

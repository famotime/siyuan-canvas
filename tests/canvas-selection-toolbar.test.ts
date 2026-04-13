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
  getBezierPointAt,
  getEdgeCurveControlPoints,
  getEdgeMidpointPosition,
  resolveDragNodeIds,
  resolveEdgeToolbarPosition,
  resolveSelectionToolbarPosition,
} from "@/canvas/selection-toolbar"

const fileNodeLookupMock = {
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

  it("derives side-aware Bezier control points for vertical and horizontal edge tangents", () => {
    expect(getEdgeCurveControlPoints(
      { x: 200, y: 100 },
      "bottom",
      { x: 240, y: 340 },
      "top",
    )).toEqual({
      fromControl: { x: 200, y: 184 },
      toControl: { x: 240, y: 256 },
    })

    expect(getEdgeCurveControlPoints(
      { x: 100, y: 220 },
      "right",
      { x: 360, y: 260 },
      "left",
    )).toEqual({
      fromControl: { x: 191, y: 220 },
      toControl: { x: 269, y: 260 },
    })
  })

  it("resolves the cubic edge midpoint and edge toolbar placement from a midpoint", () => {
    const midpoint = getBezierPointAt(
      { x: 100, y: 220 },
      { x: 191, y: 220 },
      { x: 269, y: 260 },
      { x: 360, y: 260 },
      0.5,
    )

    expect(midpoint.x).toBe(230)
    expect(midpoint.y).toBe(240)
    expect(getEdgeMidpointPosition(
      { x: 100, y: 220 },
      "right",
      { x: 360, y: 260 },
      "left",
    )).toEqual(midpoint)

    expect(resolveEdgeToolbarPosition(
      midpoint,
      { width: 900, height: 700 },
      { width: 240, height: 48 },
    )).toEqual({
      placement: "top",
      x: 110,
      y: 184,
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

  it("includes selected groups' enclosed nodes even when another selected node starts the drag", () => {
    const document = {
      nodes: [
        { id: "group-1", type: "group", label: "Group", x: 0, y: 0, width: 300, height: 220 },
        { id: "inside", type: "text", text: "inside", x: 20, y: 20, width: 120, height: 80 },
        { id: "outside", type: "text", text: "outside", x: 420, y: 20, width: 120, height: 80 },
      ],
      edges: [],
    }

    expect(resolveDragNodeIds(document, "outside", ["group-1", "outside"])).toEqual([
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
    expect(editor.state.selectedNodeIds).toEqual(["n1"])

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

  it("recomputes toolbar placement when the measured toolbar width changes", async () => {
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

    const stage = document.createElement("div")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 900 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 700 })
    editor.stageRef.value = stage
    editor.viewport.x = -2800
    editor.viewport.y = -2100
    editor.selectNode("n1")
    await nextTick()

    expect(editor.selectionToolbar.visible).toBe(true)
    const initialX = editor.selectionToolbar.x

    editor.setSelectionToolbarSize({ height: 48, width: 320 })
    await nextTick()

    expect(editor.selectionToolbar.x).toBe(initialX - 50)

    wrapper.unmount()
  })

  it("left-dragging the empty stage selects every card intersecting the marquee", async () => {
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
            y: 100,
            width: 140,
            height: 80,
          },
          {
            id: "n2",
            type: "text",
            text: "two",
            x: 280,
            y: 120,
            width: 140,
            height: 80,
          },
          {
            id: "n3",
            type: "text",
            text: "three",
            x: 520,
            y: 120,
            width: 140,
            height: 80,
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

    const stage = document.createElement("section")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 1200 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 800 })
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
      }),
    })
    editor.stageRef.value = stage
    editor.viewport.scale = 1
    editor.viewport.x = editor.board.left
    editor.viewport.y = editor.board.top

    editor.startPan({
      button: 0,
      clientX: 80,
      clientY: 80,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      shiftKey: false,
      target: stage,
    } as any)

    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 430,
      clientY: 230,
    }))
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 430,
      clientY: 230,
    }))
    await nextTick()

    expect(editor.state.selectedNodeIds).toEqual(["n1", "n2"])

    wrapper.unmount()
  })

  it("lets cards shrink below thirty percent zoom floor down to ten percent", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = {
      app: {},
    }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [],
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

    editor.viewport.scale = 0.2
    editor.zoomOut()

    expect(editor.viewport.scale).toBe(0.1)

    wrapper.unmount()
  })

  it("resizes a card from its left edge", async () => {
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
            y: 100,
            width: 200,
            height: 120,
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

    const node = editor.state.document.nodes[0]!
    editor.startResize(node, "left", {
      button: 0,
      clientX: 100,
      clientY: 100,
    } as any)

    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 140,
      clientY: 100,
    }))
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 140,
      clientY: 100,
    }))
    await nextTick()

    expect(editor.state.document.nodes[0]).toMatchObject({
      x: 120,
      width: 180,
      y: 100,
      height: 120,
    })

    wrapper.unmount()
  })

  it("creates an edge by dragging from one side midpoint to another", async () => {
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
            y: 100,
            width: 180,
            height: 100,
          },
          {
            id: "n2",
            type: "text",
            text: "two",
            x: 420,
            y: 120,
            width: 180,
            height: 100,
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

    const stage = document.createElement("section")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 1200 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 800 })
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
      }),
    })
    editor.stageRef.value = stage
    editor.viewport.scale = 1
    editor.viewport.x = editor.board.left
    editor.viewport.y = editor.board.top

    const sourceNode = editor.state.document.nodes[0]!
    editor.startConnectionDrag(sourceNode, "right", {
      button: 0,
      clientX: 280,
      clientY: 150,
      preventDefault: vi.fn(),
    } as any)

    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 430,
      clientY: 170,
    }))
    await nextTick()

    expect(editor.connectionDraft.visible).toBe(true)
    expect(editor.isConnectionTarget("n2", "left")).toBe(true)

    editor.finishConnectionDrag()
    await nextTick()

    expect(editor.state.document.edges).toHaveLength(1)
    expect(editor.state.document.edges[0]).toMatchObject({
      fromNode: "n1",
      fromSide: "right",
      toNode: "n2",
      toSide: "left",
    })
    expect(editor.connectionDraft.visible).toBe(false)

    wrapper.unmount()
  })

  it("shows an edge toolbar for the selected edge and centers the viewport on that edge", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 420, y: 220, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "bottom", toNode: "n2", toSide: "top" },
        ],
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

    const stage = document.createElement("section")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 1200 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 800 })
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
      }),
    })
    editor.stageRef.value = stage
    editor.viewport.scale = 1
    editor.viewport.x = editor.board.left
    editor.viewport.y = editor.board.top

    editor.selectEdge("e1")
    await nextTick()

    expect(editor.edgeToolbar.visible).toBe(true)

    editor.centerEdgeInViewport()

    expect(editor.viewport.x).toBe(-2550)
    expect(editor.viewport.y).toBe(-1910)

    wrapper.unmount()
  })

  it("updates selected edge direction flags and inline label text", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 420, y: 220, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left" },
        ],
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

    editor.selectEdge("e1")
    editor.updateSelectedEdgeDirection("both")
    editor.startEdgeLabelEditing()
    editor.edgeLabelDraft = "edge note"
    editor.submitEdgeLabelEditing()
    await nextTick()

    expect(editor.state.document.edges[0]).toMatchObject({
      endArrow: true,
      label: "edge note",
      startArrow: true,
    })
    expect(editor.editingEdgeLabelId).toBe("")

    wrapper.unmount()
  })

  it("reconnects a selected edge endpoint when dragged onto another node anchor", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 420, y: 120, width: 180, height: 100 },
          { id: "n3", type: "text", text: "three", x: 720, y: 180, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left" },
        ],
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

    const stage = document.createElement("section")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 1400 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 900 })
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 900,
        height: 900,
        left: 0,
        right: 1400,
        top: 0,
        width: 1400,
        x: 0,
        y: 0,
      }),
    })
    editor.stageRef.value = stage
    editor.viewport.scale = 1
    editor.viewport.x = editor.board.left
    editor.viewport.y = editor.board.top

    editor.selectEdge("e1")
    editor.startEdgeEndpointDrag("to", {
      button: 0,
      clientX: 420,
      clientY: 170,
      preventDefault: vi.fn(),
    } as any)

    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 720,
      clientY: 230,
    }))
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 720,
      clientY: 230,
    }))
    await nextTick()

    expect(editor.state.document.edges[0]).toMatchObject({
      id: "e1",
      toNode: "n3",
      toSide: "left",
    })

    wrapper.unmount()
  })

  it("deletes a selected edge when its endpoint is dropped on blank space", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 420, y: 120, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left" },
        ],
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

    const stage = document.createElement("section")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 1200 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 800 })
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
      }),
    })
    editor.stageRef.value = stage
    editor.viewport.scale = 1
    editor.viewport.x = editor.board.left
    editor.viewport.y = editor.board.top

    editor.selectEdge("e1")
    editor.startEdgeEndpointDrag("to", {
      button: 0,
      clientX: 420,
      clientY: 170,
      preventDefault: vi.fn(),
    } as any)

    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 940,
      clientY: 48,
    }))
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 940,
      clientY: 48,
    }))
    await nextTick()

    expect(editor.state.document.edges).toEqual([])
    expect(editor.state.selectedEdgeId).toBe("")

    wrapper.unmount()
  })

  it("selects an edge when the marquee rectangle intersects the line but not any nodes", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 500, y: 100, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left" },
        ],
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

    const stage = document.createElement("section")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 1400 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 900 })
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 900,
        height: 900,
        left: 0,
        right: 1400,
        top: 0,
        width: 1400,
        x: 0,
        y: 0,
      }),
    })
    editor.stageRef.value = stage
    editor.viewport.scale = 1
    editor.viewport.x = editor.board.left
    editor.viewport.y = editor.board.top

    editor.startPan({
      button: 0,
      clientX: 290,
      clientY: 130,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      shiftKey: false,
      target: stage,
    } as any)

    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 490,
      clientY: 170,
    }))
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 490,
      clientY: 170,
    }))
    await nextTick()

    expect(editor.state.selectedEdgeId).toBe("e1")
    expect(editor.state.selectedNodeIds).toEqual([])

    wrapper.unmount()
  })

  it("persists edge label edits while typing and keeps the text after ending edit mode", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 420, y: 220, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left", label: "old" },
        ],
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

    editor.selectEdge("e1")
    editor.startEdgeLabelEditing()
    editor.updateEditingEdgeLabel("draft text")

    expect(editor.state.document.edges[0]).toMatchObject({
      id: "e1",
      label: "draft text",
    })

    editor.cancelEdgeLabelEditing()

    expect(editor.editingEdgeLabelId).toBe("")
    expect(editor.state.document.edges[0]).toMatchObject({
      id: "e1",
      label: "draft text",
    })

    wrapper.unmount()
  })

  it("treats a legacy edge without explicit arrow flags as single-direction in the toolbar state", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 420, y: 220, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left" },
        ],
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

    editor.selectEdge("e1")

    expect(editor.selectedEdgeDirectionMode).toBe("single")

    wrapper.unmount()
  })

  it("tracks a freeform reconnect preview point before the dragged endpoint snaps to an anchor", async () => {
    let editor!: ReturnType<typeof useCanvasEditor>

    const plugin = { app: {} }
    const bootstrap = {
      raw: JSON.stringify({
        nodes: [
          { id: "n1", type: "text", text: "one", x: 100, y: 100, width: 180, height: 100 },
          { id: "n2", type: "text", text: "two", x: 420, y: 120, width: 180, height: 100 },
        ],
        edges: [
          { id: "e1", fromNode: "n1", fromSide: "right", toNode: "n2", toSide: "left" },
        ],
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

    const stage = document.createElement("section")
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 1200 })
    Object.defineProperty(stage, "clientHeight", { configurable: true, value: 800 })
    Object.defineProperty(stage, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
      }),
    })
    editor.stageRef.value = stage
    editor.viewport.scale = 1
    editor.viewport.x = editor.board.left
    editor.viewport.y = editor.board.top

    editor.selectEdge("e1")
    editor.startEdgeEndpointDrag("to", {
      button: 0,
      clientX: 420,
      clientY: 170,
      preventDefault: vi.fn(),
    } as any)

    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 340,
      clientY: 280,
    }))
    await nextTick()

    expect(editor.edgeReconnectDraft.visible).toBe(true)
    expect(editor.edgeReconnectDraft.targetNodeId).toBe("")
    expect(editor.edgeReconnectDraft.toX).toBe(3140)
    expect(editor.edgeReconnectDraft.toY).toBe(2380)
    expect(editor.getEdgeReconnectDraftPath()).toContain("3140 2380")

    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 340,
      clientY: 280,
    }))
    await nextTick()

    wrapper.unmount()
  })
})

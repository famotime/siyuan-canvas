/* @vitest-environment jsdom */

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const apiMocks = vi.hoisted(() => ({
  createDocWithMd: vi.fn(),
  getNotebookConf: vi.fn(),
  lsNotebooks: vi.fn(),
  putFile: vi.fn(),
  removeDocByID: vi.fn(),
  renderSprig: vi.fn(),
  sql: vi.fn(),
}))

const lookupMocks = vi.hoisted(() => ({
  findSiyuanAssetByPath: vi.fn(async () => null),
  getSiyuanBlockMarkdown: vi.fn(async () => "fetched content"),
  getSiyuanDocumentMarkdown: vi.fn(async () => "doc content"),
  getSiyuanHeadingBlockMarkdown: vi.fn(async () => "heading content"),
}))

vi.mock("siyuan", () => ({
  showMessage: vi.fn(),
}))

vi.mock("@/api", () => apiMocks)
vi.mock("@/canvas/siyuan-kernel-file-node-lookups", () => lookupMocks)

import { createDefaultCanvasPluginSettings } from "@/canvas/plugin-data"
import { createCanvasEditorSelectionExport } from "@/canvas/use-canvas-editor-selection-export"

function createExportDeps(state: any, commitDocument = vi.fn()) {
  return {
    commitDocument,
    fileSource: { value: "workspace" as const },
    getPluginSettings: () => createDefaultCanvasPluginSettings(),
    getResolvedFileNode: (node: any) => ({
      id: node.file,
      kind: "document" as const,
      openPath: node.file,
      path: node.file,
      title: "Doc",
    }),
    refreshFileNodeMetadata: vi.fn(async () => {}),
    state,
    t: (key: string) => key,
  }
}

describe("use-canvas-editor-selection-export safety guards", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.lsNotebooks.mockResolvedValue({
      notebooks: [{ closed: false, id: "nb-1", name: "Main" }],
    })
    apiMocks.getNotebookConf.mockResolvedValue({ conf: { dailyNoteSavePath: "/Daily" } })
    apiMocks.renderSprig.mockResolvedValue("/Daily/Note")
    apiMocks.removeDocByID.mockResolvedValue(null)
  })

  it("rolls back created SiYuan document if canvas file switches before convertSelectionToDocument commits", async () => {
    let resolveCreateDoc!: (id: string) => void
    apiMocks.createDocWithMd.mockImplementation(
      () => new Promise<string>((resolve) => {
        resolveCreateDoc = resolve
      }),
    )

    const state = {
      document: {
        edges: [],
        nodes: [
          { height: 100, id: "n1", text: "# Note Title\nBody", type: "text", width: 200, x: 0, y: 0 },
        ],
      },
      filePath: "/data/canvas-a.canvas",
    } as any
    const commitDocument = vi.fn()
    const actions = createCanvasEditorSelectionExport(createExportDeps(state, commitDocument))

    const promise = actions.convertSelectionToDocument(["n1"])
    await vi.waitFor(() => expect(apiMocks.createDocWithMd).toHaveBeenCalledTimes(1))

    // Simulate switching canvas before createDocWithMd resolves
    state.filePath = "/data/canvas-b.canvas"
    resolveCreateDoc("doc-orphan-123")
    await promise

    expect(commitDocument).not.toHaveBeenCalled()
    expect(apiMocks.removeDocByID).toHaveBeenCalledWith("doc-orphan-123")
  })

  it("rolls back created SiYuan document when heading resolution fails after createDocWithMd", async () => {
    apiMocks.createDocWithMd.mockResolvedValueOnce("doc-rollback-456")
    apiMocks.sql.mockRejectedValueOnce(new Error("sql failed"))

    const state = {
      document: {
        edges: [],
        nodes: [
          { height: 100, id: "n1", text: "# Title\nOne", type: "text", width: 200, x: 0, y: 0 },
          { height: 100, id: "n2", text: "Two", type: "text", width: 200, x: 0, y: 150 },
        ],
      },
      filePath: "/data/canvas-a.canvas",
    } as any
    const commitDocument = vi.fn()
    const actions = createCanvasEditorSelectionExport(createExportDeps(state, commitDocument))

    await actions.convertSelectionToDocument(["n1", "n2"])

    expect(commitDocument).not.toHaveBeenCalled()
    expect(apiMocks.removeDocByID).toHaveBeenCalledWith("doc-rollback-456")
  })

  it("drops stale convertSelectionToText commit when canvas switches mid-flight", async () => {
    let resolveMarkdown!: (md: string) => void
    lookupMocks.getSiyuanDocumentMarkdown.mockImplementation(
      () => new Promise<string>((resolve) => {
        resolveMarkdown = resolve
      }),
    )

    const state = {
      document: {
        edges: [],
        nodes: [
          { file: "doc-1", height: 100, id: "f1", type: "file", width: 200, x: 0, y: 0 },
        ],
      },
      filePath: "/data/canvas-a.canvas",
    } as any
    const commitDocument = vi.fn()
    const actions = createCanvasEditorSelectionExport(createExportDeps(state, commitDocument))

    const promise = actions.convertSelectionToText(["f1"])
    await vi.waitFor(() => expect(lookupMocks.getSiyuanDocumentMarkdown).toHaveBeenCalledTimes(1))

    state.filePath = "/data/canvas-b.canvas"
    resolveMarkdown("stale doc markdown")
    await promise

    expect(commitDocument).not.toHaveBeenCalled()
  })
})

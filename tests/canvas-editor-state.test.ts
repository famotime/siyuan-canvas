import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { CanvasEditorState } from "@/canvas/editor-state"
import { CanvasExternalChangeError } from "@/canvas/file-service"

describe("canvas editor state", () => {
  it("opening a file loads the document and resets dirty state", async () => {
    const service = {
      load: vi.fn(async () => ({
        path: "/data/storage/canvas/example.canvas",
        raw: "{}",
        parseResult: {
          document: {
            nodes: [],
            edges: [],
          },
          errors: [],
          warnings: [],
        },
      })),
      save: vi.fn(),
    }

    const state = new CanvasEditorState(service as any)
    await state.open("/data/storage/canvas/example.canvas")

    expect(state.filePath).toBe("/data/storage/canvas/example.canvas")
    expect(state.document).toEqual({
      nodes: [],
      edges: [],
    })
    expect(state.isDirty).toBe(false)
    expect(state.issues.errors).toEqual([])
  })

  it("updating the document marks the editor dirty", () => {
    const state = new CanvasEditorState({
      load: vi.fn(),
      save: vi.fn(),
    } as any)

    state.replaceDocument({
      nodes: [],
      edges: [],
    })
    state.patchDocument({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "edited",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [],
    })

    expect(state.isDirty).toBe(true)
    expect(state.document.nodes).toHaveLength(1)
  })

  it("saving persists the current document and clears dirty state", async () => {
    const save = vi.fn(async () => "{}")
    const state = new CanvasEditorState({
      load: vi.fn(),
      save,
    } as any)

    state.replaceDocument({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "edited",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [],
    }, "/data/storage/canvas/example.canvas")
    state.patchDocument({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "edited twice",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [],
    })

    await state.save()

    expect(save).toHaveBeenCalledWith("/data/storage/canvas/example.canvas", state.document, {
      baseRaw: undefined,
      detectExternalChanges: undefined,
    })
    expect(state.isDirty).toBe(false)
  })

  it("keeps the document dirty and records conflict data when the file changed on disk", async () => {
    const state = new CanvasEditorState({
      load: vi.fn(async () => ({
        path: "/data/storage/canvas/example.canvas",
        raw: `${JSON.stringify({
          nodes: [
            {
              id: "n1",
              type: "text",
              text: "original",
              x: 0,
              y: 0,
              width: 320,
              height: 180,
            },
          ],
          edges: [],
        }, null, "\t")}\n`,
        parseResult: {
          document: {
            nodes: [
              {
                id: "n1",
                type: "text",
                text: "original",
                x: 0,
                y: 0,
                width: 320,
                height: 180,
              },
            ],
            edges: [],
          },
          errors: [],
          warnings: [],
        },
      })),
      save: vi.fn(async () => {
        throw new CanvasExternalChangeError(
          "/data/storage/canvas/example.canvas",
          `${JSON.stringify({
            nodes: [
              {
                id: "n1",
                type: "text",
                text: "changed on disk",
                x: 0,
                y: 0,
                width: 320,
                height: 180,
              },
            ],
            edges: [],
          }, null, "\t")}\n`,
          {
            document: {
              nodes: [
                {
                  id: "n1",
                  type: "text",
                  text: "changed on disk",
                  x: 0,
                  y: 0,
                  width: 320,
                  height: 180,
                },
              ],
              edges: [],
            },
            errors: [],
            warnings: [],
          },
        )
      }),
    } as any)

    await state.open("/data/storage/canvas/example.canvas")
    state.patchDocument({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "edited in memory",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [],
    })

    await expect(state.save()).rejects.toBeInstanceOf(CanvasExternalChangeError)
    expect(state.isDirty).toBe(true)
    expect(state.conflict?.path).toBe("/data/storage/canvas/example.canvas")
    expect(state.conflict?.document?.nodes[0]?.text).toBe("changed on disk")
  })

  it("supports additive node selection and select-all", () => {
    const state = new CanvasEditorState({
      load: vi.fn(),
      save: vi.fn(),
    } as any)

    state.replaceDocument({
      nodes: [
        {
          id: "n1",
          type: "text",
          text: "one",
          x: 0,
          y: 0,
          width: 320,
          height: 180,
        },
        {
          id: "n2",
          type: "text",
          text: "two",
          x: 400,
          y: 0,
          width: 320,
          height: 180,
        },
      ],
      edges: [],
    })

    state.selectNode("n1")
    state.selectNode("n2", { additive: true })

    expect(state.selectedNodeId).toBe("n2")
    expect(state.selectedNodeIds).toEqual(["n1", "n2"])

    state.selectAllNodes()

    expect(state.selectedNodeIds).toEqual(["n1", "n2"])
  })
})

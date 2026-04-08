import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { CanvasEditorState } from "@/canvas/editor-state"

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

    expect(save).toHaveBeenCalledWith("/data/storage/canvas/example.canvas", state.document)
    expect(state.isDirty).toBe(false)
  })
})

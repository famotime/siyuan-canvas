import {
  describe,
  expect,
  it,
} from "vitest"
import {
  computed,
  ref,
} from "vue"

import { createCanvasEditorBindings } from "@/canvas/editor-bindings"

describe("canvas editor bindings", () => {
  it("unwraps nested refs for template consumers", () => {
    const bindings = createCanvasEditorBindings({
      edgeTargets: computed(() => [{ id: "n1" }]),
      selectedNode: ref<{ id: string } | null>({ id: "n1" }),
    })

    expect(Array.isArray(bindings.edgeTargets)).toBe(true)
    expect(bindings.edgeTargets[0]?.id).toBe("n1")
    expect(bindings.selectedNode?.id).toBe("n1")
  })

  it("preserves DOM refs when explicitly requested", () => {
    const fileInputRef = ref<HTMLInputElement | undefined>()
    const bindings = createCanvasEditorBindings({
      fileInputRef,
      selectedNode: ref<{ id: string } | null>({ id: "n1" }),
    }, ["fileInputRef"])

    expect(bindings.fileInputRef).toBe(fileInputRef)
    expect(bindings.selectedNode?.id).toBe("n1")
  })
})

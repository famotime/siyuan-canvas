/* @vitest-environment jsdom */

import type { IProtyle } from "siyuan"
import {
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  normalizeCanvasEmbedPath,
  resolveCanvasEmbedTargetDocumentId,
  runCanvasEmbedCommand,
} from "@/canvas/canvas-embed-command"

function protyle(rootID?: string, id?: string): IProtyle {
  return {
    block: { rootID, id },
    element: document.createElement("div"),
  } as unknown as IProtyle
}

describe("canvas embed command", () => {
  it("normalizes quoted paths and converts workspace absolute paths", async () => {
    await expect(normalizeCanvasEmbedPath(" \"D:\\Siyuan\\data\\assets\\a.canvas\" ", async () => "D:/Siyuan"))
      .resolves.toBe("/data/assets/a.canvas")
  })

  it("keeps non-workspace absolute paths unchanged after quote trimming", async () => {
    await expect(normalizeCanvasEmbedPath("'D:\\Other\\a.canvas'", async () => "D:/Siyuan"))
      .resolves.toBe("D:\\Other\\a.canvas")
  })

  it("resolves target document id from command protyle before fallbacks", () => {
    const lastActive = protyle("last-root")
    const editor = protyle("editor-root")
    document.body.innerHTML = `<div class="protyle-wysiwyg" data-node-id="dom-root"></div>`

    expect(resolveCanvasEmbedTargetDocumentId({
      commandProtyle: protyle("command-root"),
      getAllEditor: () => [{ protyle: editor }],
      lastActiveProtyle: lastActive,
    })).toBe("command-root")
  })

  it("uses last active, editor list, and DOM roots as ordered fallbacks", () => {
    document.body.innerHTML = `<div class="protyle-wysiwyg" data-node-id="dom-root"></div>`

    expect(resolveCanvasEmbedTargetDocumentId({
      commandProtyle: null,
      getAllEditor: () => [{ protyle: protyle("editor-root") }],
      lastActiveProtyle: protyle("last-root"),
    })).toBe("last-root")

    expect(resolveCanvasEmbedTargetDocumentId({
      commandProtyle: null,
      getAllEditor: () => [{ protyle: protyle("editor-root") }],
      lastActiveProtyle: null,
    })).toBe("editor-root")

    expect(resolveCanvasEmbedTargetDocumentId({
      commandProtyle: null,
      getAllEditor: () => [],
      lastActiveProtyle: null,
    })).toBe("dom-root")
  })

  it("shows the no-document warning when there is no target document", async () => {
    const showMessage = vi.fn()
    document.body.innerHTML = ""

    await runCanvasEmbedCommand({
      canvasPath: "/data/a.canvas",
      commandProtyle: null,
      debugLog: vi.fn(),
      getAllEditor: () => [],
      getFileText: vi.fn(async () => "{}"),
      getWorkspaceDir: vi.fn(),
      insertCanvasEmbed: vi.fn(),
      lastActiveProtyle: null,
      messages: {
        insertCanvasEmbedFailed: "failed",
        insertCanvasEmbedNoDocument: "no document",
        insertCanvasEmbedSuccess: "success",
        messageUnableOpenCanvasFile: "unable",
      },
      showMessage,
    })

    expect(showMessage).toHaveBeenCalledWith("no document", 4000, "warning")
  })
})

import type { Ref } from "vue"
import type { CanvasEditorState } from "@/canvas/editor-state"
import type { ResolvedCanvasFileNode } from "@/canvas/file-node-resolution"
import type { CanvasNode } from "@/canvas/types"
import type { CanvasI18nTranslator } from "@/canvas/use-canvas-editor-shared"

import {
  findSiyuanAssetByPath,
  findSiyuanDocumentByPath,
} from "@/canvas/siyuan-kernel-file-node-lookups"
import { createCanvasFileNodePreview } from "@/canvas/file-node-preview"
import {
  createFallbackCanvasFileNode,
  resolveCanvasFileNode,
} from "@/canvas/file-node-resolution"

interface CanvasEditorFileNodeOptions {
  fileNodeMeta: Ref<Record<string, ResolvedCanvasFileNode>>
  state: CanvasEditorState
  t: CanvasI18nTranslator
}

export function createCanvasEditorFileNodeHelpers(options: CanvasEditorFileNodeOptions) {
  const {
    fileNodeMeta,
    state,
    t,
  } = options

  let fileNodeResolveVersion = 0

  function getResolvedFileNode(node: CanvasNode): ResolvedCanvasFileNode {
    if (node.type !== "file") {
      throw new Error("Resolved file-node metadata requested for a non-file node.")
    }

    return fileNodeMeta.value[node.id] || createFallbackCanvasFileNode(node.file)
  }

  async function refreshFileNodeMetadata() {
    const version = ++fileNodeResolveVersion
    const fileNodes = state.document.nodes.filter((node): node is Extract<CanvasNode, { type: "file" }> => node.type === "file")
    const nextEntries = await Promise.all(fileNodes.map(async (node) => {
      const resolved = await resolveCanvasFileNode(node.file, {
        resolveAssetByPath: findSiyuanAssetByPath,
        resolveDocumentByPath: findSiyuanDocumentByPath,
      })
      return [node.id, resolved] as const
    }))

    if (version !== fileNodeResolveVersion) {
      return
    }

    fileNodeMeta.value = Object.fromEntries(nextEntries)
  }

  function getNodeTitle(node: CanvasNode): string {
    switch (node.type) {
      case "file":
        return getResolvedFileNode(node).title
      case "group":
        return node.label || t("nodeDefaultGroupLabel")
      case "link":
        return t("nodeKindExternalLink")
      case "text":
        return node.text.split("\n")[0] || t("nodeKindText")
      default:
        return node.id
    }
  }

  function getFileNodeDescription(node: CanvasNode): string {
    return node.type === "file" ? getResolvedFileNode(node).description : ""
  }

  function getFileNodeKind(node: CanvasNode): string {
    return node.type === "file" ? getResolvedFileNode(node).kind : ""
  }

  function getFileNodePreview(node: CanvasNode) {
    if (node.type !== "file") {
      throw new Error("File node preview requested for a non-file node.")
    }

    return createCanvasFileNodePreview(getResolvedFileNode(node))
  }

  return {
    getFileNodeDescription,
    getFileNodeKind,
    getFileNodePreview,
    getNodeTitle,
    getResolvedFileNode,
    refreshFileNodeMetadata,
  }
}

import type { Ref } from "vue"
import type { CanvasEditorState } from "@/canvas/editor-state"
import type { ResolvedCanvasFileTarget } from "@/canvas/file-target-resolution"
import type { CanvasFileTargetPreview } from "@/canvas/file-target-preview"
import type { CanvasNode } from "@/canvas/types"
import type { CanvasI18nTranslator } from "@/canvas/use-canvas-editor-shared"

import {
  findSiyuanAssetByPath,
  findSiyuanDocumentByBlockId,
  findSiyuanDocumentByPath,
  findSiyuanImageAssetByBlockId,
  getSiyuanDocumentMarkdown,
} from "@/canvas/siyuan-kernel-file-node-lookups"
import { renderMarkdownPreview } from "@/canvas/markdown-preview"
import {
  createCanvasFileTargetPreview,
  loadCanvasTargetPreview,
} from "@/canvas/file-target-preview"
import {
  resolveCanvasFileTarget,
  type ResolvedCanvasDocumentTarget,
} from "@/canvas/file-target-resolution"

interface CanvasEditorFileNodeOptions {
  fileNodeMeta: Ref<Record<string, ResolvedCanvasFileTarget & {
    detail: string
    excerptHtml?: string
    thumbnail?: CanvasFileTargetPreview["thumbnail"]
  }>>
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

  function createFallbackFileTarget(path: string): ResolvedCanvasFileTarget & { detail: string } {
    const trimmed = path.trim()
    const segments = trimmed.replace(/\\/g, "/").split("/")
    return {
      detail: trimmed,
      kind: trimmed.endsWith(".canvas") ? "canvas" : "file",
      path: trimmed,
      title: segments[segments.length - 1] || trimmed,
    }
  }

  async function readWorkspaceCanvasText(path: string): Promise<string> {
    const response = await fetch("/api/file/getFile", {
      body: JSON.stringify({ path }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    if (!response.ok) {
      throw new Error(`Unable to read canvas file: ${path}`)
    }

    return response.text()
  }

  function getResolvedFileNode(node: CanvasNode): ResolvedCanvasFileTarget & {
    detail: string
    excerptHtml?: string
    thumbnail?: CanvasFileTargetPreview["thumbnail"]
  } {
    if (node.type !== "file") {
      throw new Error("Resolved file-node metadata requested for a non-file node.")
    }

    return fileNodeMeta.value[node.id] || createFallbackFileTarget(node.file)
  }

  async function withDocumentPreview(target: ResolvedCanvasDocumentTarget) {
    const markdown = await getSiyuanDocumentMarkdown(target.id)
    return {
      ...target,
      detail: target.hpath || target.path,
      excerptHtml: renderMarkdownPreview(markdown),
    }
  }

  async function refreshFileNodeMetadata() {
    const version = ++fileNodeResolveVersion
    const fileNodes = state.document.nodes.filter((node): node is Extract<CanvasNode, { type: "file" }> => node.type === "file")
    const nextEntries = await Promise.all(fileNodes.map(async (node) => {
      const resolved = await resolveCanvasFileTarget(node.file, {
        resolveCanvasByPath: async (path) => (
          path.trim().endsWith(".canvas")
            ? {
                kind: "canvas" as const,
                path,
                title: path.replace(/\\/g, "/").split("/").at(-1) || path,
              }
            : null
        ),
        resolveDocumentByBlockId: async (blockId) => {
          const document = await findSiyuanDocumentByBlockId(blockId)
          return document
            ? {
                ...document,
                kind: "document" as const,
              }
            : null
        },
        resolveDocumentByPath: async (path) => {
          const document = await findSiyuanDocumentByPath(path)
          return document
            ? {
                ...document,
                kind: "document" as const,
              }
            : null
        },
        resolveImageByBlockId: async (blockId) => {
          const image = await findSiyuanImageAssetByBlockId(blockId)
          return image
            ? {
                kind: "image" as const,
                openPath: image.openPath,
                path: image.path,
                title: image.title || image.name,
              }
            : null
        },
        resolveImageByPath: async (path) => {
          const image = await findSiyuanAssetByPath(path)
          return image
            ? {
                kind: "image" as const,
                openPath: image.openPath,
                path: image.path,
                title: image.title || image.name,
              }
            : null
        },
      })

      let enriched: ResolvedCanvasFileTarget & { detail: string, excerptHtml?: string } = {
        ...resolved,
        detail: resolved.path,
      }

      if (resolved.kind === "document") {
        enriched = await withDocumentPreview(resolved)
      }

      if (resolved.kind === "canvas") {
        const canvasPreview = await loadCanvasTargetPreview(resolved, {
          readCanvasText: readWorkspaceCanvasText,
        })
        enriched = {
          ...resolved,
          detail: resolved.path,
          thumbnail: canvasPreview.thumbnail,
        }
      }

      return [node.id, enriched] as const
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
    return node.type === "file" ? getResolvedFileNode(node).detail : ""
  }

  function getFileNodeKind(node: CanvasNode): string {
    return node.type === "file" ? getResolvedFileNode(node).kind : ""
  }

  function getFileNodePreview(node: CanvasNode) {
    if (node.type !== "file") {
      throw new Error("File node preview requested for a non-file node.")
    }

    return createCanvasFileTargetPreview(getResolvedFileNode(node))
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

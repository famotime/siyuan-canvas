import type { Ref } from "vue"
import type { CanvasEditorState } from "@/canvas/editor-state"
import type { ResolvedCanvasFileTarget } from "@/canvas/file-target-resolution"
import type { CanvasFileTargetPreview } from "@/canvas/file-target-preview"
import type { CanvasNode } from "@/canvas/types"
import type { CanvasI18nTranslator } from "@/canvas/use-canvas-editor-shared"

import {
  findSiyuanAssetByPath,
  findSiyuanBlockById,
  findSiyuanDocumentByBlockId,
  findSiyuanDocumentByPath,
  findSiyuanImageAssetByBlockId,
  getSiyuanBlockDOM,
  getSiyuanHeadingBlockDOM,
} from "@/canvas/siyuan-kernel-file-node-lookups"
import {
  createCanvasFileTargetPreview,
  loadCanvasTargetPreview,
} from "@/canvas/file-target-preview"
import {
  resolveCanvasFileTarget,
  type ResolvedCanvasBlockTarget,
  type ResolvedCanvasDocumentTarget,
} from "@/canvas/file-target-resolution"

interface CanvasEditorFileNodeOptions {
  fileNodeMeta: Ref<Record<string, ResolvedCanvasFileTarget & {
    detail: string
    excerptHtml?: string
    imageSrc?: string
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

  const resolveLookups = {
    resolveBlockById: async (blockId: string) => {
      const block = await findSiyuanBlockById(blockId)
      return block
        ? {
            ...block,
            kind: 'block' as const,
          }
        : null
    },
    resolveCanvasByPath: async (path: string) => (
      path.trim().endsWith('.canvas')
        ? {
            kind: 'canvas' as const,
            path,
            title: path.replace(/\\/g, '/').split('/').at(-1) || path,
          }
        : null
    ),
    resolveDocumentByBlockId: async (blockId: string) => {
      const document = await findSiyuanDocumentByBlockId(blockId)
      return document
        ? {
            ...document,
            kind: 'document' as const,
          }
        : null
    },
    resolveDocumentByPath: async (path: string) => {
      const document = await findSiyuanDocumentByPath(path)
      return document
        ? {
            ...document,
            kind: 'document' as const,
          }
        : null
    },
    resolveImageByBlockId: async (blockId: string) => {
      const image = await findSiyuanImageAssetByBlockId(blockId)
      return image
        ? {
            blockId: image.blockId || blockId,
            kind: 'image' as const,
            openPath: image.openPath,
            path: image.path,
            title: image.title || image.name,
          }
        : null
    },
    resolveImageByPath: async (path: string) => {
      const image = await findSiyuanAssetByPath(path)
      return image
        ? {
            blockId: image.blockId,
            kind: 'image' as const,
            openPath: image.openPath,
            path: image.path,
            title: image.title || image.name,
          }
        : null
    },
  }

  function extractImageSourceFromPreviewHtml(previewHtml: string): string | undefined {
    return previewHtml.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1]
  }

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
    imageSrc?: string
    thumbnail?: CanvasFileTargetPreview["thumbnail"]
  } {
    if (node.type !== "file") {
      throw new Error("Resolved file-node metadata requested for a non-file node.")
    }

    return fileNodeMeta.value[node.id] || createFallbackFileTarget(node.file)
  }

  function preprocessSiyuanBlockDOM(domStr: string): string {
    if (!domStr) {
      return ""
    }

    if (typeof document === "undefined") {
      return domStr
        .replace(/contenteditable="true"/gi, "")
        .replace(/<div[^>]*class="[^"]*protyle-attr[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, "")
    }

    const temp = document.createElement("div")
    temp.innerHTML = domStr

    const editableElements = temp.querySelectorAll("[contenteditable]")
    editableElements.forEach((el) => {
      el.removeAttribute("contenteditable")
    })

    const attrs = temp.querySelectorAll(".protyle-attr")
    attrs.forEach((el) => {
      el.remove()
    })

    return temp.innerHTML
  }

  async function withDocumentPreview(target: ResolvedCanvasDocumentTarget) {
    const dom = await getSiyuanBlockDOM(target.id)
    return {
      ...target,
      detail: target.hpath || target.path,
      excerptHtml: preprocessSiyuanBlockDOM(dom),
    }
  }

  async function withBlockPreview(target: ResolvedCanvasBlockTarget) {
    const isHeadingBlock = target.type === "h"
    const dom = isHeadingBlock
      ? await getSiyuanHeadingBlockDOM(target.id)
      : await getSiyuanBlockDOM(target.id)
    const excerptHtml = preprocessSiyuanBlockDOM(dom)
    return {
      ...target,
      detail: target.hpath || target.path,
      excerptHtml,
      imageSrc: extractImageSourceFromPreviewHtml(excerptHtml),
    }
  }

  async function resolveFileNodeMetadata(node: Extract<CanvasNode, { type: 'file' }>) {
    const resolved = await resolveCanvasFileTarget(node.file, resolveLookups)

    let enriched: ResolvedCanvasFileTarget & {
      detail: string
      excerptHtml?: string
      imageSrc?: string
      thumbnail?: CanvasFileTargetPreview['thumbnail']
    } = {
      ...resolved,
      detail: resolved.path,
    }

    if (resolved.kind === 'block') {
      enriched = await withBlockPreview(resolved)
    }

    if (resolved.kind === 'document') {
      enriched = await withDocumentPreview(resolved)
    }

    if (resolved.kind === 'canvas') {
      const canvasPreview = await loadCanvasTargetPreview(resolved, {
        readCanvasText: readWorkspaceCanvasText,
      })
      enriched = {
        ...resolved,
        detail: resolved.path,
        thumbnail: canvasPreview.thumbnail,
      }
    }

    return enriched
  }

  async function refreshFileNodeMetadata(nodeIds?: string[]) {
    const version = ++fileNodeResolveVersion
    const fileNodes = state.document.nodes.filter((node): node is Extract<CanvasNode, { type: 'file' }> => (
      node.type === 'file' && (!nodeIds || nodeIds.includes(node.id))
    ))
    const nextEntries = await Promise.all(fileNodes.map(async (node) => {
      return [node.id, await resolveFileNodeMetadata(node)] as const
    }))

    if (version !== fileNodeResolveVersion) {
      return
    }

    if (!nodeIds) {
      fileNodeMeta.value = Object.fromEntries(nextEntries)
      return
    }

    fileNodeMeta.value = {
      ...fileNodeMeta.value,
      ...Object.fromEntries(nextEntries),
    }
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

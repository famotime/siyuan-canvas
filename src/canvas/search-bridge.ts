import type {
  CanvasDocument,
  CanvasNode,
} from "@/canvas/types"

export type CanvasSearchTargetField = "label" | "note" | "text"
export type CanvasSearchTargetType = "edge" | "node"

export interface CanvasSearchTarget {
  field: CanvasSearchTargetField
  id: string
  nodeId: string
  replaceable: boolean
  text: string
  title: string
  type: CanvasSearchTargetType
}

export interface CanvasSearchDecoration {
  current: boolean
  end: number
  start: number
  targetId: string
}

export interface CanvasSearchHostSnapshot {
  revision: string
  targets: CanvasSearchTarget[]
}

export interface CanvasSearchHostContext {
  filePath: string
  id: string
  readonly: boolean
  title: string
}

export interface CanvasSearchHost {
  getContext: () => CanvasSearchHostContext
  getSnapshot: () => Promise<CanvasSearchHostSnapshot>
  replaceTextRanges: (
    targetId: string,
    ranges: Array<{ end: number, start: number, text: string }>,
  ) => Promise<{ appliedCount: number, revision: string }>
  reveal: (targetId: string, range?: { end: number, start: number }) => Promise<boolean>
  subscribe: (listener: () => void) => () => void
  syncDecorations: (decorations: CanvasSearchDecoration[]) => void
  root: HTMLElement
  version: 1
}

export interface CollectCanvasSearchTargetsOptions {
  document: CanvasDocument
  fileNodeTextById?: Map<string, string>
}

export function getCanvasSearchRegistry(): Set<CanvasSearchHost> {
  const globalWithRegistry = globalThis as typeof globalThis & { __siyuanCanvasSearchHosts?: Set<CanvasSearchHost> }
  if (!globalWithRegistry.__siyuanCanvasSearchHosts) {
    globalWithRegistry.__siyuanCanvasSearchHosts = new Set()
  }

  return globalWithRegistry.__siyuanCanvasSearchHosts
}

export function registerCanvasSearchHost(host: CanvasSearchHost): () => void {
  const registry = getCanvasSearchRegistry()
  registry.add(host)
  return () => {
    registry.delete(host)
  }
}

export function collectCanvasSearchTargets(options: CollectCanvasSearchTargetsOptions): CanvasSearchTarget[] {
  const fileNodeTextById = options.fileNodeTextById ?? new Map()
  const targets: CanvasSearchTarget[] = []

  for (const node of options.document.nodes) {
    const target = createNodeSearchTarget(node, fileNodeTextById)
    if (target) {
      targets.push(target)
    }
  }

  for (const edge of options.document.edges) {
    const label = edge.label?.trim()
    if (!label) {
      continue
    }

    targets.push({
      field: "label",
      id: `edge:${edge.id}:label`,
      nodeId: edge.id,
      replaceable: false,
      text: label,
      title: label,
      type: "edge",
    })
  }

  return targets
}

export function createCanvasSearchRevision(filePath: string, nodeCount: number, raw: string) {
  return `canvas:${filePath}:${nodeCount}:${raw.length}`
}

export function renderCanvasSearchMarkedText(text: string, decorations: CanvasSearchDecoration[]) {
  const ranges = decorations
    .filter(decoration => isValidReplacementRange(text, decoration.start, decoration.end) && decoration.start < decoration.end)
    .sort((left, right) => left.start - right.start)

  const htmlParts: string[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start < cursor) {
      continue
    }

    htmlParts.push(escapeHtml(text.slice(cursor, range.start)))
    htmlParts.push([
      `<mark class="${range.current ? "canvas-search-mark canvas-search-mark--current" : "canvas-search-mark"}">`,
      escapeHtml(text.slice(range.start, range.end)),
      "</mark>",
    ].join(""))
    cursor = range.end
  }

  htmlParts.push(escapeHtml(text.slice(cursor)))
  return htmlParts.join("")
}

function createNodeSearchTarget(node: CanvasNode, fileNodeTextById: Map<string, string>): CanvasSearchTarget | null {
  if (node.type === "text" && node.text.length > 0) {
    return {
      field: "text",
      id: `node:${node.id}:text`,
      nodeId: node.id,
      replaceable: true,
      text: node.text,
      title: firstLine(node.text) || node.id,
      type: "node",
    }
  }

  if (node.type === "file") {
    const text = fileNodeTextById.get(node.id)?.trim() || node.file.trim()
    if (!text) {
      return null
    }

    return {
      field: "note",
      id: `node:${node.id}:note`,
      nodeId: node.id,
      replaceable: false,
      text,
      title: firstLine(text) || node.file,
      type: "node",
    }
  }

  if (node.type === "group") {
    const label = node.label?.trim()
    if (!label) {
      return null
    }

    return {
      field: "label",
      id: `node:${node.id}:label`,
      nodeId: node.id,
      replaceable: false,
      text: label,
      title: label,
      type: "node",
    }
  }

  return null
}

export function replaceCanvasTextTargetRanges(options: {
  document: CanvasDocument
  ranges: Array<{ end: number, start: number, text: string }>
  targetId: string
}): { appliedCount: number, document: CanvasDocument } {
  const parsed = parseCanvasTargetId(options.targetId)
  if (!parsed || parsed.type !== "node" || parsed.field !== "text") {
    return { appliedCount: 0, document: options.document }
  }

  let appliedCount = 0
  const ranges = [...options.ranges].sort((left, right) => right.start - left.start)
  const nodes = options.document.nodes.map((node) => {
    if (node.id !== parsed.id || node.type !== "text") {
      return node
    }

    let text = node.text
    let nodeAppliedCount = 0
    for (const range of ranges) {
      if (!isValidReplacementRange(text, range.start, range.end)) {
        continue
      }

      text = `${text.slice(0, range.start)}${range.text}${text.slice(range.end)}`
      nodeAppliedCount += 1
    }

    appliedCount += nodeAppliedCount
    return nodeAppliedCount > 0 ? { ...node, text } : node
  })

  return {
    appliedCount,
    document: appliedCount > 0 ? { ...options.document, nodes } : options.document,
  }
}

export function parseCanvasTargetId(targetId: string): { field: CanvasSearchTargetField, id: string, type: CanvasSearchTargetType } | null {
  const [type, id, field] = targetId.split(":")
  if ((type !== "node" && type !== "edge") || !id || !isCanvasSearchTargetField(field)) {
    return null
  }

  return { field, id, type }
}

function isCanvasSearchTargetField(value: string | undefined): value is CanvasSearchTargetField {
  return value === "label" || value === "note" || value === "text"
}

function isValidReplacementRange(text: string, start: number, end: number) {
  return Number.isInteger(start)
    && Number.isInteger(end)
    && start >= 0
    && end >= start
    && end <= text.length
}

function firstLine(text: string) {
  return text.split(/\r?\n/, 1)[0]?.trim() ?? ""
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}

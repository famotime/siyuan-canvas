import type {
  CanvasDocument,
  CanvasEdge,
  CanvasFileNode,
  CanvasNode,
  CanvasTextNode,
} from "@/canvas/types"
import type {
  CanvasPluginSettings,
} from "@/canvas/plugin-data"
import type { ResolvedCanvasFileTarget } from "@/canvas/file-target-resolution"
import type { CanvasPluginBridge } from "@/canvas/use-canvas-editor-shared"
import type { CanvasEditorFileSource } from "@/canvas/use-canvas-editor-shared"
import type { CanvasEditorState } from "@/canvas/editor-state"

import {
  showMessage,
} from "siyuan"
import {
  createDocWithMd,
  getNotebookConf,
  lsNotebooks,
  putFile,
  renderSprig,
  sql,
} from "@/api"
import {
  createCanvasEdge,
  createCanvasNode,
} from "@/canvas/document"
import {
  extractMarkdownHeadingBlocks,
  extractMarkdownHeadingSections,
} from "@/canvas/markdown-preview"
import {
  getSiyuanDocumentMarkdown,
  getSiyuanHeadingBlockMarkdown,
  getSiyuanBlockMarkdown,
  findSiyuanAssetByPath,
} from "@/canvas/siyuan-kernel-file-node-lookups"
import {
  getCanvasFileName,
} from "@/canvas/use-canvas-editor-shared"
import {
  buildWorkspaceImagePath,
} from "@/canvas/workspace-image-files"
import {
  doNodesOverlap,
  findNonOverlappingPosition,
} from "@/canvas/node-overlap"
import {
  escapeSqlString,
} from "@/canvas/siyuan-file-node-lookups"

// ---------------------------------------------------------------------------
// Re-exports for backward compatibility
// ---------------------------------------------------------------------------

export { doNodesOverlap } from "@/canvas/node-overlap"

/**
 * 在已有节点集合中查找不重叠的位置（保留旧签名兼容）。
 * 内部委托给 `findNonOverlappingPosition`。
 */
export function findNonOverlappingNodePosition(
  node: CanvasNode,
  existingNodes: CanvasNode[],
  stepY: number,
): { x: number, y: number } {
  const result = findNonOverlappingPosition(
    node.x, node.y, node.width, node.height,
    existingNodes, stepY,
  )
  node.x = result.x
  node.y = result.y
  return result
}

export function topologicalSortSelectedNodes(selectedIds: string[], edges: CanvasEdge[]): string[] {
  const selectedSet = new Set(selectedIds)
  const adjacency = new Map<string, string[]>()
  const incomingCount = new Map<string, number>()
  for (const id of selectedIds) {
    adjacency.set(id, [])
    incomingCount.set(id, 0)
  }
  for (const edge of edges) {
    if (selectedSet.has(edge.fromNode) && selectedSet.has(edge.toNode)) {
      adjacency.get(edge.fromNode)!.push(edge.toNode)
      incomingCount.set(edge.toNode, (incomingCount.get(edge.toNode) || 0) + 1)
    }
  }
  const queue: string[] = []
  for (const id of selectedIds) {
    if ((incomingCount.get(id) || 0) === 0) queue.push(id)
  }
  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)
    for (const neighbor of adjacency.get(current) || []) {
      const count = (incomingCount.get(neighbor) || 1) - 1
      incomingCount.set(neighbor, count)
      if (count === 0) queue.push(neighbor)
    }
  }
  for (const id of selectedIds) {
    if (!sorted.includes(id)) sorted.push(id)
  }
  return sorted
}

export function buildMergedMarkdown(nodes: CanvasTextNode[]): string {
  const parts: string[] = []
  let headingIndex = 0
  for (const node of nodes) {
    const text = node.text.trim()
    if (!text) continue
    const lines = text.split('\n')
    const headingLevel = headingIndex === 0 ? 1 : Math.min(headingIndex + 1, 6)
    const headingPrefix = '#'.repeat(headingLevel)
    parts.push(`${headingPrefix} ${lines[0]}`)
    if (lines.length > 1) {
      parts.push(lines.slice(1).join('\n'))
    }
    parts.push('')
    headingIndex++
  }
  return parts.join('\n')
}

export function extractDocumentTitle(node: CanvasTextNode, fallbackLabel: string): string {
  const firstLine = node.text.split('\n')[0]?.trim() || ''
  return firstLine || fallbackLabel
}

export function stripKramdownBlockIds(markdown: string): string {
  return markdown
    .replace(/\{:[^}]*\}/g, '')
    .replace(/\s*\n{3,}/g, '\n\n')
    .trim()
}

export function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
}

export async function readWorkspaceFileBlob(path: string): Promise<Blob> {
  const response = await fetch('/api/file/getFile', {
    body: JSON.stringify({ path }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Unable to read workspace file: ${path}`)
  }

  return response.blob()
}

export function getImageFileName(resolved: Extract<ResolvedCanvasFileTarget, { kind: 'image' }>): string {
  const source = resolved.path || resolved.openPath || resolved.title
  return getCanvasFileName(source) || getCanvasFileName(resolved.openPath) || 'image.png'
}

// ---------------------------------------------------------------------------
// Factory — impure functions that need injected dependencies
// ---------------------------------------------------------------------------

export interface SelectionExportDependencies {
  state: CanvasEditorState & { document: CanvasDocument, filePath: string }
  commitDocument: (doc: CanvasDocument) => void
  refreshFileNodeMetadata: (ids: string[]) => Promise<void>
  getResolvedFileNode: (node: CanvasFileNode) => ResolvedCanvasFileTarget
  getPluginSettings: () => CanvasPluginSettings
  fileSource: { value: CanvasEditorFileSource }
  t: (key: string, params?: Record<string, unknown>) => string
}

export function createCanvasEditorSelectionExport(deps: SelectionExportDependencies) {
  const { state, commitDocument, refreshFileNodeMetadata, getResolvedFileNode, getPluginSettings, fileSource, t } = deps

  async function findHeadingBlockIds(documentId: string, expectedCount: number): Promise<string[]> {
    const blocks = await sql(
      `SELECT id FROM blocks WHERE root_id = '${escapeSqlString(documentId)}' AND type = 'h' ORDER BY sort ASC`,
    )
    if (blocks && blocks.length >= expectedCount) {
      return blocks.slice(0, expectedCount).map((b: { id: string }) => b.id)
    }
    return (blocks || []).map((b: { id: string }) => b.id)
  }

  async function resolveNoteCreationDirectory(): Promise<{ notebook: string, parentPath: string } | null> {
    const settings = getPluginSettings()
    const notebooks = await lsNotebooks()
    const notebook = notebooks?.notebooks?.find((n: { closed: boolean }) => !n.closed)
    if (!notebook) return null

    if (settings.noteCreationDirectory) {
      const normalized = settings.noteCreationDirectory.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
      return { notebook: notebook.id, parentPath: normalized || '/' }
    }

    const conf = await getNotebookConf(notebook.id)
    const dailyNotePath = conf?.conf?.dailyNoteSavePath
    if (!dailyNotePath) return { notebook: notebook.id, parentPath: '/' }

    const resolved = await renderSprig(dailyNotePath)
    const segments = resolved.replace(/\\/g, '/').replace(/\/+/g, '/').split('/').filter(Boolean)
    segments.pop()
    return { notebook: notebook.id, parentPath: '/' + segments.join('/') }
  }

  async function copyImageTargetToWorkspaceCanvasAssets(
    resolved: Extract<ResolvedCanvasFileTarget, { kind: 'image' }>,
  ): Promise<string | null> {
    if (fileSource.value !== 'workspace' || !state.filePath.endsWith('.canvas')) {
      return null
    }

    const sourcePath = resolved.openPath || resolved.path
    if (!sourcePath) {
      return null
    }

    const file = await readWorkspaceFileBlob(sourcePath)
    const targetPath = buildWorkspaceImagePath(state.filePath, getImageFileName(resolved))
    await putFile(targetPath, false, file)
    return targetPath
  }

  async function fetchFileNodeContent(node: CanvasFileNode): Promise<string> {
    let resolved = getResolvedFileNode(node)
    if (resolved.kind !== 'image') {
      const image = await findSiyuanAssetByPath(node.file)
      if (image) {
        resolved = {
          blockId: image.blockId,
          kind: 'image',
          openPath: image.openPath,
          path: image.path,
          title: image.title || image.name,
        }
      }
    }

    switch (resolved.kind) {
      case 'document': {
        const raw = await getSiyuanDocumentMarkdown(resolved.id)
        return stripKramdownBlockIds(raw)
      }
      case 'block': {
        if (resolved.type === 'h') {
          const raw = await getSiyuanHeadingBlockMarkdown(resolved.id)
          return stripKramdownBlockIds(raw)
        }
        const raw = await getSiyuanBlockMarkdown(resolved.id)
        return stripKramdownBlockIds(raw)
      }
      case 'image': {
        const imageSrc = await copyImageTargetToWorkspaceCanvasAssets(resolved)
          || resolved.openPath
          || resolved.path
        return `![${escapeMarkdownImageAlt(resolved.title || '')}](${imageSrc})`
      }
      default:
        return resolved.title || node.file
    }
  }

  async function decomposeSelectedDocument(
    selectedNode: CanvasNode | undefined,
    canDecompose: boolean,
  ) {
    if (!canDecompose || !selectedNode) {
      return
    }

    const sourceNode = selectedNode
    const sourceNodeId = sourceNode.id
    const decomposedHeadings: Array<{ file?: string, level: number, text?: string }> = []
    if (sourceNode.type === 'file') {
      const resolved = getResolvedFileNode(sourceNode)
      if (resolved.kind !== 'document') {
        return
      }

      const markdown = await getSiyuanDocumentMarkdown(resolved.id)
      decomposedHeadings.push(
        ...extractMarkdownHeadingBlocks(markdown)
          .filter((heading) => heading.id !== resolved.id)
          .map((heading) => ({
            file: heading.id,
            level: heading.level,
          })),
      )
    } else if (sourceNode.type === 'text') {
      const sections = extractMarkdownHeadingSections(sourceNode.text)
      if (sections.length > 1) {
        decomposedHeadings.push(
          ...sections.map((section) => ({
            level: section.level,
            text: section.text,
          })),
        )
      }
    }

    if (!decomposedHeadings.length) {
      showMessage(t('messageNoValidChapterInfo'), 4000, 'warning')
      return
    }

    const minLevel = Math.min(...decomposedHeadings.map((heading) => heading.level))
    const headingNodes: CanvasNode[] = []
    const parentById = new Map<string, string>()
    const stack: Array<{ id: string, level: number }> = [{
      id: sourceNodeId,
      level: minLevel - 1,
    }]
    const columnCounts = new Map<number, number>()
    const existingNodes = [...state.document.nodes]
    const horizontalGap = 120
    const verticalGap = 40

    for (const heading of decomposedHeadings) {
      while (stack.length > 0 && stack[stack.length - 1]!.level >= heading.level) {
        stack.pop()
      }

      const parent = stack[stack.length - 1] ?? { id: sourceNodeId, level: minLevel - 1 }
      const depth = Math.max(1, heading.level - minLevel + 1)
      const row = columnCounts.get(depth) ?? 0
      columnCounts.set(depth, row + 1)

      const node = createCanvasNode(sourceNode.type)
      if (node.type === 'file') {
        node.file = heading.file || ''
      } else if (node.type === 'text') {
        node.text = heading.text || ''
      }
      node.x = sourceNode.x + depth * (sourceNode.width + horizontalGap)
      node.y = sourceNode.y + row * (node.height + verticalGap)
      const position = findNonOverlappingNodePosition(node, existingNodes, node.height + verticalGap)
      node.x = position.x
      node.y = position.y

      headingNodes.push(node)
      parentById.set(node.id, parent.id)
      existingNodes.push(node)
      stack.push({
        id: node.id,
        level: heading.level,
      })
    }

    const headingEdges = headingNodes.map((node) => {
      const edge = createCanvasEdge(parentById.get(node.id) || sourceNodeId, node.id)
      edge.fromSide = 'right'
      edge.toSide = 'left'
      return edge
    })

    commitDocument({
      ...state.document,
      edges: [...state.document.edges, ...headingEdges],
      nodes: [...state.document.nodes, ...headingNodes],
    })
    state.selectNode(sourceNodeId)
    if (sourceNode.type === 'file') {
      await refreshFileNodeMetadata(headingNodes.map((node) => node.id))
    }
  }

  async function convertSelectionToDocument(selectedNodeIds: string[]) {
    const allTextNodes = selectedNodeIds
      .map(id => state.document.nodes.find(n => n.id === id))
      .filter((n): n is CanvasTextNode => n?.type === 'text')

    if (allTextNodes.length === 0) return

    const dir = await resolveNoteCreationDirectory()
    if (!dir) {
      showMessage(t('messageNoNotebookAvailable'), 4000, 'warning')
      return
    }

    try {
      const orderedIds = selectedNodeIds.length === 1
        ? selectedNodeIds
        : topologicalSortSelectedNodes(selectedNodeIds, state.document.edges)

      const orderedNodes = orderedIds
        .map(id => allTextNodes.find(n => n.id === id))
        .filter((n): n is CanvasTextNode => Boolean(n))

      if (orderedNodes.length === 0) return

      const firstNonEmpty = orderedNodes.find(n => n.text.trim())
      if (!firstNonEmpty) return

      const title = extractDocumentTitle(firstNonEmpty, t('nodeKindText'))
      const markdown = buildMergedMarkdown(orderedNodes)
      const docPath = dir.parentPath === '/' ? `/${title}` : `${dir.parentPath}/${title}`
      const documentId = await createDocWithMd(dir.notebook, docPath, markdown)

      const replacementNodes: Array<{ id: string, node: CanvasFileNode }> = []

      if (orderedNodes.length === 1) {
        const source = orderedNodes[0]
        replacementNodes.push({
          id: source.id,
          node: {
            id: source.id,
            type: 'file',
            file: documentId,
            x: source.x,
            y: source.y,
            width: source.width,
            height: source.height,
            color: source.color,
          },
        })
      } else {
        const nonEmptyCount = orderedNodes.filter(n => n.text.trim()).length
        const headingCount = Math.max(0, nonEmptyCount - 1)
        const headingBlockIds = headingCount > 0
          ? await findHeadingBlockIds(documentId, headingCount)
          : []
        let headingIndex = 0

        for (let i = 0; i < orderedNodes.length; i++) {
          const source = orderedNodes[i]
          let fileId = documentId
          if (i > 0 && source.text.trim()) {
            fileId = headingBlockIds[headingIndex] || documentId
            headingIndex++
          }
          const fileNode: CanvasFileNode = {
            id: source.id,
            type: 'file',
            file: fileId,
            x: source.x,
            y: source.y,
            width: source.width,
            height: source.height,
            color: source.color,
          }
          replacementNodes.push({ id: source.id, node: fileNode })
        }
      }

      const replacementMap = new Map(replacementNodes.map(r => [r.id, r.node]))
      const updatedNodes = state.document.nodes.map(node =>
        replacementMap.get(node.id) ?? node,
      )

      commitDocument({
        ...state.document,
        nodes: updatedNodes,
      })

      await refreshFileNodeMetadata(replacementNodes.map(r => r.id))

      showMessage(t('messageConvertToDocumentSuccess', { title }), 3000)
    } catch (err) {
      console.error('[siyuan-canvas] convertSelectionToDocument failed:', err)
      showMessage(t('messageConvertToDocumentFailed'), 4000, 'error')
    }
  }

  async function convertSelectionToText(selectedNodeIds: string[]) {
    const fileNodes = selectedNodeIds
      .map(id => state.document.nodes.find(n => n.id === id))
      .filter((n): n is CanvasFileNode => n?.type === 'file')

    if (fileNodes.length === 0) return

    try {
      const replacementEntries = await Promise.all(fileNodes.map(async (node) => {
        const content = await fetchFileNodeContent(node)
        const textNode: CanvasTextNode = {
          id: node.id,
          type: 'text',
          text: content,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          color: node.color,
        }
        return { id: node.id, node: textNode as CanvasNode }
      }))

      const replacementMap = new Map(replacementEntries.map(r => [r.id, r.node]))
      const updatedNodes = state.document.nodes.map(node =>
        replacementMap.get(node.id) ?? node,
      )

      commitDocument({
        ...state.document,
        nodes: updatedNodes,
      })

      showMessage(t('messageConvertToTextSuccess'), 3000)
    } catch (err) {
      console.error('[siyuan-canvas] convertSelectionToText failed:', err)
      showMessage(t('messageConvertToTextFailed'), 4000, 'error')
    }
  }

  return {
    decomposeSelectedDocument,
    convertSelectionToDocument,
    convertSelectionToText,
    findHeadingBlockIds,
    resolveNoteCreationDirectory,
    fetchFileNodeContent,
  }
}
